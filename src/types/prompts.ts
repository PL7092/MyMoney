export type PromptCategory = 'chat_responses' | 'categorization' | 'analysis' | 'recommendations';

export interface AIPrompt {
  id: number;
  name: string;
  category: PromptCategory;
  prompt: string;
  description?: string;
  variables: string[];
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PromptVariable {
  name: string;
  description: string;
  example: string;
}

export const PROMPT_VARIABLES: Record<string, PromptVariable> = {
  total_expenses: {
    name: 'total_expenses',
    description: 'Total de despesas',
    example: '1250.50'
  },
  total_income: {
    name: 'total_income',
    description: 'Total de receitas',
    example: '3000.00'
  },
  total_balance: {
    name: 'total_balance',
    description: 'Saldo total de todas as contas',
    example: '5420.30'
  },
  budget_count: {
    name: 'budget_count',
    description: 'Número de orçamentos configurados',
    example: '5'
  },
  budget_status: {
    name: 'budget_status',
    description: 'Status dos orçamentos',
    example: '3 dentro do limite, 2 próximos do limite'
  },
  top_categories: {
    name: 'top_categories',
    description: 'Principais categorias de gastos',
    example: 'Alimentação, Transporte, Casa'
  },
  highest_category: {
    name: 'highest_category',
    description: 'Categoria com maior gasto',
    example: 'Alimentação'
  },
  savings_suggestion: {
    name: 'savings_suggestion',
    description: 'Sugestão de poupança',
    example: 'economizar 10% do saldo em investimentos de baixo risco'
  },
  description: {
    name: 'description',
    description: 'Descrição da transação',
    example: 'Compra no Continente'
  },
  amount: {
    name: 'amount',
    description: 'Valor da transação',
    example: '45.67'
  },
  date: {
    name: 'date',
    description: 'Data da transação',
    example: '2024-01-15'
  },
  categories: {
    name: 'categories',
    description: 'Lista de categorias disponíveis',
    example: 'Alimentação, Transporte, Saúde, etc.'
  },
  spent: {
    name: 'spent',
    description: 'Valor já gasto no orçamento',
    example: '450.00'
  },
  limit: {
    name: 'limit',
    description: 'Limite do orçamento',
    example: '500.00'
  },
  percentage: {
    name: 'percentage',
    description: 'Percentagem gasta do orçamento',
    example: '90'
  },
  category_name: {
    name: 'category_name',
    description: 'Nome da categoria',
    example: 'Alimentação'
  },
  period: {
    name: 'period',
    description: 'Período de análise em dias',
    example: '30'
  },
  daily_avg: {
    name: 'daily_avg',
    description: 'Média diária de gastos',
    example: '42.50'
  }
};

export const CATEGORY_LABELS: Record<PromptCategory, string> = {
  chat_responses: 'Respostas do Chat',
  categorization: 'Categorização de Transações',
  analysis: 'Análises Automáticas',
  recommendations: 'Recomendações'
};
