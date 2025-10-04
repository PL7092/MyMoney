import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from '../components/ui/use-toast';

export interface AppSettings {
  currency: string;
  dateFormat: string;
  theme: 'light' | 'dark' | 'system';
  language: string;
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

export interface SecuritySettings {
  twoFactorAuth: boolean;
  sessionTimeout: number;
  loginAlerts: boolean;
  dataEncryption: boolean;
}

export interface UserSettings {
  appSettings: AppSettings;
  notificationSettings: NotificationSettings;
  securitySettings: SecuritySettings;
}

interface SettingsContextType {
  settings: UserSettings;
  isLoading: boolean;
  updateAppSettings: (settings: Partial<AppSettings>) => Promise<void>;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => Promise<void>;
  updateSecuritySettings: (settings: Partial<SecuritySettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: UserSettings = {
  appSettings: {
    currency: 'EUR',
    dateFormat: 'DD/MM/YYYY',
    theme: 'system',
    language: 'pt',
  },
  notificationSettings: {
    budgetAlerts: true,
    transactionNotifications: false,
    monthlyReports: true,
    investmentAlerts: true,
    goalReminders: true,
    emailNotifications: true,
    pushNotifications: false,
  },
  securitySettings: {
    twoFactorAuth: false,
    sessionTimeout: 30,
    loginAlerts: true,
    dataEncryption: true,
  },
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // API Helper function
  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token');
    const base = (localStorage.getItem('api_base_url') || '').trim();
    const baseClean = base.replace(/\/$/, '');
    const url = baseClean ? `${baseClean}/api${endpoint}` : `/api${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('Settings API call error for', url, ':', error);
      throw error;
    }
  };

  // Load settings from database
  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const response = await apiCall('/user-settings');
      if (response.success && response.data) {
        // Ensure the response data has the correct structure
        const settingsData = {
          appSettings: response.data.appSettings || defaultSettings.appSettings,
          notificationSettings: response.data.notificationSettings || defaultSettings.notificationSettings,
          securitySettings: response.data.securitySettings || defaultSettings.securitySettings,
        };
        
        setSettings(settingsData);
        
        // Apply theme immediately
        applyTheme(settingsData.appSettings.theme);
        
        // Save some settings to localStorage for immediate access
        localStorage.setItem('currency', settingsData.appSettings.currency);
        localStorage.setItem('dateFormat', settingsData.appSettings.dateFormat);
        localStorage.setItem('language', settingsData.appSettings.language);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      // Fallback to localStorage if database fails
      loadSettingsFromLocalStorage();
    } finally {
      setIsLoading(false);
    }
  };

  // Fallback to localStorage
  const loadSettingsFromLocalStorage = () => {
    try {
      const appSettings = localStorage.getItem('appSettings');
      const notificationSettings = localStorage.getItem('notifications');
      const securitySettings = localStorage.getItem('security');

      // Always set settings, using defaults if localStorage is empty
      setSettings({
        appSettings: appSettings ? JSON.parse(appSettings) : defaultSettings.appSettings,
        notificationSettings: notificationSettings ? JSON.parse(notificationSettings) : defaultSettings.notificationSettings,
        securitySettings: securitySettings ? JSON.parse(securitySettings) : defaultSettings.securitySettings,
      });
    } catch (error) {
      console.error('Error loading settings from localStorage:', error);
      // If there's an error parsing localStorage, use default settings
      setSettings(defaultSettings);
    }
  };

  // Apply theme to document
  const applyTheme = (theme: 'light' | 'dark' | 'system') => {
    const root = document.documentElement;
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.toggle('dark', systemTheme === 'dark');
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  };

  // Update app settings
  const updateAppSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      setIsLoading(true);
      
      const updatedAppSettings = { ...settings.appSettings, ...newSettings };
      const updatedSettings = { ...settings, appSettings: updatedAppSettings };
      
      // Save to database
      const response = await apiCall('/user-settings', {
        method: 'PUT',
        body: JSON.stringify({
          category: 'app',
          settings: updatedAppSettings,
        }),
      });
      
      if (response.success) {
        setSettings(updatedSettings);
        
        // Apply changes immediately
        if (newSettings.theme) {
          applyTheme(newSettings.theme);
        }
        
        // Update localStorage
        localStorage.setItem('appSettings', JSON.stringify(updatedAppSettings));
        if (newSettings.currency) localStorage.setItem('currency', newSettings.currency);
        if (newSettings.dateFormat) localStorage.setItem('dateFormat', newSettings.dateFormat);
        if (newSettings.language) localStorage.setItem('language', newSettings.language);
        
        toast({
          title: "Configurações Salvas",
          description: "As configurações da aplicação foram salvas com sucesso",
        });
        
        // Trigger a page refresh for date format changes to take effect
        if (newSettings.dateFormat && newSettings.dateFormat !== settings.appSettings.dateFormat) {
          setTimeout(() => window.location.reload(), 1000);
        }
      }
    } catch (error) {
      console.error('Error updating app settings:', error);
      
      // Fallback to localStorage
      const updatedAppSettings = { ...settings.appSettings, ...newSettings };
      localStorage.setItem('appSettings', JSON.stringify(updatedAppSettings));
      setSettings(prev => ({ ...prev, appSettings: updatedAppSettings }));
      
      // Apply theme change even if database fails
      if (newSettings.theme) {
        applyTheme(newSettings.theme);
      }
      
      toast({
        title: "Configurações Salvas Localmente",
        description: "Configurações salvas no dispositivo (erro ao sincronizar com servidor)",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Update notification settings
  const updateNotificationSettings = async (newSettings: Partial<NotificationSettings>) => {
    try {
      setIsLoading(true);
      
      const updatedNotificationSettings = { ...settings.notificationSettings, ...newSettings };
      const updatedSettings = { ...settings, notificationSettings: updatedNotificationSettings };
      
      const response = await apiCall('/user-settings', {
        method: 'PUT',
        body: JSON.stringify({
          category: 'notifications',
          settings: updatedNotificationSettings,
        }),
      });
      
      if (response.success) {
        setSettings(updatedSettings);
        localStorage.setItem('notifications', JSON.stringify(updatedNotificationSettings));
        
        toast({
          title: "Configurações Salvas",
          description: "As configurações de notificações foram salvas com sucesso",
        });
      }
    } catch (error) {
      console.error('Error updating notification settings:', error);
      
      // Fallback to localStorage
      const updatedNotificationSettings = { ...settings.notificationSettings, ...newSettings };
      localStorage.setItem('notifications', JSON.stringify(updatedNotificationSettings));
      setSettings(prev => ({ ...prev, notificationSettings: updatedNotificationSettings }));
      
      toast({
        title: "Configurações Salvas Localmente",
        description: "Configurações salvas no dispositivo (erro ao sincronizar com servidor)",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Update security settings
  const updateSecuritySettings = async (newSettings: Partial<SecuritySettings>) => {
    try {
      setIsLoading(true);
      
      const updatedSecuritySettings = { ...settings.securitySettings, ...newSettings };
      const updatedSettings = { ...settings, securitySettings: updatedSecuritySettings };
      
      const response = await apiCall('/user-settings', {
        method: 'PUT',
        body: JSON.stringify({
          category: 'security',
          settings: updatedSecuritySettings,
        }),
      });
      
      if (response.success) {
        setSettings(updatedSettings);
        localStorage.setItem('security', JSON.stringify(updatedSecuritySettings));
        
        toast({
          title: "Configurações Salvas",
          description: "As configurações de segurança foram salvas com sucesso",
        });
      }
    } catch (error) {
      console.error('Error updating security settings:', error);
      
      // Fallback to localStorage
      const updatedSecuritySettings = { ...settings.securitySettings, ...newSettings };
      localStorage.setItem('security', JSON.stringify(updatedSecuritySettings));
      setSettings(prev => ({ ...prev, securitySettings: updatedSecuritySettings }));
      
      toast({
        title: "Configurações Salvas Localmente",
        description: "Configurações salvas no dispositivo (erro ao sincronizar com servidor)",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh settings from database
  const refreshSettings = async () => {
    await loadSettings();
  };

  // Initialize settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    if (settings?.appSettings?.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [settings?.appSettings?.theme]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        isLoading,
        updateAppSettings,
        updateNotificationSettings,
        updateSecuritySettings,
        refreshSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};