import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, X, Minimize2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatBotProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const ChatBot: React.FC<ChatBotProps> = ({ isOpen, onToggle }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Olá! Sou seu assistente financeiro. Como posso ajudar você hoje?',
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getBotResponse = (userMessage: string): string => {
    const message = userMessage.toLowerCase();
    
    if (message.includes('saldo') || message.includes('conta')) {
      return 'Para verificar seu saldo, vá até a seção de Contas no menu lateral. Lá você pode ver todas as suas contas e saldos atuais.';
    }
    
    if (message.includes('transação') || message.includes('gasto') || message.includes('despesa')) {
      return 'Você pode adicionar novas transações na seção "Transações". Clique no botão "+" para registrar receitas ou despesas.';
    }
    
    if (message.includes('orçamento') || message.includes('budget')) {
      return 'Na seção de "Orçamentos" você pode criar e gerenciar seus orçamentos mensais. Defina limites para diferentes categorias de gastos.';
    }
    
    if (message.includes('investimento') || message.includes('investir')) {
      return 'A seção de "Investimentos" permite acompanhar sua carteira de investimentos e o desempenho dos seus ativos.';
    }
    
    if (message.includes('relatório') || message.includes('report')) {
      return 'Você pode gerar relatórios detalhados na seção "Relatórios" para analisar seus gastos, receitas e tendências financeiras.';
    }
    
    if (message.includes('meta') || message.includes('objetivo') || message.includes('poupança')) {
      return 'Na seção "Poupanças" você pode definir metas de economia e acompanhar seu progresso rumo aos objetivos financeiros.';
    }
    
    if (message.includes('ajuda') || message.includes('help')) {
      return 'Posso ajudar você com: consulta de saldos, registro de transações, criação de orçamentos, acompanhamento de investimentos, geração de relatórios e definição de metas de poupança. O que você gostaria de fazer?';
    }
    
    return 'Entendo! Para uma resposta mais específica, você pode navegar pelas seções do menu lateral ou me fazer perguntas sobre saldos, transações, orçamentos, investimentos ou relatórios.';
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simular delay de resposta
    setTimeout(() => {
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: getBotResponse(inputValue),
        isUser: false,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, botResponse]);
      setIsTyping(false);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <Card className="fixed bottom-20 right-4 w-80 h-96 shadow-elevated z-50 bg-gradient-card">
      <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              <Bot className="h-3 w-3" />
            </AvatarFallback>
          </Avatar>
          Assistente FinanceFlow
        </CardTitle>
        <div className="flex gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onToggle}
            className="h-6 w-6"
          >
            <Minimize2 className="h-3 w-3" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onToggle}
            className="h-6 w-6"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 pt-0 flex flex-col h-80">
        <ScrollArea className="flex-1 mb-3">
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-2 text-sm ${
                    message.isUser
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-muted text-muted-foreground rounded-lg p-2 text-sm">
                  <div className="flex space-x-1">
                    <div className="w-1 h-1 bg-current rounded-full animate-bounce"></div>
                    <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua mensagem..."
            className="flex-1"
          />
          <Button onClick={handleSendMessage} size="icon" className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};