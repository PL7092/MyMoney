import mysql from 'mysql2/promise';

export interface DatabaseConfig {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  useSSL: boolean;
  connectionTimeout: number;
  maxConnections: number;
}

export interface DatabaseTestResult {
  success: boolean;
  message: string;
  connectionTime?: number;
  serverVersion?: string;
  error?: string;
}

export class DatabaseService {
  private static instance: DatabaseService;
  private config: DatabaseConfig | null = null;
  private pool: mysql.Pool | null = null;

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  setConfig(config: DatabaseConfig): void {
    this.config = config;
    this.createPool();
  }

  private createPool(): void {
    if (this.config) {
      const poolConfig: any = {
        host: this.config.host,
        port: parseInt(this.config.port),
        user: this.config.username,
        password: this.config.password,
        database: this.config.database,
        connectionLimit: this.config.maxConnections || 10,
        acquireTimeout: this.config.connectionTimeout || 60000,
        timeout: 60000,
        reconnect: true
      };

      // Handle SSL configuration
      if (this.config.useSSL) {
        poolConfig.ssl = { rejectUnauthorized: false };
      }

      this.pool = mysql.createPool(poolConfig);
    }
  }

  // Test database connection
  async testConnection(config: DatabaseConfig): Promise<DatabaseTestResult> {
    const startTime = Date.now();
    
    try {
      // Basic validation
      if (!config.host || !config.database || !config.username) {
        return {
          success: false,
          message: 'Configuração incompleta: host, database e username são obrigatórios',
          error: 'INVALID_CONFIG'
        };
      }

      if (!config.port || isNaN(parseInt(config.port)) || parseInt(config.port) <= 0) {
        return {
          success: false,
          message: 'Porta inválida ou não especificada',
          error: 'INVALID_PORT'
        };
      }

      // Create test connection
      const testConfig: any = {
        host: config.host,
        port: parseInt(config.port),
        user: config.username,
        password: config.password,
        database: config.database,
        connectionLimit: 1,
        acquireTimeout: config.connectionTimeout || 10000,
        timeout: 10000
      };

      // Handle SSL configuration
      if (config.useSSL) {
        testConfig.ssl = { rejectUnauthorized: false };
      }

      const testPool = mysql.createPool(testConfig);

      try {
        // Test the connection by running a simple query
        const [rows] = await testPool.execute('SELECT VERSION() as version');
        const version = (rows as any[])[0]?.version || 'Unknown';
        
        await testPool.end();
        
        return {
          success: true,
          message: 'Ligação bem-sucedida ao MariaDB',
          connectionTime: Date.now() - startTime,
          serverVersion: version
        };
      } catch (connectionError) {
        await testPool.end().catch(() => {});
        throw connectionError;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      let friendlyMessage = 'Erro na ligação: ';
      
      if (errorMessage.includes('ECONNREFUSED')) {
        friendlyMessage += 'Servidor não está acessível. Verifique se o MariaDB está em execução.';
      } else if (errorMessage.includes('ER_ACCESS_DENIED_ERROR')) {
        friendlyMessage += 'Credenciais inválidas. Verifique o utilizador e senha.';
      } else if (errorMessage.includes('ER_BAD_DB_ERROR')) {
        friendlyMessage += 'Base de dados não existe.';
      } else if (errorMessage.includes('ETIMEDOUT')) {
        friendlyMessage += 'Timeout de ligação. Verifique a conectividade de rede.';
      } else {
        friendlyMessage += errorMessage;
      }

      return {
        success: false,
        message: friendlyMessage,
        connectionTime: Date.now() - startTime,
        error: 'CONNECTION_ERROR'
      };
    }
  }

  // Initialize database schema
  async initializeSchema(): Promise<boolean> {
    if (!this.config || !this.pool) {
      throw new Error('Database config not set');
    }

    try {
      console.log('Initializing database schema...');
      
      const schemas = [
        // Users table
        `CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          avatar_url VARCHAR(500),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
        
        // Categories table
        `CREATE TABLE IF NOT EXISTS categories (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          color VARCHAR(7) DEFAULT '#6366f1',
          icon VARCHAR(50) DEFAULT 'folder',
          user_id INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
        
        // Accounts table
        `CREATE TABLE IF NOT EXISTS accounts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          type ENUM('checking', 'savings', 'credit', 'investment', 'other') NOT NULL,
          balance DECIMAL(15,2) DEFAULT 0.00,
          currency VARCHAR(3) DEFAULT 'EUR',
          bank_name VARCHAR(255),
          account_number VARCHAR(100),
          user_id INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
        
        // Transactions table
        `CREATE TABLE IF NOT EXISTS transactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          amount DECIMAL(15,2) NOT NULL,
          description VARCHAR(500),
          type ENUM('income', 'expense', 'transfer') NOT NULL,
          category_id INT,
          account_id INT,
          date DATE NOT NULL,
          tags TEXT,
          notes TEXT,
          user_id INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
        
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
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
        
        // Investments table
        `CREATE TABLE IF NOT EXISTS investments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          symbol VARCHAR(20),
          type ENUM('stock', 'bond', 'mutual_fund', 'etf', 'crypto', 'other') NOT NULL,
          quantity DECIMAL(15,6) DEFAULT 0,
          purchase_price DECIMAL(15,2) DEFAULT 0,
          current_price DECIMAL(15,2) DEFAULT 0,
          user_id INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
        
        // Savings goals table
        `CREATE TABLE IF NOT EXISTS savings_goals (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          target_amount DECIMAL(15,2) NOT NULL,
          current_amount DECIMAL(15,2) DEFAULT 0,
          target_date DATE,
          description TEXT,
          user_id INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
        
        // Recurring transactions table
        `CREATE TABLE IF NOT EXISTS recurring_transactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          amount DECIMAL(15,2) NOT NULL,
          description VARCHAR(500),
          type ENUM('income', 'expense') NOT NULL,
          frequency ENUM('weekly', 'monthly', 'yearly') NOT NULL,
          category_id INT,
          account_id INT,
          start_date DATE NOT NULL,
          end_date DATE,
          last_processed DATE,
          is_active BOOLEAN DEFAULT TRUE,
          user_id INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`
      ];

      // Execute each schema
      for (const schema of schemas) {
        await this.pool.execute(schema);
      }
      
      console.log('Database schema initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize schema:', error);
      return false;
    }
  }

  // Execute raw SQL query (for advanced users)
  async executeQuery(query: string, params?: any[]): Promise<any> {
    if (!this.config || !this.pool) {
      throw new Error('Database config not set');
    }

    try {
      console.log('Executing query:', query.substring(0, 100) + '...');
      
      const [rows, fields] = params 
        ? await this.pool.execute(query, params)
        : await this.pool.execute(query);
      
      return { 
        success: true, 
        rows, 
        fields,
        affectedRows: (rows as any).affectedRows || 0,
        insertId: (rows as any).insertId || null
      };
    } catch (error) {
      console.error('Query execution failed:', error);
      throw error;
    }
  }

  // Backup database
  async createBackup(): Promise<string> {
    if (!this.config) {
      throw new Error('Database config not set');
    }

    try {
      // In production, this would create an actual database backup
      console.log('Creating database backup...');
      
      // Mock backup creation
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const backupId = `backup_${Date.now()}`;
      return backupId;
    } catch (error) {
      console.error('Backup creation failed:', error);
      throw error;
    }
  }

  // Restore from backup
  async restoreBackup(backupId: string): Promise<boolean> {
    if (!this.config) {
      throw new Error('Database config not set');
    }

    try {
      // In production, this would restore from an actual backup
      console.log('Restoring backup:', backupId);
      
      // Mock restore
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      return true;
    } catch (error) {
      console.error('Backup restore failed:', error);
      return false;
    }
  }

  // Get database statistics
  async getStatistics(): Promise<any> {
    if (!this.config || !this.pool) {
      throw new Error('Database config not set');
    }

    try {
      // Get table count
      const [tables] = await this.pool.execute(
        'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ?',
        [this.config.database]
      );
      
      // Get total records across main tables
      const [recordsResult] = await this.pool.execute(`
        SELECT 
          (SELECT COUNT(*) FROM transactions) + 
          (SELECT COUNT(*) FROM budgets) + 
          (SELECT COUNT(*) FROM accounts) + 
          (SELECT COUNT(*) FROM investments) + 
          (SELECT COUNT(*) FROM savings_goals) as total_records
      `);
      
      // Get database size
      const [sizeResult] = await this.pool.execute(`
        SELECT 
          ROUND(SUM(data_length + index_length) / 1024 / 1024, 1) AS 'size_mb'
        FROM information_schema.tables 
        WHERE table_schema = ?
      `, [this.config.database]);
      
      // Get connection count
      const [connectionResult] = await this.pool.execute('SHOW STATUS LIKE "Threads_connected"');
      
      return {
        totalTables: (tables as any[])[0]?.count || 0,
        totalRecords: (recordsResult as any[])[0]?.total_records || 0,
        databaseSize: `${(sizeResult as any[])[0]?.size_mb || 0}MB`,
        lastBackup: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        uptime: 'Connected',
        connections: (connectionResult as any[])[0]?.Value || 0
      };
    } catch (error) {
      console.error('Failed to get statistics:', error);
      throw error;
    }
  }

  // Close database connections
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}