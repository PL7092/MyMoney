import React, { useState, useMemo } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Tag, ArrowUpRight, ArrowDownRight, ArrowRightLeft, Download, Calendar } from 'lucide-react';
import { useFinance } from '../../contexts/FinanceContext';
import { TransactionForm } from './TransactionForm';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { formatDatePT, getCurrentMonthRange } from '../../utils/dateUtils';
import { DatePicker } from '../ui/date-picker';
import { useDateFormat } from '../../hooks/useDateFormat';

export const TransactionManager: React.FC = () => {
  const { transactions, deleteTransaction, addTransaction, updateTransaction, categories, accounts, entities } = useFinance();
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const { formatDateForInput } = useDateFormat();
  const [filters, setFilters] = useState({
    search: '',
    type: 'all',
    category: 'all',
    entity: 'all',
    account: 'all',
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: ''
  });

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = filters.search === '' ||
        t.description.toLowerCase().includes(filters.search.toLowerCase()) ||
        (t.tags && t.tags.some(tag => tag.toLowerCase().includes(filters.search.toLowerCase())));

      const matchesType = filters.type === 'all' || t.type === filters.type;
      const matchesCategory = filters.category === 'all' || t.categoryId === filters.category;
      const matchesEntity = filters.entity === 'all' || t.entity === filters.entity;
      const matchesAccount = filters.account === 'all' || t.accountId === filters.account;

      const matchesDateFrom = filters.dateFrom === '' || new Date(t.date) >= new Date(filters.dateFrom);
      const matchesDateTo = filters.dateTo === '' || new Date(t.date) <= new Date(filters.dateTo);

      const matchesAmountMin = filters.amountMin === '' || t.amount >= parseFloat(filters.amountMin);
      const matchesAmountMax = filters.amountMax === '' || t.amount <= parseFloat(filters.amountMax);

      return matchesSearch && matchesType && matchesCategory && matchesEntity && 
             matchesAccount && matchesDateFrom && matchesDateTo && matchesAmountMin && matchesAmountMax;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filters]);

  const handleEdit = (transaction: any) => {
    setEditingTransaction(transaction);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem a certeza que deseja eliminar esta transação?')) {
      await deleteTransaction(id);
    }
  };

  const handleFormSave = async (transactionData: any) => {
    try {
      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, transactionData);
      } else {
        await addTransaction(transactionData);
      }
      handleFormClose();
    } catch (error) {
      console.error('Erro ao guardar transação:', error);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingTransaction(null);
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      type: '',
      category: '',
      entity: '',
      account: '',
      dateFrom: '',
      dateTo: '',
      amountMin: '',
      amountMax: ''
    });
  };

  const setThisMonth = () => {
    const { start, end } = getCurrentMonthRange();
    setFilters(prev => ({ ...prev, dateFrom: start, dateTo: end }));
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'income':
        return <ArrowUpRight className="h-4 w-4 text-green-600" />;
      case 'expense':
        return <ArrowDownRight className="h-4 w-4 text-red-600" />;
      case 'transfer':
        return <ArrowRightLeft className="h-4 w-4 text-blue-600" />;
      default:
        return <ArrowRightLeft className="h-4 w-4" />;
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'income':
        return 'Receita';
      case 'expense':
        return 'Despesa';
      case 'transfer':
        return 'Transferência';
      default:
        return type;
    }
  };

  const exportTransactions = () => {
    const csvContent = [
      ['Data', 'Tipo', 'Descrição', 'Categoria', 'Entidade', 'Conta', 'Valor', 'Tags'].join(','),
      ...filteredTransactions.map(t => [
        formatDatePT(t.date),
        getTransactionTypeLabel(t.type),
        t.description,
        categories.find(c => c.id === t.categoryId)?.name || 'N/A',
        t.entity || '',
        accounts.find(a => a.id === t.accountId)?.name || 'N/A',
        Number(t.amount ?? 0).toFixed(2),
        (t.tags || []).join('; ')
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transacoes_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Summary calculations
  const summary = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
    
    const expenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);

    return { income, expenses, balance: income - expenses };
  }, [filteredTransactions]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transações</h1>
          <p className="text-muted-foreground">Gerir todas as suas transações financeiras</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportTransactions}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Transação
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-card shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receitas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">€{summary.income.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">€{summary.expenses.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              €{summary.balance.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={setThisMonth}>
                <Calendar className="h-4 w-4 mr-2" />
                Este Mês
              </Button>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Limpar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Pesquisar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Descrição ou tags..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <Select
                value={filters.type}
                onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="income">Receitas</SelectItem>
                  <SelectItem value="expense">Despesas</SelectItem>
                  <SelectItem value="transfer">Transferências</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <Select
                value={filters.category}
                onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: category.color }}
                        />
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Account */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Conta</label>
              <Select
                value={filters.account}
                onValueChange={(value) => setFilters(prev => ({ ...prev, account: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as contas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as contas</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.name}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Inicial</label>
              <DatePicker
                date={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
                onSelect={(d) => setFilters(prev => ({ ...prev, dateFrom: d ? formatDateForInput(d) : '' }))}
              />
            </div>

            {/* Date To */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Final</label>
              <DatePicker
                date={filters.dateTo ? new Date(filters.dateTo) : undefined}
                onSelect={(d) => setFilters(prev => ({ ...prev, dateTo: d ? formatDateForInput(d) : '' }))}
              />
            </div>

            {/* Amount Min */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Valor Mínimo (€)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={filters.amountMin}
                onChange={(e) => setFilters(prev => ({ ...prev, amountMin: e.target.value }))}
              />
            </div>

            {/* Amount Max */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Valor Máximo (€)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={filters.amountMax}
                onChange={(e) => setFilters(prev => ({ ...prev, amountMax: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle>
            Transações ({filteredTransactions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma transação encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{formatDatePT(transaction.date)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTransactionIcon(transaction.type)}
                          {getTransactionTypeLabel(transaction.type)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>{transaction.description}</div>
                          {transaction.tags && transaction.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {transaction.tags.map((tag, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  <Tag className="h-3 w-3 mr-1" />
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{categories.find(c => c.id === transaction.categoryId)?.name || 'N/A'}</TableCell>
                      <TableCell>{accounts.find(a => a.id === transaction.accountId)?.name || 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <span className={
                          transaction.type === 'income' 
                            ? 'text-green-600' 
                            : transaction.type === 'expense' 
                            ? 'text-red-600' 
                            : 'text-foreground'
                        }>
                          €{Number(transaction.amount ?? 0).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(transaction)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(transaction.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Form Modal */}
      {showForm && (
        <TransactionForm
          transaction={editingTransaction}
          onClose={handleFormClose}
          onSave={handleFormSave}
        />
      )}
    </div>
  );
};