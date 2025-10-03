import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import mysql from 'mysql2/promise';
import { smartImportService } from '../services/SmartImportService.js';
import { FileParsingService } from '../services/FileParsingService.js';

const router = express.Router();

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'smart-import');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls', '.pdf'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de arquivo não suportado: ${fileExt}`));
    }
  }
});

// Função para obter conexão com o banco
async function getDbConnection() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'MyMoney',
    password: process.env.DB_PASSWORD || '1Tretadepassword?',
    database: process.env.DB_NAME || 'mymoney',
    charset: 'utf8mb4'
  });
  return connection;
}

// POST /api/smart-import/upload - Upload e parsing inicial do arquivo
router.post('/upload', upload.single('file'), async (req, res) => {
  let connection;
  
  try {
    const { file } = req;
    const { userId } = req.body;
    
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo foi enviado'
      });
    }
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'ID do usuário é obrigatório'
      });
    }
    
    // Gerar session ID único
    const sessionId = uuidv4();
    
    connection = await getDbConnection();
    
    // Criar registro da sessão de import
    await connection.execute(`
      INSERT INTO smart_import_sessions 
      (session_id, file_name, file_type, file_size, status, user_id)
      VALUES (?, ?, ?, ?, 'uploading', ?)
    `, [
      sessionId,
      file.originalname,
      path.extname(file.originalname).toLowerCase().replace('.', ''),
      file.size,
      userId
    ]);
    
    res.json({
      success: true,
      sessionId,
      fileName: file.originalname,
      fileSize: file.size,
      message: 'Arquivo enviado com sucesso. Iniciando processamento...'
    });
    
    // Processar arquivo em background
    processFileInBackground(sessionId, file.path, file.originalname, userId);
    
  } catch (error) {
    console.error('Erro no upload:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// POST /api/smart-import/paste - Processar dados colados
router.post('/paste', async (req, res) => {
  let connection;
  
  try {
    const { textData, userId } = req.body;
    
    if (!textData || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Dados de texto e ID do usuário são obrigatórios'
      });
    }
    
    const sessionId = uuidv4();
    
    connection = await getDbConnection();
    
    // Criar registro da sessão
    await connection.execute(`
      INSERT INTO smart_import_sessions 
      (session_id, file_name, file_type, status, user_id)
      VALUES (?, ?, 'paste', 'processing', ?)
    `, [sessionId, 'Dados colados', userId]);
    
    res.json({
      success: true,
      sessionId,
      message: 'Dados recebidos. Iniciando processamento...'
    });
    
    // Processar dados em background
    processTextDataInBackground(sessionId, textData, userId);
    
  } catch (error) {
    console.error('Erro no processamento de dados colados:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// GET /api/smart-import/status/:sessionId - Verificar status do processamento
router.get('/status/:sessionId', async (req, res) => {
  let connection;
  
  try {
    const { sessionId } = req.params;
    
    connection = await getDbConnection();
    
    // Buscar status da sessão
    const [sessionRows] = await connection.execute(`
      SELECT * FROM smart_import_sessions WHERE session_id = ?
    `, [sessionId]);
    
    if (sessionRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Sessão não encontrada'
      });
    }
    
    const session = sessionRows[0];
    
    // Buscar transações temporárias se o processamento estiver completo
    let transactions = [];
    if (session.status === 'completed') {
      const [transactionRows] = await connection.execute(`
        SELECT * FROM temp_transactions 
        WHERE session_id = ? 
        ORDER BY normalized_date DESC, id ASC
      `, [sessionId]);
      
      transactions = transactionRows;
    }
    
    res.json({
      success: true,
      session,
      transactions
    });
    
  } catch (error) {
    console.error('Erro ao verificar status:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// GET /api/smart-import/transactions/:sessionId - Obter transações processadas
router.get('/transactions/:sessionId', async (req, res) => {
  let connection;
  
  try {
    const { sessionId } = req.params;
    
    connection = await getDbConnection();
    
    const [rows] = await connection.execute(`
      SELECT 
        t.*,
        c.name as suggested_category_name,
        a.name as suggested_account_name
      FROM temp_transactions t
      LEFT JOIN categories c ON t.suggested_category_id = c.id
      LEFT JOIN accounts a ON t.suggested_account_id = a.id
      WHERE t.session_id = ?
      ORDER BY t.normalized_date DESC, t.id ASC
    `, [sessionId]);
    
    res.json({
      success: true,
      transactions: rows
    });
    
  } catch (error) {
    console.error('Erro ao buscar transações:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// POST /api/smart-import/feedback - Enviar feedback sobre sugestões
router.post('/feedback', async (req, res) => {
  let connection;
  
  try {
    const { sessionId, transactionId, userChoice, createRule } = req.body;
    
    if (!sessionId || !transactionId || !userChoice) {
      return res.status(400).json({
        success: false,
        error: 'SessionId, transactionId e userChoice são obrigatórios'
      });
    }
    
    connection = await getDbConnection();
    
    // Buscar dados da transação
    const [transactionRows] = await connection.execute(`
      SELECT * FROM temp_transactions WHERE id = ? AND session_id = ?
    `, [transactionId, sessionId]);
    
    if (transactionRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Transação não encontrada'
      });
    }
    
    const transaction = transactionRows[0];
    
    // Atualizar transação com escolha do usuário
    await connection.execute(`
      UPDATE temp_transactions 
      SET 
        user_category_id = ?,
        user_account_id = ?,
        user_feedback = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      userChoice.categoryId,
      userChoice.accountId,
      JSON.stringify(userChoice),
      transactionId
    ]);
    
    // Aplicar aprendizagem com feedback
    await smartImportService.learnFromFeedback(
      transaction.user_id,
      {
        description: transaction.normalized_description,
        amount: transaction.normalized_amount,
        type: transaction.normalized_type,
        category_id: userChoice.categoryId,
        account_id: userChoice.accountId
      },
      {
        accepted: userChoice.accepted,
        correctedCategoryId: userChoice.categoryId,
        correctedAccountId: userChoice.accountId
      }
    );
    
    // Criar regra de IA se solicitado explicitamente
    if (createRule) {
      await smartImportService.createAIRule(
        transaction.user_id,
        transaction.normalized_description,
        userChoice.categoryId,
        userChoice.accountId,
        'user_explicit_rule'
      );
    }
    
    res.json({
      success: true,
      message: 'Feedback registrado e aprendizagem aplicada com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao processar feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// GET /api/smart-import/rules/:userId - Obter regras de IA do usuário
router.get('/rules/:userId', async (req, res) => {
  let connection;
  
  try {
    const { userId } = req.params;
    
    connection = await getDbConnection();
    
    const [rules] = await connection.execute(`
      SELECT 
        r.*,
        COUNT(t.id) as usage_count
      FROM ai_rules r
      LEFT JOIN temp_transactions t ON JSON_EXTRACT(t.ai_suggestions, '$[0].ruleId') = r.id
      WHERE r.user_id = ? OR r.user_id IS NULL
      GROUP BY r.id
      ORDER BY r.priority DESC, r.created_at DESC
    `, [userId]);
    
    res.json({
      success: true,
      rules: rules.map(rule => ({
        ...rule,
        rule_data: JSON.parse(rule.rule_data || '{}')
      }))
    });
    
  } catch (error) {
    console.error('Erro ao buscar regras:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// POST /api/smart-import/rules - Criar nova regra de IA
router.post('/rules', async (req, res) => {
  let connection;
  
  try {
    const { userId, ruleType, description, ruleData, priority } = req.body;
    
    if (!userId || !ruleType || !description || !ruleData) {
      return res.status(400).json({
        success: false,
        error: 'Todos os campos são obrigatórios'
      });
    }
    
    connection = await getDbConnection();
    
    await connection.execute(`
      INSERT INTO ai_rules 
      (user_id, rule_type, description, rule_data, priority, is_active)
      VALUES (?, ?, ?, ?, ?, TRUE)
    `, [
      userId,
      ruleType,
      description,
      JSON.stringify(ruleData),
      priority || 5
    ]);
    
    res.json({
      success: true,
      message: 'Regra criada com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao criar regra:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// PUT /api/smart-import/rules/:ruleId - Atualizar regra de IA
router.put('/rules/:ruleId', async (req, res) => {
  let connection;
  
  try {
    const { ruleId } = req.params;
    const { description, ruleData, priority, isActive } = req.body;
    
    connection = await getDbConnection();
    
    await connection.execute(`
      UPDATE ai_rules 
      SET 
        description = COALESCE(?, description),
        rule_data = COALESCE(?, rule_data),
        priority = COALESCE(?, priority),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      description,
      ruleData ? JSON.stringify(ruleData) : null,
      priority,
      isActive,
      ruleId
    ]);
    
    res.json({
      success: true,
      message: 'Regra atualizada com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao atualizar regra:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// DELETE /api/smart-import/session/:sessionId - Limpar sessão
router.delete('/session/:sessionId', async (req, res) => {
  let connection;
  
  try {
    const { sessionId } = req.params;
    
    connection = await getDbConnection();
    
    // Remover transações temporárias
    await connection.execute(`
      DELETE FROM temp_transactions WHERE session_id = ?
    `, [sessionId]);
    
    // Remover sessão
    await connection.execute(`
      DELETE FROM smart_import_sessions WHERE session_id = ?
    `, [sessionId]);
    
    res.json({
      success: true,
      message: 'Sessão removida com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao remover sessão:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Função para processar arquivo em background
async function processFileInBackground(sessionId, filePath, fileName, userId) {
  let connection;
  
  try {
    connection = await getDbConnection();
    
    // Atualizar status para 'parsing'
    await connection.execute(`
      UPDATE smart_import_sessions 
      SET status = 'parsing', updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `, [sessionId]);
    
    // Usar FileParsingService para processar o arquivo
    const fileParsingService = new FileParsingService();
    const parseResult = await fileParsingService.parseFile(filePath, fileName);
    
    if (!parseResult.success) {
      throw new Error(`Erro no parsing: ${parseResult.error}`);
    }
    
    const transactions = parseResult.data;
    
    // Atualizar status para 'processing'
    await connection.execute(`
      UPDATE smart_import_sessions 
      SET status = 'processing', total_rows = ?, updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `, [transactions.length, sessionId]);
    
    // Inserir transações temporárias
    let successfulRows = 0;
    for (const transaction of transactions) {
      try {
        await connection.execute(`
          INSERT INTO temp_transactions 
          (session_id, original_data, normalized_date, normalized_description, 
           normalized_amount, normalized_type, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          sessionId,
          JSON.stringify(transaction.originalData || transaction),
          transaction.date,
          transaction.description,
          Math.abs(transaction.amount), // Garantir valor positivo
          transaction.type || (transaction.amount < 0 ? 'expense' : 'income'),
          userId
        ]);
        successfulRows++;
      } catch (error) {
        console.error('Erro ao inserir transação:', error, transaction);
      }
    }
    
    // Atualizar status para 'ai_processing'
    await connection.execute(`
      UPDATE smart_import_sessions 
      SET status = 'ai_processing', processed_rows = ?, successful_rows = ?, 
          updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `, [sampleTransactions.length, sampleTransactions.length, sessionId]);
    
    // Fechar conexão antes do processamento de IA
    await connection.end();
    connection = null;
    
    // Processar com IA
    await smartImportService.enrichTransactions(sessionId, userId);
    
    // Detectar duplicatas
    await smartImportService.detectDuplicates(sessionId, userId);
    
    // Reabrir conexão para atualizar status final
    connection = await getDbConnection();
    
    // Atualizar status para 'completed'
    await connection.execute(`
      UPDATE smart_import_sessions 
      SET status = 'completed', updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `, [sessionId]);
    
    // Limpar arquivo temporário
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.warn('Erro ao remover arquivo temporário:', error);
    }
    
  } catch (error) {
    console.error('Erro no processamento em background:', error);
    
    if (connection) {
      await connection.execute(`
        UPDATE smart_import_sessions 
        SET status = 'error', updated_at = CURRENT_TIMESTAMP
        WHERE session_id = ?
      `, [sessionId]);
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Função para processar dados de texto em background
async function processTextDataInBackground(sessionId, textData, userId) {
  let connection;
  
  try {
    connection = await getDbConnection();
    
    // Simular processamento de dados de texto
    const lines = textData.split('\n').filter(line => line.trim());
    const transactions = [];
    
    // Exemplo simples de parsing
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        transactions.push({
          date: new Date().toISOString().split('T')[0],
          description: parts.slice(0, -1).join(' '),
          amount: parseFloat(parts[parts.length - 1]) || 0,
          type: 'expense'
        });
      }
    }
    
    // Atualizar sessão
    await connection.execute(`
      UPDATE smart_import_sessions 
      SET total_rows = ?, processed_rows = ?, successful_rows = ?, 
          status = 'completed', updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `, [transactions.length, transactions.length, transactions.length, sessionId]);
    
    // Inserir transações
    for (const transaction of transactions) {
      await connection.execute(`
        INSERT INTO temp_transactions 
        (session_id, original_data, normalized_date, normalized_description, 
         normalized_amount, normalized_type, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        sessionId,
        JSON.stringify({ originalLine: line }),
        transaction.date,
        transaction.description,
        transaction.amount,
        transaction.type,
        userId
      ]);
    }
    
  } catch (error) {
    console.error('Erro no processamento de texto:', error);
    
    if (connection) {
      await connection.execute(`
        UPDATE smart_import_sessions 
        SET status = 'error', updated_at = CURRENT_TIMESTAMP
        WHERE session_id = ?
      `, [sessionId]);
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Endpoint para finalizar importação e gravar transações definitivas
router.post('/finalize', async (req, res) => {
  const { sessionId, approvedTransactions } = req.body;
  
  if (!sessionId || !Array.isArray(approvedTransactions)) {
    return res.status(400).json({ 
      error: 'sessionId e approvedTransactions são obrigatórios' 
    });
  }

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Verificar se a sessão existe e pertence ao usuário
    const [sessions] = await connection.execute(`
      SELECT user_id, status FROM smart_import_sessions 
      WHERE session_id = ?
    `, [sessionId]);
    
    if (sessions.length === 0) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }
    
    const { user_id: userId, status } = sessions[0];
    
    if (status !== 'completed') {
      return res.status(400).json({ 
        error: 'Sessão deve estar no status completed para finalizar' 
      });
    }

    // Iniciar transação
    await connection.beginTransaction();
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Processar cada transação aprovada
    for (const transaction of approvedTransactions) {
      try {
        // Validar dados obrigatórios
        if (!transaction.date || !transaction.description || transaction.amount === undefined) {
          throw new Error('Dados obrigatórios faltando: date, description, amount');
        }
        
        // Inserir na tabela principal de transações
        await connection.execute(`
          INSERT INTO transactions 
          (user_id, date, description, amount, type, category_id, account_id, 
           created_at, updated_at, source)
          VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'smart_import')
        `, [
          userId,
          transaction.date,
          transaction.description,
          transaction.amount,
          transaction.type || (transaction.amount < 0 ? 'expense' : 'income'),
          transaction.category_id || null,
          transaction.account_id || null
        ]);
        
        successCount++;
        
        // Se há feedback do usuário, criar/atualizar regra IA
        if (transaction.userFeedback && transaction.category_id) {
          await smartImportService.createAIRule(
            userId,
            transaction.description,
            transaction.category_id,
            transaction.account_id,
            'user_feedback'
          );
        }
        
      } catch (error) {
        errorCount++;
        errors.push({
          transaction: transaction.description,
          error: error.message
        });
        console.error('Erro ao inserir transação:', error, transaction);
      }
    }
    
    // Atualizar status da sessão para 'finalized'
    await connection.execute(`
      UPDATE smart_import_sessions 
      SET status = 'finalized', 
          processed_rows = ?, 
          updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `, [successCount, sessionId]);
    
    // Limpar transações temporárias
    await connection.execute(`
      DELETE FROM temp_transactions WHERE session_id = ?
    `, [sessionId]);
    
    // Commit da transação
    await connection.commit();
    
    res.json({
      success: true,
      message: 'Importação finalizada com sucesso',
      summary: {
        total: approvedTransactions.length,
        success: successCount,
        errors: errorCount,
        errorDetails: errors
      }
    });
    
  } catch (error) {
    console.error('Erro ao finalizar importação:', error);
    
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Erro no rollback:', rollbackError);
      }
    }
    
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

export default router;