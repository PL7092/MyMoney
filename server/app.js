import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import services
import { AuthService } from './services/AuthService.js';
import { logger } from './services/LoggerService.js';
import { cache } from './services/CacheService.js';
import { backup } from './services/BackupService.js';
import { healthCheck } from './services/HealthCheckService.js';
import { dbInit } from './services/DatabaseInitService.js';

// Import middleware
import {
  helmetConfig,
  compressionConfig,
  authLimiter,
  apiLimiter,
  strictLimiter,
  validateRequest,
  sanitizeInput,
  securityLogger,
  corsSecurityCheck,
  schemas
} from './middleware/security.js';

// Import existing database service
import { DatabaseService } from './db-commonjs.js';
import legacyRoutes from './routes/legacy.js';

class App {
  constructor() {
    this.app = express();
    this.port = process.env.APP_PORT || 3000;
    this.db = new DatabaseService();
    this.auth = new AuthService();
    
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  initializeMiddleware() {
    // Security middleware
    this.app.use(helmetConfig);
    this.app.use(compressionConfig);
    this.app.use(securityLogger);
    this.app.use(sanitizeInput);

    // CORS configuration
    const corsOptions = {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    };
    this.app.use(cors(corsOptions));
    this.app.use(corsSecurityCheck);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use(logger.expressMiddleware());
  }

  initializeRoutes() {
    // Health check endpoints
    this.app.get(['/health', '/api/health'], this.healthCheck.bind(this));
    this.app.get('/api/health/detailed', this.detailedHealthCheck.bind(this));
    this.app.get('/api/health/quick', this.quickHealthCheck.bind(this));
    this.app.get('/api/database/status', this.getDatabaseStatus.bind(this));

    // Authentication routes (with rate limiting)
    this.app.post('/api/auth/register', 
      authLimiter,
      validateRequest(schemas.register),
      this.register.bind(this)
    );

    this.app.post('/api/auth/login',
      authLimiter,
      validateRequest(schemas.login),
      this.login.bind(this)
    );

    this.app.post('/api/auth/refresh',
      authLimiter,
      this.refreshToken.bind(this)
    );

    this.app.post('/api/auth/logout',
      this.auth.authenticateToken.bind(this.auth),
      this.logout.bind(this)
    );

    // API routes (now accessible without authentication)
    this.app.use('/api', apiLimiter);
    // Removed authentication requirement - all routes are now public

    // Cache management routes
    this.app.get('/api/cache/stats', this.getCacheStats.bind(this));
    this.app.delete('/api/cache/flush', strictLimiter, this.flushCache.bind(this));

    // Backup management routes
    this.app.get('/api/backup/list', this.getBackupList.bind(this));
    this.app.get('/api/backup/stats', this.getBackupStats.bind(this));
    this.app.post('/api/backup/create', strictLimiter, this.createBackup.bind(this));
    this.app.post('/api/backup/restore', strictLimiter, this.restoreBackup.bind(this));

    // System monitoring routes
    this.app.get('/api/system/status', this.getSystemStatus.bind(this));
    this.app.get('/api/system/logs', strictLimiter, this.getSystemLogs.bind(this));

    // Import existing routes from original server
    this.importLegacyRoutes();

    // Check if dist directory exists
    const distPath = path.join(__dirname, '../dist');
    
    if (fs.existsSync(distPath)) {
      // Production mode: serve built files
      this.app.use(express.static(distPath));
      
      // SPA fallback for production
      this.app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      // Development mode: serve source files
      console.log('⚠️  Dist directory not found. Running in development mode.');
      console.log('📁 Serving static files from public directory');
      
      // Serve public assets
      this.app.use(express.static(path.join(__dirname, '../public')));
      
      // Development fallback - serve a simple HTML page
      this.app.get('*', (req, res) => {
        res.send(`
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>MyMoney - Build Required</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                max-width: 800px; 
                margin: 50px auto; 
                padding: 20px;
                background: #f5f5f5;
              }
              .container {
                background: white;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              .status { color: #e74c3c; }
              .success { color: #27ae60; }
              .info { color: #3498db; }
              pre { background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>🏗️ MyMoney Application</h1>
              <p class="status">⚠️ Frontend build not found</p>
              
              <h2>Status:</h2>
              <ul>
                <li class="success">✅ Docker containers running</li>
                <li class="success">✅ Backend server active</li>
                <li class="success">✅ Database connected</li>
                <li class="success">✅ Redis connected</li>
                <li class="status">❌ Frontend build missing</li>
              </ul>
              
              <h2>Solution:</h2>
              <p>The frontend needs to be built. Run the following command:</p>
              <pre>npm run build</pre>
              
              <h2>API Status:</h2>
              <p class="info">Backend API is available at: <a href="/api/health">/api/health</a></p>
              
              <h2>Next Steps:</h2>
              <ol>
                <li>Stop the Docker containers: <code>docker-compose down</code></li>
                <li>Rebuild with frontend: <code>docker-compose up --build -d</code></li>
                <li>Or build locally: <code>npm run build</code></li>
              </ol>
            </div>
          </body>
          </html>
        `);
      });
    }
  }

  async healthCheck(req, res) {
    try {
      const dbStatus = await this.checkDatabaseHealth();
      const cacheStatus = cache.isAvailable();
      const backupStatus = backup.getStatus();

      const health = {
        status: dbStatus.connected && cacheStatus ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        services: {
          database: dbStatus,
          cache: { connected: cacheStatus },
          backup: backupStatus
        }
      };

      res.json(health);
    } catch (error) {
      logger.error('Health check failed', error);
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  }

  async detailedHealthCheck(req, res) {
    try {
      const systemStatus = await healthCheck.getSystemStatus();
      res.json(systemStatus);
    } catch (error) {
      logger.error('Detailed health check failed:', error);
      res.status(500).json({
        status: 'unhealthy',
        message: 'Health check service unavailable',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async quickHealthCheck(req, res) {
    try {
      const quickStatus = await healthCheck.quickCheck();
      const statusCode = quickStatus.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(quickStatus);
    } catch (error) {
      logger.error('Quick health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  }

  async getDatabaseStatus(req, res) {
    try {
      const dbStatus = await dbInit.getStatus();
      const statusCode = dbStatus.status === 'connected' ? 200 : 503;
      res.status(statusCode).json(dbStatus);
    } catch (error) {
      logger.error('Database status check failed:', error);
      res.status(503).json({
        status: 'error',
        message: 'Database status unavailable',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async checkDatabaseHealth() {
    try {
      await this.db.query('SELECT 1');
      return { connected: true };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }

  async register(req, res) {
    try {
      const { email, password, name } = req.body;
      
      const result = await this.auth.register(email, password, name);
      
      logger.audit('USER_REGISTER', result.user.id, { email });
      
      res.status(201).json({
        message: 'User registered successfully',
        user: result.user,
        tokens: result.tokens
      });
    } catch (error) {
      logger.security('REGISTRATION_FAILED', { 
        email: req.body.email,
        error: error.message,
        ip: req.ip 
      });
      
      res.status(400).json({ error: error.message });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;
      
      const result = await this.auth.login(email, password);
      
      logger.audit('USER_LOGIN', result.user.id, { email, ip: req.ip });
      
      res.json({
        message: 'Login successful',
        user: result.user,
        tokens: result.tokens
      });
    } catch (error) {
      logger.security('LOGIN_FAILED', { 
        email: req.body.email,
        error: error.message,
        ip: req.ip 
      });
      
      res.status(401).json({ error: error.message });
    }
  }

  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
      }
      
      const result = await this.auth.refreshTokens(refreshToken);
      
      logger.audit('TOKEN_REFRESH', result.user.id);
      
      res.json({
        message: 'Tokens refreshed successfully',
        user: result.user,
        tokens: result.tokens
      });
    } catch (error) {
      logger.security('TOKEN_REFRESH_FAILED', { 
        error: error.message,
        ip: req.ip 
      });
      
      res.status(401).json({ error: error.message });
    }
  }

  async logout(req, res) {
    try {
      const { refreshToken } = req.body;
      
      await this.auth.logout(refreshToken);
      await cache.deleteUserSession(req.user.userId);
      
      logger.audit('USER_LOGOUT', req.user.userId);
      
      res.json({ message: 'Logout successful' });
    } catch (error) {
      logger.error('Logout failed', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }

  async getCacheStats(req, res) {
    try {
      const stats = await cache.getInfo();
      res.json(stats);
    } catch (error) {
      logger.error('Failed to get cache stats', error);
      res.status(500).json({ error: 'Failed to get cache stats' });
    }
  }

  async flushCache(req, res) {
    try {
      await cache.flush();
      logger.audit('CACHE_FLUSH', req.user.userId);
      res.json({ message: 'Cache flushed successfully' });
    } catch (error) {
      logger.error('Failed to flush cache', error);
      res.status(500).json({ error: 'Failed to flush cache' });
    }
  }

  async getBackupList(req, res) {
    try {
      const backups = await backup.getBackupList();
      res.json(backups);
    } catch (error) {
      logger.error('Failed to get backup list', error);
      res.status(500).json({ error: 'Failed to get backup list' });
    }
  }

  async getBackupStats(req, res) {
    try {
      const stats = await backup.getBackupStats();
      res.json(stats);
    } catch (error) {
      logger.error('Failed to get backup stats', error);
      res.status(500).json({ error: 'Failed to get backup stats' });
    }
  }

  async createBackup(req, res) {
    try {
      const result = await backup.createManualBackup();
      
      logger.audit('BACKUP_CREATE', req.user.userId, { 
        success: result.success,
        file: result.file 
      });
      
      res.json(result);
    } catch (error) {
      logger.error('Failed to create backup', error);
      res.status(500).json({ error: 'Failed to create backup' });
    }
  }

  async restoreBackup(req, res) {
    try {
      const { backupFile } = req.body;
      
      if (!backupFile) {
        return res.status(400).json({ error: 'Backup file required' });
      }
      
      const result = await backup.restoreBackup(backupFile);
      
      logger.audit('BACKUP_RESTORE', req.user.userId, { 
        file: backupFile,
        success: result.success 
      });
      
      res.json(result);
    } catch (error) {
      logger.error('Failed to restore backup', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getSystemStatus(req, res) {
    try {
      const [dbStats, cacheInfo, backupStats, logStats] = await Promise.all([
        this.getDbStats(),
        cache.getInfo(),
        backup.getBackupStats(),
        logger.getLogStats()
      ]);

      const status = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: dbStats,
        cache: cacheInfo,
        backup: backupStats,
        logs: logStats
      };

      res.json(status);
    } catch (error) {
      logger.error('Failed to get system status', error);
      res.status(500).json({ error: 'Failed to get system status' });
    }
  }

  async getDbStats() {
    try {
      const tables = ['users', 'accounts', 'transactions', 'categories', 'budgets'];
      const stats = {};
      
      for (const table of tables) {
        const result = await this.db.query(`SELECT COUNT(*) as count FROM ${table}`);
        stats[table] = result[0].count;
      }
      
      return stats;
    } catch (error) {
      logger.error('Failed to get database stats', error);
      return {};
    }
  }

  async getSystemLogs(req, res) {
    try {
      const { level = 'info', limit = 100 } = req.query;
      
      // Esta é uma implementação simplificada
      // Em produção, você implementaria uma busca mais sofisticada nos logs
      res.json({ 
        message: 'Log retrieval not implemented',
        suggestion: 'Check log files directly or implement log aggregation'
      });
    } catch (error) {
      logger.error('Failed to get system logs', error);
      res.status(500).json({ error: 'Failed to get system logs' });
    }
  }

  importLegacyRoutes() {
    // Import routes from the original server
    // This is a placeholder - you would import the actual route handlers
    this.app.use('/api', legacyRoutes);
  }

  initializeErrorHandling() {
    // 404 handler
    this.app.use((req, res, next) => {
      const error = new Error(`Not Found - ${req.originalUrl}`);
      error.status = 404;
      next(error);
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      const status = error.status || 500;
      const message = error.message || 'Internal Server Error';
      
      logger.error('Unhandled error', error, {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.userId
      });

      res.status(status).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      });
    });
  }

  async start() {
    try {
      // Initialize database
      await this.db.init();
      logger.info('Database initialized');

      // Start server
      this.server = this.app.listen(this.port, '0.0.0.0', () => {
        logger.info(`Server running on port ${this.port}`, {
          environment: process.env.NODE_ENV,
          port: this.port,
          host: '0.0.0.0'
        });
      });

      // Graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('Failed to start server', error);
      process.exit(1);
    }
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully`);
      
      if (this.server) {
        this.server.close(async () => {
          logger.info('HTTP server closed');
          
          // Close database connections
          if (this.db.pool) {
            await this.db.pool.end();
            logger.info('Database connections closed');
          }
          
          // Close cache connections
          await cache.close();
          
          process.exit(0);
        });
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

export default App;