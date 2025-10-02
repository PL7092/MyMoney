/**
 * MyMoney Application Server
 * Enhanced with security, performance, and monitoring features
 */

import 'dotenv/config';
import App from './app.js';
import { logger } from './services/LoggerService.js';
import { dbInit } from './services/DatabaseInitService.js';
import { healthCheck } from './services/HealthCheckService.js';

// Validate required environment variables
const requiredEnvVars = [
  'DB_HOST',
  'DB_USER', 
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  logger.error('Missing required environment variables', { missing: missingEnvVars });
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please check your .env file and ensure all required variables are set.');
  process.exit(1);
}

// Set default environment variables
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.APP_PORT = process.env.APP_PORT || '3000';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.BACKUP_RETENTION_DAYS = process.env.BACKUP_RETENTION_DAYS || '30';
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:5173';

// Log startup information
logger.info('Starting MyMoney Application Server', {
  nodeVersion: process.version,
  environment: process.env.NODE_ENV,
  port: process.env.APP_PORT,
  pid: process.pid
});

// Initialize services and start the application
async function startApplication() {
  try {
    logger.info('Initializing application services...');
    
    // 1. Initialize database
    logger.info('Initializing database...');
    const dbResult = await dbInit.initialize();
    if (!dbResult.success) {
      logger.warn('Database initialization had issues:', dbResult.message);
      // Continue anyway - the app might work with existing DB
    } else {
      logger.info('Database initialized successfully');
    }
    
    // 2. Initialize health checks
    logger.info('Initializing health checks...');
    await healthCheck.init();
    
    // 3. Start the Express application
    logger.info('Starting Express application...');
    const app = new App();
    await app.start();
    
    // 4. Start periodic health checks
    logger.info('Starting periodic health monitoring...');
    healthCheck.startPeriodicChecks();
    
    logger.info('🚀 MyMoney Application started successfully!');
    
    // Log initial system status
    setTimeout(async () => {
      try {
        const status = await healthCheck.getSystemStatus();
        logger.info('Initial system status:', {
          status: status.status,
          message: status.message,
          summary: status.summary
        });
      } catch (error) {
        logger.warn('Could not get initial system status:', error.message);
      }
    }, 2000);
    
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

startApplication().catch(error => {
  logger.error('Application startup crashed:', error);
  console.error('❌ Failed to start application:', error.message);
  process.exit(1);
});

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Log successful startup
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
});