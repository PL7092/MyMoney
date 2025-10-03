-- Smart Import Tables for MyMoney Application
-- This file contains the database structure for the Smart Import functionality

-- Temporary transactions table for staging imported data
CREATE TABLE IF NOT EXISTS temp_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    original_data JSON NOT NULL COMMENT 'Raw imported data',
    normalized_date DATE,
    normalized_description VARCHAR(500),
    normalized_amount DECIMAL(15,2),
    normalized_type ENUM('income', 'expense', 'transfer'),
    suggested_category_id INT,
    suggested_account_id INT,
    confidence_score DECIMAL(3,2) DEFAULT 0.00,
    processing_status ENUM('pending', 'processed', 'error') DEFAULT 'pending',
    error_message TEXT,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (suggested_category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (suggested_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    INDEX idx_session_id (session_id),
    INDEX idx_user_id (user_id),
    INDEX idx_processing_status (processing_status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI Rules table for storing categorization and processing rules
CREATE TABLE IF NOT EXISTS ai_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    rule_type ENUM('categorization', 'duplicate_detection', 'description_optimization', 'amount_validation') NOT NULL,
    conditions JSON NOT NULL COMMENT 'Rule conditions in JSON format',
    actions JSON NOT NULL COMMENT 'Actions to take when rule matches',
    priority INT DEFAULT 100 COMMENT 'Lower number = higher priority',
    is_active BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT FALSE COMMENT 'System rules cannot be deleted',
    usage_count INT DEFAULT 0 COMMENT 'Number of times this rule has been applied',
    success_rate DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Success rate percentage',
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_rule_type (rule_type),
    INDEX idx_priority (priority),
    INDEX idx_active (is_active),
    INDEX idx_system (is_system)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Smart Import Sessions table for tracking import sessions
CREATE TABLE IF NOT EXISTS smart_import_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL UNIQUE,
    file_name VARCHAR(255),
    file_type ENUM('csv', 'xls', 'xlsx', 'pdf', 'paste') NOT NULL,
    file_size INT,
    total_rows INT DEFAULT 0,
    processed_rows INT DEFAULT 0,
    successful_rows INT DEFAULT 0,
    error_rows INT DEFAULT 0,
    status ENUM('uploading', 'parsing', 'processing', 'completed', 'error') DEFAULT 'uploading',
    ai_provider VARCHAR(50) COMMENT 'AI provider used for processing',
    processing_time_ms INT COMMENT 'Total processing time in milliseconds',
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_session_id (session_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default AI rules for categorization
INSERT IGNORE INTO ai_rules (name, description, rule_type, conditions, actions, priority, is_system, user_id) VALUES
('Supermercado_Alimentacao', 'Categorizar transações de supermercados como Alimentação', 'categorization', 
 JSON_OBJECT('keywords', JSON_ARRAY('supermercado', 'continente', 'pingo doce', 'lidl', 'auchan', 'intermarche'), 'amount_range', JSON_OBJECT('min', 5, 'max', 500)), 
 JSON_OBJECT('category_name', 'Alimentação', 'confidence', 0.9), 
 10, TRUE, 1),

('Combustivel_Transporte', 'Categorizar transações de combustível como Transporte', 'categorization',
 JSON_OBJECT('keywords', JSON_ARRAY('galp', 'bp', 'repsol', 'cepsa', 'combustivel', 'gasolina', 'gasóleo'), 'amount_range', JSON_OBJECT('min', 20, 'max', 200)),
 JSON_OBJECT('category_name', 'Transporte', 'confidence', 0.95),
 10, TRUE, 1),

('Farmacia_Saude', 'Categorizar transações de farmácias como Saúde', 'categorization',
 JSON_OBJECT('keywords', JSON_ARRAY('farmacia', 'farmácia', 'wells', 'saúde'), 'amount_range', JSON_OBJECT('min', 2, 'max', 100)),
 JSON_OBJECT('category_name', 'Saúde', 'confidence', 0.9),
 10, TRUE, 1),

('Salario_Receita', 'Categorizar salários como receita', 'categorization',
 JSON_OBJECT('keywords', JSON_ARRAY('salario', 'salário', 'vencimento', 'ordenado', 'remuneração'), 'amount_range', JSON_OBJECT('min', 500, 'max', 10000)),
 JSON_OBJECT('category_name', 'Salário', 'type', 'income', 'confidence', 0.95),
 5, TRUE, 1),

('Duplicata_Mesmo_Valor', 'Detectar possíveis duplicatas com mesmo valor em 5 dias', 'duplicate_detection',
 JSON_OBJECT('time_window_days', 5, 'amount_tolerance', 0.01, 'description_similarity', 0.8),
 JSON_OBJECT('flag_as_duplicate', true, 'confidence', 0.8),
 20, TRUE, 1);

-- Insert Smart Import prompt into ai_prompts table
INSERT IGNORE INTO ai_prompts (name, category, prompt, description, variables, is_default) VALUES
('smart_import_analysis', 'categorization',
'Analise a seguinte transação importada e forneça sugestões de categorização:

DADOS DA TRANSAÇÃO:
- Descrição: {description}
- Valor: €{amount}
- Data: {date}
- Tipo detectado: {detected_type}

CONTEXTO DISPONÍVEL:
- Categorias existentes: {available_categories}
- Subcategorias: {available_subcategories}
- Histórico similar: {similar_transactions}
- Regras de IA ativas: {active_rules}

ANÁLISE REQUERIDA:
1. Descrição otimizada (mais clara e concisa)
2. Tipo de movimento (income/expense/transfer)
3. Categoria sugerida (baseada nas disponíveis)
4. Subcategoria sugerida (se aplicável)
5. Detecção de duplicatas (verificar transações similares)
6. Associações possíveis (investimentos, pagamentos recorrentes, poupanças, ativos)
7. Nível de confiança (0-1)
8. Justificação da sugestão

FORMATO DE RESPOSTA (JSON):
{
  "optimized_description": "string",
  "suggested_type": "income|expense|transfer",
  "suggested_category": "string",
  "suggested_subcategory": "string|null",
  "confidence": 0.95,
  "reasoning": "string",
  "duplicate_risk": {
    "is_potential_duplicate": boolean,
    "similar_transactions": [],
    "confidence": 0.8
  },
  "associations": {
    "investment_match": "string|null",
    "recurring_payment_match": "string|null",
    "savings_goal_match": "string|null",
    "asset_match": "string|null"
  },
  "suggested_rules": {
    "create_new_rule": boolean,
    "rule_description": "string|null"
  }
}',
'Prompt principal para análise inteligente de transações importadas',
'["description", "amount", "date", "detected_type", "available_categories", "available_subcategories", "similar_transactions", "active_rules"]',
TRUE);