import mysql from 'mysql2/promise';
import { logger } from './LoggerService.js';

/**
 * SmartImportService - Serviço para enriquecimento inteligente de transações importadas
 * Implementa sugestões automáticas usando IA e regras de aprendizagem
 */
export class SmartImportService {
  constructor() {
    this.dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'MyMoney',
      password: process.env.DB_PASSWORD || '1Tretadepassword?',
      database: process.env.DB_NAME || 'mymoney',
      charset: 'utf8mb4'
    };
  }

  /**
   * Obter conexão com o banco de dados
   */
  async getDbConnection() {
    return await mysql.createConnection(this.dbConfig);
  }

  /**
   * Enriquecer transações temporárias com sugestões de IA
   * @param {string} sessionId - ID da sessão de importação
   * @param {string} userId - ID do usuário
   */
  async enrichTransactions(sessionId, userId) {
    let connection;
    
    try {
      connection = await this.getDbConnection();
      
      // Buscar transações temporárias não processadas
      const [transactions] = await connection.execute(`
        SELECT * FROM temp_transactions 
        WHERE session_id = ? AND ai_processed = FALSE
        ORDER BY id ASC
      `, [sessionId]);

      logger.info(`Enriquecendo ${transactions.length} transações para sessão ${sessionId}`);

      // Buscar regras de IA existentes
      const aiRules = await this.getAIRules(connection, userId);
      
      // Buscar categorias e contas do usuário
      const [categories] = await connection.execute(`
        SELECT id, name, type FROM categories WHERE user_id = ? OR user_id IS NULL
      `, [userId]);
      
      const [accounts] = await connection.execute(`
        SELECT id, name, type FROM accounts WHERE user_id = ?
      `, [userId]);

      // Processar cada transação
      for (const transaction of transactions) {
        try {
          const suggestions = await this.generateSuggestions(
            transaction, 
            aiRules, 
            categories, 
            accounts,
            connection,
            userId
          );

          // Atualizar transação com sugestões
          await connection.execute(`
            UPDATE temp_transactions 
            SET 
              suggested_category_id = ?,
              suggested_account_id = ?,
              confidence_score = ?,
              ai_suggestions = ?,
              ai_processed = TRUE,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [
            suggestions.categoryId,
            suggestions.accountId,
            suggestions.confidence,
            JSON.stringify(suggestions.details),
            transaction.id
          ]);

          logger.debug(`Transação ${transaction.id} enriquecida com confiança ${suggestions.confidence}`);

        } catch (error) {
          logger.error(`Erro ao processar transação ${transaction.id}:`, error);
          
          // Marcar como processada mesmo com erro
          await connection.execute(`
            UPDATE temp_transactions 
            SET ai_processed = TRUE, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [transaction.id]);
        }
      }

      // Atualizar estatísticas da sessão
      await this.updateSessionStats(connection, sessionId);

      logger.info(`Enriquecimento concluído para sessão ${sessionId}`);

    } catch (error) {
      logger.error('Erro no enriquecimento de transações:', error);
      throw error;
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  /**
   * Gerar sugestões para uma transação
   */
  async generateSuggestions(transaction, aiRules, categories, accounts, connection, userId) {
    const description = transaction.normalized_description?.toLowerCase() || '';
    const amount = parseFloat(transaction.normalized_amount) || 0;
    const type = transaction.normalized_type || 'expense';

    let bestCategoryMatch = null;
    let bestAccountMatch = null;
    let maxConfidence = 0;
    let suggestionDetails = [];

    // 1. Aplicar regras de IA existentes
    for (const rule of aiRules) {
      const ruleData = JSON.parse(rule.rule_data || '{}');
      const confidence = this.evaluateRule(transaction, ruleData);
      
      if (confidence > maxConfidence) {
        maxConfidence = confidence;
        bestCategoryMatch = ruleData.categoryId;
        bestAccountMatch = ruleData.accountId;
        
        suggestionDetails.push({
          type: 'ai_rule',
          ruleId: rule.id,
          confidence: confidence,
          reason: `Regra: ${rule.description}`
        });
      }
    }

    // 2. Buscar transações similares históricas
    const historicalMatch = await this.findSimilarTransactions(
      connection, 
      description, 
      amount, 
      type, 
      userId
    );

    if (historicalMatch && historicalMatch.confidence > maxConfidence) {
      maxConfidence = historicalMatch.confidence;
      bestCategoryMatch = historicalMatch.categoryId;
      bestAccountMatch = historicalMatch.accountId;
      
      suggestionDetails.push({
        type: 'historical',
        confidence: historicalMatch.confidence,
        reason: `Similar a: ${historicalMatch.description}`,
        matchCount: historicalMatch.count
      });
    }

    // 3. Aplicar regras baseadas em palavras-chave
    const keywordMatch = this.matchByKeywords(description, amount, type, categories, accounts);
    
    if (keywordMatch && keywordMatch.confidence > maxConfidence) {
      maxConfidence = keywordMatch.confidence;
      bestCategoryMatch = keywordMatch.categoryId;
      bestAccountMatch = keywordMatch.accountId;
      
      suggestionDetails.push({
        type: 'keyword',
        confidence: keywordMatch.confidence,
        reason: `Palavra-chave: ${keywordMatch.keyword}`,
        keyword: keywordMatch.keyword
      });
    }

    // 4. Sugestões padrão baseadas no tipo e valor
    if (!bestCategoryMatch) {
      const defaultMatch = this.getDefaultSuggestion(type, amount, categories, accounts);
      if (defaultMatch) {
        bestCategoryMatch = defaultMatch.categoryId;
        bestAccountMatch = defaultMatch.accountId;
        maxConfidence = defaultMatch.confidence;
        
        suggestionDetails.push({
          type: 'default',
          confidence: defaultMatch.confidence,
          reason: defaultMatch.reason
        });
      }
    }

    return {
      categoryId: bestCategoryMatch,
      accountId: bestAccountMatch,
      confidence: Math.round(maxConfidence * 100) / 100,
      details: suggestionDetails
    };
  }

  /**
   * Buscar regras de IA do usuário
   */
  async getAIRules(connection, userId) {
    const [rules] = await connection.execute(`
      SELECT * FROM ai_rules 
      WHERE (user_id = ? OR user_id IS NULL) AND is_active = TRUE
      ORDER BY priority DESC, created_at DESC
    `, [userId]);

    return rules;
  }

  /**
   * Avaliar uma regra de IA contra uma transação
   */
  evaluateRule(transaction, ruleData) {
    let confidence = 0;
    const description = transaction.normalized_description?.toLowerCase() || '';
    const amount = parseFloat(transaction.normalized_amount) || 0;

    // Verificar correspondência de descrição
    if (ruleData.descriptionPatterns) {
      for (const pattern of ruleData.descriptionPatterns) {
        if (description.includes(pattern.toLowerCase())) {
          confidence += pattern.weight || 0.3;
        }
      }
    }

    // Verificar faixa de valores
    if (ruleData.amountRange) {
      const { min, max } = ruleData.amountRange;
      if (amount >= (min || 0) && amount <= (max || Infinity)) {
        confidence += 0.2;
      }
    }

    // Verificar tipo de transação
    if (ruleData.transactionType && ruleData.transactionType === transaction.normalized_type) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0); // Máximo 1.0
  }

  /**
   * Buscar transações similares no histórico
   */
  async findSimilarTransactions(connection, description, amount, type, userId) {
    try {
      // Buscar por descrição similar
      const [similar] = await connection.execute(`
        SELECT 
          category_id,
          account_id,
          description,
          COUNT(*) as count,
          AVG(ABS(amount - ?)) as avg_amount_diff
        FROM transactions 
        WHERE user_id = ? 
          AND type = ?
          AND (
            description LIKE ? 
            OR description LIKE ?
            OR SOUNDEX(description) = SOUNDEX(?)
          )
          AND ABS(amount - ?) < (? * 0.5)
        GROUP BY category_id, account_id, description
        ORDER BY count DESC, avg_amount_diff ASC
        LIMIT 1
      `, [
        amount, userId, type,
        `%${description.substring(0, 10)}%`,
        `%${description.substring(-10)}%`,
        description,
        amount, amount
      ]);

      if (similar.length > 0) {
        const match = similar[0];
        const confidence = Math.min(0.8, 0.3 + (match.count * 0.1));
        
        return {
          categoryId: match.category_id,
          accountId: match.account_id,
          confidence: confidence,
          description: match.description,
          count: match.count
        };
      }

      return null;
    } catch (error) {
      logger.warn('Erro ao buscar transações similares:', error);
      return null;
    }
  }

  /**
   * Correspondência por palavras-chave
   */
  matchByKeywords(description, amount, type, categories, accounts) {
    const keywords = {
      // Alimentação
      'alimentacao': ['supermercado', 'continente', 'pingo doce', 'lidl', 'auchan', 'restaurante', 'cafe', 'padaria'],
      // Transporte
      'transporte': ['combustivel', 'gasolina', 'gasóleo', 'metro', 'autocarro', 'taxi', 'uber', 'bolt'],
      // Saúde
      'saude': ['farmacia', 'hospital', 'clinica', 'medico', 'dentista'],
      // Entretenimento
      'entretenimento': ['cinema', 'teatro', 'spotify', 'netflix', 'gaming'],
      // Utilidades
      'utilidades': ['agua', 'luz', 'gas', 'internet', 'telefone', 'edp', 'nos', 'meo'],
      // Salário
      'salario': ['salario', 'ordenado', 'vencimento', 'remuneracao']
    };

    for (const [categoryName, keywordList] of Object.entries(keywords)) {
      for (const keyword of keywordList) {
        if (description.includes(keyword)) {
          const category = categories.find(c => 
            c.name.toLowerCase().includes(categoryName) ||
            c.name.toLowerCase().includes(keyword)
          );

          if (category) {
            return {
              categoryId: category.id,
              accountId: accounts.length > 0 ? accounts[0].id : null,
              confidence: 0.6,
              keyword: keyword
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Sugestão padrão baseada no tipo
   */
  getDefaultSuggestion(type, amount, categories, accounts) {
    let defaultCategory = null;

    if (type === 'income') {
      defaultCategory = categories.find(c => 
        c.name.toLowerCase().includes('receita') ||
        c.name.toLowerCase().includes('salario') ||
        c.type === 'income'
      );
    } else {
      defaultCategory = categories.find(c => 
        c.name.toLowerCase().includes('geral') ||
        c.name.toLowerCase().includes('outros') ||
        c.type === 'expense'
      );
    }

    if (defaultCategory) {
      return {
        categoryId: defaultCategory.id,
        accountId: accounts.length > 0 ? accounts[0].id : null,
        confidence: 0.3,
        reason: `Categoria padrão para ${type}`
      };
    }

    return null;
  }

  /**
   * Atualizar estatísticas da sessão
   */
  async updateSessionStats(connection, sessionId) {
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN ai_processed = TRUE THEN 1 END) as processed,
        AVG(confidence_score) as avg_confidence
      FROM temp_transactions 
      WHERE session_id = ?
    `, [sessionId]);

    if (stats.length > 0) {
      const { total, processed, avg_confidence } = stats[0];
      
      await connection.execute(`
        UPDATE smart_import_sessions 
        SET 
          ai_processed_rows = ?,
          avg_confidence_score = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE session_id = ?
      `, [processed, avg_confidence || 0, sessionId]);
    }
  }

  /**
   * Criar nova regra de IA baseada no feedback do usuário
   */
  async createAIRule(userId, transactionData, userChoice, description) {
    let connection;
    
    try {
      connection = await this.getDbConnection();
      
      const ruleData = {
        descriptionPatterns: [
          {
            pattern: transactionData.normalized_description?.toLowerCase(),
            weight: 0.5
          }
        ],
        amountRange: {
          min: transactionData.normalized_amount * 0.8,
          max: transactionData.normalized_amount * 1.2
        },
        transactionType: transactionData.normalized_type,
        categoryId: userChoice.categoryId,
        accountId: userChoice.accountId
      };

      await connection.execute(`
        INSERT INTO ai_rules 
        (user_id, rule_type, description, rule_data, priority, is_active)
        VALUES (?, 'user_feedback', ?, ?, 5, TRUE)
      `, [
        userId,
        description || `Regra automática para ${transactionData.normalized_description}`,
        JSON.stringify(ruleData)
      ]);

      logger.info(`Nova regra de IA criada para usuário ${userId}`);

    } catch (error) {
      logger.error('Erro ao criar regra de IA:', error);
      throw error;
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  /**
   * Detectar duplicatas potenciais
   */
  async detectDuplicates(sessionId, userId) {
    let connection;
    
    try {
      connection = await this.getDbConnection();
      
      const [tempTransactions] = await connection.execute(`
        SELECT * FROM temp_transactions WHERE session_id = ?
      `, [sessionId]);

      const duplicates = [];

      for (const tempTx of tempTransactions) {
        // Buscar transações existentes similares
        const [existing] = await connection.execute(`
          SELECT id, description, amount, date, account_id
          FROM transactions 
          WHERE user_id = ?
            AND ABS(DATEDIFF(date, ?)) <= 3
            AND ABS(amount - ?) < 0.01
            AND (
              description = ? 
              OR SOUNDEX(description) = SOUNDEX(?)
            )
          LIMIT 5
        `, [
          userId,
          tempTx.normalized_date,
          tempTx.normalized_amount,
          tempTx.normalized_description,
          tempTx.normalized_description
        ]);

        if (existing.length > 0) {
          duplicates.push({
            tempTransactionId: tempTx.id,
            possibleDuplicates: existing,
            confidence: existing.length > 1 ? 0.9 : 0.7
          });

          // Marcar como possível duplicata
          await connection.execute(`
            UPDATE temp_transactions 
            SET 
              is_duplicate = TRUE,
              duplicate_info = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [
            JSON.stringify({ possibleDuplicates: existing }),
            tempTx.id
          ]);
        }
      }

      logger.info(`Detectadas ${duplicates.length} possíveis duplicatas para sessão ${sessionId}`);
      return duplicates;

    } catch (error) {
      logger.error('Erro na detecção de duplicatas:', error);
      throw error;
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  /**
   * Aprender com feedback do usuário e melhorar regras
   */
  async learnFromFeedback(userId, transactionData, userChoice) {
    let connection;
    try {
      connection = await mysql.createConnection(dbConfig);
      
      const { description, amount, type, category_id, account_id } = transactionData;
      const { accepted, correctedCategoryId, correctedAccountId } = userChoice;
      
      if (accepted) {
        // Reforçar regra existente ou criar nova
        await this.reinforceRule(connection, userId, description, category_id, account_id);
      } else if (correctedCategoryId || correctedAccountId) {
        // Criar nova regra com correção do usuário
        await this.createCorrectionRule(
          connection, 
          userId, 
          description, 
          correctedCategoryId || category_id,
          correctedAccountId || account_id
        );
      }
      
      // Atualizar estatísticas de aprendizagem
      await this.updateLearningStats(connection, userId);
      
    } catch (error) {
      logger.error('Erro no aprendizado com feedback:', error);
      throw error;
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  /**
   * Reforçar regra existente
   */
  async reinforceRule(connection, userId, description, categoryId, accountId) {
    // Procurar regra similar existente
    const [existingRules] = await connection.execute(`
      SELECT id, usage_count, confidence_score 
      FROM ai_rules 
      WHERE user_id = ? AND category_id = ? 
      AND (pattern LIKE ? OR ? LIKE CONCAT('%', pattern, '%'))
      ORDER BY confidence_score DESC
      LIMIT 1
    `, [userId, categoryId, `%${description}%`, description]);

    if (existingRules.length > 0) {
      const rule = existingRules[0];
      const newUsageCount = rule.usage_count + 1;
      const newConfidence = Math.min(0.95, rule.confidence_score + 0.05);
      
      await connection.execute(`
        UPDATE ai_rules 
        SET usage_count = ?, confidence_score = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newUsageCount, newConfidence, rule.id]);
      
      logger.info(`Regra reforçada: ID ${rule.id}, nova confiança: ${newConfidence}`);
    } else {
      // Criar nova regra
      await this.createAIRule(userId, description, categoryId, accountId, 'user_reinforcement');
    }
  }

  /**
   * Criar regra de correção
   */
  async createCorrectionRule(connection, userId, description, categoryId, accountId) {
    // Extrair palavras-chave da descrição
    const keywords = this.extractKeywords(description);
    const pattern = keywords.slice(0, 3).join('|'); // Usar até 3 palavras-chave
    
    await connection.execute(`
      INSERT INTO ai_rules 
      (user_id, pattern, category_id, account_id, confidence_score, 
       rule_type, usage_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      userId,
      pattern,
      categoryId,
      accountId,
      0.7, // Confiança inicial para correções
      'user_correction',
      1
    ]);
    
    logger.info(`Nova regra de correção criada para usuário ${userId}: ${pattern}`);
  }

  /**
   * Extrair palavras-chave relevantes
   */
  extractKeywords(description) {
    // Palavras irrelevantes a serem filtradas
    const stopWords = new Set([
      'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos',
      'para', 'por', 'com', 'sem', 'sob', 'sobre', 'entre', 'até',
      'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'e', 'ou',
      'que', 'se', 'te', 'me', 'lhe', 'nos', 'vos', 'lhes'
    ]);
    
    return description
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remover pontuação
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 5); // Máximo 5 palavras-chave
  }

  /**
   * Atualizar estatísticas de aprendizagem
   */
  async updateLearningStats(connection, userId) {
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_rules,
        AVG(confidence_score) as avg_confidence,
        SUM(usage_count) as total_usage
      FROM ai_rules 
      WHERE user_id = ?
    `, [userId]);

    if (stats.length > 0) {
      logger.info(`Estatísticas de aprendizagem para usuário ${userId}:`, stats[0]);
    }
  }

  /**
   * Otimizar regras antigas e pouco usadas
   */
  async optimizeRules(userId) {
    let connection;
    try {
      connection = await mysql.createConnection(dbConfig);
      
      // Remover regras antigas com baixo uso (mais de 6 meses e menos de 3 usos)
      const [removed] = await connection.execute(`
        DELETE FROM ai_rules 
        WHERE user_id = ? 
        AND usage_count < 3 
        AND created_at < DATE_SUB(NOW(), INTERVAL 6 MONTH)
      `, [userId]);
      
      // Reduzir confiança de regras não usadas recentemente
      await connection.execute(`
        UPDATE ai_rules 
        SET confidence_score = GREATEST(0.1, confidence_score - 0.1)
        WHERE user_id = ? 
        AND updated_at < DATE_SUB(NOW(), INTERVAL 3 MONTH)
      `, [userId]);
      
      logger.info(`Otimização de regras para usuário ${userId}: ${removed.affectedRows} regras removidas`);
      
    } catch (error) {
      logger.error('Erro na otimização de regras:', error);
      throw error;
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }
}

export const smartImportService = new SmartImportService();