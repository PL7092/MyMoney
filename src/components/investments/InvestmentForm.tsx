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

interface InvestmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const InvestmentForm: React.FC<InvestmentFormProps> = ({ open, onOpenChange }) => {
  const { addInvestment, accounts } = useFinance();
  const { formatDateForInput } = useDateFormat();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    type: 'stock' as const,
    quantity: 0,
    purchasePrice: 0,
    currentPrice: 0,
    purchaseDate: formatDateForInput(new Date()),
    accountId: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    
    try {
      setIsLoading(true);
      await addInvestment({
        ...formData,
        marketValue: formData.currentPrice * formData.quantity,
        gainLoss: (formData.currentPrice - formData.purchasePrice) * formData.quantity,
        gainLossPercentage: formData.purchasePrice > 0 
          ? ((formData.currentPrice - formData.purchasePrice) / formData.purchasePrice) * 100 
          : 0,
      });
      toast({
        title: "Investimento Criado",
        description: "O investimento foi adicionado com sucesso.",
      });
      onOpenChange(false);
      // Reset form
      setFormData({
        name: '',
        symbol: '',
        type: 'stock',
        quantity: 0,
        purchasePrice: 0,
        currentPrice: 0,
        purchaseDate: formatDateForInput(new Date()),
        accountId: '',
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao criar investimento.",
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
          <DialogTitle>Novo Investimento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Nome do investimento"
              required
            />
          </div>

          <div>
            <Label htmlFor="symbol">Símbolo (opcional)</Label>
            <Input
              id="symbol"
              value={formData.symbol}
              onChange={(e) => setFormData(prev => ({ ...prev, symbol: e.target.value }))}
              placeholder="AAPL, TSLA, etc."
            />
          </div>

          <div>
            <Label htmlFor="type">Tipo</Label>
            <Select value={formData.type} onValueChange={(value: any) => setFormData(prev => ({ ...prev, type: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stock">Ação</SelectItem>
                <SelectItem value="bond">Obrigação</SelectItem>
                <SelectItem value="mutual_fund">Fundo Mútuo</SelectItem>
                <SelectItem value="etf">ETF</SelectItem>
                <SelectItem value="crypto">Criptomoeda</SelectItem>
                <SelectItem value="real_estate">Imobiliário</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity">Quantidade</Label>
              <Input
                id="quantity"
                type="number"
                step="0.000001"
                value={formData.quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="purchasePrice">Preço de Compra</Label>
              <Input
                id="purchasePrice"
                type="number"
                step="0.01"
                value={formData.purchasePrice}
                onChange={(e) => setFormData(prev => ({ ...prev, purchasePrice: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="currentPrice">Preço Atual</Label>
            <Input
              id="currentPrice"
              type="number"
              step="0.01"
              value={formData.currentPrice}
              onChange={(e) => setFormData(prev => ({ ...prev, currentPrice: parseFloat(e.target.value) || 0 }))}
              placeholder="0.00"
            />
          </div>

          <div>
            <Label htmlFor="purchaseDate">Data de Compra</Label>
            <DatePicker
              date={formData.purchaseDate ? new Date(formData.purchaseDate) : undefined}
              onSelect={(d) => setFormData(prev => ({ ...prev, purchaseDate: d ? formatDateForInput(d) : '' }))}
            />
          </div>

          <div>
            <Label htmlFor="accountId">Conta (opcional)</Label>
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

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Criando...' : 'Criar Investimento'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};