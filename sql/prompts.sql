-- AI Prompts table for managing customizable AI prompts
CREATE TABLE IF NOT EXISTS ai_prompts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category ENUM('chat_responses', 'categorization', 'analysis', 'recommendations') NOT NULL,
  prompt TEXT NOT NULL,
  description VARCHAR(255),
  variables TEXT COMMENT 'JSON array of available variables',
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_name_category (name, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default prompts for chat responses
INSERT INTO ai_prompts (name, category, prompt, description, variables, is_default) VALUES
('chat_gastos', 'chat_responses', 
'Analisei seus gastos e você gastou €{total_expenses} no total. Suas principais categorias de despesa são: {top_categories}. Recomendo revisar os gastos em {highest_category} que representam a maior parte do seu orçamento.',
'Resposta para perguntas sobre gastos',
'["total_expenses", "top_categories", "highest_category"]',
TRUE),

('chat_orcamento', 'chat_responses',
'Você tem {budget_count} orçamentos configurados. {budget_status}. Recomendo revisar regularmente para manter controle dos gastos e ajustar os limites conforme necessário.',
'Resposta para perguntas sobre orçamentos',
'["budget_count", "budget_status"]',
TRUE),

('chat_poupanca', 'chat_responses',
'Com saldo total de €{total_balance}, sugiro {savings_suggestion}. Considere definir metas de poupança específicas e investimentos de baixo risco para fazer seu dinheiro crescer.',
'Resposta para perguntas sobre poupança',
'["total_balance", "savings_suggestion"]',
TRUE),

('chat_generico', 'chat_responses',
'Entendo sua pergunta sobre finanças. Com base nos seus dados: {financial_summary}. Recomendo manter um controle regular de gastos e revisar seus orçamentos mensalmente para alcançar seus objetivos financeiros.',
'Resposta genérica para outras perguntas',
'["financial_summary"]',
TRUE);

-- Insert default prompts for categorization
INSERT INTO ai_prompts (name, category, prompt, description, variables, is_default) VALUES
('categorization_analysis', 'categorization',
'Analise a seguinte transação e sugira a melhor categoria:\nDescrição: {description}\nValor: €{amount}\nData: {date}\n\nCategorias disponíveis: {categories}\nPalavras-chave identificadas: {keywords}\n\nSugestão de categoria baseada em padrões históricos e análise semântica.',
'Prompt para categorização automática de transações',
'["description", "amount", "date", "categories", "keywords"]',
TRUE),

('duplicate_detection', 'categorization',
'Verifique se esta transação pode ser uma duplicata:\nNova: {new_transaction}\nExistente: {existing_transaction}\nDias de diferença: {days_diff}\nSimilaridade: {similarity}%\n\nAnálise: {reasoning}',
'Prompt para detecção de transações duplicadas',
'["new_transaction", "existing_transaction", "days_diff", "similarity", "reasoning"]',
TRUE),

('description_optimization', 'categorization',
'Otimize a descrição da transação para melhor clareza:\nOriginal: {original_description}\nPadrões similares: {similar_patterns}\n\nDescrição otimizada: {optimized_description}',
'Prompt para otimização de descrições',
'["original_description", "similar_patterns", "optimized_description"]',
TRUE);

-- Insert default prompts for analysis
INSERT INTO ai_prompts (name, category, prompt, description, variables, is_default) VALUES
('budget_alert_near_limit', 'analysis',
'⚠️ Atenção: Você gastou €{spent} de €{limit} ({percentage}%) em {category_name}. Faltam {days_remaining} dias até o fim do período. Considere reduzir gastos nesta categoria para evitar exceder o orçamento.',
'Alerta quando orçamento está próximo do limite',
'["spent", "limit", "percentage", "category_name", "days_remaining"]',
TRUE),

('budget_alert_exceeded', 'analysis',
'🚨 Orçamento Excedido: Você excedeu o orçamento de {category_name} em €{excess}. Total gasto: €{spent} de €{limit}. Revise seus gastos e ajuste o orçamento se necessário.',
'Alerta quando orçamento foi excedido',
'["category_name", "excess", "spent", "limit"]',
TRUE),

('spending_trend', 'analysis',
'📊 Análise de Gastos: Nos últimos {period} dias, você gastou €{total_spent} com média diária de €{daily_avg}. Tendência: {trend}. {recommendation}',
'Análise de tendências de gastos',
'["period", "total_spent", "daily_avg", "trend", "recommendation"]',
TRUE),

('savings_opportunity', 'analysis',
'💰 Oportunidade de Poupança: Com saldo total de €{total_balance} distribuído em {account_count} contas, você tem potencial para poupar €{savings_potential} mensalmente. {suggestion}',
'Identificação de oportunidades de poupança',
'["total_balance", "account_count", "savings_potential", "suggestion"]',
TRUE);

-- Insert default prompts for recommendations
INSERT INTO ai_prompts (name, category, prompt, description, variables, is_default) VALUES
('monthly_summary', 'recommendations',
'📈 Resumo Mensal:\n- Receitas: €{total_income}\n- Despesas: €{total_expenses}\n- Saldo: €{net_balance}\n- Taxa de poupança: {savings_rate}%\n\n{personalized_advice}',
'Resumo e recomendações mensais',
'["total_income", "total_expenses", "net_balance", "savings_rate", "personalized_advice"]',
TRUE),

('investment_suggestion', 'recommendations',
'💼 Sugestões de Investimento: Com base no seu perfil financeiro ({risk_profile}), considere diversificar investimentos. Portfolio atual: €{current_investments}. Recomendação: {investment_advice}',
'Sugestões personalizadas de investimento',
'["risk_profile", "current_investments", "investment_advice"]',
TRUE);
