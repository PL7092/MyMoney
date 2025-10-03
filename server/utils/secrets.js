import { readFileSync } from 'fs';
import { logger } from '../services/LoggerService.js';

/**
 * Reads a Docker secret from file or falls back to environment variable
 * @param {string} secretPath - Path to the secret file (e.g., '/run/secrets/db_password')
 * @param {string} envVar - Environment variable name as fallback
 * @param {string} defaultValue - Default value if neither secret nor env var exists
 * @returns {string} The secret value
 */
export function readSecret(secretPath, envVar, defaultValue = '') {
  try {
    // First try to read from Docker secret file
    if (secretPath && process.env[`${envVar}_FILE`]) {
      const secretFile = process.env[`${envVar}_FILE`];
      const secret = readFileSync(secretFile, 'utf8').trim();
      if (secret) {
        logger.debug(`Successfully read secret from file: ${secretFile}`);
        return secret;
      }
    }
    
    // Fallback to environment variable
    if (process.env[envVar]) {
      logger.debug(`Using environment variable: ${envVar}`);
      return process.env[envVar];
    }
    
    // Use default value (including empty string)
    if (defaultValue !== undefined) {
      logger.warn(`Using default value for ${envVar}`);
      return defaultValue;
    }
    
    throw new Error(`No secret found for ${envVar}`);
  } catch (error) {
    logger.error(`Error reading secret ${envVar}:`, error.message);
    
    // Fallback to environment variable if file read fails
    if (process.env[envVar]) {
      logger.debug(`Falling back to environment variable: ${envVar}`);
      return process.env[envVar];
    }
    
    if (defaultValue !== undefined) {
      logger.warn(`Using default value for ${envVar} after error`);
      return defaultValue;
    }
    
    throw error;
  }
}

/**
 * Get database password from secret or environment
 */
export function getDbPassword() {
  return readSecret('/run/secrets/db_password', 'DB_PASSWORD', 'finance_user_password_2024');
}

/**
 * Get JWT secret from secret or environment
 */
export function getJwtSecret() {
  return readSecret('/run/secrets/jwt_secret', 'JWT_SECRET', 'your_super_secure_jwt_secret_key_here_minimum_32_characters');
}

/**
 * Get JWT refresh secret from secret or environment
 */
export function getJwtRefreshSecret() {
  return readSecret('/run/secrets/jwt_refresh_secret', 'JWT_REFRESH_SECRET', 'your_super_secure_refresh_secret_key_here_minimum_32_characters');
}

/**
 * Get Redis password from secret or environment
 */
export function getRedisPassword() {
  return readSecret('/run/secrets/redis_password', 'REDIS_PASSWORD', '');
}