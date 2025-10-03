import fs from 'fs';
import path from 'path';
import { logger } from './LoggerService.js';

/**
 * FileParsingService - Serviço para parsing de arquivos de transações
 * Suporta CSV, Excel e PDF
 */
export class FileParsingService {
  constructor() {
    this.supportedFormats = ['.csv', '.xlsx', '.xls', '.pdf'];
  }

  /**
   * Fazer parsing de um arquivo
   * @param {string} filePath - Caminho para o arquivo
   * @param {string} fileName - Nome original do arquivo
   * @returns {Promise<Object>} Resultado do parsing
   */
  async parseFile(filePath, fileName) {
    try {
      const fileExtension = path.extname(fileName).toLowerCase();
      
      if (!this.supportedFormats.includes(fileExtension)) {
        return {
          success: false,
          error: `Formato de arquivo não suportado: ${fileExtension}`,
          data: []
        };
      }

      logger.info(`Iniciando parsing do arquivo: ${fileName} (${fileExtension})`);

      switch (fileExtension) {
        case '.csv':
          return await this.parseCSV(filePath);
        case '.xlsx':
        case '.xls':
          return await this.parseExcel(filePath);
        case '.pdf':
          return await this.parsePDF(filePath);
        default:
          return {
            success: false,
            error: `Formato não implementado: ${fileExtension}`,
            data: []
          };
      }
    } catch (error) {
      logger.error('Erro no parsing do arquivo:', error);
      return {
        success: false,
        error: `Erro ao processar arquivo: ${error.message}`,
        data: []
      };
    }
  }

  /**
   * Fazer parsing de arquivo CSV
   * @param {string} filePath - Caminho para o arquivo CSV
   * @returns {Promise<Object>} Resultado do parsing
   */
  async parseCSV(filePath) {
    try {
      const csvContent = await fs.promises.readFile(filePath, 'utf8');
      const lines = csvContent.trim().split('\n');
      
      if (lines.length < 2) {
        return {
          success: false,
          error: 'Arquivo CSV vazio ou sem dados válidos',
          data: []
        };
      }

      // Detectar separador
      const firstLine = lines[0];
      const separators = [',', ';', '\t', '|'];
      let separator = ',';
      let maxCount = 0;

      for (const sep of separators) {
        const count = firstLine.split(sep).length;
        if (count > maxCount) {
          maxCount = count;
          separator = sep;
        }
      }

      // Processar cabeçalhos
      const headers = lines[0].split(separator).map(h => h.trim().replace(/"/g, ''));
      const dataLines = lines.slice(1);

      const transactions = [];
      const errors = [];

      for (let i = 0; i < dataLines.length; i++) {
        try {
          const values = dataLines[i].split(separator).map(v => v.trim().replace(/"/g, ''));
          
          if (values.length !== headers.length) {
            errors.push(`Linha ${i + 2}: Número de colunas não corresponde ao cabeçalho`);
            continue;
          }

          const row = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });

          const transaction = this.normalizeTransactionData(row);
          if (transaction) {
            transactions.push(transaction);
          } else {
            errors.push(`Linha ${i + 2}: Dados inválidos ou incompletos`);
          }
        } catch (error) {
          errors.push(`Linha ${i + 2}: Erro ao processar - ${error.message}`);
        }
      }

      logger.info(`CSV parsing concluído: ${transactions.length} transações válidas, ${errors.length} erros`);

      return {
        success: true,
        data: transactions,
        errors: errors,
        totalRows: dataLines.length
      };
    } catch (error) {
      logger.error('Erro ao processar CSV:', error);
      return {
        success: false,
        error: `Erro ao processar CSV: ${error.message}`,
        data: []
      };
    }
  }

  /**
   * Fazer parsing de arquivo Excel (placeholder)
   * @param {string} filePath - Caminho para o arquivo Excel
   * @returns {Promise<Object>} Resultado do parsing
   */
  async parseExcel(filePath) {
    // Por enquanto, retornar erro indicando que Excel não está implementado
    logger.warn('Parsing de Excel não implementado ainda');
    return {
      success: false,
      error: 'Parsing de arquivos Excel não está implementado ainda. Use CSV por favor.',
      data: []
    };
  }

  /**
   * Fazer parsing de arquivo PDF (placeholder)
   * @param {string} filePath - Caminho para o arquivo PDF
   * @returns {Promise<Object>} Resultado do parsing
   */
  async parsePDF(filePath) {
    // Por enquanto, retornar erro indicando que PDF não está implementado
    logger.warn('Parsing de PDF não implementado ainda');
    return {
      success: false,
      error: 'Parsing de arquivos PDF não está implementado ainda. Use CSV por favor.',
      data: []
    };
  }

  /**
   * Normalizar dados de transação
   * @param {Object} row - Linha de dados brutos
   * @returns {Object|null} Transação normalizada ou null se inválida
   */
  normalizeTransactionData(row) {
    // Mapeamentos de campos comuns
    const fieldMappings = {
      date: ['data', 'date', 'fecha', 'datum', 'transaction_date', 'dt'],
      description: ['descricao', 'description', 'desc', 'memo', 'details', 'historico', 'movimento'],
      amount: ['valor', 'amount', 'value', 'montante', 'quantia', 'debito', 'credito'],
      type: ['tipo', 'type', 'categoria_tipo', 'transaction_type'],
      category: ['categoria', 'category', 'cat'],
      account: ['conta', 'account', 'banco', 'bank']
    };

    const findFieldValue = (fieldNames) => {
      for (const fieldName of fieldNames) {
        for (const key of Object.keys(row)) {
          if (key.toLowerCase().includes(fieldName) && row[key] !== undefined && row[key] !== '') {
            return String(row[key]).trim();
          }
        }
      }
      return '';
    };

    // Extrair campos
    const dateStr = findFieldValue(fieldMappings.date);
    const description = findFieldValue(fieldMappings.description);
    const amountStr = findFieldValue(fieldMappings.amount);
    
    // Validações básicas
    if (!dateStr || !description || !amountStr) {
      return null; // Linha inválida
    }

    // Processar data
    let date;
    try {
      const parsedDate = new Date(dateStr);
      if (isNaN(parsedDate.getTime())) {
        // Tentar formatos portugueses/brasileiros
        const dateParts = dateStr.split(/[\/\-\.]/);
        if (dateParts.length === 3) {
          const [day, month, year] = dateParts;
          date = `${year.padStart(4, '20')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } else {
          throw new Error('Formato de data inválido');
        }
      } else {
        date = parsedDate.toISOString().split('T')[0];
      }
    } catch {
      date = new Date().toISOString().split('T')[0]; // Data atual como fallback
    }

    // Processar valor
    let amount;
    try {
      // Limpar formato monetário
      const cleanAmount = amountStr
        .replace(/[€$£¥₹]/g, '') // Remover símbolos de moeda
        .replace(/\s/g, '') // Remover espaços
        .replace(/\./g, '') // Remover pontos (milhares)
        .replace(',', '.'); // Trocar vírgula por ponto (decimal)
      
      amount = Math.abs(parseFloat(cleanAmount));
      if (isNaN(amount)) {
        throw new Error('Valor inválido');
      }
    } catch {
      return null; // Valor inválido
    }

    // Determinar tipo baseado no valor original ou campo específico
    let type = 'expense';
    const typeStr = findFieldValue(fieldMappings.type).toLowerCase();
    
    if (typeStr.includes('receita') || typeStr.includes('income') || typeStr.includes('credit') || amountStr.includes('+')) {
      type = 'income';
    } else if (typeStr.includes('transferencia') || typeStr.includes('transfer')) {
      type = 'transfer';
    } else if (amountStr.includes('-') || typeStr.includes('despesa') || typeStr.includes('expense') || typeStr.includes('debit')) {
      type = 'expense';
    }

    return {
      date,
      description,
      amount,
      type,
      category: findFieldValue(fieldMappings.category) || undefined,
      account: findFieldValue(fieldMappings.account) || undefined,
      originalData: row
    };
  }
}

// Exportar instância singleton
export const fileParsingService = new FileParsingService();