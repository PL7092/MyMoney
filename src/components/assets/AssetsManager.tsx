import React, { useState } from 'react';
import { useFinance } from '../../contexts/FinanceContext';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Plus, Edit, Trash2, Home, Car, Diamond, Package } from 'lucide-react';
import { toast } from '../ui/use-toast';
import { AssetForm } from './AssetForm';
import type { Asset } from '../../contexts/FinanceContext';

export const AssetsManager: React.FC = () => {
  const { assets, deleteAsset } = useFinance();
  const [showForm, setShowForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este ativo?')) {
      try {
        await deleteAsset(id);
        toast({
          title: "Ativo Excluído",
          description: "O ativo foi removido com sucesso.",
        });
      } catch (error) {
        toast({
          title: "Erro",
          description: "Erro ao excluir ativo.",
          variant: "destructive",
        });
      }
    }
  };

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'property': return <Home className="h-5 w-5" />;
      case 'vehicle': return <Car className="h-5 w-5" />;
      case 'collectible': return <Diamond className="h-5 w-5" />;
      default: return <Package className="h-5 w-5" />;
    }
  };

  const getAssetLabel = (type: string) => {
    switch (type) {
      case 'property': return 'Propriedade';
      case 'vehicle': return 'Veículo';
      case 'collectible': return 'Colecionável';
      default: return 'Outro';
    }
  };

  // Summary calculations
  const totalValue = assets.reduce((sum, asset) => sum + Number(asset.currentValue ?? 0), 0);
  const totalQuantity = assets.length;
  const averageDepreciation = assets.length > 0 
    ? assets.reduce((sum, asset) => {
        const currentValue = Number(asset.currentValue ?? 0);
        const purchasePrice = Number(asset.purchasePrice ?? 0);
        return sum + (purchasePrice > 0 ? ((purchasePrice - currentValue) / purchasePrice) * 100 : 0);
      }, 0) / assets.length 
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Ativos</h1>
          <p className="text-muted-foreground">Gerencie seus ativos financeiros</p>
        </div>
        <Button className="flex items-center gap-2" onClick={() => setShowForm(true)}>
          <Plus size={16} />
          Novo Ativo
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalValue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalQuantity}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Depreciação Média</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageDepreciation.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Assets List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assets.map((asset) => (
          <Card key={asset.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getAssetIcon(asset.type)}
                  <div>
                    <CardTitle className="text-base">{asset.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{getAssetLabel(asset.type)}</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Valor Atual</p>
                  <p className="font-medium">€{Number(asset.currentValue ?? 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Preço de Compra</p>
                  <p className="font-medium">€{Number(asset.purchasePrice ?? 0).toLocaleString()}</p>
                </div>
              </div>
              {asset.description && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{asset.description}</p>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingAsset(asset);
                    setShowForm(true);
                  }}
                >
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(asset.id)}
                >
                  Excluir
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {asset.purchaseDate && new Date(asset.purchaseDate).toLocaleDateString()}
              </p>
            </CardFooter>
          </Card>
        ))}
      </div>

      {assets.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Nenhum ativo encontrado</h3>
            <p className="text-muted-foreground mb-4">
              Comece adicionando seus primeiros ativos financeiros.
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Ativo
            </Button>
          </CardContent>
        </Card>
      )}

      <AssetForm 
        open={showForm} 
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditingAsset(null);
        }}
        asset={editingAsset}
      />
    </div>
  );
};