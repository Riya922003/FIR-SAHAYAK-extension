import { createContext, useContext, useState, ReactNode } from 'react';
import type { User } from '../api/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (accessToken: string, refreshToken: string, userData: User) => void;
  updateUser: (updated: Partial<User>) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('fir_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('fir_token')
  );

  const login = (accessToken: string, refreshToken: string, userData: User) => {
    setToken(accessToken);
    setUser(userData);
    localStorage.setItem('fir_token', accessToken);
    localStorage.setItem('fir_refresh_token', refreshToken);
    localStorage.setItem('fir_user', JSON.stringify(userData));
  };

  const updateUser = (updated: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...updated };
      localStorage.setItem('fir_user', JSON.stringify(next));
      return next;
    });
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('fir_token');
    localStorage.removeItem('fir_refresh_token');
    localStorage.removeItem('fir_user');
    window.location.replace('/');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, updateUser, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
