const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const compression = require('compression');

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        retryAfter: Math.round(windowMs / 1000)
      });
    }
  });
};

// Rate limiters para diferentes endpoints
const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutos
  5, // máximo 5 tentativas
  'Too many authentication attempts, please try again later'
);

const apiLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutos
  100, // máximo 100 requests
  'Too many API requests, please try again later'
);

const strictLimiter = createRateLimiter(
  60 * 1000, // 1 minuto
  10, // máximo 10 requests
  'Rate limit exceeded, please slow down'
);

// Helmet configuration para segurança
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Compression middleware
const compressionConfig = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024
});

// Schemas de validação
const schemas = {
  login: Joi.object({
    email: Joi.string().email().required().max(255),
    password: Joi.string().min(8).max(128).required()
  }),

  register: Joi.object({
    email: Joi.string().email().required().max(255),
    password: Joi.string().min(8).max(128).required()
      .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
      .message('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'),
    name: Joi.string().min(2).max(100).required()
  }),

  transaction: Joi.object({
    amount: Joi.number().required().min(-999999999).max(999999999),
    description: Joi.string().required().max(255),
    category_id: Joi.number().integer().positive().required(),
    account_id: Joi.number().integer().positive().required(),
    date: Joi.date().required(),
    type: Joi.string().valid('income', 'expense').required()
  }),

  account: Joi.object({
    name: Joi.string().required().max(100),
    type: Joi.string().valid('checking', 'savings', 'credit', 'investment').required(),
    balance: Joi.number().min(-999999999).max(999999999).default(0),
    currency: Joi.string().length(3).default('EUR')
  }),

  category: Joi.object({
    name: Joi.string().required().max(100),
    type: Joi.string().valid('income', 'expense').required(),
    color: Joi.string().pattern(/^#[0-9A-F]{6}$/i).default('#000000'),
    parent_id: Joi.number().integer().positive().allow(null)
  }),

  budget: Joi.object({
    name: Joi.string().required().max(100),
    amount: Joi.number().positive().required(),
    category_id: Joi.number().integer().positive().required(),
    period: Joi.string().valid('monthly', 'yearly').required(),
    start_date: Joi.date().required(),
    end_date: Joi.date().required()
  }),

  userSettings: Joi.object({
    setting_key: Joi.string().min(1).max(50).required(),
    setting_value: Joi.alternatives().try(
      Joi.string().max(500),
      Joi.number(),
      Joi.boolean()
    ).required()
  }),

  investment: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    symbol: Joi.string().min(1).max(10).required(),
    quantity: Joi.number().positive().required(),
    purchase_price: Joi.number().positive().required(),
    current_price: Joi.number().positive().optional(),
    purchase_date: Joi.date().required(),
    type: Joi.string().valid('stock', 'bond', 'crypto', 'fund', 'other').required()
  }),

  recurringTransaction: Joi.object({
    account_id: Joi.number().integer().positive().required(),
    category_id: Joi.number().integer().positive().required(),
    amount: Joi.number().positive().required(),
    type: Joi.string().valid('income', 'expense').required(),
    description: Joi.string().min(1).max(255).required(),
    frequency: Joi.string().valid('daily', 'weekly', 'monthly', 'yearly').required(),
    start_date: Joi.date().required(),
    end_date: Joi.date().min(Joi.ref('start_date')).optional(),
    is_active: Joi.boolean().default(true)
  }),

  savingsGoal: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    target_amount: Joi.number().positive().required(),
    current_amount: Joi.number().min(0).default(0),
    target_date: Joi.date().min('now').required(),
    description: Joi.string().max(500).optional()
  }),

  entity: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    type: Joi.string().valid('person', 'company', 'organization').required(),
    email: Joi.string().email().optional(),
    phone: Joi.string().max(20).optional(),
    address: Joi.string().max(255).optional(),
    notes: Joi.string().max(500).optional()
  }),

  aiRule: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    condition: Joi.string().min(1).max(500).required(),
    action: Joi.string().min(1).max(500).required(),
    is_active: Joi.boolean().default(true),
    priority: Joi.number().integer().min(1).max(10).default(5)
  }),

  report: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    type: Joi.string().valid('income_expense', 'category_breakdown', 'account_summary', 'budget_analysis', 'investment_performance').required(),
    start_date: Joi.date().required(),
    end_date: Joi.date().min(Joi.ref('start_date')).required(),
    filters: Joi.object().optional()
  })
};

// Middleware de validação
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    req.body = value;
    next();
  };
};

// Middleware de sanitização
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove caracteres perigosos
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .trim();
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key]);
      }
    }
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);

  next();
};

// Middleware de logging de segurança
const securityLogger = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      duration: `${duration}ms`
    };

    // Log suspicious activity
    if (res.statusCode === 401 || res.statusCode === 403 || res.statusCode === 429) {
      console.warn('Security Alert:', logData);
    }
  });

  next();
};

// Middleware para verificar origem das requests
const corsSecurityCheck = (req, res, next) => {
  const origin = req.get('Origin');
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];
  
  if (req.method !== 'GET' && origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  
  next();
};

module.exports = {
  helmetConfig,
  compressionConfig,
  authLimiter,
  apiLimiter,
  strictLimiter,
  validateRequest,
  sanitizeInput,
  securityLogger,
  corsSecurityCheck,
  schemas
};