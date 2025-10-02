import { ParsedTransaction } from './FileParsingService';

export interface Transaction {
  id?: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  description: string;
  category: string;
  account: string;
  date: string;
  tags?: string[];
}

export interface AICategorizationSuggestion {
  originalTransaction: ParsedTransaction;
  suggestedCategory: string;
  suggestedSubcategory?: string;
  suggestedType: 'income' | 'expense' | 'transfer';
  suggestedAccount?: string;
  suggestedDestinationAccount?: string;
  suggestedTags: string[];
  optimizedDescription?: string;
  confidence: number;
  reasoning: string;
  possibleDuplicate?: {
    existingTransaction: Transaction;
    similarity: number;
    daysDifference: number;
  };
  associatedEntity?: {
    type: 'recurring' | 'investment' | 'savings' | 'asset';
    id: string;
    name: string;
    confidence: number;
  };
}

export interface CategorizationResult {
  suggestions: AICategorizationSuggestion[];
  newCategories: string[];
  newTags: string[];
}

export class AICategorizationService {
  private static commonCategories = {
    expense: [
      'Alimentação', 'Supermercado', 'Restaurantes', 'Fast Food',
      'Transporte', 'Combustível', 'Transportes Públicos', 'Táxi/Uber',
      'Casa', 'Renda', 'Condomínio', 'Utilities', 'Internet/Telefone',
      'Saúde', 'Médico', 'Farmácia', 'Seguro Saúde',
      'Educação', 'Cursos', 'Livros', 'Material Escolar',
      'Lazer', 'Cinema', 'Streaming', 'Hobbies', 'Viagens',
      'Vestuário', 'Roupas', 'Calçados', 'Acessórios',
      'Tecnologia', 'Software', 'Hardware', 'Gadgets',
      'Serviços', 'Banco', 'Seguros', 'Impostos',
      'Outros'
    ],
    income: [
      'Salário', 'Freelance', 'Investimentos', 'Dividendos',
      'Aluguel', 'Vendas', 'Bonus', 'Prêmios',
      'Reembolsos', 'Cashback', 'Juros',
      'Outros'
    ]
  };

  private static categoryKeywords = {
    'Alimentação': ['supermercado', 'mercearia', 'padaria', 'açougue', 'peixaria', 'continente', 'pingo doce', 'lidl', 'auchan'],
    'Restaurantes': ['restaurante', 'tasca', 'café', 'bar', 'pizzaria', 'mcdonald', 'burger', 'kfc', 'pizza hut'],
    'Fast Food': ['fast food', 'drive', 'delivery', 'uber eats', 'glovo', 'takeaway'],
    'Combustível': ['galp', 'bp', 'repsol', 'combustível', 'gasoline', 'diesel', 'posto'],
    'Transportes Públicos': ['metro', 'comboio', 'autocarro', 'cp', 'carris', 'andante', 'navegante'],
    'Táxi/Uber': ['uber', 'taxi', 'bolt', 'free now'],
    'Renda': ['renda', 'aluguer', 'rent'],
    'Utilities': ['edp', 'endesa', 'galp energia', 'água', 'gas', 'eletricidade'],
    'Internet/Telefone': ['nos', 'meo', 'vodafone', 'internet', 'telefone', 'mobile'],
    'Farmácia': ['farmácia', 'pharmacy', 'medicamento'],
    'Supermercado': ['continente', 'pingo doce', 'lidl', 'auchan', 'intermarche', 'minipreço'],
    'Banco': ['banco', 'caixa', 'millennium', 'santander', 'bpi', 'novo banco'],
    'Cinema': ['cinema', 'nos cinemas', 'cinema city'],
    'Streaming': ['netflix', 'spotify', 'amazon prime', 'disney+', 'hbo'],
    'Seguros': ['seguro', 'insurance', 'fidelidade', 'tranquilidade'],
    'Salário': ['salário', 'vencimento', 'ordenado', 'salary'],
    'Dividendos': ['dividendo', 'dividend', 'acções', 'etf'],
    'Cashback': ['cashback', 'reembolso', 'refund']
  };

  static async categorizeTransactions(
    transactions: ParsedTransaction[],
    existingTransactions: Transaction[] = [],
    existingCategories: string[] = [],
    categories: any[] = [],
    entities: any[] = [],
    recurringTransactions: any[] = [],
    investments: any[] = [],
    savingsGoals: any[] = [],
    assets: any[] = [],
    aiRules: any[] = []
  ): Promise<CategorizationResult> {
    const suggestions: AICategorizationSuggestion[] = [];
    const newCategories = new Set<string>();
    const newTags = new Set<string>();

    // Criar um mapa de padrões baseado no histórico
    const historicalPatterns = this.buildHistoricalPatterns(existingTransactions);

    for (const transaction of transactions) {
      const suggestion = await this.categorizeSingleTransaction(
        transaction,
        historicalPatterns,
        existingCategories,
        categories,
        entities,
        recurringTransactions,
        investments,
        savingsGoals,
        assets,
        aiRules,
        existingTransactions
      );
      
      suggestions.push(suggestion);
      
      // Adicionar novas categorias e tags
      if (!existingCategories.includes(suggestion.suggestedCategory)) {
        newCategories.add(suggestion.suggestedCategory);
      }
      
      suggestion.suggestedTags.forEach(tag => {
        if (!existingTransactions.some(t => t.tags?.includes(tag))) {
          newTags.add(tag);
        }
      });
    }

    return {
      suggestions,
      newCategories: Array.from(newCategories),
      newTags: Array.from(newTags)
    };
  }

  private static buildHistoricalPatterns(transactions: Transaction[]): Map<string, { category: string, type: string, count: number }> {
    const patterns = new Map();

    transactions.forEach(transaction => {
      const key = this.normalizeDescription(transaction.description);
      if (patterns.has(key)) {
        patterns.get(key).count++;
      } else {
        patterns.set(key, {
          category: transaction.category,
          type: transaction.type,
          count: 1
        });
      }
    });

    return patterns;
  }

  private static async categorizeSingleTransaction(
    transaction: ParsedTransaction,
    historicalPatterns: Map<string, any>,
    existingCategories: string[],
    categories: any[] = [],
    entities: any[] = [],
    recurringTransactions: any[] = [],
    investments: any[] = [],
    savingsGoals: any[] = [],
    assets: any[] = [],
    aiRules: any[] = [],
    existingTransactions: Transaction[] = []
  ): Promise<AICategorizationSuggestion> {
    const description = transaction.description.toLowerCase();
    const normalizedDesc = this.normalizeDescription(description);
    
    // 1. Verificar possíveis duplicatas
    const duplicateCheck = this.checkForDuplicates(transaction, existingTransactions);
    
    // 2. Verificar padrões históricos
    let suggestion: Partial<AICategorizationSuggestion> = {};
    if (historicalPatterns.has(normalizedDesc)) {
      const pattern = historicalPatterns.get(normalizedDesc);
      suggestion = {
        suggestedCategory: pattern.category,
        suggestedType: pattern.type,
        confidence: 0.95,
        reasoning: `Baseado em ${pattern.count} transações similares no histórico`
      };
    } else {
      suggestion = this.performKeywordAnalysis(transaction, categories);
    }
    
    // 3. Aplicar regras de IA customizadas
    const aiRuleResult = this.applyAIRules(transaction, aiRules, suggestion);
    if (aiRuleResult) {
      suggestion = { ...suggestion, ...aiRuleResult };
    }
    
    // 4. Verificar associações com entidades existentes
    const entityAssociation = this.checkEntityAssociations(
      transaction,
      entities,
      recurringTransactions,
      investments,
      savingsGoals,
      assets
    );
    
    // 5. Otimizar descrição baseada em padrões existentes
    const optimizedDescription = this.optimizeDescription(transaction.description, existingTransactions);
    
    // 6. Sugerir subcategoria baseada na categoria sugerida
    const subcategory = this.suggestSubcategory(suggestion.suggestedCategory || 'Outros', categories);
    
    return {
      originalTransaction: transaction,
      suggestedCategory: suggestion.suggestedCategory || 'Outros',
      suggestedSubcategory: subcategory,
      suggestedType: suggestion.suggestedType || this.inferTypeFromAmount(transaction.amount),
      suggestedTags: this.extractTags(description),
      optimizedDescription,
      confidence: suggestion.confidence || 0.3,
      reasoning: suggestion.reasoning || 'Categorização baseada em análise de padrões',
      possibleDuplicate: duplicateCheck,
      associatedEntity: entityAssociation
    };
  }

  private static checkForDuplicates(
    transaction: ParsedTransaction,
    existingTransactions: Transaction[]
  ): AICategorizationSuggestion['possibleDuplicate'] {
    const transactionDate = new Date(transaction.date);
    
    for (const existing of existingTransactions) {
      const existingDate = new Date(existing.date);
      const daysDiff = Math.abs((transactionDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Verificar se o valor é igual e está dentro de 7 dias
      if (Math.abs(existing.amount - Math.abs(transaction.amount)) < 0.01 && daysDiff <= 7) {
        // Calcular similaridade da descrição
        const similarity = this.calculateStringSimilarity(
          transaction.description.toLowerCase(),
          existing.description.toLowerCase()
        );
        
        if (similarity > 0.7) {
          return {
            existingTransaction: existing,
            similarity,
            daysDifference: Math.round(daysDiff)
          };
        }
      }
    }
    
    return undefined;
  }

  private static calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  private static performKeywordAnalysis(
    transaction: ParsedTransaction,
    categories: any[]
  ): Partial<AICategorizationSuggestion> {

    const description = transaction.description.toLowerCase();
    let bestMatch = { category: 'Outros', confidence: 0.3, type: transaction.type || 'expense' };
    let reasoning = 'Categorização baseada em análise de palavras-chave';

    // Verificar palavras-chave das categorias existentes
    for (const category of categories) {
      if (category.keywords && category.keywords.length > 0) {
        for (const keyword of category.keywords) {
          if (description.includes(keyword.toLowerCase())) {
            const confidence = this.calculateKeywordConfidence(description, keyword);
            if (confidence > bestMatch.confidence) {
              bestMatch = {
                category: category.name,
                confidence,
                type: category.type
              };
              reasoning = `Categoria personalizada identificada: "${keyword}"`;
            }
          }
        }
      }
    }

    // Fallback para categorias padrão se não encontrou match personalizado
    if (bestMatch.confidence < 0.5) {
      for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
        for (const keyword of keywords) {
          if (description.includes(keyword.toLowerCase())) {
            const confidence = this.calculateKeywordConfidence(description, keyword);
            if (confidence > bestMatch.confidence) {
              bestMatch = {
                category,
                confidence,
                type: this.inferTypeFromCategory(category)
              };
              reasoning = `Palavra-chave identificada: "${keyword}"`;
            }
          }
        }
      }
    }

    // Análise de valor para inferir tipo
    if (transaction.amount > 1000 && description.includes('salario')) {
      bestMatch = {
        category: 'Salário',
        confidence: 0.9,
        type: 'income'
      };
      reasoning = 'Valor alto com indicativo de salário';
    }

    return {
      suggestedCategory: bestMatch.category,
      suggestedType: bestMatch.type as 'income' | 'expense' | 'transfer',
      confidence: bestMatch.confidence,
      reasoning
    };
  }

  private static applyAIRules(
    transaction: ParsedTransaction,
    aiRules: any[],
    currentSuggestion: Partial<AICategorizationSuggestion>
  ): Partial<AICategorizationSuggestion> | null {
    const description = transaction.description.toLowerCase();
    
    for (const rule of aiRules) {
      if (!rule.isActive) continue;
      
      let matches = false;
      
      try {
        // Verificar condições da regra
        if (rule.conditions) {
          if (rule.conditions.description && 
              description.includes(rule.conditions.description.toLowerCase())) {
            matches = true;
          }
          
          if (rule.conditions.amount) {
            const amount = Math.abs(transaction.amount);
            if (rule.conditions.amountOperator === 'greater' && amount > rule.conditions.amount) {
              matches = true;
            } else if (rule.conditions.amountOperator === 'less' && amount < rule.conditions.amount) {
              matches = true;
            } else if (rule.conditions.amountOperator === 'equals' && 
                      Math.abs(amount - rule.conditions.amount) < 0.01) {
              matches = true;
            }
          }
        }
        
        if (matches && rule.confidence > (currentSuggestion.confidence || 0)) {
          return {
            suggestedCategory: rule.actions.category,
            suggestedSubcategory: rule.actions.subcategory,
            suggestedType: rule.actions.type,
            confidence: rule.confidence,
            reasoning: `Regra IA aplicada: ${rule.name}`
          };
        }
      } catch (error) {
        console.warn('Erro ao aplicar regra IA:', rule.name, error);
      }
    }
    
    return null;
  }

  private static checkEntityAssociations(
    transaction: ParsedTransaction,
    entities: any[],
    recurringTransactions: any[],
    investments: any[],
    savingsGoals: any[],
    assets: any[]
  ): AICategorizationSuggestion['associatedEntity'] {
    const description = transaction.description.toLowerCase();
    
    // Verificar transações recorrentes
    for (const recurring of recurringTransactions) {
      if (recurring.isActive && 
          description.includes(recurring.description.toLowerCase()) &&
          Math.abs(Math.abs(transaction.amount) - recurring.amount) < 0.01) {
        return {
          type: 'recurring',
          id: recurring.id,
          name: recurring.description,
          confidence: 0.9
        };
      }
    }
    
    // Verificar investimentos
    for (const investment of investments) {
      if (description.includes(investment.name.toLowerCase()) ||
          description.includes('investimento') ||
          description.includes('corretora') ||
          description.includes('bolsa')) {
        return {
          type: 'investment',
          id: investment.id,
          name: investment.name,
          confidence: 0.8
        };
      }
    }
    
    // Verificar metas de poupança
    for (const savings of savingsGoals) {
      if (savings.isActive &&
          description.includes(savings.name.toLowerCase()) ||
          description.includes('poupança') ||
          description.includes('saving')) {
        return {
          type: 'savings',
          id: savings.id,
          name: savings.name,
          confidence: 0.8
        };
      }
    }
    
    // Verificar ativos
    for (const asset of assets) {
      if (description.includes(asset.name.toLowerCase())) {
        return {
          type: 'asset',
          id: asset.id,
          name: asset.name,
          confidence: 0.8
        };
      }
    }
    
    // Verificar entidades
    for (const entity of entities) {
      if (entity.isActive &&
          description.includes(entity.name.toLowerCase())) {
        return {
          type: 'recurring',
          id: entity.id,
          name: entity.name,
          confidence: 0.7
        };
      }
    }
    
    return undefined;
  }

  private static optimizeDescription(description: string, existingTransactions: Transaction[]): string {
    // Encontrar descrições similares e sugerir padronização
    const normalizedInput = this.normalizeDescription(description);
    
    const similarTransactions = existingTransactions.filter(t => {
      const similarity = this.calculateStringSimilarity(
        normalizedInput,
        this.normalizeDescription(t.description)
      );
      return similarity > 0.7;
    });
    
    if (similarTransactions.length > 0) {
      // Retornar a descrição mais comum
      const descriptionCounts = similarTransactions.reduce((acc, t) => {
        acc[t.description] = (acc[t.description] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const mostCommon = Object.entries(descriptionCounts)
        .sort(([,a], [,b]) => b - a)[0];
      
      if (mostCommon && mostCommon[1] > 1) {
        return mostCommon[0];
      }
    }
    
    return description;
  }

  private static suggestSubcategory(category: string, categories: any[]): string | undefined {
    const categoryData = categories.find(c => c.name === category);
    if (categoryData && categoryData.subcategories && categoryData.subcategories.length > 0) {
      // Retornar a primeira subcategoria como sugestão padrão
      return categoryData.subcategories[0].name;
    }
    return undefined;
  }

  private static inferTypeFromAmount(amount: number): 'income' | 'expense' | 'transfer' {
    return amount > 0 ? 'income' : 'expense';
  }

  private static normalizeDescription(description: string): string {
    return description
      .toLowerCase()
      .replace(/[0-9\-\*\/\\]/g, '') // Remover números e caracteres especiais
      .replace(/\s+/g, ' ') // Normalizar espaços
      .trim()
      .substring(0, 50); // Limitar tamanho
  }

  private static calculateKeywordConfidence(description: string, keyword: string): number {
    const baseConfidence = 0.7;
    const exactMatch = description === keyword ? 0.2 : 0;
    const positionBonus = description.startsWith(keyword) ? 0.1 : 0;
    
    return Math.min(baseConfidence + exactMatch + positionBonus, 0.95);
  }

  private static inferTypeFromCategory(category: string): 'income' | 'expense' | 'transfer' {
    const incomeCategories = ['Salário', 'Freelance', 'Investimentos', 'Dividendos', 'Aluguel', 'Vendas', 'Bonus', 'Prêmios', 'Reembolsos', 'Cashback', 'Juros'];
    
    if (incomeCategories.includes(category)) {
      return 'income';
    }
    
    return 'expense';
  }

  private static extractTags(description: string): string[] {
    const tags: string[] = [];
    
    // Tags baseadas em padrões comuns
    if (description.includes('online') || description.includes('internet')) {
      tags.push('online');
    }
    
    if (description.includes('cartão') || description.includes('card')) {
      tags.push('cartão');
    }
    
    if (description.includes('transferência') || description.includes('transfer')) {
      tags.push('transferência');
    }
    
    if (description.includes('urgente') || description.includes('emergency')) {
      tags.push('urgente');
    }
    
    if (description.includes('mensal') || description.includes('monthly')) {
      tags.push('recorrente');
    }

    // Extrair possíveis estabelecimentos
    const words = description.split(' ');
    for (const word of words) {
      if (word.length > 4 && word.match(/^[a-zA-Z]+$/)) {
        // Possível nome de estabelecimento
        if (!tags.includes(word) && tags.length < 3) {
          tags.push(word);
        }
      }
    }
    
    return tags.slice(0, 3); // Máximo 3 tags
  }

  static generateFinancialAdvice(suggestions: AICategorizationSuggestion[]): string[] {
    const advice: string[] = [];
    
    // Análise de gastos por categoria
    const categoryTotals = suggestions.reduce((acc, suggestion) => {
      if (suggestion.suggestedType === 'expense') {
        acc[suggestion.suggestedCategory] = (acc[suggestion.suggestedCategory] || 0) + suggestion.originalTransaction.amount;
      }
      return acc;
    }, {} as Record<string, number>);

    const sortedCategories = Object.entries(categoryTotals)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);

    if (sortedCategories.length > 0) {
      const topCategory = sortedCategories[0];
      advice.push(`Maior categoria de gastos identificada: ${topCategory[0]} (€${topCategory[1].toFixed(2)})`);
    }

    // Detectar padrões
    const totalExpenses = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
    const foodExpenses = (categoryTotals['Alimentação'] || 0) + (categoryTotals['Restaurantes'] || 0);
    
    if (foodExpenses > totalExpenses * 0.3) {
      advice.push('Gastos com alimentação representam mais de 30% do total. Considere cozinhar mais em casa.');
    }

    if (categoryTotals['Lazer'] > totalExpenses * 0.2) {
      advice.push('Gastos com lazer estão elevados. Reveja o orçamento para esta categoria.');
    }

    return advice;
  }
}