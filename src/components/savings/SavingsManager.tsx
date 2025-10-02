import React, { useState } from 'react';
import { useFinance } from '../../contexts/FinanceContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { PlusCircle, Target, TrendingUp, Calendar } from 'lucide-react';
import { toast } from '../ui/use-toast';
import { SavingsForm } from './SavingsForm';
import { useDateFormat } from '../../hooks/useDateFormat';

export const SavingsManager: React.FC = () => {
  const { addSavingsGoal, savingsGoals, deleteSavingsGoal } = useFinance();
  const [showForm, setShowForm] = useState(false);

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta meta de poupança?')) {
      try {
        await deleteSavingsGoal(id);
        toast({
          title: "Meta Excluída",
          description: "A meta de poupança foi removida com sucesso.",
        });
      } catch (error) {
        toast({
          title: "Erro",
          description: "Erro ao excluir meta de poupança.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Metas de Poupança</h1>
          <p className="text-muted-foreground">Defina e acompanhe suas metas financeiras</p>
        </div>
        <Button className="flex items-center gap-2" onClick={() => setShowForm(true)}>
          <PlusCircle size={16} />
          Nova Meta
        </Button>
      </div>

      {/* Savings Goals List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {savingsGoals.length === 0 ? (
          <Card className="col-span-full p-8">
            <div className="text-center text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma meta de poupança definida</p>
              <p className="text-sm">Crie suas primeiras metas financeiras</p>
            </div>
          </Card>
        ) : (
          savingsGoals.map((goal) => {
            const targetAmt = Number(goal.targetAmount ?? 0);
            const currentAmt = Number(goal.currentAmount ?? 0);
            const progress = targetAmt > 0 ? (currentAmt / targetAmt) * 100 : 0;
            const daysUntilTarget = goal.targetDate
              ? Math.ceil((new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
              : 0;

            return (
              <Card key={goal.id} className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{goal.name}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
                    </div>
                    <Button variant="ghost" size="sm">
                      ⋮
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Progresso</span>
                      <span className="font-medium">{progress.toFixed(1)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>€{currentAmt.toFixed(2)}</span>
                      <span>€{targetAmt.toFixed(2)}</span>
                    </div>
                  </div>

                  {goal.targetDate && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {daysUntilTarget > 0 
                          ? `${daysUntilTarget} dias restantes`
                          : daysUntilTarget === 0 
                          ? 'Meta hoje!' 
                          : 'Meta expirada'
                        }
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      Editar
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDelete(goal.id)}
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
      
      <SavingsForm open={showForm} onOpenChange={setShowForm} />
    </div>
  );
};