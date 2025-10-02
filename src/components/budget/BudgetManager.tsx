import { useState, useMemo } from 'react';
import { useFinance } from '../../contexts/FinanceContext';
import { BudgetForm } from './BudgetForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Pencil, Trash2, Target, TrendingUp, TrendingDown, Calendar, Euro } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export function BudgetManager() {
  const { budgets, deleteBudget, transactions } = useFinance();
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<any>(null);

  // Calculate spent amounts based on actual transactions for each budget
  const budgetsWithSpent = useMemo(() => {
    return budgets.map(budget => {
      const spent = transactions
        .filter(t => 
          t.type === 'expense' &&
          t.categoryId === budget.categoryId &&
          new Date(t.date) >= new Date(budget.startDate) &&
          new Date(t.date) <= new Date(budget.endDate)
        )
        .reduce((sum, t) => sum + t.amount, 0);
      
      return { ...budget, spent };
    });
  }, [budgets, transactions]);

  const handleEdit = (budget: any) => {
    setEditingBudget(budget);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem a certeza que deseja eliminar este orçamento?')) {
      try {
        await deleteBudget(id);
        toast({
          title: "Orçamento eliminado",
          description: "O orçamento foi eliminado com sucesso",
        });
      } catch (error) {
        toast({
          title: "Erro",
          description: "Erro ao eliminar o orçamento",
          variant: "destructive",
        });
      }
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingBudget(null);
  };

  if (showForm) {
    return (
      <BudgetForm 
        budget={editingBudget} 
        onClose={handleFormClose}
      />
    );
  }

  const totalBudget = budgetsWithSpent.reduce((sum, budget) => sum + budget.amount, 0);
  const totalSpent = budgetsWithSpent.reduce((sum, budget) => sum + budget.spent, 0);
  const overallPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orçamentos</h1>
          <p className="text-muted-foreground">Gerencie e monitore seus orçamentos</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Orçamento
        </Button>
      </div>

      {/* Summary Card */}
      {budgetsWithSpent.length > 0 && (
        <Card className="bg-gradient-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Resumo Geral
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">Total Orçado</p>
                <p className="text-xl font-bold">€{totalBudget.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">Total Gasto</p>
                <p className="text-xl font-bold">€{totalSpent.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">Restante</p>
                <p className={`text-xl font-bold ${(totalBudget - totalSpent) >= 0 ? 'text-profit' : 'text-loss'}`}>
                  €{(totalBudget - totalSpent).toFixed(2)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">% Utilizado</p>
                <p className={`text-xl font-bold ${overallPercentage > 100 ? 'text-loss' : overallPercentage > 80 ? 'text-warning' : 'text-profit'}`}>
                  {overallPercentage.toFixed(1)}%
                </p>
              </div>
            </div>
            <Progress value={Math.min(overallPercentage, 100)} className="w-full h-3" />
          </CardContent>
        </Card>
      )}

      {/* Budgets */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {budgetsWithSpent.length === 0 ? (
          <Card className="col-span-full bg-gradient-card shadow-card">
            <CardContent className="py-12 text-center">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum orçamento definido</h3>
              <p className="text-muted-foreground mb-4">
                Crie o seu primeiro orçamento para controlar seus gastos
              </p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Orçamento
              </Button>
            </CardContent>
          </Card>
        ) : (
          budgetsWithSpent.map((budget) => {
            const percentage = budget.amount > 0 ? (budget.spent / budget.amount) * 100 : 0;
            const isOverBudget = budget.spent > budget.amount;
            const isNearLimit = percentage > 80 && !isOverBudget;

            return (
              <Card key={budget.id} className="bg-gradient-card shadow-card hover:shadow-lg transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{budget.name}</CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {new Date(budget.startDate).toLocaleDateString()} - {new Date(budget.endDate).toLocaleDateString()}
                      </div>
                      {budget.category_name && (
                        <Badge variant="secondary" className="text-xs">
                          {budget.category_name}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(budget)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(budget.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">€{budget.amount.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">€{(budget.amount - budget.spent).toFixed(2)} restante</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">€{budget.spent.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}% usado</p>
                      </div>
                    </div>
                    
                    <Progress 
                      value={Math.min(percentage, 100)} 
                      className="w-full h-2"
                    />
                    
                    {isOverBudget && (
                      <div className="flex items-center gap-2 text-sm text-loss">
                        <TrendingDown className="h-4 w-4" />
                        Excedido em €{(budget.spent - budget.amount).toFixed(2)}
                      </div>
                    )}
                    
                    {isNearLimit && (
                      <div className="flex items-center gap-2 text-sm text-warning">
                        <TrendingUp className="h-4 w-4" />
                        Próximo do limite
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-muted-foreground">Período</p>
                      <p className="font-medium capitalize">{budget.period}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <Badge 
                        variant={isOverBudget ? "destructive" : isNearLimit ? "secondary" : "default"}
                        className="text-xs"
                      >
                        {isOverBudget ? 'Excedido' : isNearLimit ? 'Atenção' : 'Normal'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}