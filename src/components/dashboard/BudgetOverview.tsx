import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useFinance } from "@/contexts/FinanceContext";

export function BudgetOverview() {
  const { budgets } = useFinance();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Orçamentos</CardTitle>
        <CardDescription>Estado atual dos seus orçamentos</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {budgets.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            Nenhum orçamento configurado
          </p>
        ) : (
          budgets.map((budget) => {
            const spent = Number(budget.spent ?? 0);
            const amount = Number(budget.amount ?? 0);
            const percentage = amount > 0 ? (spent / amount) * 100 : 0;
            const isOverBudget = spent > amount;

            return (
              <div key={budget.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {budget.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      €{spent.toFixed(2)} de €{amount.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${isOverBudget ? 'text-destructive' : 'text-foreground'}`}>
                      {percentage.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <Progress
                  value={Math.min(percentage, 100)}
                  className="w-full"
                />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}