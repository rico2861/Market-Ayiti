import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { adminAPI } from '../api';

interface Admin { id: string; username: string; email: string; role: string; balance: number; }
interface Ctx {
  admin: Admin | null; initialized: boolean; loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthCtx = createContext<Ctx | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    adminAPI.me().then(r => setAdmin(r.data)).catch(() => setAdmin(null)).finally(() => setInitialized(true));
    const h = () => setAdmin(null);
    window.addEventListener('admin:unauthorized', h);
    return () => window.removeEventListener('admin:unauthorized', h);
  }, []);

  const login = async (identifier: string, password: string) => {
    setLoading(true);
    try {
      const r = await adminAPI.login(identifier, password);
      if (r.data.user?.role !== 'admin') throw new Error('Admin sèlman');
      setAdmin(r.data.user);
    } finally { setLoading(false); }
  };

  const logout = async () => {
    try { await adminAPI.logout(); } catch {}
    setAdmin(null);
  };

  return <AuthCtx.Provider value={{ admin, initialized, loading, login, logout }}>{children}</AuthCtx.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAdminAuth must be inside AdminAuthProvider');
  return ctx;
}
