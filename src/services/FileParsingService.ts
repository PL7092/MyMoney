import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type?: 'income' | 'expense' | 'transfer';
  category?: string;
  account?: string;
  tags?: string[];
  rawData: any;
}

export interface ParseResult {
  success: boolean;
  data: ParsedTransaction[];
  errors: string[];
  totalRows: number;
}

export class FileParsingService {
  static async parseFile(file: File): Promise<ParseResult> {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    try {
      switch (fileExtension) {
        case 'csv':
          return await this.parseCSV(file);
        case 'xlsx':
        case 'xls':
          return await this.parseExcel(file);
        case 'pdf':
          return await this.parsePDF(file);
        default:
          return {
            success: false,
            data: [],
            errors: [`Formato de arquivo não suportado: ${fileExtension}`],
            totalRows: 0
          };
      }
    } catch (error) {
      return {
        success: false,
        data: [],
        errors: [`Erro ao processar arquivo: ${error}`],
        totalRows: 0
      };
    }
  }

  static async parseCSV(file: File): Promise<ParseResult> {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        complete: (results) => {
          const parsed = this.normalizeTransactionData(results.data as any[]);
          resolve({
            success: true,
            data: parsed.data,
            errors: parsed.errors,
            totalRows: results.data.length
          });
        },
        error: (error) => {
          resolve({
            success: false,
            data: [],
            errors: [`Erro ao processar CSV: ${error.message}`],
            totalRows: 0
          });
        }
      });
    });
  }

  static async parseExcel(file: File): Promise<ParseResult> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Usar a primeira planilha
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Converter para JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          // Converter para formato com cabeçalhos
          if (jsonData.length < 2) {
            resolve({
              success: false,
              data: [],
              errors: ['Arquivo Excel vazio ou sem dados válidos'],
              totalRows: 0
            });
            return;
          }

          const headers = jsonData[0] as string[];
          const rows = jsonData.slice(1);
          
          const formattedData = rows.map(row => {
            const obj: any = {};
            headers.forEach((header, index) => {
              obj[header] = (row as any[])[index] || '';
            });
            return obj;
          });

          const parsed = this.normalizeTransactionData(formattedData);
          resolve({
            success: true,
            data: parsed.data,
            errors: parsed.errors,
            totalRows: formattedData.length
          });
        } catch (error) {
          resolve({
            success: false,
            data: [],
            errors: [`Erro ao processar Excel: ${error}`],
            totalRows: 0
          });
        }
      };
      
      reader.onerror = () => {
        resolve({
          success: false,
          data: [],
          errors: ['Erro ao ler arquivo Excel'],
          totalRows: 0
        });
      };
      
      reader.readAsArrayBuffer(file);
    });
  }

  static async parsePDF(file: File): Promise<ParseResult> {
    try {
      // Note: PDF parsing would require additional logic to extract tabular data
      // For now, we'll return a placeholder implementation
      const text = await this.extractTextFromPDF(file);
      const transactions = this.extractTransactionsFromText(text);
      
      return {
        success: transactions.length > 0,
        data: transactions,
        errors: transactions.length === 0 ? ['Nenhuma transação encontrada no PDF'] : [],
        totalRows: transactions.length
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        errors: [`Erro ao processar PDF: ${error}`],
        totalRows: 0
      };
    }
  }

  static async parseTextData(textData: string): Promise<ParseResult> {
    try {
      // Tentar detectar formato (CSV, TSV, etc.)
      const lines = textData.trim().split('\n');
      if (lines.length < 2) {
        return {
          success: false,
          data: [],
          errors: ['Dados insuficientes para processar'],
          totalRows: 0
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

      // Processar como CSV com o separador detectado
      const csvData = Papa.parse(textData, {
        header: true,
        delimiter: separator,
        skipEmptyLines: true
      });

      const parsed = this.normalizeTransactionData(csvData.data as any[]);
      return {
        success: true,
        data: parsed.data,
        errors: parsed.errors,
        totalRows: csvData.data.length
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        errors: [`Erro ao processar dados de texto: ${error}`],
        totalRows: 0
      };
    }
  }

  private static normalizeTransactionData(rawData: any[]): { data: ParsedTransaction[], errors: string[] } {
    const data: ParsedTransaction[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      try {
        const transaction = this.mapRowToTransaction(row, i + 1);
        if (transaction) {
          data.push(transaction);
        }
      } catch (error) {
        errors.push(`Linha ${i + 1}: ${error}`);
      }
    }

    return { data, errors };
  }

  private static mapRowToTransaction(row: any, lineNumber: number): ParsedTransaction | null {
    // Mapear campos comuns em diferentes formatos
    const fieldMappings = {
      date: ['data', 'date', 'dt', 'transaction_date', 'valor_data', 'data_transacao'],
      description: ['descricao', 'description', 'desc', 'historico', 'memo', 'details', 'referencia'],
      amount: ['valor', 'amount', 'montante', 'value', 'quantia', 'debito', 'credito'],
      type: ['tipo', 'type', 'transaction_type', 'categoria_tipo'],
      category: ['categoria', 'category', 'cat', 'classification'],
      account: ['conta', 'account', 'account_name', 'origem'],
      tags: ['tags', 'etiquetas', 'labels']
    };

    const findFieldValue = (fieldNames: string[]): string => {
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
    let date: string;
    try {
      const parsedDate = new Date(dateStr);
      if (isNaN(parsedDate.getTime())) {
        // Tentar formatos portugueses/brasileiros
        const [day, month, year] = dateStr.split(/[\/\-\.]/);
        if (day && month && year) {
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
    let amount: number;
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
    let type: 'income' | 'expense' | 'transfer' = 'expense';
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
      tags: findFieldValue(fieldMappings.tags)?.split(';').filter(t => t.trim()) || undefined,
      rawData: row
    };
  }

  private static async extractTextFromPDF(file: File): Promise<string> {
    // Implementação básica - em produção usaria uma biblioteca como pdf-parse
    // Para agora, retornamos uma string vazia e sugerimos o usuário cole os dados
    return '';
  }

  private static extractTransactionsFromText(text: string): ParsedTransaction[] {
    // Implementação básica para extrair transações de texto livre
    // Seria expandida com regex patterns para diferentes formatos de extrato
    return [];
  }
}