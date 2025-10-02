export interface Notification {
  id: string;
  type: 'budget' | 'transaction' | 'investment' | 'goal' | 'recurring' | 'system';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  timestamp: string;
  read: boolean;
  actionable: boolean;
  action?: {
    label: string;
    callback: () => void;
  };
}

export interface NotificationSettings {
  budgetAlerts: boolean;
  transactionNotifications: boolean;
  monthlyReports: boolean;
  investmentAlerts: boolean;
  goalReminders: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
}

class NotificationService {
  private static instance: NotificationService;
  private notifications: Notification[] = [];
  private listeners: ((notifications: Notification[]) => void)[] = [];
  private settings: NotificationSettings;

  constructor() {
    this.settings = this.loadSettings();
    this.requestPermission();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private loadSettings(): NotificationSettings {
    const stored = localStorage.getItem('notifications');
    return stored ? JSON.parse(stored) : {
      budgetAlerts: true,
      transactionNotifications: false,
      monthlyReports: true,
      investmentAlerts: true,
      goalReminders: true,
      emailNotifications: true,
      pushNotifications: false,
    };
  }

  private async requestPermission(): Promise<void> {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }

  // Create notifications
  createBudgetAlert(category: string, spent: number, limit: number): void {
    if (!this.settings.budgetAlerts) return;

    const percentage = (spent / limit) * 100;
    let priority: 'low' | 'medium' | 'high' = 'medium';
    let title = `Alerta de Orçamento - ${category}`;
    let message = `Gastou €${spent.toFixed(2)} de €${limit.toFixed(2)} (${percentage.toFixed(1)}%)`;

    if (percentage >= 100) {
      priority = 'high';
      title = `⚠️ Orçamento Excedido - ${category}`;
      message = `Excedeu o orçamento em €${(spent - limit).toFixed(2)}`;
    } else if (percentage >= 80) {
      priority = 'high';
      title = `🚨 Orçamento Crítico - ${category}`;
    } else if (percentage >= 60) {
      priority = 'medium';
      title = `⚡ Alerta de Orçamento - ${category}`;
    }

    this.addNotification({
      type: 'budget',
      title,
      message,
      priority,
      actionable: true,
      action: {
        label: 'Ver Orçamento',
        callback: () => window.location.href = '/budgets'
      }
    });
  }

  createTransactionAlert(description: string, amount: number): void {
    if (!this.settings.transactionNotifications) return;
    if (amount < 100) return; // Only for transactions above €100

    this.addNotification({
      type: 'transaction',
      title: '💳 Nova Transação',
      message: `${description}: €${amount.toFixed(2)}`,
      priority: 'low',
      actionable: true,
      action: {
        label: 'Ver Transações',
        callback: () => window.location.href = '/transactions'
      }
    });
  }

  createInvestmentAlert(name: string, changePercentage: number): void {
    if (!this.settings.investmentAlerts) return;
    if (Math.abs(changePercentage) < 5) return; // Only for significant changes

    const isPositive = changePercentage > 0;
    const emoji = isPositive ? '📈' : '📉';
    const priority: 'low' | 'medium' | 'high' = Math.abs(changePercentage) > 10 ? 'high' : 'medium';

    this.addNotification({
      type: 'investment',
      title: `${emoji} Alerta de Investimento`,
      message: `${name}: ${isPositive ? '+' : ''}${changePercentage.toFixed(2)}%`,
      priority,
      actionable: true,
      action: {
        label: 'Ver Investimentos',
        callback: () => window.location.href = '/investments'
      }
    });
  }

  createGoalReminder(goalName: string, progress: number, daysRemaining: number): void {
    if (!this.settings.goalReminders) return;

    let priority: 'low' | 'medium' | 'high' = 'low';
    let title = `🎯 Lembrete de Meta`;
    let message = `${goalName}: ${progress.toFixed(1)}% completo`;

    if (daysRemaining <= 7 && progress < 90) {
      priority = 'high';
      title = `🚨 Meta Urgente`;
      message = `${goalName}: ${progress.toFixed(1)}% completo, ${daysRemaining} dias restantes`;
    } else if (daysRemaining <= 30 && progress < 50) {
      priority = 'medium';
      title = `⏰ Meta Atrasada`;
      message = `${goalName}: ${progress.toFixed(1)}% completo, ${daysRemaining} dias restantes`;
    }

    this.addNotification({
      type: 'goal',
      title,
      message,
      priority,
      actionable: true,
      action: {
        label: 'Ver Metas',
        callback: () => window.location.href = '/savings'
      }
    });
  }

  createRecurringAlert(description: string, variation: number): void {
    this.addNotification({
      type: 'recurring',
      title: '🔄 Variação Detectada',
      message: `${description}: ${variation > 0 ? '+' : ''}${variation.toFixed(2)}% de variação`,
      priority: Math.abs(variation) > 20 ? 'high' : 'medium',
      actionable: true,
      action: {
        label: 'Ver Recorrentes',
        callback: () => window.location.href = '/recurring'
      }
    });
  }

  createSystemNotification(title: string, message: string, priority: 'low' | 'medium' | 'high' = 'low'): void {
    this.addNotification({
      type: 'system',
      title,
      message,
      priority,
      actionable: false
    });
  }

  // Notification management
  private addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): void {
    const newNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random()}`,
      timestamp: new Date().toISOString(),
      read: false
    };

    this.notifications.unshift(newNotification);
    
    // Keep only last 50 notifications
    if (this.notifications.length > 50) {
      this.notifications = this.notifications.slice(0, 50);
    }

    this.notifyListeners();
    this.saveNotifications();
    
    // Send browser notification if enabled
    if (this.settings.pushNotifications && Notification.permission === 'granted') {
      this.sendBrowserNotification(newNotification);
    }
  }

  private sendBrowserNotification(notification: Notification): void {
    try {
      const browserNotif = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: notification.id
      });

      browserNotif.onclick = () => {
        window.focus();
        if (notification.action) {
          notification.action.callback();
        }
        browserNotif.close();
      };

      // Auto close after 5 seconds
      setTimeout(() => browserNotif.close(), 5000);
    } catch (error) {
      console.warn('Failed to send browser notification:', error);
    }
  }

  // Public methods
  getNotifications(): Notification[] {
    return [...this.notifications];
  }

  getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  markAsRead(id: string): void {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      this.notifyListeners();
      this.saveNotifications();
    }
  }

  markAllAsRead(): void {
    this.notifications.forEach(n => n.read = true);
    this.notifyListeners();
    this.saveNotifications();
  }

  deleteNotification(id: string): void {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.notifyListeners();
    this.saveNotifications();
  }

  clearAll(): void {
    this.notifications = [];
    this.notifyListeners();
    this.saveNotifications();
  }

  // Listeners
  subscribe(callback: (notifications: Notification[]) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener([...this.notifications]));
  }

  // Persistence
  private saveNotifications(): void {
    localStorage.setItem('app_notifications', JSON.stringify(this.notifications));
  }

  loadNotifications(): void {
    const stored = localStorage.getItem('app_notifications');
    if (stored) {
      this.notifications = JSON.parse(stored);
      this.notifyListeners();
    }
  }

  updateSettings(settings: Partial<NotificationSettings>): void {
    this.settings = { ...this.settings, ...settings };
    localStorage.setItem('notifications', JSON.stringify(this.settings));
  }

  getSettings(): NotificationSettings {
    return { ...this.settings };
  }
}

export default NotificationService;
