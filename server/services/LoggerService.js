const winston = require('winston');
const path = require('path');
const fs = require('fs');

class LoggerService {
  constructor() {
    this.logsDir = process.env.LOGS_DIR || path.join(__dirname, '../../logs');
    this.ensureLogsDirectory();
    this.logger = this.createLogger();
  }

  ensureLogsDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  createLogger() {
    const logFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.prettyPrint()
    );

    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({
        format: 'HH:mm:ss'
      }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let log = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
          log += ` ${JSON.stringify(meta)}`;
        }
        return log;
      })
    );

    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      defaultMeta: { service: 'mymoney-api' },
      transports: [
        // Console transport para desenvolvimento
        new winston.transports.Console({
          format: consoleFormat,
          silent: process.env.NODE_ENV === 'test'
        }),

        // File transport para logs gerais
        new winston.transports.File({
          filename: path.join(this.logsDir, 'app.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          tailable: true
        }),

        // File transport para erros
        new winston.transports.File({
          filename: path.join(this.logsDir, 'error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          tailable: true
        }),

        // File transport para auditoria de segurança
        new winston.transports.File({
          filename: path.join(this.logsDir, 'security.log'),
          level: 'warn',
          maxsize: 5242880, // 5MB
          maxFiles: 10,
          tailable: true
        })
      ],

      // Handle uncaught exceptions
      exceptionHandlers: [
        new winston.transports.File({
          filename: path.join(this.logsDir, 'exceptions.log')
        })
      ],

      // Handle unhandled promise rejections
      rejectionHandlers: [
        new winston.transports.File({
          filename: path.join(this.logsDir, 'rejections.log')
        })
      ]
    });
  }

  // Métodos de logging
  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  error(message, error = null, meta = {}) {
    const logMeta = { ...meta };
    if (error) {
      logMeta.error = {
        message: error.message,
        stack: error.stack,
        name: error.name
      };
    }
    this.logger.error(message, logMeta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  // Logging específico para auditoria
  audit(action, userId, details = {}) {
    this.logger.info('AUDIT', {
      action,
      userId,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  // Logging de segurança
  security(event, details = {}) {
    this.logger.warn('SECURITY_EVENT', {
      event,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  // Logging de performance
  performance(operation, duration, details = {}) {
    this.logger.info('PERFORMANCE', {
      operation,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  // Logging de base de dados
  database(query, duration, error = null) {
    const logData = {
      query: query.substring(0, 200), // Limitar tamanho da query
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    };

    if (error) {
      logData.error = {
        message: error.message,
        code: error.code
      };
      this.logger.error('DATABASE_ERROR', logData);
    } else {
      this.logger.debug('DATABASE_QUERY', logData);
    }
  }

  // Middleware para Express
  expressMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      const originalSend = res.send;

      res.send = function(data) {
        const duration = Date.now() - startTime;
        
        // Log da request
        const logData = {
          method: req.method,
          url: req.url,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          userId: req.user?.userId || null
        };

        if (res.statusCode >= 400) {
          logData.responseBody = data?.substring(0, 500);
          this.logger.warn('HTTP_ERROR', logData);
        } else {
          this.logger.info('HTTP_REQUEST', logData);
        }

        originalSend.call(this, data);
      }.bind(this);

      next();
    };
  }

  // Cleanup de logs antigos
  async cleanupOldLogs(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    try {
      const files = fs.readdirSync(this.logsDir);
      
      for (const file of files) {
        const filePath = path.join(this.logsDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          this.info(`Deleted old log file: ${file}`);
        }
      }
    } catch (error) {
      this.error('Failed to cleanup old logs', error);
    }
  }

  // Método para obter estatísticas de logs
  async getLogStats() {
    try {
      const files = fs.readdirSync(this.logsDir);
      const stats = {};

      for (const file of files) {
        const filePath = path.join(this.logsDir, file);
        const fileStats = fs.statSync(filePath);
        
        stats[file] = {
          size: fileStats.size,
          modified: fileStats.mtime,
          sizeFormatted: this.formatBytes(fileStats.size)
        };
      }

      return stats;
    } catch (error) {
      this.error('Failed to get log stats', error);
      return {};
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Singleton instance
const loggerService = new LoggerService();

module.exports = { LoggerService, logger: loggerService };