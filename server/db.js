import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './services/LoggerService.js';
import { getDbPassword } from './utils/secrets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatabaseService {
  constructor() {
    this.pool = null;
    this.isConnected = false;
    this.lastConfig = null;
  }

  async createConnection(config = {}) {
    // Prioritize user-configured values over environment variables and normalize types
    const normalizePort = (p) => {
      const n = typeof p === 'string' ? parseInt(p, 10) : p;
      return Number.isFinite(n) ? n : 3306;
    };

    const connectionConfig = {
      host: (config.host && String(config.host).trim()) || 
            process.env.DB_HOST || 'mariadb',
      port: normalizePort(config.port || process.env.DB_PORT || 3306),
      user: (config.username && String(config.username).trim()) || (process.env.DB_USER || 'finance_user'),
      password: (config.password && String(config.password).trim()) || getDbPassword(),
      database: (config.database && String(config.database).trim()) || (process.env.DB_NAME || 'personal_finance'),
      ssl: (config.useSSL || process.env.DB_SSL === 'true') ? {} : false,
      connectionLimit: Number(config.maxConnections) || 10,
      connectTimeout: (Number(config.connectionTimeout) || 30) * 1000,
      multipleStatements: true,
      charset: 'utf8mb4',
    };

    this.lastConfig = connectionConfig;
    this.pool = mysql.createPool(connectionConfig);
    return this.pool;
  }

  async testConnection(config) {
    try {
      const tempPool = mysql.createPool({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database,
        ssl: config.useSSL ? {} : false,
        connectionLimit: 1,
        connectTimeout: (config.connectionTimeout || 30) * 1000,
      });

      const start = Date.now();
      const connection = await tempPool.getConnection();
      await connection.ping();
      const latency = Date.now() - start;
      
      connection.release();
      await tempPool.end();

      return {
        success: true,
        message: 'Ligação estabelecida com sucesso',
        latency: `${latency}ms`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Database connection test failed:', error);
      return {
        success: false,
        message: error.message,
        error: error.code || 'CONNECTION_ERROR',
        timestamp: new Date().toISOString()
      };
    }
  }

  async initializeSchema() {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    try {
      // Ensure the target database exists. If we get ER_BAD_DB_ERROR, create it first.
      try {
        const testConn = await this.pool.getConnection();
        await testConn.ping();
        testConn.release();
      } catch (err) {
        if (err && (err.code === 'ER_BAD_DB_ERROR' || /Unknown database/i.test(err.message))) {
          const { database, ...noDbConfig } = this.lastConfig || {};
          if (!database) throw err;
          const tempPool = mysql.createPool({ ...noDbConfig, multipleStatements: true });
          const tmpConn = await tempPool.getConnection();
          await tmpConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
          tmpConn.release();
          await tempPool.end();
          // Recreate pool now that the DB exists
          this.pool = mysql.createPool(this.lastConfig);
        } else {
          throw err;
        }
      }

      // Read the init.sql file
      const sqlPath = path.join(__dirname, '..', 'sql', 'init.sql');
      let initSQL = fs.readFileSync(sqlPath, 'utf8');

      // If we are already connected to a specific database, skip CREATE DATABASE/USE statements
      const selectedDb = this.lastConfig?.database;
      if (selectedDb) {
        initSQL = initSQL
          .replace(/\bCREATE\s+DATABASE\b[\s\S]*?;/gi, '')
          .replace(/\bUSE\s+[`"']?[\w-]+[`"']?\s*;?/gi, '');
      }

      // Execute the initialization script statement-by-statement to ignore benign duplicate errors
      const connection = await this.pool.getConnection();
      try {
        const statements = initSQL
          .split(/;\s*\n/)
          .map(s => s.trim())
          .filter(s => s.length);

        for (const stmt of statements) {
          try {
            await connection.query(stmt);
          } catch (e) {
            if (e && (e.code === 'ER_DUP_KEYNAME' || e.code === 'ER_TABLE_EXISTS_ERROR' || e.code === 'ER_DUP_FIELDNAME')) {
              // Ignore duplicate index/field/table errors on idempotent runs
              continue;
            }
            throw e;
          }
        }
      } finally {
        connection.release();
      }

      // Get table statistics
      const stats = await this.getTableStats();

      return {
        success: true,
        message: 'Schema inicializado com sucesso',
        tables: stats.tables,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Schema initialization failed:', error);
      throw {
        success: false,
        message: 'Erro ao inicializar schema',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async getTableStats() {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    try {
      const connection = await this.pool.getConnection();
      
      // Get all tables
      const [tables] = await connection.execute('SHOW TABLES');
      const tableNames = tables.map(row => Object.values(row)[0]);
      
      // Get row counts for each table
      const tableStats = {};
      for (const tableName of tableNames) {
        const safeName = String(tableName).replace(/[^a-zA-Z0-9_]/g, '');
        if (!safeName) continue;
        const [countResult] = await connection.query(`SELECT COUNT(*) as count FROM \`${safeName}\``);
        tableStats[tableName] = countResult[0]?.count ?? 0;
      }

      // Get database size
      const [sizeResult] = await connection.execute(`
        SELECT 
          ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
        FROM information_schema.tables 
        WHERE table_schema = DATABASE()
      `);

      connection.release();

      return {
        tables: tableStats,
        totalTables: tableNames.length,
        totalRecords: Object.values(tableStats).reduce((sum, count) => sum + count, 0),
        sizeMB: sizeResult[0].size_mb || 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get table stats:', error);
      throw error;
    }
  }

  async importData(data) {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();

      const results = {
        categories: 0,
        accounts: 0,
        transactions: 0,
        budgets: 0,
        investments: 0,
        savings_goals: 0,
        recurring_transactions: 0,
        assets: 0
      };

      // Import categories first (referenced by other tables)
      if (data.categories?.length) {
        for (const category of data.categories) {
          await connection.execute(`
            INSERT INTO categories (id, name, type, color, icon, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
              name = VALUES(name),
              type = VALUES(type),
              color = VALUES(color),
              icon = VALUES(icon),
              updated_at = NOW()
          `, [category.id, category.name, category.type, category.color, category.icon]);
          results.categories++;
        }
      }

      // Import accounts
      if (data.accounts?.length) {
        for (const account of data.accounts) {
          await connection.execute(`
            INSERT INTO accounts (id, name, type, balance, currency, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
              name = VALUES(name),
              type = VALUES(type),
              balance = VALUES(balance),
              currency = VALUES(currency),
              updated_at = NOW()
          `, [account.id, account.name, account.type, account.balance, account.currency || 'EUR']);
          results.accounts++;
        }
      }

      // Import transactions
      if (data.transactions?.length) {
        for (const transaction of data.transactions) {
          await connection.execute(`
            INSERT INTO transactions (id, amount, type, description, category_id, account_id, date, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
              amount = VALUES(amount),
              type = VALUES(type),
              description = VALUES(description),
              category_id = VALUES(category_id),
              account_id = VALUES(account_id),
              date = VALUES(date),
              updated_at = NOW()
          `, [
            transaction.id, 
            transaction.amount, 
            transaction.type, 
            transaction.description,
            transaction.categoryId,
            transaction.accountId,
            transaction.date
          ]);
          results.transactions++;
        }
      }

      // Import budgets
      if (data.budgets?.length) {
        for (const budget of data.budgets) {
          await connection.execute(`
            INSERT INTO budgets (id, name, amount, spent, category_id, period, start_date, end_date, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
              name = VALUES(name),
              amount = VALUES(amount),
              spent = VALUES(spent),
              category_id = VALUES(category_id),
              period = VALUES(period),
              start_date = VALUES(start_date),
              end_date = VALUES(end_date),
              updated_at = NOW()
          `, [
            budget.id,
            budget.name,
            budget.amount,
            budget.spent || 0,
            budget.categoryId,
            budget.period,
            budget.startDate,
            budget.endDate
          ]);
          results.budgets++;
        }
      }

      // Import other entities as needed...
      // (investments, savings_goals, recurring_transactions, assets)

      await connection.commit();

      return {
        success: true,
        message: 'Dados importados com sucesso',
        results,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      await connection.rollback();
      console.error('Data import failed:', error);
      throw {
        success: false,
        message: 'Erro ao importar dados',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    } finally {
      connection.release();
    }
  }

  async executeQuery(query, params = []) {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const connection = await this.pool.getConnection();
    try {
      const [results] = await connection.execute(query, params);
      return results;
    } finally {
      connection.release();
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
    }
  }
}

// Export singleton instance
const db = new DatabaseService();
export default db;