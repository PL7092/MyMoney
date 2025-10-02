import { logger } from './LoggerService.js';
import { cache } from './CacheService.js';
import { DatabaseService } from '../db-commonjs.js';
import fs from 'fs';
import path from 'path';

class HealthCheckService {
  constructor() {
    this.checks = new Map();
    this.lastResults = new Map();
    this.checkInterval = parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000; // 30 segundos
    this.isRunning = false;
    this.db = new DatabaseService();
  }

  // Registrar uma verificação de saúde
  registerCheck(name, checkFunction, options = {}) {
    this.checks.set(name, {
      fn: checkFunction,
      timeout: options.timeout || 5000,
      critical: options.critical || false,
      description: options.description || name
    });
  }

  // Inicializar verificações padrão
  async init() {
    // Verificação do banco de dados
    this.registerCheck('database', async () => {
      try {
        if (!this.db.isReady) {
          await this.db.init();
        }
        
        const result = await this.db.query('SELECT 1 as test');
        return {
          status: 'healthy',
          message: 'Database connection successful',
          details: { connected: true, test_query: result.length > 0 }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Database connection failed: ${error.message}`,
          details: { connected: false, error: error.code }
        };
      }
    }, { critical: true, description: 'MariaDB/MySQL Database' });

    // Verificação do cache
    this.registerCheck('cache', async () => {
      try {
        const testKey = 'health_check_test';
        const testValue = Date.now().toString();
        
        await cache.set(testKey, testValue, 10);
        const retrieved = await cache.get(testKey);
        await cache.del(testKey);
        
        const isWorking = retrieved === testValue;
        const cacheType = cache.useMemoryFallback ? 'memory' : 'redis';
        
        return {
          status: isWorking ? 'healthy' : 'degraded',
          message: `Cache (${cacheType}) is ${isWorking ? 'working' : 'not working properly'}`,
          details: { 
            type: cacheType,
            connected: cache.isConnected,
            fallback: cache.useMemoryFallback,
            test_passed: isWorking
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Cache check failed: ${error.message}`,
          details: { error: error.message }
        };
      }
    }, { critical: false, description: 'Cache System (Redis/Memory)' });

    // Verificação de memória
    this.registerCheck('memory', async () => {
      const used = process.memoryUsage();
      const totalMB = Math.round(used.rss / 1024 / 1024);
      const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
      
      const memoryThreshold = parseInt(process.env.MEMORY_THRESHOLD_MB) || 512;
      const isHealthy = totalMB < memoryThreshold;
      
      return {
        status: isHealthy ? 'healthy' : 'warning',
        message: `Memory usage: ${totalMB}MB`,
        details: {
          rss_mb: totalMB,
          heap_used_mb: heapUsedMB,
          heap_total_mb: heapTotalMB,
          threshold_mb: memoryThreshold,
          within_threshold: isHealthy
        }
      };
    }, { critical: false, description: 'Memory Usage' });

    // Verificação de disco (logs e uploads)
    this.registerCheck('disk', async () => {
      
      try {
        const directories = ['logs', 'uploads', 'backups'];
        const results = {};
        
        for (const dir of directories) {
          const dirPath = path.join(process.cwd(), dir);
          try {
            const stats = fs.statSync(dirPath);
            results[dir] = {
              exists: true,
              writable: true // Assumindo que existe = gravável
            };
          } catch (error) {
            results[dir] = {
              exists: false,
              writable: false,
              error: error.code
            };
          }
        }
        
        const allHealthy = Object.values(results).every(r => r.exists && r.writable);
        
        return {
          status: allHealthy ? 'healthy' : 'warning',
          message: `Disk access: ${allHealthy ? 'All directories accessible' : 'Some directories have issues'}`,
          details: results
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Disk check failed: ${error.message}`,
          details: { error: error.message }
        };
      }
    }, { critical: false, description: 'Disk Access' });

    logger.info('Health check service initialized with default checks');
  }

  // Executar uma verificação específica
  async runCheck(name) {
    const check = this.checks.get(name);
    if (!check) {
      throw new Error(`Health check '${name}' not found`);
    }

    const startTime = Date.now();
    
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), check.timeout);
      });

      const result = await Promise.race([
        check.fn(),
        timeoutPromise
      ]);

      const duration = Date.now() - startTime;
      
      const checkResult = {
        name,
        description: check.description,
        status: result.status,
        message: result.message,
        details: result.details || {},
        duration_ms: duration,
        timestamp: new Date().toISOString(),
        critical: check.critical
      };

      this.lastResults.set(name, checkResult);
      return checkResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      const checkResult = {
        name,
        description: check.description,
        status: 'unhealthy',
        message: error.message,
        details: { error: error.message },
        duration_ms: duration,
        timestamp: new Date().toISOString(),
        critical: check.critical
      };

      this.lastResults.set(name, checkResult);
      return checkResult;
    }
  }

  // Executar todas as verificações
  async runAllChecks() {
    const results = [];
    const promises = [];

    for (const [name] of this.checks) {
      promises.push(this.runCheck(name));
    }

    try {
      const checkResults = await Promise.allSettled(promises);
      
      for (const result of checkResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            name: 'unknown',
            status: 'unhealthy',
            message: result.reason.message,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      logger.error('Error running health checks:', error);
    }

    return results;
  }

  // Obter status geral do sistema
  async getSystemStatus() {
    const checks = await this.runAllChecks();
    
    const criticalChecks = checks.filter(c => c.critical);
    const nonCriticalChecks = checks.filter(c => !c.critical);
    
    const criticalFailures = criticalChecks.filter(c => c.status === 'unhealthy');
    const warnings = checks.filter(c => c.status === 'warning' || c.status === 'degraded');
    
    let overallStatus = 'healthy';
    let overallMessage = 'All systems operational';
    
    if (criticalFailures.length > 0) {
      overallStatus = 'unhealthy';
      overallMessage = `${criticalFailures.length} critical system(s) failing`;
    } else if (warnings.length > 0) {
      overallStatus = 'warning';
      overallMessage = `${warnings.length} system(s) with warnings`;
    }
    
    return {
      status: overallStatus,
      message: overallMessage,
      timestamp: new Date().toISOString(),
      checks: checks,
      summary: {
        total: checks.length,
        healthy: checks.filter(c => c.status === 'healthy').length,
        warning: checks.filter(c => c.status === 'warning').length,
        degraded: checks.filter(c => c.status === 'degraded').length,
        unhealthy: checks.filter(c => c.status === 'unhealthy').length,
        critical_failures: criticalFailures.length
      }
    };
  }

  // Iniciar verificações periódicas
  startPeriodicChecks() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    logger.info(`Starting periodic health checks every ${this.checkInterval}ms`);

    this.intervalId = setInterval(async () => {
      try {
        const status = await this.getSystemStatus();
        
        // Log apenas se houver problemas
        if (status.status !== 'healthy') {
          logger.warn('System health check:', {
            status: status.status,
            message: status.message,
            summary: status.summary
          });
        } else {
          logger.debug('System health check: All systems healthy');
        }
        
        // Alertar sobre falhas críticas
        const criticalFailures = status.checks.filter(c => c.critical && c.status === 'unhealthy');
        for (const failure of criticalFailures) {
          logger.error(`Critical system failure: ${failure.name} - ${failure.message}`);
        }
        
      } catch (error) {
        logger.error('Error during periodic health check:', error);
      }
    }, this.checkInterval);
  }

  // Parar verificações periódicas
  stopPeriodicChecks() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      logger.info('Stopped periodic health checks');
    }
  }

  // Obter últimos resultados
  getLastResults() {
    const results = {};
    for (const [name, result] of this.lastResults) {
      results[name] = result;
    }
    return results;
  }

  // Verificação rápida para endpoint /health
  async quickCheck() {
    try {
      // Verificar apenas itens críticos rapidamente
      const dbCheck = await this.runCheck('database');
      const cacheCheck = await this.runCheck('cache');
      
      const isHealthy = dbCheck.status !== 'unhealthy' && cacheCheck.status !== 'unhealthy';
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: dbCheck.status,
          cache: cacheCheck.status
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
}

// Instância singleton
const healthCheck = new HealthCheckService();

export { healthCheck, HealthCheckService };