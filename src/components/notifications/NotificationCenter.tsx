import React, { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, X, Trash2, AlertCircle, Info, TrendingUp, Target } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import NotificationService, { Notification } from '../../services/NotificationService';

export const NotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'budget' | 'investment' | 'goal'>('all');

  useEffect(() => {
    const service = NotificationService.getInstance();
    service.loadNotifications();
    
    const unsubscribe = service.subscribe((notifs) => {
      setNotifications(notifs);
    });

    setNotifications(service.getNotifications());

    return unsubscribe;
  }, []);

  const service = NotificationService.getInstance();

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return !notification.read;
    if (filter === 'all') return true;
    return notification.type === filter;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'budget': return AlertCircle;
      case 'investment': return TrendingUp;
      case 'goal': return Target;
      case 'transaction': return Info;
      case 'recurring': return Info;
      default: return Bell;
    }
  };

  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      default: return 'secondary';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Agora mesmo';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('pt-PT');
  };

  return (
    <Card className="w-full max-w-2xl mx-auto bg-gradient-card shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Central de Notificações
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => service.markAllAsRead()}
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Marcar Todas
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => service.clearAll()}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          </div>
        </div>
        
        {/* Filter buttons */}
        <div className="flex flex-wrap gap-2 mt-4">
          {[
            { key: 'all', label: 'Todas' },
            { key: 'unread', label: 'Não Lidas' },
            { key: 'budget', label: 'Orçamento' },
            { key: 'investment', label: 'Investimentos' },
            { key: 'goal', label: 'Metas' }
          ].map(({ key, label }) => (
            <Button
              key={key}
              variant={filter === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(key as any)}
            >
              {label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-96">
          {filteredNotifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              {filter === 'unread' ? 'Não há notificações não lidas' : 'Não há notificações'}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredNotifications.map((notification, index) => {
                const Icon = getIcon(notification.type);
                
                return (
                  <div key={notification.id}>
                    <div
                      className={`p-4 hover:bg-background/50 transition-colors ${
                        !notification.read ? 'bg-primary/5 border-l-4 border-l-primary' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${
                          notification.priority === 'high' ? 'bg-destructive/10 text-destructive' :
                          notification.priority === 'medium' ? 'bg-primary/10 text-primary' :
                          'bg-secondary/10 text-secondary-foreground'
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-sm font-medium truncate">
                              {notification.title}
                            </h4>
                            <div className="flex items-center gap-2 ml-2">
                              <Badge 
                                variant={getPriorityColor(notification.priority) as any}
                                className="text-xs"
                              >
                                {notification.priority === 'high' ? 'Alta' : 
                                 notification.priority === 'medium' ? 'Média' : 'Baixa'}
                              </Badge>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatTime(notification.timestamp)}
                              </span>
                            </div>
                          </div>
                          
                          <p className="text-sm text-muted-foreground mb-2">
                            {notification.message}
                          </p>
                          
                          <div className="flex items-center gap-2">
                            {!notification.read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => service.markAsRead(notification.id)}
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Marcar como lida
                              </Button>
                            )}
                            
                            {notification.actionable && notification.action && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  notification.action!.callback();
                                  service.markAsRead(notification.id);
                                }}
                              >
                                {notification.action.label}
                              </Button>
                            )}
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => service.deleteNotification(notification.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                    {index < filteredNotifications.length - 1 && <Separator />}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};