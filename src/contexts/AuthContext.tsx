import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, password: string, name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Always set a default user - no authentication required
  const [user, setUser] = useState<User | null>({
    id: '1',
    email: 'public@mymoney.app',
    name: 'Usuário Público'
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // No authentication check needed - user is always "logged in"
    // This allows the app to function without requiring login
  }, []);

  const login = async (email: string, password: string) => {
    // No login required - user is always authenticated
    // This is a no-op function to maintain compatibility
    return Promise.resolve();
  };

  const register = async (email: string, password: string, name: string) => {
    // No registration required - user is always authenticated
    // This is a no-op function to maintain compatibility
    return Promise.resolve();
  };

  const logout = () => {
    // No logout required - user remains authenticated
    // This is a no-op function to maintain compatibility
  };

  const value = {
    user,
    isLoading,
    login,
    logout,
    register
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};