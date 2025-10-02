const express = require('express');
const router = express.Router();
const { logger } = require('../services/LoggerService');
const { cache } = require('../services/CacheService');
const { validateRequest, schemas } = require('../middleware/security');

const { DatabaseService } = require('../db-commonjs');
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
      SELECT t.*, a.name as account_name, c.name as category_name, c.color as category_color
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ?
    `;
    const params = [req.user.userId];
    
    if (account_id) {
      query += ' AND t.account_id = ?';
      params.push(account_id);
    }
    
    if (category_id) {
      query += ' AND t.category_id = ?';
      params.push(category_id);
    }
    
    if (type) {
      query += ' AND t.type = ?';
      params.push(type);
    }
    
    if (start_date) {
      query += ' AND t.date >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND t.date <= ?';
      params.push(end_date);
    }
    
    query += ' ORDER BY t.date DESC, t.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const transactions = await db.query(query, params);
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM transactions WHERE user_id = ?';
    const countParams = [req.user.userId];
    
    if (account_id) {
      countQuery += ' AND account_id = ?';
      countParams.push(account_id);
    }
    
    if (category_id) {
      countQuery += ' AND category_id = ?';
      countParams.push(category_id);
    }
    
    if (type) {
      countQuery += ' AND type = ?';
      countParams.push(type);
    }
    
    if (start_date) {
      countQuery += ' AND date >= ?';
      countParams.push(start_date);
    }
    
    if (end_date) {
      countQuery += ' AND date <= ?';
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
                                AND t.date >= b.start_date 
                                AND t.date <= b.end_date
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

// Add more routes as needed for other entities...
// This is a comprehensive base that covers the main entities

module.exports = router;