import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ChatBot } from "@/components/chatbot/ChatBot";
import { ChatBotToggle } from "@/components/chatbot/ChatBotToggle";
import { FinanceProvider } from "./contexts/FinanceContext";
import { AuthProvider } from "./contexts/AuthContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import Index from "./pages/Index";
import Data from "./pages/Data";
import Transactions from "./pages/Transactions";
import Budgets from "./pages/Budgets";
import Accounts from "./pages/Accounts";
import Investments from "./pages/Investments";
import Recurring from "./pages/Recurring";
import Savings from "./pages/Savings";
import Assets from "./pages/Assets";
import Reports from "./pages/Reports";
import AIAdvisor from "./pages/AIAdvisor";
import ImportExport from "./pages/ImportExport";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import TestComponent from "@/TestComponent";

const queryClient = new QueryClient();

const AppContent = () => {
  console.log("🏠 AppContent component rendering");
  const [chatBotOpen, setChatBotOpen] = useState(false);

  return (
    <FinanceProvider>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onToggleSidebar={() => {}} />
          <main className="flex-1 overflow-auto">
            <div className="container mx-auto px-6 py-8">
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/data" element={<Data />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/budgets" element={<Budgets />} />
                <Route path="/accounts" element={<Accounts />} />
                <Route path="/investments" element={<Investments />} />
                <Route path="/recurring" element={<Recurring />} />
                <Route path="/savings" element={<Savings />} />
                <Route path="/assets" element={<Assets />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/ai-advisor" element={<AIAdvisor />} />
                <Route path="/import-export" element={<ImportExport />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </main>
        </div>
        
        {/* ChatBot Components */}
        <ChatBot isOpen={chatBotOpen} onToggle={() => setChatBotOpen(!chatBotOpen)} />
        <ChatBotToggle isOpen={chatBotOpen} onToggle={() => setChatBotOpen(!chatBotOpen)} />
      </div>
    </FinanceProvider>
  );
};

const App = () => {
  console.log("🎯 App component rendering");
  
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SettingsProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </TooltipProvider>
        </SettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
