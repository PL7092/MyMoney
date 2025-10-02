import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useFinance } from "@/contexts/FinanceContext";

export function InvestmentSummary() {
  const { investments } = useFinance();
  
  const totalValue = investments.reduce((sum, inv) => sum + Number(inv.currentValue ?? 0), 0);
  const totalCost = investments.reduce((sum, inv) => sum + Number(inv.totalCost ?? 0), 0);
  const totalChange = totalValue - totalCost;
  const totalChangePercent = totalCost > 0 ? (totalChange / totalCost) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Investimentos</CardTitle>
        <CardDescription>Resumo da sua carteira de investimentos</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Valor Total</p>
            <p className="text-2xl font-bold">€{totalValue.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-muted-foreground">
              Variação Total
            </p>
            <p className={`text-lg font-semibold ${totalChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalChange >= 0 ? '+' : ''}€{totalChange.toFixed(2)} ({totalChangePercent.toFixed(2)}%)
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {investments.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhum investimento registado
            </p>
          ) : (
            investments.map((investment) => {
              const currentValue = Number(investment.currentValue ?? 0);
              const totalCostItem = Number(investment.totalCost ?? 0);
              const change = currentValue - totalCostItem;
              const changePercent = totalCostItem > 0 ? (change / totalCostItem) * 100 : 0;
              
              return (
                <div
                  key={investment.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{investment.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {investment.type} • {investment.quantity || 0} unidades
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">€{currentValue.toFixed(2)}</p>
                    <p className={`text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {change >= 0 ? '+' : ''}€{change.toFixed(2)} ({changePercent.toFixed(1)}%)
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}