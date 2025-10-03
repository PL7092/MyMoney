import { StatCard } from "@/components/dashboard/StatCard";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { BudgetOverview } from "@/components/dashboard/BudgetOverview";
import { InvestmentSummary } from "@/components/dashboard/InvestmentSummary";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { BackendStatus } from "@/components/debug/BackendStatus";
import { ConnectionStatus } from "@/components/debug/ConnectionStatus";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/contexts/FinanceContext";
import { 
  Wallet, 
  TrendingUp, 
  Target, 
  PiggyBank,
  Bell,
  Search,
  Calendar,
  Filter
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";


const Index = () => {
  console.log("📊 Index (Dashboard) component rendering");
  const location = useLocation();
  const { accounts, transactions } = useFinance();
  console.log("📊 Dashboard data:", { accountsCount: accounts.length, transactionsCount: transactions.length });

  // Calculate real statistics from data
  const stats = useMemo(() => {
    // Total balance from all accounts
    const totalBalance = accounts.reduce((sum, account) => sum + Number(account.balance ?? 0), 0);

    // Current month's transactions
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const currentMonthTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate.getMonth() === currentMonth && 
             transactionDate.getFullYear() === currentYear;
    });

    // Previous month's transactions for comparison
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    
    const prevMonthTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate.getMonth() === prevMonth && 
             transactionDate.getFullYear() === prevMonthYear;
    });

    // Calculate income and expenses for current month
    const currentIncome = currentMonthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
    
    const currentExpenses = currentMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);

    // Calculate previous month for comparison
    const prevIncome = prevMonthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
    
    const prevExpenses = prevMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);

    // Calculate percentage changes
    const incomeChange = prevIncome > 0 ? ((currentIncome - prevIncome) / prevIncome * 100) : 0;
    const expenseChange = prevExpenses > 0 ? ((currentExpenses - prevExpenses) / prevExpenses * 100) : 0;
    
    // Savings = Income - Expenses this month
    const currentSavings = currentIncome - currentExpenses;
    const prevSavings = prevIncome - prevExpenses;
    const savingsChange = currentSavings - prevSavings;

    return {
      totalBalance,
      currentIncome,
      currentExpenses,
      currentSavings,
      savingsChange,
      incomeChange,
      expenseChange
    };
  }, [accounts, transactions]);

  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash]);

  return (
    <div id="topo" className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral das suas finanças</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Search className="h-4 w-4 mr-2" />
            Pesquisar
          </Button>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filtrar
          </Button>
          <Button variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            Este Mês
          </Button>
          <Button variant="outline" size="sm">
            <Bell className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Backend Connection Status */}
      <BackendStatus />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div id="contas">
          <StatCard
            title="Saldo Total"
            value={`€${stats.totalBalance.toFixed(2)}`}
            change={`${accounts.length} contas ativas`}
            changeType="neutral"
            icon={Wallet}
          />
        </div>
        <div id="receitas">
          <StatCard
            title="Receitas"
            value={`€${stats.currentIncome.toFixed(2)}`}
            change={`${stats.incomeChange >= 0 ? '+' : ''}${stats.incomeChange.toFixed(1)}% vs mês anterior`}
            changeType={stats.incomeChange >= 0 ? "positive" : "negative"}
            icon={TrendingUp}
          />
        </div>
        <div id="despesas">
          <StatCard
            title="Despesas"
            value={`€${stats.currentExpenses.toFixed(2)}`}
            change={`${stats.expenseChange >= 0 ? '+' : ''}${stats.expenseChange.toFixed(1)}% vs mês anterior`}
            changeType={stats.expenseChange <= 0 ? "positive" : "negative"}
            icon={Target}
          />
        </div>
        <div id="poupancas">
          <StatCard
            title="Poupanças"
            value={`€${stats.currentSavings.toFixed(2)}`}
            change={`${stats.savingsChange >= 0 ? '+' : ''}€${Math.abs(stats.savingsChange).toFixed(2)} este mês`}
            changeType={stats.savingsChange >= 0 ? "positive" : "negative"}
            icon={PiggyBank}
          />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - 2 sections */}
        <div className="lg:col-span-2 space-y-6">
          <section id="transacoes">
            <RecentTransactions />
          </section>
          <section id="investimentos">
            <InvestmentSummary />
          </section>
        </div>
        
        {/* Right Column - 3 sections */}
        <div className="space-y-6">
          <section id="acoes-rapidas">
            <QuickActions />
          </section>
          <section id="orcamentos">
            <BudgetOverview />
          </section>
          <section id="status-conexao">
            <ConnectionStatus />
          </section>
        </div>
      </div>
    </div>
  );
};

export default Index;
