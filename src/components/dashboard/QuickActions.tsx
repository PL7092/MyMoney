import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Target,
  TrendingUp,
  FileText,
  Brain
} from "lucide-react";

const quickActions = [
  {
    title: "Nova Transação",
    description: "Registar receita ou despesa",
    icon: Plus,
    color: "bg-gradient-primary"
  },
  {
    title: "Transferência",
    description: "Entre contas",
    icon: ArrowUpRight,
    color: "bg-gradient-profit"
  },
  {
    title: "Definir Orçamento",
    description: "Controlar gastos",
    icon: Target,
    color: "bg-info"
  },
  {
    title: "Investir",
    description: "Adicionar investimento",
    icon: TrendingUp,
    color: "bg-investment"
  },
  {
    title: "Relatório",
    description: "Gerar análise",
    icon: FileText,
    color: "bg-warning"
  },
  {
    title: "Conselho IA",
    description: "Sugestões personalizadas",
    icon: Brain,
    color: "bg-accent"
  }
];

export function QuickActions() {
  const navigate = useNavigate();

  const handleActionClick = (actionTitle: string) => {
    switch (actionTitle) {
      case "Nova Transação":
        navigate("/transactions");
        break;
      case "Transferência":
        navigate("/accounts");
        break;
      case "Definir Orçamento":
        navigate("/budgets");
        break;
      case "Investir":
        navigate("/investments");
        break;
      case "Relatório":
        navigate("/reports");
        break;
      case "Conselho IA":
        navigate("/ai-advisor");
        break;
      default:
        break;
    }
  };

  return (
    <Card className="bg-gradient-card shadow-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Ações Rápidas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.title}
                variant="outline"
                className="h-auto p-4 flex-col items-start gap-2 hover:shadow-card transition-all duration-300"
                onClick={() => handleActionClick(action.title)}
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${action.color} shadow-sm`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">{action.title}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}