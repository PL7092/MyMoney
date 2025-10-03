import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import db from './db.js';
import { getDbPassword } from './utils/secrets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.APP_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API routes are defined below

// Health check endpoint with real database status (supports /health and /api/health)
app.get(['/health', '/api/health'], async (req, res) => {
  let dbStatus = 'disconnected';
  let dbError = null;
  
  try {
    if (db.pool) {
      const connection = await db.pool.getConnection();
      await connection.ping();
      connection.release();
      dbStatus = 'connected';
    }
  } catch (error) {
    dbStatus = 'error';
    dbError = error.message;
  }
  
  res.json({ 
    status: dbStatus === 'connected' ? 'healthy' : 'degraded', 
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      error: dbError
    }
  });
});

// Database API endpoints
app.post('/api/db/test', async (req, res) => {
  try {
    const config = req.body;
    const result = await db.testConnection(config);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

app.post('/api/db/init', async (req, res) => {
  try {
    // Prefer client-provided config; fallback to environment
    const bodyConfig = req.body || {};
    const config = bodyConfig.host ? bodyConfig : {
      host: process.env.DB_HOST === 'mariadb' ? 'localhost' : process.env.DB_HOST,
      port: process.env.DB_PORT,
      username: process.env.DB_USER,
      password: getDbPassword(),
      database: process.env.DB_NAME,
      useSSL: process.env.DB_SSL === 'true'
    };

    // (Re)initialize connection with provided config
    await db.createConnection(config);

    const result = await db.initializeSchema();
    res.json(result);
  } catch (error) {
    console.error('❌ Failed to initialize schema:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao inicializar schema',
      error: error.message
    });
  }
});

// Routes
import promptsRouter from './routes/prompts.js';
app.use('/api/prompts', promptsRouter);

app.get('/api/db/stats', async (req, res) => {
  try {
    if (!db.pool) {
      await db.createConnection({
        host: process.env.DB_HOST === 'mariadb' ? 'localhost' : process.env.DB_HOST,
        port: process.env.DB_PORT,
        username: process.env.DB_USER,
        password: getDbPassword(),
        database: process.env.DB_NAME,
        useSSL: process.env.DB_SSL === 'true'
      });
    }
    
    const stats = await db.getTableStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Failed to get database stats:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter estatísticas',
      error: error.message
    });
  }
});

// Also allow POST with client-provided config
app.post('/api/db/stats', async (req, res) => {
  try {
    const bodyConfig = req.body || {};
    if (bodyConfig.host) {
      await db.createConnection(bodyConfig);
    } else if (!db.pool) {
      await db.createConnection({
        host: process.env.DB_HOST === 'mariadb' ? 'localhost' : process.env.DB_HOST,
        port: process.env.DB_PORT,
        username: process.env.DB_USER,
        password: getDbPassword(),
        database: process.env.DB_NAME,
        useSSL: process.env.DB_SSL === 'true'
      });
    }

    const stats = await db.getTableStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('❌ Failed to get database stats via POST:', error.message);
    res.status(500).json({ success: false, message: 'Erro ao obter estatísticas', error: error.message });
  }
});

app.post('/api/db/import', async (req, res) => {
  try {
    const { config: bodyConfig, data } = req.body || {};

    if (bodyConfig) {
      await db.createConnection(bodyConfig);
    } else if (!db.pool) {
      await db.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        username: process.env.DB_USER,
        password: getDbPassword(),
        database: process.env.DB_NAME,
        useSSL: process.env.DB_SSL === 'true'
      });
    }
    
    const payload = data || req.body;
    const result = await db.importData(payload);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao importar dados',
      error: error.message
    });
  }
});

// General API status
app.get('/api/status', (req, res) => {
  res.json({ 
    message: 'Personal Finance Manager API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// ========== USER SETTINGS CRUD ==========
app.get('/api/user-settings', async (req, res) => {
  try {
    if (!db.pool) {
      return res.status(500).json({
        success: false,
        message: 'Database connection not available'
      });
    }

    const [rows] = await db.pool.execute(`
      SELECT category, settings 
      FROM user_settings 
      WHERE user_id = 1
    `);

    // Combine all settings into a single object
    const settings = {
      appSettings: { currency: 'EUR', dateFormat: 'DD/MM/YYYY', theme: 'system', language: 'pt' },
      notificationSettings: { budgetAlerts: true, transactionNotifications: false, monthlyReports: true, investmentAlerts: true, goalReminders: true, emailNotifications: true, pushNotifications: false },
      securitySettings: { twoFactorAuth: false, sessionTimeout: 30, loginAlerts: true, dataEncryption: true }
    };

    rows.forEach(row => {
      if (row.category === 'app') {
        settings.appSettings = { ...settings.appSettings, ...row.settings };
      } else if (row.category === 'notifications') {
        settings.notificationSettings = { ...settings.notificationSettings, ...row.settings };
      } else if (row.category === 'security') {
        settings.securitySettings = { ...settings.securitySettings, ...row.settings };
      }
    });

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching user settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user settings',
      error: error.message
    });
  }
});

app.put('/api/user-settings', async (req, res) => {
  try {
    if (!db.pool) {
      return res.status(500).json({
        success: false,
        message: 'Database connection not available'
      });
    }

    const { category, settings } = req.body;

    if (!category || !settings) {
      return res.status(400).json({
        success: false,
        message: 'Category and settings are required'
      });
    }

    if (!['app', 'notifications', 'security'].includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category. Must be app, notifications, or security'
      });
    }

    // Insert or update settings
    await db.pool.execute(`
      INSERT INTO user_settings (user_id, category, settings) 
      VALUES (1, ?, ?)
      ON DUPLICATE KEY UPDATE 
        settings = VALUES(settings),
        updated_at = CURRENT_TIMESTAMP
    `, [category, JSON.stringify(settings)]);

    res.json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user settings',
      error: error.message
    });
  }
});

// ========== CATEGORIES CRUD ==========
app.get('/api/categories', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const categories = await db.query('SELECT * FROM categories WHERE user_id IS NULL OR user_id = ?', [1]);
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { name, color, icon } = req.body;
    const result = await db.query(
      'INSERT INTO categories (name, color, icon, user_id) VALUES (?, ?, ?, ?)',
      [name, color || '#6366f1', icon || 'folder', 1]
    );
    const category = await db.query('SELECT * FROM categories WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: category[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/categories/:id', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { id } = req.params;
    const { name, color, icon } = req.body;
    await db.query(
      'UPDATE categories SET name = ?, color = ?, icon = ? WHERE id = ? AND (user_id = ? OR user_id IS NULL)',
      [name, color, icon, id, 1]
    );
    const category = await db.query('SELECT * FROM categories WHERE id = ?', [id]);
    res.json({ success: true, data: category[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { id } = req.params;
    await db.query('DELETE FROM categories WHERE id = ? AND user_id = ?', [id, 1]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== ACCOUNTS CRUD ==========
app.get('/api/accounts', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const accounts = await db.query('SELECT * FROM accounts WHERE user_id = ?', [1]);
    res.json({ success: true, data: accounts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/accounts', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { name, type, balance, currency } = req.body;
    const result = await db.query(
      'INSERT INTO accounts (name, type, balance, currency, user_id) VALUES (?, ?, ?, ?, ?)',
      [name, type, balance || 0, currency || 'EUR', 1]
    );
    const account = await db.query('SELECT * FROM accounts WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: account[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/accounts/:id', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { id } = req.params;
    const { name, type, balance, currency } = req.body;
    await db.query(
      'UPDATE accounts SET name = ?, type = ?, balance = ?, currency = ? WHERE id = ? AND user_id = ?',
      [name, type, balance, currency, id, 1]
    );
    const account = await db.query('SELECT * FROM accounts WHERE id = ?', [id]);
    res.json({ success: true, data: account[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/accounts/:id', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { id } = req.params;
    await db.query('DELETE FROM accounts WHERE id = ? AND user_id = ?', [id, 1]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== TRANSACTIONS CRUD ==========
app.get('/api/transactions', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const transactions = await db.query(`
      SELECT t.*, c.name as category_name, c.color as category_color
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ?
      ORDER BY t.transaction_date DESC, t.created_at DESC
    `, [1]);
    res.json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { amount, description, type, category_id, account_id, date } = req.body;
    const result = await db.query(
      'INSERT INTO transactions (amount, description, type, category_id, account_id, date, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [amount, description, type, category_id, account_id, date, 1]
    );
    
    // Update account balance
    const balanceChange = type === 'income' ? amount : -amount;
    await db.query(
      'UPDATE accounts SET balance = balance + ? WHERE id = ?',
      [balanceChange, account_id]
    );
    
    const transaction = await db.query(`
      SELECT t.*, c.name as category_name, c.color as category_color
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `, [result.insertId]);
    
    res.json({ success: true, data: transaction[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { id } = req.params;
    const { amount, description, type, category_id, account_id, date } = req.body;
    
    // Get old transaction to reverse balance change
    const oldTransaction = await db.query('SELECT * FROM transactions WHERE id = ?', [id]);
    if (oldTransaction.length > 0) {
      const oldBalanceChange = oldTransaction[0].type === 'income' ? -oldTransaction[0].amount : oldTransaction[0].amount;
      await db.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [oldBalanceChange, oldTransaction[0].account_id]);
    }
    
    await db.query(
      'UPDATE transactions SET amount = ?, description = ?, type = ?, category_id = ?, account_id = ?, date = ? WHERE id = ? AND user_id = ?',
      [amount, description, type, category_id, account_id, date, id, 1]
    );
    
    // Apply new balance change
    const balanceChange = type === 'income' ? amount : -amount;
    await db.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [balanceChange, account_id]);
    
    const transaction = await db.query(`
      SELECT t.*, c.name as category_name, c.color as category_color
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `, [id]);
    
    res.json({ success: true, data: transaction[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { id } = req.params;
    
    // Get transaction to reverse balance change
    const transaction = await db.query('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [id, 1]);
    if (transaction.length > 0) {
      const balanceChange = transaction[0].type === 'income' ? -transaction[0].amount : transaction[0].amount;
      await db.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [balanceChange, transaction[0].account_id]);
    }
    
    await db.query('DELETE FROM transactions WHERE id = ? AND user_id = ?', [id, 1]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== BUDGETS CRUD ==========
app.get('/api/budgets', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const budgets = await db.query(`
      SELECT b.*, c.name as category_name, c.color as category_color
      FROM budgets b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
    `, [1]);
    res.json({ success: true, data: budgets });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/budgets', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { name, amount, category_id, period, start_date, end_date } = req.body;
    const result = await db.query(
      'INSERT INTO budgets (name, amount, category_id, period, start_date, end_date, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, amount, category_id, period, start_date, end_date, 1]
    );
    const budget = await db.query(`
      SELECT b.*, c.name as category_name, c.color as category_color
      FROM budgets b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.id = ?
    `, [result.insertId]);
    res.json({ success: true, data: budget[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/budgets/:id', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { id } = req.params;
    const { name, amount, category_id, period, start_date, end_date } = req.body;
    await db.query(
      'UPDATE budgets SET name = ?, amount = ?, category_id = ?, period = ?, start_date = ?, end_date = ? WHERE id = ? AND user_id = ?',
      [name, amount, category_id, period, start_date, end_date, id, 1]
    );
    const budget = await db.query(`
      SELECT b.*, c.name as category_name, c.color as category_color
      FROM budgets b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.id = ?
    `, [id]);
    res.json({ success: true, data: budget[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/budgets/:id', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { id } = req.params;
    await db.query('DELETE FROM budgets WHERE id = ? AND user_id = ?', [id, 1]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== INVESTMENTS CRUD ==========
app.get('/api/investments', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const investments = await db.query(`
      SELECT i.*, a.name as account_name
      FROM investments i
      LEFT JOIN accounts a ON i.account_id = a.id
      WHERE i.user_id = ?
      ORDER BY i.created_at DESC
    `, [1]);
    res.json({ success: true, data: investments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/investments', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { name, symbol, type, quantity, purchase_price, current_price, purchase_date, account_id } = req.body;
    const result = await db.query(
      'INSERT INTO investments (name, symbol, type, quantity, purchase_price, current_price, purchase_date, account_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, symbol, type, quantity || 0, purchase_price || 0, current_price || purchase_price || 0, purchase_date, account_id, 1]
    );
    const investment = await db.query(`
      SELECT i.*, a.name as account_name
      FROM investments i
      LEFT JOIN accounts a ON i.account_id = a.id
      WHERE i.id = ?
    `, [result.insertId]);
    res.json({ success: true, data: investment[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/investments/:id', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { id } = req.params;
    const { name, symbol, type, quantity, purchase_price, current_price, purchase_date, account_id } = req.body;
    await db.query(
      'UPDATE investments SET name = ?, symbol = ?, type = ?, quantity = ?, purchase_price = ?, current_price = ?, purchase_date = ?, account_id = ? WHERE id = ? AND user_id = ?',
      [name, symbol, type, quantity, purchase_price, current_price, purchase_date, account_id, id, 1]
    );
    const investment = await db.query(`
      SELECT i.*, a.name as account_name
      FROM investments i
      LEFT JOIN accounts a ON i.account_id = a.id
      WHERE i.id = ?
    `, [id]);
    res.json({ success: true, data: investment[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/investments/:id', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { id } = req.params;
    await db.query('DELETE FROM investments WHERE id = ? AND user_id = ?', [id, 1]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== RECURRING TRANSACTIONS CRUD ==========
app.get('/api/recurring-transactions', async (req, res) => {
  console.log('DEBUG: Recurring transactions route called');
  try {
    if (!db.pool) await db.createConnection();
    const recurringTransactions = await db.query(`
      SELECT rt.*, c.name as category_name, c.color as category_color
      FROM recurring_transactions rt
      LEFT JOIN categories c ON rt.category_id = c.id
      WHERE rt.user_id = ?
      ORDER BY rt.created_at DESC
    `, [1]);
    res.json({ success: true, data: recurringTransactions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
console.log('DEBUG: Recurring transactions GET route registered');

app.post('/api/recurring-transactions', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { amount, description, type, frequency, category_id, account_id, start_date, end_date, next_occurrence } = req.body;
    const result = await db.query(
      'INSERT INTO recurring_transactions (amount, description, type, frequency, category_id, account_id, start_date, end_date, next_occurrence, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [amount, description, type, frequency, category_id, account_id, start_date, end_date, next_occurrence || start_date, 1]
    );
    const recurringTransaction = await db.query(`
      SELECT rt.*, c.name as category_name, c.color as category_color
      FROM recurring_transactions rt
      LEFT JOIN categories c ON rt.category_id = c.id
      WHERE rt.id = ?
    `, [result.insertId]);
    res.json({ success: true, data: recurringTransaction[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/recurring-transactions/:id', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { id } = req.params;
    const { amount, description, type, frequency, category_id, account_id, start_date, end_date, next_occurrence, is_active } = req.body;
    await db.query(
      'UPDATE recurring_transactions SET amount = ?, description = ?, type = ?, frequency = ?, category_id = ?, account_id = ?, start_date = ?, end_date = ?, next_occurrence = ?, is_active = ? WHERE id = ? AND user_id = ?',
      [amount, description, type, frequency, category_id, account_id, start_date, end_date, next_occurrence, is_active, id, 1]
    );
    const recurringTransaction = await db.query(`
      SELECT rt.*, c.name as category_name, c.color as category_color
      FROM recurring_transactions rt
      LEFT JOIN categories c ON rt.category_id = c.id
      WHERE rt.id = ?
    `, [id]);
    res.json({ success: true, data: recurringTransaction[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/recurring-transactions/:id', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { id } = req.params;
    await db.query('DELETE FROM recurring_transactions WHERE id = ? AND user_id = ?', [id, 1]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== ASSETS CRUD ==========
app.get('/api/assets', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const assets = await db.query(`
      SELECT * FROM assets
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [1]);
    res.json({ success: true, data: assets });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/assets', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { name, type, purchase_price, current_value, purchase_date, description, depreciation_rate } = req.body;
    const result = await db.query(
      'INSERT INTO assets (name, type, purchase_price, current_value, purchase_date, description, depreciation_rate, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, type, purchase_price, current_value || purchase_price, purchase_date, description, depreciation_rate || 0, 1]
    );
    const asset = await db.query('SELECT * FROM assets WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: asset[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/assets/:id', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { id } = req.params;
    const { name, type, purchase_price, current_value, purchase_date, description, depreciation_rate } = req.body;
    await db.query(
      'UPDATE assets SET name = ?, type = ?, purchase_price = ?, current_value = ?, purchase_date = ?, description = ?, depreciation_rate = ? WHERE id = ? AND user_id = ?',
      [name, type, purchase_price, current_value, purchase_date, description, depreciation_rate, id, 1]
    );
    const asset = await db.query('SELECT * FROM assets WHERE id = ?', [id]);
    res.json({ success: true, data: asset[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/assets/:id', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { id } = req.params;
    await db.query('DELETE FROM assets WHERE id = ? AND user_id = ?', [id, 1]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== SAVINGS GOALS CRUD ==========
app.get('/api/savings-goals', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const savingsGoals = await db.query(`
      SELECT sg.*, a.name as account_name
      FROM savings_goals sg
      LEFT JOIN accounts a ON sg.account_id = a.id
      WHERE sg.user_id = ?
      ORDER BY sg.created_at DESC
    `, [1]);
    res.json({ success: true, data: savingsGoals });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/savings-goals', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { name, target_amount, current_amount, target_date, description, priority, account_id } = req.body;
    const result = await db.query(
      'INSERT INTO savings_goals (name, target_amount, current_amount, target_date, description, priority, account_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, target_amount, current_amount || 0, target_date, description, priority || 'medium', account_id, 1]
    );
    const savingsGoal = await db.query(`
      SELECT sg.*, a.name as account_name
      FROM savings_goals sg
      LEFT JOIN accounts a ON sg.account_id = a.id
      WHERE sg.id = ?
    `, [result.insertId]);
    res.json({ success: true, data: savingsGoal[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/savings-goals/:id', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { id } = req.params;
    const { name, target_amount, current_amount, target_date, description, priority, account_id, is_completed } = req.body;
    await db.query(
      'UPDATE savings_goals SET name = ?, target_amount = ?, current_amount = ?, target_date = ?, description = ?, priority = ?, account_id = ?, is_completed = ? WHERE id = ? AND user_id = ?',
      [name, target_amount, current_amount, target_date, description, priority, account_id, is_completed, id, 1]
    );
    const savingsGoal = await db.query(`
      SELECT sg.*, a.name as account_name
      FROM savings_goals sg
      LEFT JOIN accounts a ON sg.account_id = a.id
      WHERE sg.id = ?
    `, [id]);
    res.json({ success: true, data: savingsGoal[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/savings-goals/:id', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { id } = req.params;
    await db.query('DELETE FROM savings_goals WHERE id = ? AND user_id = ?', [id, 1]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== ENTITIES CRUD ==========
app.get('/api/entities', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const entities = await db.query(`
      SELECT * FROM entities
      WHERE user_id = ?
      ORDER BY name ASC
    `, [1]);
    res.json({ success: true, data: entities });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/entities', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { name, type } = req.body;
    const result = await db.query(
      'INSERT INTO entities (name, type, user_id) VALUES (?, ?, ?)',
      [name, type || 'vendor', 1]
    );
    const entity = await db.query('SELECT * FROM entities WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: entity[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/entities/:id', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { id } = req.params;
    const { name, type, is_active } = req.body;
    await db.query(
      'UPDATE entities SET name = ?, type = ?, is_active = ? WHERE id = ? AND user_id = ?',
      [name, type, is_active, id, 1]
    );
    const entity = await db.query('SELECT * FROM entities WHERE id = ?', [id]);
    res.json({ success: true, data: entity[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/entities/:id', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { id } = req.params;
    await db.query('DELETE FROM entities WHERE id = ? AND user_id = ?', [id, 1]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== AI RULES CRUD ==========
app.get('/api/ai-rules', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const aiRules = await db.query(`
      SELECT * FROM ai_rules
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [1]);
    res.json({ success: true, data: aiRules });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/ai-rules', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { name, description, conditions, actions } = req.body;
    const result = await db.query(
      'INSERT INTO ai_rules (name, description, conditions, actions, user_id) VALUES (?, ?, ?, ?, ?)',
      [name, description, JSON.stringify(conditions), JSON.stringify(actions), 1]
    );
    const aiRule = await db.query('SELECT * FROM ai_rules WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: aiRule[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/ai-rules/:id', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { id } = req.params;
    const { name, description, conditions, actions, is_active } = req.body;
    await db.query(
      'UPDATE ai_rules SET name = ?, description = ?, conditions = ?, actions = ?, is_active = ? WHERE id = ? AND user_id = ?',
      [name, description, JSON.stringify(conditions), JSON.stringify(actions), is_active, id, 1]
    );
    const aiRule = await db.query('SELECT * FROM ai_rules WHERE id = ?', [id]);
    res.json({ success: true, data: aiRule[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/ai-rules/:id', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { id } = req.params;
    await db.query('DELETE FROM ai_rules WHERE id = ? AND user_id = ?', [id, 1]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== IMPORT/EXPORT ENDPOINTS ==========
app.post('/api/import/transactions', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    
    const { transactions, smartImport } = req.body;
    
    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({
        success: false,
        error: 'Transactions array is required'
      });
    }

    const results = {
      imported: 0,
      duplicates: 0,
      errors: []
    };

    for (const transaction of transactions) {
      try {
        // Check for duplicates if smart import is enabled
        if (smartImport) {
          const existing = await db.query(`
            SELECT id FROM transactions 
            WHERE description = ? AND amount = ? AND date = ? AND user_id = ?
          `, [transaction.description, transaction.amount, transaction.date, 1]);
          
          if (existing.length > 0) {
            results.duplicates++;
            continue;
          }
        }

        // Insert transaction
        const result = await db.query(
          'INSERT INTO transactions (amount, description, type, category_id, account_id, date, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            transaction.amount, 
            transaction.description, 
            transaction.type || 'expense',
            transaction.category_id || null,
            transaction.account_id || null,
            transaction.date,
            1
          ]
        );

        // Update account balance if account specified
        if (transaction.account_id) {
          const balanceChange = (transaction.type || 'expense') === 'income' ? transaction.amount : -transaction.amount;
          await db.query(
            'UPDATE accounts SET balance = balance + ? WHERE id = ?',
            [balanceChange, transaction.account_id]
          );
        }

        results.imported++;
      } catch (error) {
        results.errors.push({
          transaction: transaction.description,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      data: results,
      message: `${results.imported} transactions imported, ${results.duplicates} duplicates skipped`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reports endpoint
app.get('/api/reports/summary', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    
    const { startDate, endDate } = req.query;
    
    // Get basic financial summary
    const transactions = await db.query(`
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expenses,
        COUNT(*) as total_transactions
      FROM transactions 
      WHERE user_id = ? 
      ${startDate ? 'AND date >= ?' : ''} 
      ${endDate ? 'AND date <= ?' : ''}
    `, [1, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : [])]);
    
    const accounts = await db.query('SELECT SUM(balance) as total_balance FROM accounts WHERE user_id = ?', [1]);
    
    res.json({
      success: true,
      data: {
        totalIncome: transactions[0]?.total_income || 0,
        totalExpenses: transactions[0]?.total_expenses || 0,
        totalTransactions: transactions[0]?.total_transactions || 0,
        totalBalance: accounts[0]?.total_balance || 0,
        netIncome: (transactions[0]?.total_income || 0) - (transactions[0]?.total_expenses || 0)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve static files AFTER API routes
app.use(express.static(path.join(__dirname, '../dist')));

// ========== SAMPLE DATA INITIALIZATION ==========
app.post('/api/init-sample-data', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    
    // Check if data already exists
    const existingTransactions = await db.query('SELECT COUNT(*) as count FROM transactions WHERE user_id = ?', [1]);
    if (existingTransactions[0].count > 0) {
      return res.json({ success: true, message: 'Sample data already exists' });
    }

    // Sample categories
    const categories = [
      { name: 'Alimentação', type: 'expense', color: '#ef4444', icon: 'utensils' },
      { name: 'Transporte', type: 'expense', color: '#f97316', icon: 'car' },
      { name: 'Saúde', type: 'expense', color: '#22c55e', icon: 'heart' },
      { name: 'Entretenimento', type: 'expense', color: '#8b5cf6', icon: 'gamepad2' },
      { name: 'Salário', type: 'income', color: '#10b981', icon: 'banknote' },
      { name: 'Freelance', type: 'income', color: '#06b6d4', icon: 'laptop' }
    ];

    const categoryIds = [];
    for (const cat of categories) {
      const result = await db.query(
        'INSERT INTO categories (name, type, color, icon, user_id) VALUES (?, ?, ?, ?, ?)',
        [cat.name, cat.type, cat.color, cat.icon, 1]
      );
      categoryIds.push(result.insertId);
    }

    // Sample accounts
    const accounts = [
      { name: 'Conta Corrente', type: 'checking', balance: 2500.00, currency: 'EUR' },
      { name: 'Poupança', type: 'savings', balance: 15000.00, currency: 'EUR' },
      { name: 'Cartão de Crédito', type: 'credit', balance: -850.00, currency: 'EUR' }
    ];

    const accountIds = [];
    for (const acc of accounts) {
      const result = await db.query(
        'INSERT INTO accounts (name, type, balance, currency, user_id) VALUES (?, ?, ?, ?, ?)',
        [acc.name, acc.type, acc.balance, acc.currency, 1]
      );
      accountIds.push(result.insertId);
    }

    // Sample transactions (last 30 days)
    const transactions = [
      { amount: 2800.00, description: 'Salário mensal', type: 'income', category_idx: 4, days_ago: 1 },
      { amount: -45.50, description: 'Supermercado', type: 'expense', category_idx: 0, days_ago: 2 },
      { amount: -12.00, description: 'Metro', type: 'expense', category_idx: 1, days_ago: 3 },
      { amount: -85.00, description: 'Jantar restaurante', type: 'expense', category_idx: 3, days_ago: 5 },
      { amount: -35.00, description: 'Farmácia', type: 'expense', category_idx: 2, days_ago: 7 },
      { amount: 450.00, description: 'Projeto freelance', type: 'income', category_idx: 5, days_ago: 10 },
      { amount: -120.00, description: 'Compras supermercado', type: 'expense', category_idx: 0, days_ago: 12 },
      { amount: -25.00, description: 'Cinema', type: 'expense', category_idx: 3, days_ago: 15 },
      { amount: -60.00, description: 'Combustível', type: 'expense', category_idx: 1, days_ago: 18 },
      { amount: -18.50, description: 'Lanche', type: 'expense', category_idx: 0, days_ago: 20 }
    ];

    for (const trans of transactions) {
      const date = new Date();
      date.setDate(date.getDate() - trans.days_ago);
      await db.query(
        'INSERT INTO transactions (amount, description, type, category_id, account_id, date, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [Math.abs(trans.amount), trans.description, trans.type, categoryIds[trans.category_idx], accountIds[0], date.toISOString().split('T')[0], 1]
      );
    }

    // Sample budget
    await db.query(
      'INSERT INTO budgets (name, amount, category_id, period, start_date, end_date, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['Orçamento Alimentação', 400.00, categoryIds[0], 'monthly', new Date().toISOString().split('T')[0], 
       new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0], 1]
    );

    // Sample investment
    await db.query(
      'INSERT INTO investments (name, symbol, type, quantity, purchase_price, current_price, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['Apple Inc.', 'AAPL', 'stock', 10, 150.00, 175.00, 1]
    );

    // Sample savings goal
    const targetDate = new Date();
    targetDate.setFullYear(targetDate.getFullYear() + 1);
    await db.query(
      'INSERT INTO savings_goals (name, target_amount, current_amount, target_date, description, priority, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['Férias de Verão', 3000.00, 1200.00, targetDate.toISOString().split('T')[0], 'Viagem para a Grécia', 'high', 1]
    );

    res.json({ success: true, message: 'Sample data initialized successfully' });
  } catch (error) {
    console.error('Error initializing sample data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== ENTITIES CRUD ==========
app.get('/api/entities', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const entities = await db.query('SELECT DISTINCT entity FROM transactions WHERE entity IS NOT NULL ORDER BY entity');
    const entityList = entities.map(row => ({ name: row.entity, count: 1 }));
    res.json({ success: true, data: entityList });
  } catch (error) {
    console.error('Error fetching entities:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== AI RULES CRUD ==========
// AI Rules endpoints are defined earlier in the file

// ========== SAVINGS GOALS CRUD ==========
app.get('/api/savings-goals', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const goals = await db.query('SELECT * FROM savings_goals WHERE user_id = ? ORDER BY created_at DESC', [1]);
    res.json({ success: true, data: goals });
  } catch (error) {
    console.error('Error fetching savings goals:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/savings-goals', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { name, target_amount, target_date, description, priority } = req.body;
    const result = await db.query(
      'INSERT INTO savings_goals (name, target_amount, current_amount, target_date, description, priority, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, target_amount, 0, target_date, description || '', priority || 'medium', 1]
    );
    const goal = await db.query('SELECT * FROM savings_goals WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: goal[0] });
  } catch (error) {
    console.error('Error creating savings goal:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== SMART IMPORT ENDPOINT ==========
app.post('/api/import/transactions', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    const { transactions, smartImport } = req.body;
    
    let imported = 0;
    let duplicates = 0;
    let errors = [];
    
    for (const transaction of transactions) {
      try {
        // Check for duplicates
        const existing = await db.query(
          'SELECT id FROM transactions WHERE description = ? AND amount = ? AND date = ? AND account_id = ?',
          [transaction.description, transaction.amount, transaction.date, transaction.account_id]
        );
        
        if (existing.length > 0) {
          duplicates++;
          continue;
        }
        
        // Insert transaction
        await db.query(`
          INSERT INTO transactions (type, amount, description, category_id, account_id, date, entity, user_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [
          transaction.type,
          transaction.amount,
          transaction.description,
          transaction.category_id,
          transaction.account_id,
          transaction.date,
          transaction.entity || 'Importação',
          1
        ]);
        
        imported++;
      } catch (error) {
        errors.push(`Error importing transaction: ${error.message}`);
      }
    }
    
    res.json({
      success: true,
      message: `Importação concluída: ${imported} importadas, ${duplicates} duplicadas`,
      data: { imported, duplicates, errors }
    });
  } catch (error) {
    console.error('Error importing transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API 404 handler - must come before the catch-all route
// TEMPORARILY COMMENTED OUT - This was interfering with API routes
// app.use('/api/*', (req, res) => {
//   console.error('API endpoint not found:', req.path);
//   res.status(404).json({ 
//     success: false, 
//     error: 'API endpoint not found',
//     path: req.path 
//   });
// });

// Serve static assets
app.use(express.static(path.resolve(__dirname, '../dist')));

// Serve React app for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../dist/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Initialize database connection with retries
const initializeWithRetry = async (retries = 10, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`🔄 Attempting database connection (attempt ${i + 1}/${retries})`);
      
      await db.createConnection({
        host: process.env.DB_HOST || 'mariadb',
        port: parseInt(process.env.DB_PORT) || 3306,
        username: process.env.DB_USER || 'finance_user',
        password: getDbPassword(),
        database: process.env.DB_NAME || 'personal_finance',
        useSSL: process.env.DB_SSL === 'true'
      });
      
      // Test the connection
      const testResult = await db.query('SELECT 1 as test');
      console.log('✅ Database connection successful:', testResult);
      
      // Initialize schema
      await db.initializeSchema();
      console.log('✅ Database schema initialized');
      
      // Ensure default user (id=1) exists to satisfy FK references
      try {
        await db.query(
          'INSERT IGNORE INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)',
          [1, 'system@local', 'System', 'system']
        );
        console.log('✅ Default system user ensured (id=1)');
        
        // Seed sample data only when explicitly enabled
        if (process.env.SEED_SAMPLE_DATA === 'true') {
          const existingData = await db.query('SELECT COUNT(*) as count FROM transactions WHERE user_id = ?', [1]);
          if (existingData[0].count === 0) {
            console.log('🔄 Seeding sample data (SEED_SAMPLE_DATA=true)...');
            const response = await fetch(`http://localhost:${PORT}/api/init-sample-data`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            if (response.ok) {
              console.log('✅ Sample data initialized');
            }
          }
        } else {
          console.log('ℹ️ Sample data seeding disabled (SEED_SAMPLE_DATA!=true)');
        }
      } catch (seedErr) {
        console.warn('⚠️ Could not ensure base user:', seedErr.message);
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Database connection attempt ${i + 1} failed:`, error.message);
      if (i < retries - 1) {
        console.log(`⏳ Waiting ${delay/1000}s before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw new Error('Failed to connect to database after all retries');
};

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Personal Finance Manager running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  
  try {
    await initializeWithRetry();
    console.log('✅ Server fully initialized with database');
  } catch (error) {
    console.error('❌ Failed to initialize database connection:', error.message);
  }
});