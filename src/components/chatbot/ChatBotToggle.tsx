import React from 'react';
import { Bot, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ChatBotToggleProps {
  isOpen: boolean;
  onToggle: () => void;
  hasUnreadMessages?: boolean;
}

export const ChatBotToggle: React.FC<ChatBotToggleProps> = ({
  isOpen,
  onToggle,
  hasUnreadMessages = false,
}) => {
  return (
    <div className="fixed bottom-4 right-4 z-40">
      <Button
        onClick={onToggle}
        className={`
          relative h-14 w-14 rounded-full shadow-elevated bg-gradient-primary
          hover:shadow-glow transition-all duration-300 animate-pulse-glow
          ${isOpen ? 'rotate-45' : 'rotate-0'}
        `}
        size="icon"
      >
        {isOpen ? (
          <MessageCircle className="h-6 w-6 text-primary-foreground" />
        ) : (
          <Bot className="h-6 w-6 text-primary-foreground" />
        )}
        
        {hasUnreadMessages && !isOpen && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
            !
          </Badge>
        )}
      </Button>
    </div>
  );
};