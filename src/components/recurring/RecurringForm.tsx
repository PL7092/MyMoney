import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useFinance } from '../../contexts/FinanceContext';
import { toast } from '../ui/use-toast';
import { useDateFormat } from '../../hooks/useDateFormat';
import { DatePicker } from '../ui/date-picker';

interface RecurringFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RecurringForm: React.FC<RecurringFormProps> = ({ open, onOpenChange }) => {
  const { addRecurringTransaction, categories, accounts } = useFinance();
  const { formatDateForInput } = useDateFormat();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: 0,
    description: '',
    type: 'expense' as const,
    frequency: 'monthly' as const,
    categoryId: '',
    accountId: '',
    startDate: formatDateForInput(new Date()),
    endDate: '',
    nextOccurrence: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.accountId || !formData.startDate) return;
    
    try {
      setIsLoading(true);
      await addRecurringTransaction({
        ...formData,
        occurrenceCount: 0,
        isActive: true,
      });
      toast({
        title: "Transação Recorrente Criada",
        description: "A transação recorrente foi criada com sucesso.",
      });
      onOpenChange(false);
      // Reset form
      setFormData({
        amount: 0,
        description: '',
        type: 'expense',
        frequency: 'monthly',
        categoryId: '',
        accountId: '',
        startDate: formatDateForInput(new Date()),
        endDate: '',
        nextOccurrence: '',
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao criar transação recorrente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Transação Recorrente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descrição da transação"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Valor</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <Label htmlFor="type">Tipo</Label>
              <Select value={formData.type} onValueChange={(value: any) => setFormData(prev => ({ ...prev, type: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="frequency">Frequência</Label>
            <Select value={formData.frequency} onValueChange={(value: any) => setFormData(prev => ({ ...prev, frequency: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Diário</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="biweekly">Quinzenal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="quarterly">Trimestral</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="categoryId">Categoria</Label>
            <Select value={formData.categoryId} onValueChange={(value) => setFormData(prev => ({ ...prev, categoryId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.filter(category => String(category.id || '').trim()).map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="accountId">Conta</Label>
            <Select value={formData.accountId} onValueChange={(value) => setFormData(prev => ({ ...prev, accountId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar conta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.filter(account => String(account.id || '').trim()).map((account) => (
                  <SelectItem key={account.id} value={String(account.id)}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Data de Início</Label>
              <DatePicker
                date={formData.startDate ? new Date(formData.startDate) : undefined}
                onSelect={(d) => setFormData(prev => ({ ...prev, startDate: d ? formatDateForInput(d) : '', nextOccurrence: d ? formatDateForInput(d) : '' }))}
              />
            </div>
            <div>
              <Label htmlFor="endDate">Data de Fim (opcional)</Label>
              <DatePicker
                date={formData.endDate ? new Date(formData.endDate) : undefined}
                onSelect={(d) => setFormData(prev => ({ ...prev, endDate: d ? formatDateForInput(d) : '' }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Criando...' : 'Criar Recorrente'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};