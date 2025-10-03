import express from 'express';
const router = express.Router();
import { logger } from '../services/LoggerService.js';
import { cache } from '../services/CacheService.js';
import { validateRequest, schemas } from '../middleware/security.js';

import { DatabaseService } from '../db-commonjs.js';
const db = new DatabaseService();

// Middleware to simulate a public user for all routes (no authentication required)
router.use((req, res, next) => {
  req.user = {
    userId: 'public-user',
    email: 'public@mymoney.app',
    name: 'Public User'
  };
  next();
});

// Cache middleware for GET requests
const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') return next();
    
    // Use generic key since no authentication is required
    const key = `api:${req.originalUrl}:public`;
    
    try {
      const cached = await cache.get(key);
      if (cached) {
        logger.debug('Cache hit', { key, type: 'public' });
        return res.json(cached);
      }
    } catch (error) {
      logger.warn('Cache error', error);
    }
    
    // Store original json method
    const originalJson = res.json;
    res.json = function(data) {
      // Cache successful responses
      if (res.statusCode === 200) {
        cache.set(key, data, duration).catch(err => 
          logger.warn('Failed to cache response', err)
        );
      }
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Database status
router.get('/database/status', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Database status check failed', error);
    res.status(500).json({ status: 'disconnected', error: error.message });
  }
});

// User settings
router.get('/user/settings', cacheMiddleware(600), async (req, res) => {
  try {
    const settings = await db.query(
      'SELECT * FROM user_settings WHERE user_id = ?',
      [req.user.userId]
    );
    
    logger.debug('User settings retrieved', { userId: req.user.userId });
    res.json(settings);
  } catch (error) {
    logger.error('Failed to get user settings', error, { userId: req.user.userId });
    res.status(500).json({ error: 'Failed to get user settings' });
  }
});

router.post('/user/settings', validateRequest(schemas.userSettings), async (req, res) => {
  try {
    const { setting_key, setting_value } = req.body;
    
    await db.query(
      'INSERT INTO user_settings (user_id, setting_key, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
      [req.user.userId, setting_key, setting_value]
    );
    
    // Invalidate cache
    await cache.deletePattern(`api:/api/user/settings:${req.user.userId}`);
    
    logger.audit('USER_SETTING_UPDATE', req.user.userId, { setting_key });
    res.json({ message: 'Setting updated successfully' });
  } catch (error) {
    logger.error('Failed to update user setting', error, { userId: req.user.userId });
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// Categories
router.get('/categories', cacheMiddleware(300), async (req, res) => {
  try {
    const categories = await db.query(
      'SELECT * FROM categories WHERE user_id = ? ORDER BY name',
      [req.user.userId]
    );
    
    res.json(categories);
  } catch (error) {
    logger.error('Failed to get categories', error, { userId: req.user.userId });
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

router.post('/categories', validateRequest(schemas.category), async (req, res) => {
  try {
    const { name, type, color, icon } = req.body;
    
    const result = await db.query(
      'INSERT INTO categories (user_id, name, type, color, icon) VALUES (?, ?, ?, ?, ?)',
      [req.user.userId, name, type, color, icon]
    );
    
    // Invalidate cache
    await cache.deletePattern(`api:/api/categories:${req.user.userId}`);
    
    logger.audit('CATEGORY_CREATE', req.user.userId, { categoryId: result.insertId, name });
    res.status(201).json({ id: result.insertId, message: 'Category created successfully' });
  } catch (error) {
    logger.error('Failed to create category', error, { userId: req.user.userId });
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/categories/:id', validateRequest(schemas.category), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, color, icon } = req.body;
    
    const result = await db.query(
      'UPDATE categories SET name = ?, type = ?, color = ?, icon = ? WHERE id = ? AND user_id = ?',
      [name, type, color, icon, id, req.user.userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Invalidate cache
    await cache.deletePattern(`api:/api/categories:${req.user.userId}`);
    
    logger.audit('CATEGORY_UPDATE', req.user.userId, { categoryId: id, name });
    res.json({ message: 'Category updated successfully' });
  } catch (error) {
    logger.error('Failed to update category', error, { userId: req.user.userId, categoryId: req.params.id });
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if category is used in transactions
    const usage = await db.query(
      'SELECT COUNT(*) as count FROM transactions WHERE category_id = ? AND user_id = ?',
      [id, req.user.userId]
    );
    
    if (usage[0].count > 0) {
      return res.status(400).json({ error: 'Cannot delete category that is used in transactions' });
    }
    
    const result = await db.query(
      'DELETE FROM categories WHERE id = ? AND user_id = ?',
      [id, req.user.userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Invalidate cache
    await cache.deletePattern(`api:/api/categories:${req.user.userId}`);
    
    logger.audit('CATEGORY_DELETE', req.user.userId, { categoryId: id });
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete category', error, { userId: req.user.userId, categoryId: req.params.id });
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// Accounts
router.get('/accounts', cacheMiddleware(300), async (req, res) => {
  try {
    const accounts = await db.query(
      'SELECT * FROM accounts WHERE user_id = ? ORDER BY name',
      [req.user.userId]
    );
    
    res.json(accounts);
  } catch (error) {
    logger.error('Failed to get accounts', error, { userId: req.user.userId });
    res.status(500).json({ error: 'Failed to get accounts' });
  }
});

router.post('/accounts', validateRequest(schemas.account), async (req, res) => {
  try {
    const { name, type, balance, currency, bank_name, account_number } = req.body;
    
    const result = await db.query(
      'INSERT INTO accounts (user_id, name, type, balance, currency, bank_name, account_number) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.userId, name, type, balance, currency, bank_name, account_number]
    );
    
    // Invalidate cache
    await cache.deletePattern(`api:/api/accounts:${req.user.userId}`);
    
    logger.audit('ACCOUNT_CREATE', req.user.userId, { accountId: result.insertId, name });
    res.status(201).json({ id: result.insertId, message: 'Account created successfully' });
  } catch (error) {
    logger.error('Failed to create account', error, { userId: req.user.userId });
    res.status(500).json({ error: 'Failed to create account' });
  }
});

router.put('/accounts/:id', validateRequest(schemas.account), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, balance, currency, bank_name, account_number } = req.body;
    
    const result = await db.query(
      'UPDATE accounts SET name = ?, type = ?, balance = ?, currency = ?, bank_name = ?, account_number = ? WHERE id = ? AND user_id = ?',
      [name, type, balance, currency, bank_name, account_number, id, req.user.userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Invalidate cache
    await cache.deletePattern(`api:/api/accounts:${req.user.userId}`);
    
    logger.audit('ACCOUNT_UPDATE', req.user.userId, { accountId: id, name });
    res.json({ message: 'Account updated successfully' });
  } catch (error) {
    logger.error('Failed to update account', error, { userId: req.user.userId, accountId: req.params.id });
    res.status(500).json({ error: 'Failed to update account' });
  }
});

router.delete('/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if account is used in transactions
    const usage = await db.query(
      'SELECT COUNT(*) as count FROM transactions WHERE account_id = ? AND user_id = ?',
      [id, req.user.userId]
    );
    
    if (usage[0].count > 0) {
      return res.status(400).json({ error: 'Cannot delete account that has transactions' });
    }
    
    const result = await db.query(
      'DELETE FROM accounts WHERE id = ? AND user_id = ?',
      [id, req.user.userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Invalidate cache
    await cache.deletePattern(`api:/api/accounts:${req.user.userId}`);
    
    logger.audit('ACCOUNT_DELETE', req.user.userId, { accountId: id });
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete account', error, { userId: req.user.userId, accountId: req.params.id });
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Transactions
router.get('/transactions', cacheMiddleware(60), async (req, res) => {
  try {
    const { page = 1, limit = 50, account_id, category_id, type, start_date, end_date } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT t.*, c.name as category_name, c.color as category_color
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ?
    `;
    const params = [req.user.userId];
    
    if (category_id) {
      query += ' AND t.category_id = ?';
      params.push(category_id);
    }
    
    if (type) {
      query += ' AND t.type = ?';
      params.push(type);
    }
    
    if (start_date) {
      query += ' AND t.transaction_date >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND t.transaction_date <= ?';
      params.push(end_date);
    }
    
    query += ' ORDER BY t.transaction_date DESC, t.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const transactions = await db.query(query, params);
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM transactions WHERE user_id = ?';
    const countParams = [req.user.userId];
    
    if (category_id) {
      countQuery += ' AND category_id = ?';
      countParams.push(category_id);
    }
    
    if (type) {
      countQuery += ' AND type = ?';
      countParams.push(type);
    }
    
    if (start_date) {
      countQuery += ' AND transaction_date >= ?';
      countParams.push(start_date);
    }
    
    if (end_date) {
      countQuery += ' AND transaction_date <= ?';
      countParams.push(end_date);
    }
    
    const countResult = await db.query(countQuery, countParams);
    const total = countResult[0].total;
    
    res.json({
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Failed to get transactions', error, { userId: req.user.userId });
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

router.post('/transactions', validateRequest(schemas.transaction), async (req, res) => {
  try {
    const { account_id, category_id, amount, type, description, date, tags } = req.body;
    
    // Start transaction
    await db.query('START TRANSACTION');
    
    try {
      // Insert transaction
      const result = await db.query(
        'INSERT INTO transactions (user_id, account_id, category_id, amount, type, description, date, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [req.user.userId, account_id, category_id, amount, type, description, date, JSON.stringify(tags || [])]
      );
      
      // Update account balance
      const balanceChange = type === 'income' ? amount : -amount;
      await db.query(
        'UPDATE accounts SET balance = balance + ? WHERE id = ? AND user_id = ?',
        [balanceChange, account_id, req.user.userId]
      );
      
      await db.query('COMMIT');
      
      // Invalidate cache
      await cache.deletePattern(`api:/api/transactions:${req.user.userId}`);
      await cache.deletePattern(`api:/api/accounts:${req.user.userId}`);
      
      logger.audit('TRANSACTION_CREATE', req.user.userId, { 
        transactionId: result.insertId, 
        amount, 
        type,
        accountId: account_id 
      });
      
      res.status(201).json({ id: result.insertId, message: 'Transaction created successfully' });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.error('Failed to create transaction', error, { userId: req.user.userId });
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

router.put('/transactions/:id', validateRequest(schemas.transaction), async (req, res) => {
  try {
    const { id } = req.params;
    const { account_id, category_id, amount, type, description, date, tags } = req.body;
    
    // Get original transaction for balance adjustment
    const original = await db.query(
      'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
      [id, req.user.userId]
    );
    
    if (original.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    await db.query('START TRANSACTION');
    
    try {
      // Revert original balance change
      const originalBalanceChange = original[0].type === 'income' ? -original[0].amount : original[0].amount;
      await db.query(
        'UPDATE accounts SET balance = balance + ? WHERE id = ? AND user_id = ?',
        [originalBalanceChange, original[0].account_id, req.user.userId]
      );
      
      // Update transaction
      await db.query(
        'UPDATE transactions SET account_id = ?, category_id = ?, amount = ?, type = ?, description = ?, date = ?, tags = ? WHERE id = ? AND user_id = ?',
        [account_id, category_id, amount, type, description, date, JSON.stringify(tags || []), id, req.user.userId]
      );
      
      // Apply new balance change
      const newBalanceChange = type === 'income' ? amount : -amount;
      await db.query(
        'UPDATE accounts SET balance = balance + ? WHERE id = ? AND user_id = ?',
        [newBalanceChange, account_id, req.user.userId]
      );
      
      await db.query('COMMIT');
      
      // Invalidate cache
      await cache.deletePattern(`api:/api/transactions:${req.user.userId}`);
      await cache.deletePattern(`api:/api/accounts:${req.user.userId}`);
      
      logger.audit('TRANSACTION_UPDATE', req.user.userId, { 
        transactionId: id, 
        amount, 
        type,
        accountId: account_id 
      });
      
      res.json({ message: 'Transaction updated successfully' });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.error('Failed to update transaction', error, { userId: req.user.userId, transactionId: req.params.id });
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

router.delete('/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get transaction for balance adjustment
    const transaction = await db.query(
      'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
      [id, req.user.userId]
    );
    
    if (transaction.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    await db.query('START TRANSACTION');
    
    try {
      // Revert balance change
      const balanceChange = transaction[0].type === 'income' ? -transaction[0].amount : transaction[0].amount;
      await db.query(
        'UPDATE accounts SET balance = balance + ? WHERE id = ? AND user_id = ?',
        [balanceChange, transaction[0].account_id, req.user.userId]
      );
      
      // Delete transaction
      await db.query(
        'DELETE FROM transactions WHERE id = ? AND user_id = ?',
        [id, req.user.userId]
      );
      
      await db.query('COMMIT');
      
      // Invalidate cache
      await cache.deletePattern(`api:/api/transactions:${req.user.userId}`);
      await cache.deletePattern(`api:/api/accounts:${req.user.userId}`);
      
      logger.audit('TRANSACTION_DELETE', req.user.userId, { 
        transactionId: id,
        amount: transaction[0].amount,
        type: transaction[0].type
      });
      
      res.json({ message: 'Transaction deleted successfully' });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.error('Failed to delete transaction', error, { userId: req.user.userId, transactionId: req.params.id });
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// Budgets
router.get('/budgets', cacheMiddleware(300), async (req, res) => {
  try {
    const budgets = await db.query(
      `SELECT b.*, c.name as category_name, c.color as category_color,
              COALESCE(SUM(t.amount), 0) as spent
       FROM budgets b
       LEFT JOIN categories c ON b.category_id = c.id
       LEFT JOIN transactions t ON b.category_id = t.category_id 
                                AND t.user_id = b.user_id 
                                AND t.type = 'expense'
                                AND t.transaction_date >= b.start_date 
                                AND t.transaction_date <= b.end_date
       WHERE b.user_id = ?
       GROUP BY b.id
       ORDER BY b.start_date DESC`,
      [req.user.userId]
    );
    
    res.json(budgets);
  } catch (error) {
    logger.error('Failed to get budgets', error, { userId: req.user.userId });
    res.status(500).json({ error: 'Failed to get budgets' });
  }
});

router.post('/budgets', validateRequest(schemas.budget), async (req, res) => {
  try {
    const { category_id, amount, start_date, end_date, name } = req.body;
    
    const result = await db.query(
      'INSERT INTO budgets (user_id, category_id, amount, start_date, end_date, name) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.userId, category_id, amount, start_date, end_date, name]
    );
    
    // Invalidate cache
    await cache.deletePattern(`api:/api/budgets:${req.user.userId}`);
    
    logger.audit('BUDGET_CREATE', req.user.userId, { budgetId: result.insertId, name, amount });
    res.status(201).json({ id: result.insertId, message: 'Budget created successfully' });
  } catch (error) {
    logger.error('Failed to create budget', error, { userId: req.user.userId });
    res.status(500).json({ error: 'Failed to create budget' });
  }
});

// ========== RECURRING TRANSACTIONS CRUD ==========
router.get('/recurring-transactions', cacheMiddleware(300), async (req, res) => {
  try {
    const recurringTransactions = await db.query(`
      SELECT rt.*, c.name as category_name, c.color as category_color
      FROM recurring_transactions rt
      LEFT JOIN categories c ON rt.category_id = c.id
      WHERE rt.user_id = ?
      ORDER BY rt.created_at DESC
    `, [req.user.userId]);
    
    logger.info('Retrieved recurring transactions', { 
      userId: req.user.userId, 
      count: recurringTransactions.length 
    });
    
    res.json({ success: true, data: recurringTransactions });
  } catch (error) {
    logger.error('Failed to retrieve recurring transactions', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to retrieve recurring transactions' });
  }
});

router.post('/recurring-transactions', validateRequest(schemas.transaction), async (req, res) => {
  try {
    const { amount, description, type, frequency, category_id, account_id, start_date, end_date, next_occurrence } = req.body;
    
    const result = await db.query(
      'INSERT INTO recurring_transactions (amount, description, type, frequency, category_id, account_id, start_date, end_date, next_occurrence, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [amount, description, type, frequency, category_id, account_id, start_date, end_date, next_occurrence || start_date, req.user.userId]
    );
    
    const recurringTransaction = await db.query(`
      SELECT rt.*, c.name as category_name, c.color as category_color
      FROM recurring_transactions rt
      LEFT JOIN categories c ON rt.category_id = c.id
      WHERE rt.id = ?
    `, [result.insertId]);
    
    logger.info('Created recurring transaction', { 
      userId: req.user.userId, 
      transactionId: result.insertId 
    });
    
    res.json({ success: true, data: recurringTransaction[0] });
  } catch (error) {
    logger.error('Failed to create recurring transaction', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to create recurring transaction' });
  }
});

router.put('/recurring-transactions/:id', validateRequest(schemas.transaction), async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description, type, frequency, category_id, account_id, start_date, end_date, next_occurrence, is_active } = req.body;
    
    await db.query(
      'UPDATE recurring_transactions SET amount = ?, description = ?, type = ?, frequency = ?, category_id = ?, account_id = ?, start_date = ?, end_date = ?, next_occurrence = ?, is_active = ? WHERE id = ? AND user_id = ?',
      [amount, description, type, frequency, category_id, account_id, start_date, end_date, next_occurrence, is_active, id, req.user.userId]
    );
    
    const recurringTransaction = await db.query(`
      SELECT rt.*, c.name as category_name, c.color as category_color
      FROM recurring_transactions rt
      LEFT JOIN categories c ON rt.category_id = c.id
      WHERE rt.id = ?
    `, [id]);
    
    logger.info('Updated recurring transaction', { 
      userId: req.user.userId, 
      transactionId: id 
    });
    
    res.json({ success: true, data: recurringTransaction[0] });
  } catch (error) {
    logger.error('Failed to update recurring transaction', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to update recurring transaction' });
  }
});

router.delete('/recurring-transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.query('DELETE FROM recurring_transactions WHERE id = ? AND user_id = ?', [id, req.user.userId]);
    
    logger.info('Deleted recurring transaction', { 
      userId: req.user.userId, 
      transactionId: id 
    });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete recurring transaction', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to delete recurring transaction' });
  }
});

// ========== INVESTMENTS CRUD ==========
router.get('/investments', cacheMiddleware(300), async (req, res) => {
  try {
    const investments = await db.query(`
      SELECT i.*, a.name as account_name
      FROM investments i
      LEFT JOIN accounts a ON i.account_id = a.id
      WHERE i.user_id = ?
      ORDER BY i.created_at DESC
    `, [req.user.userId]);
    
    logger.info('Retrieved investments', { 
      userId: req.user.userId, 
      count: investments.length 
    });
    
    res.json({ success: true, data: investments });
  } catch (error) {
    logger.error('Failed to retrieve investments', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to retrieve investments' });
  }
});

router.post('/investments', validateRequest(schemas.transaction), async (req, res) => {
  try {
    const { name, symbol, type, quantity, purchase_price, current_price, purchase_date, account_id } = req.body;
    
    const result = await db.query(
      'INSERT INTO investments (name, symbol, type, quantity, purchase_price, current_price, purchase_date, account_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, symbol, type, quantity || 0, purchase_price || 0, current_price || purchase_price || 0, purchase_date, account_id, req.user.userId]
    );
    
    const investment = await db.query(`
      SELECT i.*, a.name as account_name
      FROM investments i
      LEFT JOIN accounts a ON i.account_id = a.id
      WHERE i.id = ?
    `, [result.insertId]);
    
    logger.info('Created investment', { 
      userId: req.user.userId, 
      investmentId: result.insertId 
    });
    
    res.json({ success: true, data: investment[0] });
  } catch (error) {
    logger.error('Failed to create investment', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to create investment' });
  }
});

router.put('/investments/:id', validateRequest(schemas.transaction), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, symbol, type, quantity, purchase_price, current_price, purchase_date, account_id } = req.body;
    
    await db.query(
      'UPDATE investments SET name = ?, symbol = ?, type = ?, quantity = ?, purchase_price = ?, current_price = ?, purchase_date = ?, account_id = ? WHERE id = ? AND user_id = ?',
      [name, symbol, type, quantity, purchase_price, current_price, purchase_date, account_id, id, req.user.userId]
    );
    
    const investment = await db.query(`
      SELECT i.*, a.name as account_name
      FROM investments i
      LEFT JOIN accounts a ON i.account_id = a.id
      WHERE i.id = ?
    `, [id]);
    
    logger.info('Updated investment', { 
      userId: req.user.userId, 
      investmentId: id 
    });
    
    res.json({ success: true, data: investment[0] });
  } catch (error) {
    logger.error('Failed to update investment', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to update investment' });
  }
});

router.delete('/investments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.query('DELETE FROM investments WHERE id = ? AND user_id = ?', [id, req.user.userId]);
    
    logger.info('Deleted investment', { 
      userId: req.user.userId, 
      investmentId: id 
    });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete investment', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to delete investment' });
  }
});

// ========== BUDGETS PUT/DELETE (missing routes) ==========
router.put('/budgets/:id', validateRequest(schemas.budget), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, amount, category_id, period, start_date, end_date } = req.body;
    
    await db.query(
      'UPDATE budgets SET name = ?, amount = ?, category_id = ?, period = ?, start_date = ?, end_date = ? WHERE id = ? AND user_id = ?',
      [name, amount, category_id, period, start_date, end_date, id, req.user.userId]
    );
    
    const budget = await db.query(`
      SELECT b.*, c.name as category_name, c.color as category_color
      FROM budgets b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.id = ?
    `, [id]);
    
    logger.info('Updated budget', { 
      userId: req.user.userId, 
      budgetId: id 
    });
    
    res.json({ success: true, data: budget[0] });
  } catch (error) {
    logger.error('Failed to update budget', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to update budget' });
  }
});

router.delete('/budgets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.query('DELETE FROM budgets WHERE id = ? AND user_id = ?', [id, req.user.userId]);
    
    logger.info('Deleted budget', { 
      userId: req.user.userId, 
      budgetId: id 
    });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete budget', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to delete budget' });
  }
});

// ========== ASSETS CRUD ==========
router.get('/assets', cacheMiddleware(300), async (req, res) => {
  try {
    const assets = await db.query(`
      SELECT * FROM assets
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [req.user.userId]);
    
    logger.info('Retrieved assets', { 
      userId: req.user.userId, 
      count: assets.length 
    });
    
    res.json({ success: true, data: assets });
  } catch (error) {
    logger.error('Failed to retrieve assets', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to retrieve assets' });
  }
});

router.post('/assets', validateRequest(schemas.transaction), async (req, res) => {
  try {
    const { name, type, purchase_price, current_value, purchase_date, description, depreciation_rate } = req.body;
    
    const result = await db.query(
      'INSERT INTO assets (name, type, purchase_price, current_value, purchase_date, description, depreciation_rate, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, type, purchase_price, current_value || purchase_price, purchase_date, description, depreciation_rate || 0, req.user.userId]
    );
    
    const asset = await db.query('SELECT * FROM assets WHERE id = ?', [result.insertId]);
    
    logger.info('Created asset', { 
      userId: req.user.userId, 
      assetId: result.insertId 
    });
    
    res.json({ success: true, data: asset[0] });
  } catch (error) {
    logger.error('Failed to create asset', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to create asset' });
  }
});

router.put('/assets/:id', validateRequest(schemas.transaction), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, purchase_price, current_value, purchase_date, description, depreciation_rate } = req.body;
    
    await db.query(
      'UPDATE assets SET name = ?, type = ?, purchase_price = ?, current_value = ?, purchase_date = ?, description = ?, depreciation_rate = ? WHERE id = ? AND user_id = ?',
      [name, type, purchase_price, current_value, purchase_date, description, depreciation_rate, id, req.user.userId]
    );
    
    const asset = await db.query('SELECT * FROM assets WHERE id = ?', [id]);
    
    logger.info('Updated asset', { 
      userId: req.user.userId, 
      assetId: id 
    });
    
    res.json({ success: true, data: asset[0] });
  } catch (error) {
    logger.error('Failed to update asset', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to update asset' });
  }
});

router.delete('/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.query('DELETE FROM assets WHERE id = ? AND user_id = ?', [id, req.user.userId]);
    
    logger.info('Deleted asset', { 
      userId: req.user.userId, 
      assetId: id 
    });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete asset', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to delete asset' });
  }
});

// ========== SAVINGS GOALS CRUD ==========
router.get('/savings-goals', cacheMiddleware(300), async (req, res) => {
  try {
    const savingsGoals = await db.query(`
      SELECT sg.*, a.name as account_name
      FROM savings_goals sg
      LEFT JOIN accounts a ON sg.account_id = a.id
      WHERE sg.user_id = ?
      ORDER BY sg.created_at DESC
    `, [req.user.userId]);
    
    logger.info('Retrieved savings goals', { 
      userId: req.user.userId, 
      count: savingsGoals.length 
    });
    
    res.json({ success: true, data: savingsGoals });
  } catch (error) {
    logger.error('Failed to retrieve savings goals', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to retrieve savings goals' });
  }
});

router.post('/savings-goals', validateRequest(schemas.transaction), async (req, res) => {
  try {
    const { name, target_amount, current_amount, target_date, description, priority, account_id } = req.body;
    
    const result = await db.query(
      'INSERT INTO savings_goals (name, target_amount, current_amount, target_date, description, priority, account_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, target_amount, current_amount || 0, target_date, description, priority || 'medium', account_id, req.user.userId]
    );
    
    const savingsGoal = await db.query(`
      SELECT sg.*, a.name as account_name
      FROM savings_goals sg
      LEFT JOIN accounts a ON sg.account_id = a.id
      WHERE sg.id = ?
    `, [result.insertId]);
    
    logger.info('Created savings goal', { 
      userId: req.user.userId, 
      savingsGoalId: result.insertId 
    });
    
    res.json({ success: true, data: savingsGoal[0] });
  } catch (error) {
    logger.error('Failed to create savings goal', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to create savings goal' });
  }
});

router.put('/savings-goals/:id', validateRequest(schemas.transaction), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, target_amount, current_amount, target_date, description, priority, account_id, is_completed } = req.body;
    
    await db.query(
      'UPDATE savings_goals SET name = ?, target_amount = ?, current_amount = ?, target_date = ?, description = ?, priority = ?, account_id = ?, is_completed = ? WHERE id = ? AND user_id = ?',
      [name, target_amount, current_amount, target_date, description, priority, account_id, is_completed, id, req.user.userId]
    );
    
    const savingsGoal = await db.query(`
      SELECT sg.*, a.name as account_name
      FROM savings_goals sg
      LEFT JOIN accounts a ON sg.account_id = a.id
      WHERE sg.id = ?
    `, [id]);
    
    logger.info('Updated savings goal', { 
      userId: req.user.userId, 
      savingsGoalId: id 
    });
    
    res.json({ success: true, data: savingsGoal[0] });
  } catch (error) {
    logger.error('Failed to update savings goal', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to update savings goal' });
  }
});

router.delete('/savings-goals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.query('DELETE FROM savings_goals WHERE id = ? AND user_id = ?', [id, req.user.userId]);
    
    logger.info('Deleted savings goal', { 
      userId: req.user.userId, 
      savingsGoalId: id 
    });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete savings goal', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to delete savings goal' });
  }
});

// ========== ENTITIES CRUD ==========
router.get('/entities', cacheMiddleware(300), async (req, res) => {
  try {
    const entities = await db.query(`
      SELECT * FROM entities
      WHERE user_id = ?
      ORDER BY name ASC
    `, [req.user.userId]);
    
    logger.info('Retrieved entities', { 
      userId: req.user.userId, 
      count: entities.length 
    });
    
    res.json({ success: true, data: entities });
  } catch (error) {
    logger.error('Failed to retrieve entities', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to retrieve entities' });
  }
});

router.post('/entities', validateRequest(schemas.transaction), async (req, res) => {
  try {
    const { name, type } = req.body;
    
    const result = await db.query(
      'INSERT INTO entities (name, type, user_id) VALUES (?, ?, ?)',
      [name, type || 'vendor', req.user.userId]
    );
    
    const entity = await db.query('SELECT * FROM entities WHERE id = ?', [result.insertId]);
    
    logger.info('Created entity', { 
      userId: req.user.userId, 
      entityId: result.insertId 
    });
    
    res.json({ success: true, data: entity[0] });
  } catch (error) {
    logger.error('Failed to create entity', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to create entity' });
  }
});

router.put('/entities/:id', validateRequest(schemas.transaction), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, is_active } = req.body;
    
    await db.query(
      'UPDATE entities SET name = ?, type = ?, is_active = ? WHERE id = ? AND user_id = ?',
      [name, type, is_active, id, req.user.userId]
    );
    
    const entity = await db.query('SELECT * FROM entities WHERE id = ?', [id]);
    
    logger.info('Updated entity', { 
      userId: req.user.userId, 
      entityId: id 
    });
    
    res.json({ success: true, data: entity[0] });
  } catch (error) {
    logger.error('Failed to update entity', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to update entity' });
  }
});

router.delete('/entities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.query('DELETE FROM entities WHERE id = ? AND user_id = ?', [id, req.user.userId]);
    
    logger.info('Deleted entity', { 
      userId: req.user.userId, 
      entityId: id 
    });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete entity', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to delete entity' });
  }
});

// ========== AI RULES CRUD ==========
router.get('/ai-rules', cacheMiddleware(300), async (req, res) => {
  try {
    const aiRules = await db.query(`
      SELECT * FROM ai_rules
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [req.user.userId]);
    
    logger.info('Retrieved AI rules', { 
      userId: req.user.userId, 
      count: aiRules.length 
    });
    
    res.json({ success: true, data: aiRules });
  } catch (error) {
    logger.error('Failed to retrieve AI rules', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to retrieve AI rules' });
  }
});

router.post('/ai-rules', validateRequest(schemas.transaction), async (req, res) => {
  try {
    const { name, description, conditions, actions } = req.body;
    
    const result = await db.query(
      'INSERT INTO ai_rules (name, description, conditions, actions, user_id) VALUES (?, ?, ?, ?, ?)',
      [name, description, JSON.stringify(conditions), JSON.stringify(actions), req.user.userId]
    );
    
    const aiRule = await db.query('SELECT * FROM ai_rules WHERE id = ?', [result.insertId]);
    
    logger.info('Created AI rule', { 
      userId: req.user.userId, 
      aiRuleId: result.insertId 
    });
    
    res.json({ success: true, data: aiRule[0] });
  } catch (error) {
    logger.error('Failed to create AI rule', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to create AI rule' });
  }
});

router.put('/ai-rules/:id', validateRequest(schemas.transaction), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, conditions, actions, is_active } = req.body;
    
    await db.query(
      'UPDATE ai_rules SET name = ?, description = ?, conditions = ?, actions = ?, is_active = ? WHERE id = ? AND user_id = ?',
      [name, description, JSON.stringify(conditions), JSON.stringify(actions), is_active, id, req.user.userId]
    );
    
    const aiRule = await db.query('SELECT * FROM ai_rules WHERE id = ?', [id]);
    
    logger.info('Updated AI rule', { 
      userId: req.user.userId, 
      aiRuleId: id 
    });
    
    res.json({ success: true, data: aiRule[0] });
  } catch (error) {
    logger.error('Failed to update AI rule', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to update AI rule' });
  }
});

router.delete('/ai-rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.query('DELETE FROM ai_rules WHERE id = ? AND user_id = ?', [id, req.user.userId]);
    
    logger.info('Deleted AI rule', { 
      userId: req.user.userId, 
      aiRuleId: id 
    });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete AI rule', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to delete AI rule' });
  }
});

// ========== USER SETTINGS (fix route path) ==========
router.get('/user-settings', cacheMiddleware(600), async (req, res) => {
  try {
    const settings = await db.query(`
      SELECT * FROM user_settings
      WHERE user_id = ?
    `, [req.user.userId]);
    
    logger.info('Retrieved user settings', { 
      userId: req.user.userId 
    });
    
    res.json({ success: true, data: settings[0] || {} });
  } catch (error) {
    logger.error('Failed to retrieve user settings', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to retrieve user settings' });
  }
});

router.put('/user-settings', validateRequest(schemas.userSettings), async (req, res) => {
  try {
    const { currency, language, theme, date_format, number_format, timezone, notifications } = req.body;
    
    // Check if settings exist
    const existing = await db.query('SELECT id FROM user_settings WHERE user_id = ?', [req.user.userId]);
    
    if (existing.length > 0) {
      // Update existing settings
      await db.query(`
        UPDATE user_settings 
        SET currency = ?, language = ?, theme = ?, date_format = ?, number_format = ?, timezone = ?, notifications = ?
        WHERE user_id = ?
      `, [currency, language, theme, date_format, number_format, timezone, JSON.stringify(notifications), req.user.userId]);
    } else {
      // Insert new settings
      await db.query(`
        INSERT INTO user_settings (user_id, currency, language, theme, date_format, number_format, timezone, notifications)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [req.user.userId, currency, language, theme, date_format, number_format, timezone, JSON.stringify(notifications)]);
    }
    
    const settings = await db.query('SELECT * FROM user_settings WHERE user_id = ?', [req.user.userId]);
    
    logger.info('Updated user settings', { 
      userId: req.user.userId 
    });
    
    res.json({ success: true, data: settings[0] });
  } catch (error) {
    logger.error('Failed to update user settings', error, { userId: req.user.userId });
    res.status(500).json({ success: false, error: 'Failed to update user settings' });
  }
});

export default router;