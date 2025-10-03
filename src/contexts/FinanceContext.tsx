import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Types
export interface Transaction {
  id: string;
  amount: number;
  description: string;
  type: 'income' | 'expense' | 'transfer';
  categoryId?: string;
  accountId: string;
  date: string;
  tags?: string[];
  notes?: string;
  receiptUrl?: string;
  location?: string;
  entity?: string;
  isReconciled?: boolean;
  // From database views
  category_name?: string;
  category_color?: string;
  account_name?: string;
}

export interface Budget {
  id: string;
  name: string;
  amount: number;
  spent: number;
  categoryId?: string;
  period: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: string;
  endDate: string;
  alertThreshold?: number;
  isActive: boolean;
  // From database views
  category_name?: string;
  category_color?: string;
}

export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment' | 'cash' | 'other';
  balance: number;
  currency: string;
  bankName?: string;
  accountNumber?: string;
  isActive: boolean;
  created_at: string;
}

export interface Investment {
  id: string;
  name: string;
  symbol?: string;
  type: 'stock' | 'bond' | 'mutual_fund' | 'etf' | 'crypto' | 'real_estate' | 'other';
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  marketValue: number;
  gainLoss: number;
  gainLossPercentage: number;
  purchaseDate?: string;
  accountId?: string;
  // Computed values
  currentValue?: number;
  totalCost?: number;
}

export interface RecurringTransaction {
  id: string;
  amount: number;
  description: string;
  type: 'income' | 'expense';
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  categoryId?: string;
  accountId: string;
  startDate: string;
  endDate?: string;
  nextOccurrence: string;
  lastProcessed?: string;
  occurrenceCount: number;
  isActive: boolean;
}

export interface Asset {
  id: string;
  name: string;
  type: 'property' | 'vehicle' | 'collectible' | 'other';
  purchasePrice?: number;
  currentValue?: number;
  purchaseDate?: string;
  description?: string;
  depreciationRate?: number;
  created_at: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  isCompleted: boolean;
  accountId?: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  type?: 'income' | 'expense';
  color: string;
  icon?: string;
  isActive: boolean;
  isSystem?: boolean;
}

export interface Entity {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

export interface AIRule {
  id: string;
  name: string;
  description: string;
  conditions: any[];
  actions: any[];
  isActive: boolean;
  created_at: string;
}

interface FinanceContextType {
  // Data
  transactions: Transaction[];
  budgets: Budget[];
  accounts: Account[];
  investments: Investment[];
  recurringTransactions: RecurringTransaction[];
  assets: Asset[];
  savingsGoals: SavingsGoal[];
  categories: Category[];
  entities: Entity[];
  aiRules: AIRule[];
  isLoading: boolean;

  // Transaction methods
  addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<Transaction>;
  updateTransaction: (id: string, transaction: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  
  // Budget methods
  addBudget: (budget: Omit<Budget, 'id'>) => Promise<Budget>;
  updateBudget: (id: string, budget: Partial<Budget>) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  
  // Account methods
  addAccount: (account: Omit<Account, 'id' | 'created_at'>) => Promise<Account>;
  updateAccount: (id: string, account: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  
  // Investment methods
  addInvestment: (investment: Omit<Investment, 'id'>) => Promise<Investment>;
  updateInvestment: (id: string, investment: Partial<Investment>) => Promise<void>;
  deleteInvestment: (id: string) => Promise<void>;
  
  // Recurring transaction methods
  addRecurringTransaction: (transaction: Omit<RecurringTransaction, 'id'>) => Promise<RecurringTransaction>;
  updateRecurringTransaction: (id: string, transaction: Partial<RecurringTransaction>) => Promise<void>;
  deleteRecurringTransaction: (id: string) => Promise<void>;
  
  // Asset methods
  addAsset: (asset: Omit<Asset, 'id' | 'created_at'>) => Promise<Asset>;
  updateAsset: (id: string, asset: Partial<Asset>) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  
  // Savings goal methods
  addSavingsGoal: (goal: Omit<SavingsGoal, 'id' | 'created_at'>) => Promise<SavingsGoal>;
  updateSavingsGoal: (id: string, goal: Partial<SavingsGoal>) => Promise<void>;
  deleteSavingsGoal: (id: string) => Promise<void>;
  
  // Category methods
  addCategory: (category: Omit<Category, 'id'>) => Promise<Category>;
  updateCategory: (id: string, category: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  
  addEntity: (entity: Omit<Entity, 'id'>) => Promise<void>;
  updateEntity: (id: string, entity: Partial<Entity>) => Promise<void>;
  deleteEntity: (id: string) => Promise<void>;
  
  addAIRule: (rule: Omit<AIRule, 'id' | 'created_at'>) => Promise<void>;
  updateAIRule: (id: string, rule: Partial<AIRule>) => Promise<void>;
  deleteAIRule: (id: string) => Promise<void>;
  
  refreshData: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (context === undefined) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};

interface FinanceProviderProps {
  children: ReactNode;
}

export const FinanceProvider: React.FC<FinanceProviderProps> = ({ children }) => {
  console.log("💰 FinanceProvider initializing");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [aiRules, setAIRules] = useState<AIRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // API Helper function for MariaDB calls
  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token');
    const base = (localStorage.getItem('api_base_url') || '').trim();
    // Use relative URLs in Docker/production, allow override for development
    const url = base ? `${base.replace(/\/$/, '')}/api${endpoint}` : `/api${endpoint}`;

    console.log('Making API call to:', url);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      });
      
      if (!response.ok) {
        console.error('API response not ok:', response.status, response.statusText);
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Expected JSON but got:', contentType, 'Response:', text.substring(0, 200));
        throw new Error('Expected JSON response but got HTML - backend may not be running');
      }
      
      return response.json();
    } catch (error) {
      console.error('API call error for', url, ':', error);
      throw error;
    }
  };

  // Load data functions
  const loadTransactions = async () => {
    try {
      const response = await apiCall('/transactions');
      if (response.success) {
        setTransactions(response.data.map((row: any) => ({
          id: String(row.id),
          amount: Number(row.amount ?? 0),
          description: String(row.description ?? ''),
          type: row.type,
          categoryId: row.category_id != null ? String(row.category_id) : undefined,
          accountId: String(row.account_id),
          date: String(row.date),
          tags: Array.isArray(row.tags) ? row.tags : [],
          entity: row.entity ? String(row.entity) : undefined,
          isReconciled: Boolean(row.is_reconciled),
          category_name: row.category_name ? String(row.category_name) : undefined,
          category_color: row.category_color ? String(row.category_color) : undefined,
          account_name: row.account_name ? String(row.account_name) : undefined,
        })));
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const loadAccounts = async () => {
    try {
      const response = await apiCall('/accounts');
        if (response.success) {
          setAccounts(response.data.map((row: any) => ({
            id: String(row.id),
            name: String(row.name),
            type: row.type,
            balance: Number(row.balance ?? 0),
            currency: String(row.currency || 'EUR'),
            bankName: row.bank_name ?? row.bankName,
            accountNumber: row.account_number ?? row.accountNumber,
            isActive: Boolean(row.is_active ?? row.isActive ?? true),
            created_at: String(row.created_at ?? new Date().toISOString()),
          })));
        }
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await apiCall('/categories');
        if (response.success) {
          setCategories(response.data.map((row: any) => ({
            id: String(row.id),
            name: String(row.name),
            type: row.type,
            color: String(row.color || '#999999'),
            icon: row.icon ?? undefined,
            isActive: Boolean(row.is_active ?? row.isActive ?? true),
            isSystem: Boolean(row.is_system ?? row.isSystem ?? false),
          })));
        }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadBudgets = async () => {
    try {
      const response = await apiCall('/budgets');
        if (response.success) {
          setBudgets(response.data.map((row: any) => ({
            id: String(row.id),
            name: String(row.name),
            amount: Number(row.amount ?? 0),
            spent: Number(row.spent ?? 0),
            categoryId: row.category_id != null ? String(row.category_id) : undefined,
            period: row.period,
            startDate: String(row.start_date ?? row.startDate),
            endDate: String(row.end_date ?? row.endDate),
            alertThreshold: row.alert_threshold != null ? Number(row.alert_threshold) : undefined,
            isActive: Boolean(row.is_active ?? row.isActive ?? true),
            category_name: row.category_name,
            category_color: row.category_color,
          })));
        }
    } catch (error) {
      console.error('Error loading budgets:', error);
    }
  };

  // Load all data from MariaDB on component mount
  useEffect(() => {
    console.log("💰 FinanceProvider useEffect - calling refreshData");
    refreshData();
  }, []);
  const loadInvestments = async () => {
    try {
      const response = await apiCall('/investments');
      if (response.success) {
        setInvestments(response.data.map((row: any) => ({
          id: String(row.id),
          name: String(row.name),
          symbol: row.symbol ? String(row.symbol) : undefined,
          type: row.type,
          quantity: Number(row.quantity ?? 0),
          purchasePrice: Number(row.purchase_price ?? 0),
          currentPrice: Number(row.current_price ?? row.purchase_price ?? 0),
          marketValue: Number(row.market_value ?? 0),
          gainLoss: Number(row.gain_loss ?? 0),
          gainLossPercentage: Number(row.gain_loss_percentage ?? 0),
          purchaseDate: row.purchase_date,
          accountId: row.account_id != null ? String(row.account_id) : undefined,
          currentValue: Number(row.current_price ?? 0) * Number(row.quantity ?? 0),
          totalCost: Number(row.purchase_price ?? 0) * Number(row.quantity ?? 0),
        })));
      }
    } catch (error) {
      console.error('Error loading investments:', error);
    }
  };

  const loadRecurringTransactions = async () => {
    try {
      const response = await apiCall('/recurring-transactions');
      if (response.success) {
        setRecurringTransactions(response.data.map((row: any) => ({
          id: row.id,
          amount: row.amount,
          description: row.description,
          type: row.type,
          frequency: row.frequency,
          categoryId: row.category_id ?? undefined,
          accountId: row.account_id,
          startDate: row.start_date,
          endDate: row.end_date,
          nextOccurrence: row.next_occurrence,
          lastProcessed: row.last_processed,
          occurrenceCount: row.occurrence_count,
          isActive: row.is_active,
        })));
      }
    } catch (error) {
      console.error('Error loading recurring transactions:', error);
    }
  };

  const loadAssets = async () => {
    try {
      const response = await apiCall('/assets');
      if (response.success) {
        setAssets(response.data.map((row: any) => ({
          id: row.id,
          name: row.name,
          type: row.type,
          purchasePrice: row.purchase_price,
          currentValue: row.current_value,
          purchaseDate: row.purchase_date,
          description: row.description,
          depreciationRate: row.depreciation_rate,
          created_at: row.created_at,
        })));
      }
    } catch (error) {
      console.error('Error loading assets:', error);
    }
  };

  const loadSavingsGoals = async () => {
    try {
      const response = await apiCall('/savings-goals');
      if (response.success) {
        setSavingsGoals(response.data.map((row: any) => ({
          id: row.id,
          name: row.name,
          targetAmount: row.target_amount,
          currentAmount: row.current_amount,
          targetDate: row.target_date,
          description: row.description,
          priority: row.priority,
          isCompleted: row.is_completed,
          accountId: row.account_id ?? undefined,
          created_at: row.created_at,
        })));
      }
    } catch (error) {
      console.error('Error loading savings goals:', error);
    }
  };

  const loadEntities = async () => {
    try {
      const response = await apiCall('/entities');
      if (response.success) {
        setEntities(response.data.map((row: any) => ({
          id: row.id,
          name: row.name,
          type: row.type,
          isActive: row.is_active
        })));
      }
    } catch (error) {
      console.error('Error loading entities:', error);
    }
  };

  const loadAIRules = async () => {
    try {
      const response = await apiCall('/ai-rules');
      if (response.success) {
        setAIRules(response.data.map((row: any) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          conditions: JSON.parse(row.conditions || '[]'),
          actions: JSON.parse(row.actions || '[]'),
          isActive: row.is_active,
          created_at: row.created_at
        })));
      }
    } catch (error) {
      console.error('Error loading AI rules:', error);
    }
  };

  // Add Transaction - Now uses MariaDB
  const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
    try {
      setIsLoading(true);
      const payload = {
        amount: transaction.amount,
        description: transaction.description,
        type: transaction.type,
        category_id: transaction.categoryId ?? null,
        account_id: transaction.accountId,
        date: transaction.date,
      };

      const response = await apiCall('/transactions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      if (response.success) {
        const row = response.data;
        const mapped = {
          id: String(row.id),
          amount: Number(row.amount ?? 0),
          description: String(row.description ?? ''),
          type: row.type,
          categoryId: row.category_id != null ? String(row.category_id) : undefined,
          accountId: String(row.account_id),
          date: String(row.date),
          tags: Array.isArray(row.tags) ? row.tags : [],
          entity: row.entity ? String(row.entity) : undefined,
          isReconciled: Boolean(row.is_reconciled),
          category_name: row.category_name ? String(row.category_name) : undefined,
          category_color: row.category_color ? String(row.category_color) : undefined,
          account_name: row.account_name ? String(row.account_name) : undefined,
        } as Transaction;
        setTransactions(prev => [mapped, ...prev]);
        // Refresh accounts to update balances
        await loadAccounts();
        return mapped;
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Update Transaction - Now uses MariaDB
  const updateTransaction = async (id: string, transaction: Partial<Transaction>) => {
    try {
      setIsLoading(true);
      const payload = {
        amount: transaction.amount!,
        description: transaction.description!,
        type: transaction.type!,
        category_id: transaction.categoryId ?? null,
        account_id: transaction.accountId!,
        date: transaction.date!,
      };
      const response = await apiCall(`/transactions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      
      if (response.success) {
        const row = response.data;
        const mapped = {
          id: String(row.id),
          amount: Number(row.amount ?? 0),
          description: String(row.description ?? ''),
          type: row.type,
          categoryId: row.category_id != null ? String(row.category_id) : undefined,
          accountId: String(row.account_id),
          date: String(row.date),
          tags: Array.isArray(row.tags) ? row.tags : [],
          entity: row.entity ? String(row.entity) : undefined,
          isReconciled: Boolean(row.is_reconciled),
          category_name: row.category_name ? String(row.category_name) : undefined,
          category_color: row.category_color ? String(row.category_color) : undefined,
          account_name: row.account_name ? String(row.account_name) : undefined,
        } as Transaction;
        setTransactions(prev => prev.map(t => t.id === id ? mapped : t));
        // Refresh accounts to update balances
        await loadAccounts();
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete Transaction - Now uses MariaDB
  const deleteTransaction = async (id: string) => {
    try {
      setIsLoading(true);
      const response = await apiCall(`/transactions/${id}`, {
        method: 'DELETE',
      });
      
      if (response.success) {
        setTransactions(prev => prev.filter(t => t.id !== id));
        // Refresh accounts to update balances
        await loadAccounts();
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Add Account - Now uses MariaDB
  const addAccount = async (account: Omit<Account, 'id' | 'created_at'>) => {
    try {
      setIsLoading(true);
      const response = await apiCall('/accounts', {
        method: 'POST',
        body: JSON.stringify(account),
      });
      
        if (response.success) {
          const row = response.data;
          const mapped: Account = {
            id: String(row.id),
            name: String(row.name),
            type: row.type,
            balance: Number(row.balance ?? 0),
            currency: String(row.currency || 'EUR'),
            bankName: row.bank_name ?? row.bankName,
            accountNumber: row.account_number ?? row.accountNumber,
            isActive: Boolean(row.is_active ?? row.isActive ?? true),
            created_at: String(row.created_at ?? new Date().toISOString()),
          };
          setAccounts(prev => [...prev, mapped]);
          return mapped;
        }
    } catch (error) {
      console.error('Error adding account:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Update Account - Now uses MariaDB
  const updateAccount = async (id: string, account: Partial<Account>) => {
    try {
      setIsLoading(true);
      const response = await apiCall(`/accounts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(account),
      });
      
        if (response.success) {
          const row = response.data;
          const mapped: Account = {
            id: String(row.id),
            name: String(row.name),
            type: row.type,
            balance: Number(row.balance ?? 0),
            currency: String(row.currency || 'EUR'),
            bankName: row.bank_name ?? row.bankName,
            accountNumber: row.account_number ?? row.accountNumber,
            isActive: Boolean(row.is_active ?? row.isActive ?? true),
            created_at: String(row.created_at ?? new Date().toISOString()),
          };
          setAccounts(prev => prev.map(a => a.id === id ? mapped : a));
        }
    } catch (error) {
      console.error('Error updating account:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete Account - Now uses MariaDB
  const deleteAccount = async (id: string) => {
    try {
      setIsLoading(true);
      const response = await apiCall(`/accounts/${id}`, {
        method: 'DELETE',
      });
      
      if (response.success) {
        setAccounts(prev => prev.filter(a => a.id !== id));
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Add Category - Now uses MariaDB
  const addCategory = async (category: Omit<Category, 'id'>) => {
    try {
      setIsLoading(true);
      const response = await apiCall('/categories', {
        method: 'POST',
        body: JSON.stringify(category),
      });
      
      if (response.success) {
        setCategories(prev => [...prev, response.data]);
        return response.data;
      }
    } catch (error) {
      console.error('Error adding category:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Update Category - Now uses MariaDB
  const updateCategory = async (id: string, category: Partial<Category>) => {
    try {
      setIsLoading(true);
      const response = await apiCall(`/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(category),
      });
      
      if (response.success) {
        setCategories(prev => prev.map(c => c.id === id ? response.data : c));
      }
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete Category - Now uses MariaDB
  const deleteCategory = async (id: string) => {
    try {
      setIsLoading(true);
      const response = await apiCall(`/categories/${id}`, {
        method: 'DELETE',
      });
      
      if (response.success) {
        setCategories(prev => prev.filter(c => c.id !== id));
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Add Budget - Now uses MariaDB
  const addBudget = async (budget: Omit<Budget, 'id'>) => {
    try {
      setIsLoading(true);
      const response = await apiCall('/budgets', {
        method: 'POST',
        body: JSON.stringify(budget),
      });
      
      if (response.success) {
        setBudgets(prev => [...prev, response.data]);
        return response.data;
      }
    } catch (error) {
      console.error('Error adding budget:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Update Budget - Now uses MariaDB
  const updateBudget = async (id: string, budget: Partial<Budget>) => {
    try {
      setIsLoading(true);
      const response = await apiCall(`/budgets/${id}`, {
        method: 'PUT',
        body: JSON.stringify(budget),
      });
      
      if (response.success) {
        setBudgets(prev => prev.map(b => b.id === id ? response.data : b));
      }
    } catch (error) {
      console.error('Error updating budget:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete Budget - Now uses MariaDB
  const deleteBudget = async (id: string) => {
    try {
      setIsLoading(true);
      const response = await apiCall(`/budgets/${id}`, {
        method: 'DELETE',
      });
      
      if (response.success) {
        setBudgets(prev => prev.filter(b => b.id !== id));
      }
    } catch (error) {
      console.error('Error deleting budget:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Investment methods - Now uses MariaDB
  const addInvestment = async (investment: Omit<Investment, 'id'>) => {
    try {
      setIsLoading(true);
      const payload = {
        name: investment.name,
        symbol: investment.symbol,
        type: investment.type,
        quantity: investment.quantity,
        purchase_price: investment.purchasePrice,
        current_price: investment.currentPrice ?? investment.purchasePrice,
        purchase_date: (investment as any).purchaseDate || (investment as any).purchase_date,
        account_id: (investment as any).accountId ?? (investment as any).account_id ?? null,
      };
      const response = await apiCall('/investments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      if (response.success) {
        setInvestments(prev => [...prev, response.data]);
        return response.data;
      }
    } catch (error) {
      console.error('Error adding investment:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateInvestment = async (id: string, investment: Partial<Investment>) => {
    try {
      setIsLoading(true);
      const payload: any = {};
      if (investment.name !== undefined) payload.name = investment.name;
      if (investment.symbol !== undefined) payload.symbol = investment.symbol;
      if (investment.type !== undefined) payload.type = investment.type as any;
      if (investment.quantity !== undefined) payload.quantity = investment.quantity as any;
      if ((investment as any).purchasePrice !== undefined) payload.purchase_price = (investment as any).purchasePrice;
      if ((investment as any).currentPrice !== undefined) payload.current_price = (investment as any).currentPrice;
      if ((investment as any).purchaseDate !== undefined) payload.purchase_date = (investment as any).purchaseDate;
      if ((investment as any).accountId !== undefined) payload.account_id = (investment as any).accountId;
      const response = await apiCall(`/investments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      
      if (response.success) {
        setInvestments(prev => prev.map(i => i.id === id ? response.data : i));
      }
    } catch (error) {
      console.error('Error updating investment:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteInvestment = async (id: string) => {
    try {
      setIsLoading(true);
      const response = await apiCall(`/investments/${id}`, {
        method: 'DELETE',
      });
      
      if (response.success) {
        setInvestments(prev => prev.filter(i => i.id !== id));
      }
    } catch (error) {
      console.error('Error deleting investment:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Recurring transaction methods - Now uses MariaDB
  const addRecurringTransaction = async (transaction: Omit<RecurringTransaction, 'id'>) => {
    try {
      setIsLoading(true);
      const payload = {
        amount: transaction.amount,
        description: transaction.description,
        type: transaction.type,
        frequency: transaction.frequency,
        category_id: transaction.categoryId ?? null,
        account_id: transaction.accountId,
        start_date: transaction.startDate,
        end_date: (transaction as any).endDate ?? null,
        next_occurrence: (transaction as any).nextOccurrence ?? transaction.startDate,
      };
      const response = await apiCall('/recurring-transactions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      if (response.success) {
        setRecurringTransactions(prev => [...prev, response.data]);
        return response.data;
      }
    } catch (error) {
      console.error('Error adding recurring transaction:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateRecurringTransaction = async (id: string, transaction: Partial<RecurringTransaction>) => {
    try {
      setIsLoading(true);
      const payload: any = {};
      if (transaction.amount !== undefined) payload.amount = transaction.amount;
      if (transaction.description !== undefined) payload.description = transaction.description;
      if (transaction.type !== undefined) payload.type = transaction.type;
      if (transaction.frequency !== undefined) payload.frequency = transaction.frequency;
      if ((transaction as any).categoryId !== undefined) payload.category_id = (transaction as any).categoryId;
      if ((transaction as any).accountId !== undefined) payload.account_id = (transaction as any).accountId;
      if ((transaction as any).startDate !== undefined) payload.start_date = (transaction as any).startDate;
      if ((transaction as any).endDate !== undefined) payload.end_date = (transaction as any).endDate;
      if ((transaction as any).nextOccurrence !== undefined) payload.next_occurrence = (transaction as any).nextOccurrence;
      if ((transaction as any).isActive !== undefined) payload.is_active = (transaction as any).isActive;
      const response = await apiCall(`/recurring-transactions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      
      if (response.success) {
        setRecurringTransactions(prev => prev.map(r => r.id === id ? response.data : r));
      }
    } catch (error) {
      console.error('Error updating recurring transaction:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteRecurringTransaction = async (id: string) => {
    try {
      setIsLoading(true);
      const response = await apiCall(`/recurring-transactions/${id}`, {
        method: 'DELETE',
      });
      
      if (response.success) {
        setRecurringTransactions(prev => prev.filter(r => r.id !== id));
      }
    } catch (error) {
      console.error('Error deleting recurring transaction:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Asset methods - Now uses MariaDB
  const addAsset = async (asset: Omit<Asset, 'id' | 'created_at'>) => {
    try {
      setIsLoading(true);
      const payload = {
        name: asset.name,
        type: asset.type,
        purchase_price: asset.purchasePrice,
        current_value: asset.currentValue ?? asset.purchasePrice,
        purchase_date: asset.purchaseDate,
        description: asset.description,
        depreciation_rate: asset.depreciationRate ?? 0,
      };
      const response = await apiCall('/assets', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      if (response.success) {
        setAssets(prev => [...prev, response.data]);
        return response.data;
      }
    } catch (error) {
      console.error('Error adding asset:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateAsset = async (id: string, asset: Partial<Asset>) => {
    try {
      setIsLoading(true);
      const payload: any = {};
      if (asset.name !== undefined) payload.name = asset.name;
      if (asset.type !== undefined) payload.type = asset.type as any;
      if ((asset as any).purchasePrice !== undefined) payload.purchase_price = (asset as any).purchasePrice;
      if ((asset as any).currentValue !== undefined) payload.current_value = (asset as any).currentValue;
      if ((asset as any).purchaseDate !== undefined) payload.purchase_date = (asset as any).purchaseDate;
      if (asset.description !== undefined) payload.description = asset.description as any;
      if ((asset as any).depreciationRate !== undefined) payload.depreciation_rate = (asset as any).depreciationRate;
      const response = await apiCall(`/assets/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      
      if (response.success) {
        setAssets(prev => prev.map(a => a.id === id ? response.data : a));
      }
    } catch (error) {
      console.error('Error updating asset:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAsset = async (id: string) => {
    try {
      setIsLoading(true);
      const response = await apiCall(`/assets/${id}`, {
        method: 'DELETE',
      });
      
      if (response.success) {
        setAssets(prev => prev.filter(a => a.id !== id));
      }
    } catch (error) {
      console.error('Error deleting asset:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Savings goal methods - Now uses MariaDB
  const addSavingsGoal = async (goal: Omit<SavingsGoal, 'id' | 'created_at'>) => {
    try {
      setIsLoading(true);
      const payload = {
        name: goal.name,
        target_amount: goal.targetAmount,
        current_amount: goal.currentAmount ?? 0,
        target_date: goal.targetDate,
        description: goal.description,
        priority: goal.priority,
        account_id: goal.accountId ?? null,
      };
      const response = await apiCall('/savings-goals', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      if (response.success) {
        setSavingsGoals(prev => [...prev, response.data]);
        return response.data;
      }
    } catch (error) {
      console.error('Error adding savings goal:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateSavingsGoal = async (id: string, goal: Partial<SavingsGoal>) => {
    try {
      setIsLoading(true);
      const payload: any = {};
      if (goal.name !== undefined) payload.name = goal.name;
      if ((goal as any).targetAmount !== undefined) payload.target_amount = (goal as any).targetAmount;
      if ((goal as any).currentAmount !== undefined) payload.current_amount = (goal as any).currentAmount;
      if ((goal as any).targetDate !== undefined) payload.target_date = (goal as any).targetDate;
      if (goal.description !== undefined) payload.description = goal.description as any;
      if (goal.priority !== undefined) payload.priority = goal.priority as any;
      if ((goal as any).accountId !== undefined) payload.account_id = (goal as any).accountId;
      if ((goal as any).isCompleted !== undefined) payload.is_completed = (goal as any).isCompleted;
      const response = await apiCall(`/savings-goals/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      
      if (response.success) {
        setSavingsGoals(prev => prev.map(g => g.id === id ? response.data : g));
      }
    } catch (error) {
      console.error('Error updating savings goal:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSavingsGoal = async (id: string) => {
    try {
      setIsLoading(true);
      const response = await apiCall(`/savings-goals/${id}`, {
        method: 'DELETE',
      });
      
      if (response.success) {
        setSavingsGoals(prev => prev.filter(g => g.id !== id));
      }
    } catch (error) {
      console.error('Error deleting savings goal:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Entity methods (keeping mock for now)
  const addEntity = async (entity: Omit<Entity, 'id'>) => {
    try {
      const newEntity: Entity = {
        ...entity,
        id: Date.now().toString(),
      };
      setEntities(prev => [...prev, newEntity]);
    } catch (error) {
      console.error('Error adding entity:', error);
      throw error;
    }
  };

  const updateEntity = async (id: string, entity: Partial<Entity>) => {
    try {
      setEntities(prev => prev.map(e => e.id === id ? { ...e, ...entity } : e));
    } catch (error) {
      console.error('Error updating entity:', error);
      throw error;
    }
  };

  const deleteEntity = async (id: string) => {
    try {
      setEntities(prev => prev.filter(e => e.id !== id));
    } catch (error) {
      console.error('Error deleting entity:', error);
      throw error;
    }
  };

  // AI Rules methods (keeping mock for now)
  const addAIRule = async (rule: Omit<AIRule, 'id' | 'created_at'>) => {
    try {
      const newRule: AIRule = {
        ...rule,
        id: Date.now().toString(),
        created_at: new Date().toISOString(),
      };
      setAIRules(prev => [...prev, newRule]);
    } catch (error) {
      console.error('Error adding AI rule:', error);
      throw error;
    }
  };

  const updateAIRule = async (id: string, rule: Partial<AIRule>) => {
    try {
      setAIRules(prev => prev.map(r => r.id === id ? { ...r, ...rule } : r));
    } catch (error) {
      console.error('Error updating AI rule:', error);
      throw error;
    }
  };

  const deleteAIRule = async (id: string) => {
    try {
      setAIRules(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error deleting AI rule:', error);
      throw error;
    }
  };

  const refreshData = async () => {
    console.log("💰 refreshData started");
    setIsLoading(true);
    
    try {
      console.log("💰 Loading all data from MariaDB");
      // Load all data from MariaDB
      await Promise.all([
        loadTransactions(),
        loadBudgets(),
        loadAccounts(),
        loadCategories(),
        loadInvestments(),
        loadRecurringTransactions(),
        loadAssets(),
        loadSavingsGoals(),
        loadEntities(),
        loadAIRules(),
      ]);
      console.log('✅ Data refreshed from MariaDB successfully');
    } catch (error) {
      console.error('❌ Error refreshing data from backend:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    // Data
    transactions,
    budgets,
    accounts,
    investments,
    recurringTransactions,
    assets,
    savingsGoals,
    categories,
    entities,
    aiRules,
    isLoading,

    // Methods
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addBudget,
    updateBudget,
    deleteBudget,
    addAccount,
    updateAccount,
    deleteAccount,
    addInvestment,
    updateInvestment,
    deleteInvestment,
    addRecurringTransaction,
    updateRecurringTransaction,
    deleteRecurringTransaction,
    addAsset,
    updateAsset,
    deleteAsset,
    addSavingsGoal,
    updateSavingsGoal,
    deleteSavingsGoal,
    addCategory,
    updateCategory,
    deleteCategory,
    addEntity,
    updateEntity,
    deleteEntity,
    addAIRule,
    updateAIRule,
    deleteAIRule,
    refreshData,
  };

  return (
    <FinanceContext.Provider value={value}>
      {children}
    </FinanceContext.Provider>
  );
};
