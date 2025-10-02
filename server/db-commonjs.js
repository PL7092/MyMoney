import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

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
      password: (config.password && String(config.password).trim()) || (process.env.DB_PASSWORD || 'finance_user_password_2024'),
      database: (config.database && String(config.database).trim()) || (process.env.DB_NAME || 'personal_finance'),
      ssl: (config.useSSL || process.env.DB_SSL === 'true') ? {} : false,
      connectionLimit: Number(config.maxConnections) || Number(process.env.DB_CONNECTION_LIMIT) || 10,
      connectTimeout: (Number(config.connectionTimeout) || 30) * 1000,
      multipleStatements: true,
      charset: 'utf8mb4',
    };

    this.lastConfig = connectionConfig;
    this.pool = mysql.createPool(connectionConfig);
    return this.pool;
  }

  async init() {
    if (!this.pool) {
      await this.createConnection();
    }
    
    try {
      // Test the connection
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();
      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('Database connection failed:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async query(sql, params = []) {
    if (!this.pool) {
      await this.init();
    }
    
    try {
      const [rows] = await this.pool.execute(sql, params);
      return rows;
    } catch (error) {
      console.error('Database query failed:', error);
      throw error;
    }
  }

  async transaction(queries) {
    if (!this.pool) {
      await this.init();
    }

    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const results = [];
      for (const { sql, params } of queries) {
        const [result] = await connection.execute(sql, params);
        results.push(result);
      }
      
      await connection.commit();
      return results;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
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
        connectTimeout: 10000,
        charset: 'utf8mb4',
      });

      const connection = await tempPool.getConnection();
      await connection.ping();
      connection.release();
      await tempPool.end();
      
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { 
        success: false, 
        message: error.message,
        code: error.code 
      };
    }
  }

  async initializeSchema() {
    try {
      const schemaPath = path.join(__dirname, '../sql/init.sql');
      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Split by semicolon and execute each statement
        const statements = schema.split(';').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
          if (statement.trim()) {
            await this.query(statement);
          }
        }
        
        console.log('Database schema initialized successfully');
        return true;
      }
    } catch (error) {
      console.error('Failed to initialize schema:', error);
      throw error;
    }
  }

  async getTableStats() {
    try {
      const tables = ['users', 'accounts', 'transactions', 'categories', 'budgets'];
      const stats = {};
      
      for (const table of tables) {
        try {
          const result = await this.query(`SELECT COUNT(*) as count FROM ${table}`);
          stats[table] = result[0].count;
        } catch (error) {
          stats[table] = 0; // Table might not exist yet
        }
      }
      
      return stats;
    } catch (error) {
      console.error('Failed to get table stats:', error);
      return {};
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
    }
  }

  // Getter for compatibility
  get isReady() {
    return this.isConnected && this.pool !== null;
  }
}

export { DatabaseService };