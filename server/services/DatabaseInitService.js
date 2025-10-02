import { logger } from './LoggerService.js';
import { DatabaseService } from '../db-commonjs.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

class DatabaseInitService {
  constructor() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    this.db = new DatabaseService();
    this.schemaVersion = '1.0.0';
    this.migrationPath = path.join(__dirname, '..', 'migrations');
  }

  // Verificar se o banco de dados existe e está acessível
  async checkDatabaseConnection() {
    try {
      await this.db.init();
      logger.info('Database connection established successfully');
      return true;
    } catch (error) {
      logger.error('Database connection failed:', error.message);
      return false;
    }
  }

  // Criar banco de dados se não existir
  async createDatabaseIfNotExists() {
    try {
      const dbName = process.env.DB_NAME || 'mymoney';
      
      // Conectar sem especificar banco de dados
      const tempDb = new DatabaseService();
      const tempConfig = { ...tempDb.config };
      delete tempConfig.database;
      
      const connection = await mysql.createConnection(tempConfig);
      
      // Verificar se o banco existe
      const [databases] = await connection.execute(
        'SHOW DATABASES LIKE ?',
        [dbName]
      );
      
      if (databases.length === 0) {
        logger.info(`Creating database: ${dbName}`);
        await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        logger.info(`Database ${dbName} created successfully`);
      } else {
        logger.info(`Database ${dbName} already exists`);
      }
      
      await connection.end();
      return true;
    } catch (error) {
      logger.error('Error creating database:', error.message);
      return false;
    }
  }

  // Verificar se as tabelas existem
  async checkTablesExist() {
    try {
      const tables = await this.db.query('SHOW TABLES');
      const tableNames = tables.map(row => Object.values(row)[0]);
      
      const requiredTables = ['users', 'transactions', 'categories', 'refresh_tokens'];
      const missingTables = requiredTables.filter(table => !tableNames.includes(table));
      
      return {
        exists: missingTables.length === 0,
        existing: tableNames,
        missing: missingTables,
        total: tableNames.length
      };
    } catch (error) {
      logger.error('Error checking tables:', error.message);
      return { exists: false, existing: [], missing: [], total: 0 };
    }
  }

  // Criar tabelas básicas
  async createBasicTables() {
    try {
      logger.info('Creating basic database tables...');

      // Tabela de usuários
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          first_name VARCHAR(50),
          last_name VARCHAR(50),
          is_active BOOLEAN DEFAULT TRUE,
          last_login TIMESTAMP NULL,
          failed_login_attempts INT DEFAULT 0,
          locked_until TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_username (username),
          INDEX idx_email (email),
          INDEX idx_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Tabela de tokens de refresh
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          token_hash VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          revoked_at TIMESTAMP NULL,
          device_info TEXT,
          ip_address VARCHAR(45),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_user_id (user_id),
          INDEX idx_token_hash (token_hash),
          INDEX idx_expires_at (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Tabela de categorias
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          color VARCHAR(7) DEFAULT '#007bff',
          icon VARCHAR(50),
          type ENUM('income', 'expense') NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_user_id (user_id),
          INDEX idx_type (type),
          INDEX idx_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Tabela de transações
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          category_id INT,
          amount DECIMAL(15,2) NOT NULL,
          description TEXT,
          transaction_date DATE NOT NULL,
          type ENUM('income', 'expense') NOT NULL,
          payment_method VARCHAR(50),
          reference_number VARCHAR(100),
          notes TEXT,
          is_recurring BOOLEAN DEFAULT FALSE,
          recurring_pattern VARCHAR(50),
          tags JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
          INDEX idx_user_id (user_id),
          INDEX idx_category_id (category_id),
          INDEX idx_transaction_date (transaction_date),
          INDEX idx_type (type),
          INDEX idx_amount (amount)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Tabela de configurações do sistema
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS system_settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          setting_key VARCHAR(100) UNIQUE NOT NULL,
          setting_value TEXT,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_setting_key (setting_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      logger.info('Basic database tables created successfully');
      return true;
    } catch (error) {
      logger.error('Error creating basic tables:', error.message);
      return false;
    }
  }

  // Inserir dados iniciais
  async insertInitialData() {
    try {
      logger.info('Inserting initial data...');

      // Verificar se já existem dados
      const [userCount] = await this.db.query('SELECT COUNT(*) as count FROM users');
      if (userCount.count > 0) {
        logger.info('Initial data already exists, skipping...');
        return true;
      }

      // Inserir configurações do sistema
      const systemSettings = [
        ['schema_version', this.schemaVersion, 'Current database schema version'],
        ['app_name', 'MyMoney', 'Application name'],
        ['currency_default', 'EUR', 'Default currency'],
        ['date_format', 'DD/MM/YYYY', 'Default date format'],
        ['backup_enabled', 'true', 'Enable automatic backups'],
        ['maintenance_mode', 'false', 'Maintenance mode status']
      ];

      for (const [key, value, description] of systemSettings) {
        await this.db.query(
          'INSERT IGNORE INTO system_settings (setting_key, setting_value, description) VALUES (?, ?, ?)',
          [key, value, description]
        );
      }

      // Inserir categorias padrão (será feito quando um usuário for criado)
      logger.info('Initial data inserted successfully');
      return true;
    } catch (error) {
      logger.error('Error inserting initial data:', error.message);
      return false;
    }
  }

  // Criar categorias padrão para um usuário
  async createDefaultCategories(userId) {
    try {
      const defaultCategories = [
        // Categorias de despesas
        { name: 'Alimentação', type: 'expense', color: '#ff6b6b', icon: 'utensils' },
        { name: 'Transporte', type: 'expense', color: '#4ecdc4', icon: 'car' },
        { name: 'Habitação', type: 'expense', color: '#45b7d1', icon: 'home' },
        { name: 'Saúde', type: 'expense', color: '#96ceb4', icon: 'heart' },
        { name: 'Educação', type: 'expense', color: '#feca57', icon: 'book' },
        { name: 'Entretenimento', type: 'expense', color: '#ff9ff3', icon: 'gamepad' },
        { name: 'Compras', type: 'expense', color: '#54a0ff', icon: 'shopping-bag' },
        { name: 'Outros', type: 'expense', color: '#5f27cd', icon: 'ellipsis-h' },
        
        // Categorias de receitas
        { name: 'Salário', type: 'income', color: '#00d2d3', icon: 'money-bill' },
        { name: 'Freelance', type: 'income', color: '#ff9f43', icon: 'laptop' },
        { name: 'Investimentos', type: 'income', color: '#10ac84', icon: 'chart-line' },
        { name: 'Outros', type: 'income', color: '#ee5a24', icon: 'plus' }
      ];

      for (const category of defaultCategories) {
        await this.db.query(
          'INSERT INTO categories (user_id, name, type, color, icon) VALUES (?, ?, ?, ?, ?)',
          [userId, category.name, category.type, category.color, category.icon]
        );
      }

      logger.info(`Default categories created for user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error creating default categories:', error.message);
      return false;
    }
  }

  // Verificar e atualizar schema
  async checkAndUpdateSchema() {
    try {
      // Verificar versão atual do schema
      const [setting] = await this.db.query(
        'SELECT setting_value FROM system_settings WHERE setting_key = ?',
        ['schema_version']
      );

      const currentVersion = setting ? setting.setting_value : '0.0.0';
      
      if (currentVersion !== this.schemaVersion) {
        logger.info(`Schema update needed: ${currentVersion} -> ${this.schemaVersion}`);
        // Aqui você pode adicionar lógica de migração se necessário
        
        await this.db.query(
          'UPDATE system_settings SET setting_value = ? WHERE setting_key = ?',
          [this.schemaVersion, 'schema_version']
        );
        
        logger.info('Schema version updated successfully');
      }

      return true;
    } catch (error) {
      logger.error('Error checking schema version:', error.message);
      return false;
    }
  }

  // Inicialização completa do banco de dados
  async initialize() {
    try {
      logger.info('Starting database initialization...');

      // 1. Verificar conexão
      const connected = await this.checkDatabaseConnection();
      if (!connected) {
        // Tentar criar o banco de dados
        const created = await this.createDatabaseIfNotExists();
        if (!created) {
          throw new Error('Failed to create database');
        }
        
        // Tentar conectar novamente
        const reconnected = await this.checkDatabaseConnection();
        if (!reconnected) {
          throw new Error('Failed to connect after database creation');
        }
      }

      // 2. Verificar tabelas
      const tableStatus = await this.checkTablesExist();
      if (!tableStatus.exists) {
        logger.info(`Missing tables: ${tableStatus.missing.join(', ')}`);
        const created = await this.createBasicTables();
        if (!created) {
          throw new Error('Failed to create basic tables');
        }
      }

      // 3. Inserir dados iniciais
      await this.insertInitialData();

      // 4. Verificar e atualizar schema
      await this.checkAndUpdateSchema();

      logger.info('Database initialization completed successfully');
      return {
        success: true,
        message: 'Database initialized successfully',
        details: {
          tables_created: !tableStatus.exists,
          existing_tables: tableStatus.existing.length,
          schema_version: this.schemaVersion
        }
      };

    } catch (error) {
      logger.error('Database initialization failed:', error.message);
      return {
        success: false,
        message: `Database initialization failed: ${error.message}`,
        error: error.message
      };
    }
  }

  // Verificação rápida do status do banco
  async getStatus() {
    try {
      const connected = await this.checkDatabaseConnection();
      if (!connected) {
        return { status: 'disconnected', message: 'Cannot connect to database' };
      }

      const tableStatus = await this.checkTablesExist();
      const [userCount] = await this.db.query('SELECT COUNT(*) as count FROM users');
      const [transactionCount] = await this.db.query('SELECT COUNT(*) as count FROM transactions');

      return {
        status: 'connected',
        message: 'Database is operational',
        details: {
          tables: tableStatus.existing.length,
          users: userCount.count,
          transactions: transactionCount.count,
          schema_version: this.schemaVersion
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        error: error.message
      };
    }
  }
}

// Instância singleton
const dbInit = new DatabaseInitService();

export { dbInit, DatabaseInitService };