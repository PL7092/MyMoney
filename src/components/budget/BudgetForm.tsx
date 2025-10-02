import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useFinance } from '../../contexts/FinanceContext';
import type { Budget } from '../../contexts/FinanceContext';
import { DatePicker } from '../ui/date-picker';

interface BudgetFormProps {
  budget?: Budget;
  onClose: () => void;
}

export function BudgetForm({ budget, onClose }: BudgetFormProps) {
  const { addBudget, updateBudget, categories } = useFinance();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    categoryId: 'all',
    amount: '',
    period: 'monthly' as 'weekly' | 'monthly' | 'quarterly' | 'yearly',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    if (budget) {
      setFormData({
        name: budget.name,
        categoryId: budget.categoryId || 'all',
        amount: budget.amount.toString(),
        period: budget.period,
        startDate: budget.startDate,
        endDate: budget.endDate,
      });
    } else {
      // Set default dates for new budget
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      
      setFormData(prev => ({
        ...prev,
        startDate: startOfMonth,
        endDate: endOfMonth,
      }));
    }
  }, [budget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.amount || !formData.startDate || !formData.endDate) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Erro",
        description: "O valor deve ser um número positivo",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const budgetData = {
        name: formData.name,
        categoryId: formData.categoryId === 'all' ? undefined : formData.categoryId,
        amount,
        spent: 0,
        period: formData.period,
        startDate: formData.startDate,
        endDate: formData.endDate,
        isActive: true,
      };

      if (budget) {
        await updateBudget(budget.id, budgetData);
        toast({
          title: "Orçamento atualizado",
          description: "O orçamento foi atualizado com sucesso",
        });
      } else {
        await addBudget(budgetData);
        toast({
          title: "Orçamento criado",
          description: "O novo orçamento foi criado com sucesso",
        });
      }
      
      onClose();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar o orçamento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{budget ? 'Editar' : 'Novo'} Orçamento</CardTitle>
        <CardDescription>
          {budget ? 'Atualize os dados do orçamento' : 'Crie um novo orçamento para controlar seus gastos'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Orçamento *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: Alimentação Dezembro"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Select
              value={formData.categoryId}
              onValueChange={(value) => setFormData(prev => ({ ...prev, categoryId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.filter(c => c.type === 'expense' && String(c.id || '').trim()).map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor Limite (€) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="period">Período</Label>
            <Select
              value={formData.period}
              onValueChange={(value: 'weekly' | 'monthly' | 'quarterly' | 'yearly') => setFormData(prev => ({ ...prev, period: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="quarterly">Trimestral</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Data de Início *</Label>
              <DatePicker
                date={formData.startDate ? new Date(formData.startDate) : undefined}
                onSelect={(d) => setFormData(prev => ({ ...prev, startDate: d ? d.toISOString().split('T')[0] : '' }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Data de Fim *</Label>
              <DatePicker
                date={formData.endDate ? new Date(formData.endDate) : undefined}
                onSelect={(d) => setFormData(prev => ({ ...prev, endDate: d ? d.toISOString().split('T')[0] : '' }))}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : budget ? 'Atualizar' : 'Criar'} Orçamento
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}