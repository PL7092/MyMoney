import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  CreditCard, 
  Target, 
  Wallet, 
  TrendingUp, 
  Calendar,
  PiggyBank,
  Car,
  BarChart3,
  Brain,
  Settings,
  FileText,
  Upload,
  Database
} from "lucide-react";

interface SidebarProps {
  className?: string;
}

const navigation = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Transações",
    href: "/transactions",
    icon: CreditCard,
  },
  {
    name: "Orçamentos",
    href: "/budgets",
    icon: Target,
  },
  {
    name: "Contas",
    href: "/accounts",
    icon: Wallet,
  },
  {
    name: "Investimentos",
    href: "/investments",
    icon: TrendingUp,
  },
  {
    name: "Recorrentes",
    href: "/recurring",
    icon: Calendar,
  },
  {
    name: "Poupanças",
    href: "/savings",
    icon: PiggyBank,
  },
  {
    name: "Ativos",
    href: "/assets",
    icon: Car,
  },
  {
    name: "Relatórios",
    href: "/reports",
    icon: BarChart3,
  },
  {
    name: "Conselheiro IA",
    href: "/ai-advisor",
    icon: Brain,
  },
  {
    name: "Gestão de Dados",
    href: "/data",
    icon: Database,
  },
  {
    name: "Importar/Exportar",
    href: "/import-export",
    icon: Upload,
  },
];

export function Sidebar({ className }: SidebarProps) {
  const location = useLocation();
  
  return (
    <div className={cn("flex h-full w-64 flex-col bg-gradient-sidebar border-r border-border", className)}>
      <div className="flex h-16 items-center px-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
            <LayoutDashboard className="h-4 w-4 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-bold text-foreground">FinanceFlow</h1>
        </div>
      </div>
      
      <nav className="flex-1 space-y-1 px-4 py-6">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          return (
            <Link key={item.name} to={item.href}>
              <Button
                variant={isActive ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 h-10",
                  isActive && "bg-gradient-primary shadow-card"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Button>
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-border">
        <Link to="/settings">
          <Button variant="ghost" className="w-full justify-start gap-3 h-10">
            <Settings className="h-4 w-4" />
            Configurações
          </Button>
        </Link>
      </div>
    </div>
  );
}