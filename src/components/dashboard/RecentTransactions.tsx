import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useFinance } from "@/contexts/FinanceContext";

export function RecentTransactions() {
  const { transactions } = useFinance();
  
  const recentTransactions = transactions.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transações Recentes</CardTitle>
        <CardDescription>As suas últimas movimentações financeiras</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {recentTransactions.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            Nenhuma transação encontrada
          </p>
        ) : (
          recentTransactions.map((transaction) => {
            const isIncome = transaction.type === 'income';
            
            return (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: transaction.category_color || '#6366f1' }}
                  />
                  <div>
                    <p className="font-medium">{transaction.description || 'Sem descrição'}</p>
                    <p className="text-sm text-muted-foreground">
                      {transaction.category_name || 'Sem categoria'} • {new Date(transaction.date).toLocaleDateString('pt-PT')}
                    </p>
                  </div>
                </div>
                <p className={`font-semibold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                  {isIncome ? '+' : '-'}€{Math.abs(transaction.amount).toFixed(2)}
                </p>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}