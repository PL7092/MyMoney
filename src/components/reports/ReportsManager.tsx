import React, { useState, useMemo } from 'react';
import { useFinance } from '../../contexts/FinanceContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { TrendingUp, TrendingDown, BarChart3, PieChart, Download, Calendar } from 'lucide-react';
import { toast } from '../ui/use-toast';
import { useDateFormat } from '../../hooks/useDateFormat';

export const ReportsManager: React.FC = () => {
  const { transactions, investments, accounts, categories } = useFinance();
  const [selectedPeriod, setSelectedPeriod] = useState('thisMonth');

  const getDateRangeForPeriod = (period: string) => {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    switch (period) {
      case 'thisMonth':
        start.setDate(1);
        end.setMonth(end.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        start.setMonth(start.getMonth() - 1, 1);
        end.setDate(0);
        break;
      case 'thisYear':
        start.setMonth(0, 1);
        end.setMonth(11, 31);
        break;
      case 'last3Months':
        start.setMonth(start.getMonth() - 3, 1);
        end.setDate(0);
        break;
      default:
        start.setDate(1);
        end.setMonth(end.getMonth() + 1, 0);
    }

    return { start, end };
  };

  const { start: startDate, end: endDate } = getDateRangeForPeriod(selectedPeriod);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  }, [transactions, startDate, endDate]);

  // Calculate summary
  const summary = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);

    const expenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);

    const balance = income - expenses;
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

    return { income, expenses, balance, savingsRate };
  }, [filteredTransactions]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const categoryTotals: { [key: string]: { income: number; expense: number } } = {};

    filteredTransactions.forEach(t => {
      const categoryName = categories.find(c => c.id === t.categoryId)?.name || 'Sem Categoria';
      
      if (!categoryTotals[categoryName]) {
        categoryTotals[categoryName] = { income: 0, expense: 0 };
      }

       if (t.type === 'income') {
         categoryTotals[categoryName].income += Number(t.amount ?? 0);
       } else if (t.type === 'expense') {
         categoryTotals[categoryName].expense += Number(t.amount ?? 0);
       }
    });

    return categoryTotals;
  }, [filteredTransactions, categories]);

  // Account balances
  const accountBalances = useMemo(() => {
    return accounts.map(account => {
      const accountTransactions = filteredTransactions.filter(t => 
        t.accountId === account.id
      );
      
      const movement = accountTransactions.reduce((sum, t) => {
        const amt = Number(t.amount ?? 0);
        return t.type === 'income' ? sum + amt : sum - amt;
      }, 0);

      return {
        ...account,
        movement,
        transactionCount: accountTransactions.length
      };
    });
  }, [filteredTransactions, accounts]);

  // Investment summary
  const investmentSummary = useMemo(() => {
    const totalInvested = investments.reduce((sum, inv) => sum + Number(inv.purchasePrice ?? 0), 0);
    const totalCurrent = investments.reduce((sum, inv) => sum + Number(inv.currentValue ?? 0), 0);
    const totalReturn = totalCurrent - totalInvested;

    return { totalInvested, totalCurrent, totalReturn };
  }, [investments]);

  const exportReport = () => {
    const csvData = [
      ['Período', `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`],
      [''],
      ['RESUMO'],
      ['Receitas', `€${summary.income.toFixed(2)}`],
      ['Despesas', `€${summary.expenses.toFixed(2)}`],
      ['Saldo', `€${summary.balance.toFixed(2)}`],
      ['Taxa de Poupança', `${summary.savingsRate.toFixed(2)}%`],
      [''],
      ['CATEGORIAS'],
      ['Categoria', 'Receitas', 'Despesas'],
      ...Object.entries(categoryBreakdown).map(([category, amounts]) => [
        category,
        `€${amounts.income.toFixed(2)}`,
        `€${amounts.expense.toFixed(2)}`
      ])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `relatorio-${selectedPeriod}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    toast({
      title: "Relatório Exportado",
      description: "O relatório foi exportado com sucesso.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground">Análise detalhada das suas finanças</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="thisMonth">Este Mês</SelectItem>
              <SelectItem value="lastMonth">Mês Passado</SelectItem>
              <SelectItem value="last3Months">Últimos 3 Meses</SelectItem>
              <SelectItem value="thisYear">Este Ano</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportReport} className="flex items-center gap-2">
            <Download size={16} />
            Exportar
          </Button>
        </div>
      </div>

      {/* Period Display */}
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Período: {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}</span>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Receitas</p>
              <p className="text-2xl font-bold text-green-600">€{summary.income.toFixed(2)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Despesas</p>
              <p className="text-2xl font-bold text-red-600">€{summary.expenses.toFixed(2)}</p>
            </div>
            <TrendingDown className="h-8 w-8 text-red-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Saldo</p>
              <p className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                €{summary.balance.toFixed(2)}
              </p>
            </div>
            <BarChart3 className="h-8 w-8" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Taxa Poupança</p>
              <p className={`text-2xl font-bold ${summary.savingsRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {summary.savingsRate.toFixed(1)}%
              </p>
            </div>
            <PieChart className="h-8 w-8" />
          </div>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Distribuição por Categoria</h3>
        <div className="space-y-4">
          {Object.entries(categoryBreakdown).map(([category, amounts]) => {
            const total = amounts.expense || amounts.income;
            const maxAmount = Math.max(...Object.values(categoryBreakdown).map(c => Math.max(c.income, c.expense)));
            const percentage = maxAmount > 0 ? (total / maxAmount) * 100 : 0;

            return (
              <div key={category} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{category}</span>
                  <div className="flex items-center gap-4 text-sm">
                    {amounts.income > 0 && (
                      <span className="text-green-600">+€{amounts.income.toFixed(2)}</span>
                    )}
                    {amounts.expense > 0 && (
                      <span className="text-red-600">-€{amounts.expense.toFixed(2)}</span>
                    )}
                  </div>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Account Performance and Investments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Performance das Contas</h3>
          <div className="space-y-4">
            {accountBalances.map((account) => (
              <div key={account.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <p className="font-medium">{account.name}</p>
                  <p className="text-sm text-muted-foreground">{account.transactionCount} transações</p>
                </div>
                <div className="text-right">
                  <p className={`font-medium ${account.movement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {account.movement >= 0 ? '+' : ''}€{account.movement.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">Saldo: €{Number((account as any).balance ?? 0).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Resumo de Investimentos</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Total Investido</span>
              <span className="font-medium">€{investmentSummary.totalInvested.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Valor Atual</span>
              <span className="font-medium">€{investmentSummary.totalCurrent.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Retorno</span>
              <span className={`font-medium ${investmentSummary.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {investmentSummary.totalReturn >= 0 ? '+' : ''}€{investmentSummary.totalReturn.toFixed(2)}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};