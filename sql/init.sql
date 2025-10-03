-- Personal Finance Manager Database Schema
-- MariaDB initialization script

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Create database if not exists (será criada automaticamente pelo docker-compose)
-- CREATE DATABASE IF NOT EXISTS mymoney CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mymoney;

-- Create application user
CREATE USER IF NOT EXISTS 'MyMoney'@'%' IDENTIFIED BY '1Tretadepassword?';
GRANT ALL PRIVILEGES ON mymoney.* TO 'MyMoney'@'%';
FLUSH PRIVILEGES;

-- Users table
CREATE TABLE IF NOT EXISTS users (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Refresh tokens table for JWT authentication
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_tokens (user_id),
    INDEX idx_token (token),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default demo user to satisfy FK (id=1)
INSERT IGNORE INTO users (id, email, name, password_hash) VALUES (1, 'system@local', 'System', 'system');
-- Categories table
CREATE TABLE IF NOT EXISTS categories (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Budgets table
CREATE TABLE IF NOT EXISTS budgets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    spent DECIMAL(15,2) DEFAULT 0.00,
    period ENUM('weekly', 'monthly', 'quarterly', 'yearly') NOT NULL,
    category_id INT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    alert_threshold DECIMAL(5,2) DEFAULT 80.00,
    is_active BOOLEAN DEFAULT TRUE,
    user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_budgets (user_id),
    INDEX idx_budget_period (period),
    INDEX idx_budget_dates (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Investments table
CREATE TABLE IF NOT EXISTS investments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    symbol VARCHAR(20),
    type ENUM('stock', 'bond', 'mutual_fund', 'etf', 'crypto', 'real_estate', 'other') NOT NULL,
    quantity DECIMAL(15,6) DEFAULT 0,
    purchase_price DECIMAL(15,2) DEFAULT 0,
    current_price DECIMAL(15,2) DEFAULT 0,
    market_value DECIMAL(15,2) DEFAULT 0,
    gain_loss DECIMAL(15,2) DEFAULT 0,
    gain_loss_percentage DECIMAL(5,2) DEFAULT 0,
    purchase_date DATE,
    account_id INT,
    user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_investments (user_id),
    INDEX idx_investment_type (type),
    INDEX idx_investment_symbol (symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Savings goals table
CREATE TABLE IF NOT EXISTS savings_goals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    target_amount DECIMAL(15,2) NOT NULL,
    current_amount DECIMAL(15,2) DEFAULT 0,
    target_date DATE,
    description TEXT,
    priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
    is_completed BOOLEAN DEFAULT FALSE,
    account_id INT,
    user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_savings_goals (user_id),
    INDEX idx_savings_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Recurring transactions table
CREATE TABLE IF NOT EXISTS recurring_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    amount DECIMAL(15,2) NOT NULL,
    description VARCHAR(500),
    type ENUM('income', 'expense') NOT NULL,
    frequency ENUM('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly') NOT NULL,
    category_id INT,
    account_id INT,
    start_date DATE NOT NULL,
    end_date DATE,
    next_occurrence DATE NOT NULL,
    last_processed DATE,
    occurrence_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_recurring (user_id),
    INDEX idx_recurring_active (is_active),
    INDEX idx_next_occurrence (next_occurrence)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Assets table
CREATE TABLE IF NOT EXISTS assets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type ENUM('property', 'vehicle', 'collectible', 'other') NOT NULL,
    purchase_price DECIMAL(15,2),
    current_value DECIMAL(15,2),
    purchase_date DATE,
    description TEXT,
    depreciation_rate DECIMAL(5,2) DEFAULT 0,
    user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_assets (user_id),
    INDEX idx_asset_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Financial reports table
CREATE TABLE IF NOT EXISTS reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type ENUM('income_expense', 'budget_analysis', 'investment_performance', 'net_worth', 'custom') NOT NULL,
    parameters JSON DEFAULT NULL,
    generated_data JSON DEFAULT NULL,
    date_range_start DATE,
    date_range_end DATE,
    user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_reports (user_id),
    INDEX idx_report_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default categories
INSERT IGNORE INTO categories (name, color, icon, is_system, user_id) VALUES
('Alimentação', '#ef4444', 'utensils', TRUE, NULL),
('Transporte', '#3b82f6', 'car', TRUE, NULL),
('Casa', '#10b981', 'home', TRUE, NULL),
('Saúde', '#f59e0b', 'heart', TRUE, NULL),
('Educação', '#8b5cf6', 'graduation-cap', TRUE, NULL),
('Entretenimento', '#ec4899', 'gamepad-2', TRUE, NULL),
('Compras', '#06b6d4', 'shopping-bag', TRUE, NULL),
('Viagens', '#84cc16', 'plane', TRUE, NULL),
('Serviços', '#6b7280', 'wrench', TRUE, NULL),
('Outros', '#64748b', 'more-horizontal', TRUE, NULL),
('Salário', '#22c55e', 'banknote', TRUE, NULL),
('Freelance', '#3b82f6', 'laptop', TRUE, NULL),
('Investimentos', '#8b5cf6', 'trending-up', TRUE, NULL);

SET FOREIGN_KEY_CHECKS = 1;

-- Create views for common queries
CREATE OR REPLACE VIEW v_transaction_summary AS
SELECT 
    t.id,
    t.amount,
    t.description,
    t.type,
    t.transaction_date,
    c.name as category_name,
    c.color as category_color,
    t.user_id
FROM transactions t
LEFT JOIN categories c ON t.category_id = c.id;

CREATE OR REPLACE VIEW v_budget_status AS
SELECT 
    b.id,
    b.name,
    b.amount,
    b.spent,
    b.period,
    b.start_date,
    b.end_date,
    c.name as category_name,
    c.color as category_color,
    ROUND((b.spent / b.amount) * 100, 2) as spent_percentage,
    (b.amount - b.spent) as remaining,
    b.user_id
FROM budgets b
LEFT JOIN categories c ON b.category_id = c.id
WHERE b.is_active = TRUE;

-- User Settings table
CREATE TABLE IF NOT EXISTS user_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL DEFAULT 1,
    category ENUM('app', 'notifications', 'security') NOT NULL,
    settings JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_category (user_id, category),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert default settings for user 1
INSERT IGNORE INTO user_settings (user_id, category, settings) VALUES
(1, 'app', JSON_OBJECT(
    'currency', 'EUR',
    'dateFormat', 'DD/MM/YYYY',
    'theme', 'system',
    'language', 'pt'
)),
(1, 'notifications', JSON_OBJECT(
    'budgetAlerts', true,
    'transactionNotifications', false,
    'monthlyReports', true,
    'investmentAlerts', true,
    'goalReminders', true,
    'emailNotifications', true,
    'pushNotifications', false
)),
(1, 'security', JSON_OBJECT(
    'twoFactorAuth', false,
    'sessionTimeout', 30,
    'loginAlerts', true,
    'dataEncryption', true
));

-- Create indexes for better performance
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_budgets_user_active ON budgets(user_id, is_active);
CREATE INDEX idx_accounts_user_active ON accounts(user_id, is_active);