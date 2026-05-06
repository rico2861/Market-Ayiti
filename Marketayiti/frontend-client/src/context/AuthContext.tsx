import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { authAPI } from '../api';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  initialized: boolean;
  loading: boolean;
  login:    (identifier: string, password: string) => Promise<{ via: string }>;
  register: (data: any) => Promise<{ via: string }>;
  logout:   () => Promise<void>;
  refresh:  () => Promise<void>;
  updateBalance: (balance: number) => void;
  updateUser:    (u: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]             = useState<User | null>(null);
  const [initialized, setInit]      = useState(false);
  const [loading, setLoading]       = useState(false);

  const fetchMe = useCallback(async () => {
    try {
      const res = await authAPI.me();
      setUser(res.data);
    } catch {
      setUser(null);
    } finally {
      setInit(true);
    }
  }, []);

  useEffect(() => {
    fetchMe();
    const onExpiry = () => setUser(null);
    window.addEventListener('auth:expired', onExpiry);
    return () => window.removeEventListener('auth:expired', onExpiry);
  }, [fetchMe]);

  const login = async (identifier: string, password: string) => {
    setLoading(true);
    try {
      const res = await authAPI.login(identifier, password);
      // Store token if returned
      if (res.data.access_token) {
        localStorage.setItem('ayiti_token', res.data.access_token);
      }
      setUser(res.data.user);
      return { via: res.data.via };
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: any) => {
    setLoading(true);
    try {
      const res = await authAPI.register(data);
      if (res.data.access_token) {
        localStorage.setItem('ayiti_token', res.data.access_token);
      }
      // Immediately set user — they are now registered AND logged in
      setUser(res.data.user);
      return { via: res.data.via || 'register' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try { await authAPI.logout(); } catch {}
    localStorage.removeItem('ayiti_token');
    setUser(null);
  };

  const refresh = async () => { await fetchMe(); };

  const updateBalance = (balance: number) =>
    setUser(u => u ? { ...u, balance } : u);

  const updateUser = (partial: Partial<User>) =>
    setUser(u => u ? { ...u, ...partial } : u);

  return (
    <AuthContext.Provider value={{
      user, initialized, loading,
      login, register, logout, refresh,
      updateBalance, updateUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
