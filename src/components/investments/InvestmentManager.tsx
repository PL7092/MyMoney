import React, { useState } from 'react';
import { useFinance } from '../../contexts/FinanceContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { PlusCircle, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from '../ui/use-toast';
import { InvestmentForm } from './InvestmentForm';

export const InvestmentManager: React.FC = () => {
  const { addInvestment, investments, deleteInvestment } = useFinance();
  const [showForm, setShowForm] = useState(false);

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este investimento?')) {
      try {
        await deleteInvestment(id);
        toast({
          title: "Investimento Excluído",
          description: "O investimento foi removido com sucesso.",
        });
      } catch (error) {
        toast({
          title: "Erro",
          description: "Erro ao excluir investimento.",
          variant: "destructive",
        });
      }
    }
  };

  // Calculate totals
  const totalInvested = investments.reduce((sum, inv) => sum + Number(inv.purchasePrice ?? 0), 0);
  const totalCurrent = investments.reduce((sum, inv) => sum + Number(inv.currentValue ?? 0), 0);
  const totalReturn = totalCurrent - totalInvested;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Investimentos</h1>
          <p className="text-muted-foreground">Gerencie sua carteira de investimentos</p>
        </div>
        <Button className="flex items-center gap-2" onClick={() => setShowForm(true)}>
          <PlusCircle size={16} />
          Novo Investimento
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Investido</p>
              <p className="text-xl font-bold">€{totalInvested.toFixed(2)}</p>
            </div>
            <Wallet className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Valor Atual</p>
              <p className="text-xl font-bold">€{totalCurrent.toFixed(2)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Retorno</p>
              <p className={`text-xl font-bold ${totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                €{totalReturn.toFixed(2)}
              </p>
            </div>
            {totalReturn >= 0 ? (
              <TrendingUp className="h-8 w-8 text-green-600" />
            ) : (
              <TrendingDown className="h-8 w-8 text-red-600" />
            )}
          </div>
        </Card>
      </div>

      {/* Investments List */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Seus Investimentos</h3>
        
        {investments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum investimento registrado</p>
            <p className="text-sm">Clique em "Novo Investimento" para começar</p>
          </div>
        ) : (
          <div className="space-y-4">
            {investments.map((investment) => (
              <div key={investment.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium">{investment.name}</h4>
                      <Badge variant="outline">{investment.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{investment.name}</p>
                  </div>

                  <div className="text-right mr-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Inicial</p>
                        <p className="font-medium">€{Number(investment.purchasePrice ?? 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Atual</p>
                        <p className="font-medium">€{Number(investment.currentValue ?? 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(investment.id)}
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <InvestmentForm open={showForm} onOpenChange={setShowForm} />
    </div>
  );
};