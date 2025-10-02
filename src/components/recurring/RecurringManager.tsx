import React, { useState } from 'react';
import { useFinance } from '../../contexts/FinanceContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { PlusCircle, Repeat, Calendar, AlertTriangle } from 'lucide-react';
import { toast } from '../ui/use-toast';
import { RecurringForm } from './RecurringForm';

export const RecurringManager: React.FC = () => {
  const { addRecurringTransaction, recurringTransactions, deleteRecurringTransaction } = useFinance();
  const [showForm, setShowForm] = useState(false);

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta transação recorrente?')) {
      try {
        await deleteRecurringTransaction(id);
        toast({
          title: "Transação Recorrente Excluída",
          description: "A transação recorrente foi removida com sucesso.",
        });
      } catch (error) {
        toast({
          title: "Erro",
          description: "Erro ao excluir transação recorrente.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transações Recorrentes</h1>
          <p className="text-muted-foreground">Gerencie transações que se repetem automaticamente</p>
        </div>
        <Button className="flex items-center gap-2" onClick={() => setShowForm(true)}>
          <PlusCircle size={16} />
          Nova Recorrente
        </Button>
      </div>

      {/* Recurring Transactions List */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Suas Transações Recorrentes</h3>
        
        {recurringTransactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Repeat className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma transação recorrente configurada</p>
            <p className="text-sm">Configure transações que se repetem automaticamente</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recurringTransactions.map((recurring) => (
              <div key={recurring.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium">{recurring.description}</h4>
                      <Badge variant="outline">{recurring.type}</Badge>
                      <Badge variant="secondary">{recurring.frequency}</Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span>€{Number(recurring.amount ?? 0).toFixed(2)}</span>
                      <span>Próxima: {new Date().toLocaleDateString()}</span>
                      {recurring.isActive && (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          Ativa
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(recurring.id)}
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
      
      <RecurringForm open={showForm} onOpenChange={setShowForm} />
    </div>
  );
};