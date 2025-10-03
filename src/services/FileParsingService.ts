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
    try {
      // Usar PDF.js para extrair texto do PDF
      const pdfjsLib = await import('pdfjs-dist');
      
      // Configurar worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      
      // Extrair texto de todas as páginas
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }
      
      return fullText;
    } catch (error) {
      console.error('Erro ao extrair texto do PDF:', error);
      throw new Error('Não foi possível extrair texto do PDF. Verifique se o arquivo não está protegido.');
    }
  }

  private static extractTransactionsFromText(text: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    const lines = text.split('\n').filter(line => line.trim());
    
    // Padrões regex para diferentes formatos de extrato bancário
    const patterns = [
      // Formato: DD/MM/YYYY DESCRIÇÃO VALOR
      /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([-+]?\d+[.,]\d{2})\s*$/,
      // Formato: DD-MM-YYYY DESCRIÇÃO VALOR
      /(\d{2}-\d{2}-\d{4})\s+(.+?)\s+([-+]?\d+[.,]\d{2})\s*$/,
      // Formato: YYYY-MM-DD DESCRIÇÃO VALOR
      /(\d{4}-\d{2}-\d{2})\s+(.+?)\s+([-+]?\d+[.,]\d{2})\s*$/,
      // Formato com separador de milhares: DD/MM/YYYY DESCRIÇÃO 1.234,56
      /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([-+]?\d{1,3}(?:\.\d{3})*[,]\d{2})\s*$/
    ];
    
    for (const line of lines) {
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          const [, dateStr, description, amountStr] = match;
          
          try {
            // Processar data
            let date: string;
            if (dateStr.includes('/')) {
              const [day, month, year] = dateStr.split('/');
              date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            } else if (dateStr.includes('-')) {
              if (dateStr.startsWith('20')) {
                date = dateStr; // Já está no formato YYYY-MM-DD
              } else {
                const [day, month, year] = dateStr.split('-');
                date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
              }
            } else {
              continue; // Formato não reconhecido
            }
            
            // Processar valor
            const cleanAmount = amountStr
              .replace(/[€$£¥₹]/g, '')
              .replace(/\s/g, '')
              .replace(/\./g, '') // Remover separadores de milhares
              .replace(',', '.'); // Trocar vírgula decimal por ponto
            
            const amount = Math.abs(parseFloat(cleanAmount));
            if (isNaN(amount)) continue;
            
            // Determinar tipo baseado no sinal
            const type: 'income' | 'expense' = amountStr.startsWith('-') ? 'expense' : 'income';
            
            transactions.push({
              date,
              description: description.trim(),
              amount,
              type,
              rawData: { originalLine: line }
            });
            
            break; // Parar de tentar outros padrões para esta linha
          } catch (error) {
            console.warn('Erro ao processar linha:', line, error);
            continue;
          }
        }
      }
    }
    
    return transactions;
  }

  // Método para validar e enriquecer dados antes do Smart Import
  static validateAndEnrichData(transactions: ParsedTransaction[]): {
    valid: ParsedTransaction[];
    invalid: { transaction: ParsedTransaction; errors: string[] }[];
  } {
    const valid: ParsedTransaction[] = [];
    const invalid: { transaction: ParsedTransaction; errors: string[] }[] = [];
    
    for (const transaction of transactions) {
      const errors: string[] = [];
      
      // Validar data
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(transaction.date)) {
        errors.push('Formato de data inválido (esperado: YYYY-MM-DD)');
      } else {
        const date = new Date(transaction.date);
        if (isNaN(date.getTime())) {
          errors.push('Data inválida');
        }
      }
      
      // Validar descrição
      if (!transaction.description || transaction.description.trim().length < 3) {
        errors.push('Descrição muito curta (mínimo 3 caracteres)');
      }
      
      // Validar valor
      if (!transaction.amount || transaction.amount <= 0) {
        errors.push('Valor deve ser maior que zero');
      }
      
      // Validar tipo
      if (transaction.type && !['income', 'expense', 'transfer'].includes(transaction.type)) {
        errors.push('Tipo de transação inválido');
      }
      
      if (errors.length === 0) {
        valid.push(transaction);
      } else {
        invalid.push({ transaction, errors });
      }
    }
    
    return { valid, invalid };
  }

  // Método para detectar duplicatas potenciais
  static detectPotentialDuplicates(transactions: ParsedTransaction[]): {
    transaction: ParsedTransaction;
    duplicates: ParsedTransaction[];
    confidence: number;
  }[] {
    const duplicates: {
      transaction: ParsedTransaction;
      duplicates: ParsedTransaction[];
      confidence: number;
    }[] = [];
    
    for (let i = 0; i < transactions.length; i++) {
      const current = transactions[i];
      const potentialDuplicates: ParsedTransaction[] = [];
      
      for (let j = i + 1; j < transactions.length; j++) {
        const other = transactions[j];
        
        // Verificar se são potenciais duplicatas
        const sameAmount = Math.abs(current.amount - other.amount) < 0.01;
        const sameDate = current.date === other.date;
        const similarDescription = this.calculateSimilarity(
          current.description.toLowerCase(),
          other.description.toLowerCase()
        ) > 0.8;
        
        if (sameAmount && (sameDate || similarDescription)) {
          potentialDuplicates.push(other);
        }
      }
      
      if (potentialDuplicates.length > 0) {
        const confidence = potentialDuplicates.length > 1 ? 0.9 : 0.7;
        duplicates.push({
          transaction: current,
          duplicates: potentialDuplicates,
          confidence
        });
      }
    }
    
    return duplicates;
  }

  // Método auxiliar para calcular similaridade entre strings
  private static calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  // Implementação da distância de Levenshtein
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}