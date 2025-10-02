import redis from 'redis';
import { logger } from './LoggerService.js';

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.retryAttempts = 0;
    this.maxRetries = 3;
    this.useMemoryFallback = false;
    this.memoryCache = new Map();
    this.memoryTTL = new Map();
    this.defaultTTL = parseInt(process.env.CACHE_TTL) || 3600; // 1 hora
    this.keyPrefix = process.env.CACHE_PREFIX || 'mymoney:';
    this.init();
  }

  async init() {
    try {
      await this.connect();
    } catch (error) {
      logger.error('Failed to initialize Redis cache', error);
      this.enableMemoryFallback();
    }
  }

  async connect() {
    try {
      if (this.isConnected || this.useMemoryFallback) return;

      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = redis.createClient({
        url: redisUrl,
        password: process.env.REDIS_PASSWORD,
        socket: {
          connectTimeout: 5000,
          lazyConnect: true,
          reconnectStrategy: (retries) => {
            if (retries > this.maxRetries) {
              logger.error('Max Redis reconnection attempts reached');
              return false;
            }
            return Math.min(retries * 50, 500);
          }
        }
      });

      this.client.on('error', (err) => {
        logger.error('Redis Client Error:', err);
        this.isConnected = false;
        this.enableMemoryFallback();
      });

      this.client.on('connect', () => {
        logger.info('Redis connected successfully');
        this.isConnected = true;
        this.useMemoryFallback = false;
        this.retryAttempts = 0;
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis reconnecting...');
        this.retryAttempts++;
      });

      await this.client.connect();
      
    } catch (error) {
      logger.error('Failed to connect to Redis, using memory fallback:', error);
      this.enableMemoryFallback();
    }
  }

  enableMemoryFallback() {
    this.useMemoryFallback = true;
    this.isConnected = false;
    logger.warn('Using memory cache fallback - data will not persist between restarts');
    
    // Limpar cache em memória periodicamente
    setInterval(() => {
      this.cleanExpiredMemoryCache();
    }, 60000); // A cada minuto
  }

  cleanExpiredMemoryCache() {
    const now = Date.now();
    for (const [key, expireTime] of this.memoryTTL.entries()) {
      if (expireTime && expireTime < now) {
        this.memoryCache.delete(key);
        this.memoryTTL.delete(key);
      }
    }
  }

  // Gerar chave com prefix
  generateKey(key) {
    return `${this.keyPrefix}${key}`;
  }

  // Verificar se o cache está disponível
  isAvailable() {
    return this.isConnected && this.client;
  }

  // Obter valor do cache
  async get(key) {
    try {
      const fullKey = this.generateKey(key);

      if (this.useMemoryFallback) {
        // Verificar se a chave expirou
        const expireTime = this.memoryTTL.get(fullKey);
        if (expireTime && expireTime < Date.now()) {
          this.memoryCache.delete(fullKey);
          this.memoryTTL.delete(fullKey);
          logger.debug('Memory cache miss (expired)', { key: fullKey });
          return null;
        }

        const value = this.memoryCache.get(fullKey);
        if (value === undefined) {
          logger.debug('Memory cache miss', { key: fullKey });
          return null;
        }

        logger.debug('Memory cache hit', { key: fullKey });
        return value;
      }

      if (!this.isConnected) {
        await this.connect();
      }

      if (!this.isConnected) {
        logger.debug('Cache not available', { key: fullKey });
        return null;
      }

      const value = await this.client.get(fullKey);
      
      if (value === null) {
        logger.debug('Redis cache miss', { key: fullKey });
        return null;
      }

      logger.debug('Redis cache hit', { key: fullKey });
      return JSON.parse(value);
    } catch (error) {
      logger.error('Cache get error', error, { key });
      return null;
    }
  }

  // Definir valor no cache
  async set(key, value, ttl = null) {
    try {
      const fullKey = this.generateKey(key);
      const expiration = ttl || this.defaultTTL;

      if (this.useMemoryFallback) {
        this.memoryCache.set(fullKey, value);
        if (expiration > 0) {
          this.memoryTTL.set(fullKey, Date.now() + (expiration * 1000));
        }
        logger.debug('Memory cache set', { key: fullKey, ttl: expiration });
        return true;
      }

      if (!this.isConnected) {
        await this.connect();
      }

      if (!this.isConnected) {
        // Fallback para memória se Redis falhar
        this.enableMemoryFallback();
        return this.set(key, value, ttl);
      }

      const serializedValue = JSON.stringify(value);
      await this.client.setEx(fullKey, expiration, serializedValue);
      
      logger.debug('Redis cache set', { key: fullKey, ttl: expiration });
      return true;
    } catch (error) {
      logger.error('Failed to set cache key', error, { key });
      // Fallback para memória em caso de erro
      this.enableMemoryFallback();
      return this.set(key, value, ttl);
    }
  }

  // Deletar valor do cache
  async del(key) {
    try {
      const fullKey = this.generateKey(key);

      if (this.useMemoryFallback) {
        const existed = this.memoryCache.has(fullKey);
        this.memoryCache.delete(fullKey);
        this.memoryTTL.delete(fullKey);
        logger.debug('Memory cache delete', { key: fullKey, deleted: existed });
        return existed;
      }

      if (!this.isConnected) {
        await this.connect();
      }

      if (!this.isConnected) {
        return false;
      }

      const result = await this.client.del(fullKey);
      logger.debug('Redis cache delete', { key: fullKey, deleted: result > 0 });
      return result > 0;
    } catch (error) {
      logger.error('Cache delete error', error, { key });
      return false;
    }
  }

  // Deletar múltiplas chaves por padrão
  async delPattern(pattern) {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      const fullPattern = this.generateKey(pattern);
      const keys = await this.client.keys(fullPattern);
      
      if (keys.length > 0) {
        const result = await this.client.del(keys);
        logger.debug('Cache pattern delete', { pattern: fullPattern, deleted: result });
        return result;
      }
      
      return 0;
    } catch (error) {
      logger.error('Cache pattern delete error', error, { pattern });
      return 0;
    }
  }

  // Verificar se chave existe
  async exists(key) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const fullKey = this.generateKey(key);
      const result = await this.client.exists(fullKey);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error', error, { key });
      return false;
    }
  }

  // Incrementar valor numérico
  async incr(key, amount = 1) {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const fullKey = this.generateKey(key);
      const result = await this.client.incrBy(fullKey, amount);
      logger.debug('Cache increment', { key: fullKey, amount, result });
      return result;
    } catch (error) {
      logger.error('Cache increment error', error, { key });
      return null;
    }
  }

  // Definir TTL para chave existente
  async expire(key, ttl) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const fullKey = this.generateKey(key);
      const result = await this.client.expire(fullKey, ttl);
      return result === 1;
    } catch (error) {
      logger.error('Cache expire error', error, { key });
      return false;
    }
  }

  // Cache específico para sessões de usuário
  async setUserSession(userId, sessionData, ttl = 86400) { // 24 horas
    const key = `session:${userId}`;
    return await this.set(key, sessionData, ttl);
  }

  async getUserSession(userId) {
    const key = `session:${userId}`;
    return await this.get(key);
  }

  async deleteUserSession(userId) {
    const key = `session:${userId}`;
    return await this.del(key);
  }

  // Cache para dados financeiros
  async setUserData(userId, dataType, data, ttl = 1800) { // 30 minutos
    const key = `user:${userId}:${dataType}`;
    return await this.set(key, data, ttl);
  }

  async getUserData(userId, dataType) {
    const key = `user:${userId}:${dataType}`;
    return await this.get(key);
  }

  async invalidateUserData(userId, dataType = '*') {
    const pattern = `user:${userId}:${dataType}`;
    return await this.delPattern(pattern);
  }

  // Cache para estatísticas
  async setStats(key, stats, ttl = 3600) { // 1 hora
    const cacheKey = `stats:${key}`;
    return await this.set(cacheKey, stats, ttl);
  }

  async getStats(key) {
    const cacheKey = `stats:${key}`;
    return await this.get(cacheKey);
  }

  // Rate limiting usando Redis
  async checkRateLimit(identifier, limit, window) {
    if (!this.isAvailable()) {
      return { allowed: true, remaining: limit };
    }

    try {
      const key = `ratelimit:${identifier}`;
      const current = await this.incr(key);
      
      if (current === 1) {
        await this.expire(key, window);
      }

      const allowed = current <= limit;
      const remaining = Math.max(0, limit - current);

      return { allowed, remaining, current };
    } catch (error) {
      logger.error('Rate limit check error', error, { identifier });
      return { allowed: true, remaining: limit };
    }
  }

  // Obter informações do cache
  async getInfo() {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const info = await this.client.info();
      const dbSize = await this.client.dbSize();
      
      return {
        connected: this.isConnected,
        dbSize,
        info: info.split('\r\n').reduce((acc, line) => {
          const [key, value] = line.split(':');
          if (key && value) {
            acc[key] = value;
          }
          return acc;
        }, {})
      };
    } catch (error) {
      logger.error('Cache info error', error);
      return null;
    }
  }

  // Limpar todo o cache
  async flush() {
    try {
      if (this.useMemoryFallback) {
        this.memoryCache.clear();
        this.memoryTTL.clear();
        logger.info('Memory cache flushed successfully');
        return true;
      }

      if (!this.isConnected) {
        await this.connect();
      }

      if (!this.isConnected) {
        return false;
      }

      await this.client.flushDb();
      logger.info('Redis cache flushed successfully');
      return true;
    } catch (error) {
      logger.error('Cache flush error', error);
      return false;
    }
  }

  // Fechar conexão
  async close() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis connection closed');
    }
  }

  // Middleware para cache de responses
  cacheMiddleware(ttl = 300) { // 5 minutos
    return async (req, res, next) => {
      if (!this.isAvailable() || req.method !== 'GET') {
        return next();
      }

      const cacheKey = `response:${req.originalUrl}:${req.user?.userId || 'anonymous'}`;
      
      try {
        const cachedResponse = await this.get(cacheKey);
        
        if (cachedResponse) {
          logger.debug('Serving cached response', { url: req.originalUrl });
          return res.json(cachedResponse);
        }

        // Interceptar response
        const originalSend = res.json;
        res.json = (data) => {
          if (res.statusCode === 200) {
            this.set(cacheKey, data, ttl);
          }
          originalSend.call(res, data);
        };

        next();
      } catch (error) {
        logger.error('Cache middleware error', error);
        next();
      }
    };
  }
}

// Singleton instance
const cacheService = new CacheService();

export { CacheService, cacheService as cache };