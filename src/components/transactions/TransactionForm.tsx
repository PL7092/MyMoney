import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { X, Plus, Tag } from 'lucide-react';
import { DatePicker } from '../ui/date-picker';
import { useFinance } from '../../contexts/FinanceContext';
import { useDateFormat } from '../../hooks/useDateFormat';
import type { Transaction } from '../../contexts/FinanceContext';

interface TransactionFormProps {
  transaction?: Transaction | null;
  onClose: () => void;
  onSave: (transaction: any) => void;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  transaction,
  onClose,
  onSave,
}) => {
  const { categories, accounts, entities, savingsGoals } = useFinance();
  const { formatDateForInput } = useDateFormat();
  const [formData, setFormData] = useState({
    type: 'expense' as 'income' | 'expense' | 'transfer',
    amount: '',
    description: '',
    category: '',
    entity: '',
    account: '',
    toAccount: '',
    date: formatDateForInput(new Date()),
    tags: [] as string[],
  });

  const [newTag, setNewTag] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (transaction) {
      setFormData({
        type: transaction.type,
        amount: transaction.amount.toString(),
        description: transaction.description,
        category: transaction.categoryId || '',
        entity: transaction.entity || '',
        account: transaction.accountId || '',
        toAccount: '',
        date: transaction.date,
        tags: transaction.tags || [],
      });
    }
  }, [transaction]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Valor deve ser maior que zero';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Descrição é obrigatória';
    }
    if (!formData.account) {
      newErrors.account = 'Conta é obrigatória';
    }
    if (formData.type !== 'transfer' && !formData.category) {
      newErrors.category = 'Categoria é obrigatória';
    }
    if (!formData.entity || formData.entity === 'none') {
      newErrors.entity = 'Entidade é obrigatória';
    }
    if (formData.type === 'transfer' && !formData.toAccount) {
      newErrors.toAccount = 'Conta de destino é obrigatória';
    }
    if (formData.type === 'transfer' && formData.account === formData.toAccount) {
      newErrors.toAccount = 'Conta de origem e destino devem ser diferentes';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const transactionData = {
      type: formData.type,
      amount: parseFloat(formData.amount),
      description: formData.description,
      categoryId: formData.type === 'transfer' ? undefined : (formData.category || undefined),
      entity: formData.entity,
      accountId: formData.account,
      date: formData.date,
      tags: formData.tags,
    };

    onSave(transactionData);
  };

  const filteredCategories = categories.filter(cat => 
    formData.type === 'transfer' ? true : !cat.type || cat.type === formData.type
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {transaction ? 'Editar Transação' : 'Nova Transação'}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tipo de Transação */}
            <div className="space-y-2">
              <Label>Tipo de Transação</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => handleInputChange('type', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="transfer">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Valor */}
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (€)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                className={errors.amount ? 'border-red-500' : ''}
              />
              {errors.amount && (
                <p className="text-sm text-red-500">{errors.amount}</p>
              )}
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                placeholder="Descrição da transação"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className={errors.description ? 'border-red-500' : ''}
              />
              {errors.description && (
                <p className="text-sm text-red-500">{errors.description}</p>
              )}
            </div>

            {/* Categoria (não para transferências) */}
            {formData.type !== 'transfer' && (
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => handleInputChange('category', value)}
                >
                  <SelectTrigger className={errors.category ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
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
                {errors.category && (
                  <p className="text-sm text-red-500">{errors.category}</p>
                )}
              </div>
            )}

            {/* Entidade */}
            <div className="space-y-2">
              <Label>Entidade</Label>
              <Select
                value={formData.entity}
                onValueChange={(value) => handleInputChange('entity', value)}
              >
                <SelectTrigger className={errors.entity ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Selecione uma entidade" />
                </SelectTrigger>
                <SelectContent>
                  {entities.map((entity) => (
                    <SelectItem key={entity.id} value={entity.name}>
                      {entity.name} ({entity.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.entity && (
                <p className="text-sm text-red-500">{errors.entity}</p>
              )}
            </div>

            {/* Conta de Origem */}
            <div className="space-y-2">
              <Label>Conta{formData.type === 'transfer' ? ' de Origem' : ''}</Label>
              <Select
                value={formData.account}
                onValueChange={(value) => handleInputChange('account', value)}
              >
                <SelectTrigger className={errors.account ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Selecione uma conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {account.name} (€{Number(account.balance ?? 0).toFixed(2)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.account && (
                <p className="text-sm text-red-500">{errors.account}</p>
              )}
            </div>

            {/* Conta de Destino (apenas para transferências) */}
            {formData.type === 'transfer' && (
              <div className="space-y-2">
                <Label>Conta de Destino</Label>
                <Select
                  value={formData.toAccount}
                  onValueChange={(value) => handleInputChange('toAccount', value)}
                >
                  <SelectTrigger className={errors.toAccount ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecione a conta de destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter(account => account.name !== formData.account)
                      .map((account) => (
                        <SelectItem key={account.id} value={String(account.id)}>
                          {account.name} (€{Number(account.balance ?? 0).toFixed(2)})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {errors.toAccount && (
                  <p className="text-sm text-red-500">{errors.toAccount}</p>
                )}
              </div>
            )}

            {/* Data */}
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <DatePicker
                date={formData.date ? new Date(formData.date) : undefined}
                onSelect={(d) => handleInputChange('date', d ? formatDateForInput(d) : '')}
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags (Opcional)</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Adicionar tag"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                />
                <Button type="button" variant="outline" onClick={handleAddTag}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="gap-1">
                      <Tag className="h-3 w-3" />
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Botões */}
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1">
                {transaction ? 'Actualizar' : 'Guardar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};