import mysql from 'mysql2/promise';
import { promises as fs } from 'fs';
import path from 'path';

class DatabaseService {
  constructor() {
    this.pool = null;
    this.config = {
      host: process.env.DB_HOST || 'mariadb',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'finance_user',
      password: process.env.DB_PASSWORD || 'finance_user_password_2024',
      database: process.env.DB_NAME || 'personal_finance',
      charset: process.env.DB_CHARSET || 'utf8mb4',
      collation: process.env.DB_COLLATION || 'utf8mb4_unicode_ci',
      timezone: process.env.DB_TIMEZONE || '+00:00',
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
      acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000,
      timeout: parseInt(process.env.DB_TIMEOUT) || 60000,
      reconnect: true,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    };
  }

  async initialize() {
    try {
      console.log('🔌 Initializing MariaDB connection...');
      
      // Create connection pool
      this.pool = mysql.createPool(this.config);
      
      // Test connection
      const connection = await this.pool.getConnection();
      const [rows] = await connection.execute('SELECT VERSION() as version, NOW() as current_time');
      connection.release();
      
      const version = rows[0].version;
      console.log(`✅ Connected to MariaDB ${version}`);
      
      // Initialize schema if needed
      await this.initializeSchema();
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize MariaDB:', error.message);
      
      // Provide helpful error messages
      if (error.code === 'ECONNREFUSED') {
        console.error('💡 Make sure MariaDB container is running and accessible');
      } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
        console.error('💡 Check database credentials in environment variables');
      } else if (error.code === 'ER_BAD_DB_ERROR') {
        console.error('💡 Database does not exist, check DB_NAME environment variable');
      }
      
      throw error;
    }
  }

  async initializeSchema() {
    try {
      console.log('📋 Checking database schema...');
      
      // Check if tables exist
      const [tables] = await this.pool.execute(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('users', 'accounts', 'transactions', 'categories')
      `, [this.config.database]);
      
      if (tables.length === 0) {
        console.log('🔧 Creating database schema...');
        await this.createSchema();
        console.log('✅ Database schema created successfully');
      } else {
        console.log(`✅ Found ${tables.length} existing tables`);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize schema:', error.message);
      throw error;
    }
  }

  async createSchema() {
    const schemaQueries = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        avatar_url VARCHAR(500),
        preferences JSON DEFAULT NULL,
        last_login TIMESTAMP NULL,
        is_active BOOLEAN DEFAULT TRUE,
        email_verified BOOLEAN DEFAULT FALSE,
        two_factor_enabled BOOLEAN DEFAULT FALSE,
        two_factor_secret VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Categories table
      `CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(7) DEFAULT '#6366f1',
        icon VARCHAR(50) DEFAULT 'folder',
        is_system BOOLEAN DEFAULT FALSE,
        user_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_categories (user_id),
        INDEX idx_system_categories (is_system)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Accounts table
      `CREATE TABLE IF NOT EXISTS accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type ENUM('checking', 'savings', 'credit', 'investment', 'cash', 'other') NOT NULL,
        balance DECIMAL(15,2) DEFAULT 0.00,
        currency VARCHAR(3) DEFAULT 'EUR',
        bank_name VARCHAR(255),
        account_number VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        user_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_accounts (user_id),
        INDEX idx_account_type (type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Transactions table
      `CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        amount DECIMAL(15,2) NOT NULL,
        description VARCHAR(500),
        type ENUM('income', 'expense', 'transfer') NOT NULL,
        category_id INT,
        account_id INT,
        transfer_account_id INT NULL,
        date DATE NOT NULL,
        tags JSON DEFAULT NULL,
        notes TEXT,
        receipt_url VARCHAR(500),
        location VARCHAR(255),
        user_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (transfer_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_transactions (user_id),
        INDEX idx_date_transactions (date),
        INDEX idx_type_transactions (type),
        INDEX idx_category_transactions (category_id),
        INDEX idx_account_transactions (account_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Refresh tokens table
      `CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(500) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_tokens (user_id),
        INDEX idx_token (token),
        INDEX idx_expires (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Budgets table
      `CREATE TABLE IF NOT EXISTS budgets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        period ENUM('weekly', 'monthly', 'yearly') NOT NULL,
        category_id INT,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        user_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_budgets (user_id),
        INDEX idx_period_budgets (period)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Insert default system user
      `INSERT IGNORE INTO users (id, email, name, password_hash) VALUES (1, 'system@local', 'System', 'system')`,

      // Insert default categories
      `INSERT IGNORE INTO categories (name, color, icon, is_system, user_id) VALUES
        ('Alimentação', '#ef4444', 'utensils', TRUE, NULL),
        ('Transporte', '#3b82f6', 'car', TRUE, NULL),
        ('Habitação', '#10b981', 'home', TRUE, NULL),
        ('Saúde', '#f59e0b', 'heart', TRUE, NULL),
        ('Educação', '#8b5cf6', 'book', TRUE, NULL),
        ('Entretenimento', '#ec4899', 'gamepad-2', TRUE, NULL),
        ('Compras', '#06b6d4', 'shopping-bag', TRUE, NULL),
        ('Salário', '#22c55e', 'banknote', TRUE, NULL),
        ('Investimentos', '#6366f1', 'trending-up', TRUE, NULL),
        ('Outros', '#6b7280', 'more-horizontal', TRUE, NULL)`
    ];

    for (const query of schemaQueries) {
      await this.pool.execute(query);
    }
  }

  async query(sql, params = []) {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    try {
      const [rows] = await this.pool.execute(sql, params);
      return rows;
    } catch (error) {
      console.error('Database query error:', error.message);
      console.error('SQL:', sql);
      console.error('Params:', params);
      throw error;
    }
  }

  async getConnection() {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }
    return await this.pool.getConnection();
  }

  async testConnection() {
    try {
      const [rows] = await this.pool.execute('SELECT 1 as test, VERSION() as version, NOW() as current_time');
      return {
        success: true,
        version: rows[0].version,
        currentTime: rows[0].current_time
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getStats() {
    try {
      const [stats] = await this.pool.execute(`
        SELECT 
          (SELECT COUNT(*) FROM users WHERE is_active = TRUE) as active_users,
          (SELECT COUNT(*) FROM accounts WHERE is_active = TRUE) as active_accounts,
          (SELECT COUNT(*) FROM transactions WHERE date >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as recent_transactions,
          (SELECT COUNT(*) FROM categories) as total_categories
      `);
      
      return stats[0];
    } catch (error) {
      console.error('Failed to get database stats:', error.message);
      return null;
    }
  }

  async close() {
    if (this.pool) {
      console.log('🔌 Closing MariaDB connection pool...');
      await this.pool.end();
      this.pool = null;
      console.log('✅ MariaDB connection pool closed');
    }
  }

  // Health check for monitoring
  async healthCheck() {
    try {
      const startTime = Date.now();
      const [rows] = await this.pool.execute('SELECT 1 as health_check');
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

export default DatabaseService;