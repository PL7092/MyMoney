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
   * Fazer parsing de arquivo Excel
   * @param {string} filePath - Caminho para o arquivo Excel
   * @returns {Promise<Object>} Resultado do parsing
   */
  async parseExcel(filePath) {
    try {
      // Importar XLSX dinamicamente
      const XLSX = await import('xlsx');
      
      // Ler o arquivo Excel
      const workbook = XLSX.readFile(filePath);
      
      // Pegar a primeira planilha
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return {
          success: false,
          error: 'Arquivo Excel não contém planilhas válidas',
          data: []
        };
      }
      
      const worksheet = workbook.Sheets[sheetName];
      
      // Converter para JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, // Usar índices numéricos como cabeçalhos
        defval: '' // Valor padrão para células vazias
      });
      
      if (jsonData.length < 2) {
        return {
          success: false,
          error: 'Arquivo Excel vazio ou sem dados válidos',
          data: []
        };
      }
      
      // Primeira linha são os cabeçalhos
      const headers = jsonData[0];
      const dataRows = jsonData.slice(1);
      
      const transactions = [];
      const errors = [];
      
      for (let i = 0; i < dataRows.length; i++) {
        try {
          const row = {};
          
          // Mapear valores para cabeçalhos
          for (let j = 0; j < headers.length; j++) {
            if (headers[j] && dataRows[i][j] !== undefined) {
              row[headers[j]] = dataRows[i][j];
            }
          }
          
          // Pular linhas vazias
          if (Object.keys(row).length === 0) {
            continue;
          }
          
          const normalizedTransaction = this.normalizeTransactionData(row);
          
          if (normalizedTransaction) {
            transactions.push(normalizedTransaction);
          } else {
            errors.push(`Linha ${i + 2}: Dados inválidos ou incompletos`);
          }
        } catch (error) {
          errors.push(`Linha ${i + 2}: ${error.message}`);
        }
      }
      
      logger.info(`Excel parsing concluído: ${transactions.length} transações, ${errors.length} erros`);
      
      return {
        success: true,
        data: transactions,
        errors: errors.length > 0 ? errors : undefined,
        summary: {
          totalRows: dataRows.length,
          successfulRows: transactions.length,
          errorRows: errors.length,
          sheetName: sheetName
        }
      };
      
    } catch (error) {
      logger.error('Erro no parsing do Excel:', error);
      return {
        success: false,
        error: `Erro ao processar arquivo Excel: ${error.message}`,
        data: []
      };
    }
  }

  /**
   * Fazer parsing de arquivo PDF
   * @param {string} filePath - Caminho para o arquivo PDF
   * @returns {Promise<Object>} Resultado do parsing
   */
  async parsePDF(filePath) {
    try {
      // Importar pdf-parse dinamicamente
      const pdfParse = await import('pdf-parse');
      
      // Ler o arquivo PDF
      const pdfBuffer = await fs.promises.readFile(filePath);
      
      // Extrair texto do PDF
      const pdfData = await pdfParse.default(pdfBuffer);
      const text = pdfData.text;
      
      if (!text || text.trim().length === 0) {
        return {
          success: false,
          error: 'PDF não contém texto extraível ou está vazio',
          data: []
        };
      }
      
      // Dividir o texto em linhas
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      if (lines.length < 2) {
        return {
          success: false,
          error: 'PDF não contém dados suficientes para parsing',
          data: []
        };
      }
      
      const transactions = [];
      const errors = [];
      
      // Tentar detectar padrões de transações bancárias
      for (let i = 0; i < lines.length; i++) {
        try {
          const line = lines[i];
          
          // Padrões comuns de extratos bancários
          // Formato: DD/MM/YYYY DESCRIÇÃO VALOR
          const datePattern = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/;
          const valuePattern = /([\-\+]?\s*[\d\.,]+(?:\s*[€$£¥₹])?)/;
          
          const dateMatch = line.match(datePattern);
          if (!dateMatch) continue;
          
          // Extrair data
          const dateStr = dateMatch[1];
          
          // Extrair valor (último número da linha)
          const valueMatches = line.match(new RegExp(valuePattern.source, 'g'));
          if (!valueMatches || valueMatches.length === 0) continue;
          
          const valueStr = valueMatches[valueMatches.length - 1];
          
          // Extrair descrição (texto entre data e valor)
          const dateIndex = line.indexOf(dateStr);
          const valueIndex = line.lastIndexOf(valueStr);
          
          if (dateIndex >= valueIndex) continue;
          
          const description = line.substring(dateIndex + dateStr.length, valueIndex).trim();
          
          if (!description || description.length < 3) continue;
          
          // Criar objeto de linha para normalização
          const row = {
            data: dateStr,
            descricao: description,
            valor: valueStr
          };
          
          const normalizedTransaction = this.normalizeTransactionData(row);
          
          if (normalizedTransaction) {
            transactions.push(normalizedTransaction);
          } else {
            errors.push(`Linha ${i + 1}: Não foi possível processar - "${line}"`);
          }
          
        } catch (error) {
          errors.push(`Linha ${i + 1}: ${error.message}`);
        }
      }
      
      // Se não encontrou transações com o padrão automático, tentar parsing manual
      if (transactions.length === 0) {
        // Tentar encontrar tabelas ou estruturas de dados
        const tableLines = lines.filter(line => {
          // Linhas que contêm pelo menos uma data e um número
          return /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(line) && 
                 /[\d\.,]+/.test(line);
        });
        
        for (let i = 0; i < tableLines.length; i++) {
          try {
            const line = tableLines[i];
            
            // Dividir por espaços múltiplos ou tabs
            const parts = line.split(/\s{2,}|\t/).filter(part => part.trim().length > 0);
            
            if (parts.length >= 3) {
              // Assumir: [Data, Descrição, Valor] ou [Data, Descrição, ..., Valor]
              const row = {
                data: parts[0],
                descricao: parts.slice(1, -1).join(' '),
                valor: parts[parts.length - 1]
              };
              
              const normalizedTransaction = this.normalizeTransactionData(row);
              
              if (normalizedTransaction) {
                transactions.push(normalizedTransaction);
              }
            }
          } catch (error) {
            // Ignorar erros no parsing manual
          }
        }
      }
      
      logger.info(`PDF parsing concluído: ${transactions.length} transações, ${errors.length} erros`);
      
      return {
        success: true,
        data: transactions,
        errors: errors.length > 0 ? errors : undefined,
        summary: {
          totalLines: lines.length,
          successfulRows: transactions.length,
          errorRows: errors.length,
          pages: pdfData.numpages
        }
      };
      
    } catch (error) {
      logger.error('Erro no parsing do PDF:', error);
      return {
        success: false,
        error: `Erro ao processar arquivo PDF: ${error.message}`,
        data: []
      };
    }
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