import React, { useState } from 'react';
import { useFinance } from '../../contexts/FinanceContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { toast } from '../ui/use-toast';
import { useDateFormat } from '../../hooks/useDateFormat';
import type { Asset } from '../../contexts/FinanceContext';
import { DatePicker } from '../ui/date-picker';

interface AssetFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: Asset | null;
}

interface AssetFormData {
  name: string;
  type: 'property' | 'vehicle' | 'collectible' | 'other';
  purchasePrice: string;
  currentValue: string;
  purchaseDate: string;
  description: string;
  depreciationRate: string;
}

export const AssetForm: React.FC<AssetFormProps> = ({ open, onOpenChange, asset }) => {
  const { addAsset, updateAsset } = useFinance();
  const { formatDateForInput } = useDateFormat();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState<AssetFormData>({
    name: asset?.name || '',
    type: asset?.type || 'other',
    purchasePrice: asset?.purchasePrice?.toString() || '',
    currentValue: asset?.currentValue?.toString() || '',
    purchaseDate: asset?.purchaseDate || formatDateForInput(new Date()),
    description: asset?.description || '',
    depreciationRate: asset?.depreciationRate?.toString() || '0',
  });

  // Update form when asset prop changes
  React.useEffect(() => {
    if (asset) {
      setFormData({
        name: asset.name || '',
        type: asset.type || 'other',
        purchasePrice: asset.purchasePrice?.toString() || '',
        currentValue: asset.currentValue?.toString() || '',
        purchaseDate: asset.purchaseDate || formatDateForInput(new Date()),
        description: asset.description || '',
        depreciationRate: asset.depreciationRate?.toString() || '0',
      });
    } else {
      setFormData({
        name: '',
        type: 'other',
        purchasePrice: '',
        currentValue: '',
        purchaseDate: formatDateForInput(new Date()),
        description: '',
        depreciationRate: '0',
      });
    }
  }, [asset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast({
        title: "Erro",
        description: "Nome é obrigatório",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const assetData = {
        name: formData.name,
        type: formData.type,
        purchasePrice: parseFloat(formData.purchasePrice) || 0,
        currentValue: parseFloat(formData.currentValue) || 0,
        purchaseDate: formData.purchaseDate,
        description: formData.description,
        depreciationRate: parseFloat(formData.depreciationRate) || 0,
      };

      if (asset) {
        await updateAsset(asset.id, assetData);
        toast({
          title: "Sucesso",
          description: "Ativo atualizado com sucesso",
        });
      } else {
        await addAsset(assetData);
        toast({
          title: "Sucesso",
          description: "Ativo criado com sucesso",
        });
      }
      
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar ativo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{asset ? 'Editar Ativo' : 'Novo Ativo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do ativo"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="property">Propriedade</SelectItem>
                  <SelectItem value="vehicle">Veículo</SelectItem>
                  <SelectItem value="collectible">Colecionável</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="purchasePrice">Preço de Compra</Label>
              <Input
                id="purchasePrice"
                type="number"
                step="0.01"
                value={formData.purchasePrice}
                onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentValue">Valor Atual</Label>
              <Input
                id="currentValue"
                type="number"
                step="0.01"
                value={formData.currentValue}
                onChange={(e) => setFormData({ ...formData, currentValue: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="purchaseDate">Data de Compra</Label>
              <DatePicker
                date={formData.purchaseDate ? new Date(formData.purchaseDate) : undefined}
                onSelect={(d) => setFormData({ ...formData, purchaseDate: d ? formatDateForInput(d) : '' })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="depreciationRate">Taxa de Depreciação (%)</Label>
              <Input
                id="depreciationRate"
                type="number"
                step="0.1"
                value={formData.depreciationRate}
                onChange={(e) => setFormData({ ...formData, depreciationRate: e.target.value })}
                placeholder="0.0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrição do ativo"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : asset ? 'Salvar' : 'Criar Ativo'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};