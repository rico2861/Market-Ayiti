import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { authAPI } from '../api';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  initialized: boolean;
  loading: boolean;
  login:    (identifier: string, password: string) => Promise<{ via: string } | { requires_2fa: true }>;
  register: (data: any) => Promise<{ via: string }>;
  logout:   () => Promise<void>;
  refresh:  () => Promise<void>;
  updateBalance: (balance: number) => void;
  updateUser:    (u: Partial<User>) => void;
  complete2fa:  (totp_code: string) => Promise<void>;
}

const CACHE_KEY = 'ayiti_user';

function readCache(): User | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch { return null; }
}

function writeCache(u: User | null) {
  try {
    if (u) {
      // Store only display fields needed for instant render — never store sensitive data
      const minimal = { id: u.id, username: u.username, balance: u.balance, bonus_balance: u.bonus_balance, role: u.role };
      localStorage.setItem(CACHE_KEY, JSON.stringify(minimal));
    } else {
      localStorage.removeItem(CACHE_KEY);
    }
  } catch {}
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialise synchronously from cache — no flash, no blank render
  const [user, setUser]        = useState<User | null>(() => readCache());
  const [initialized, setInit] = useState<boolean>(() => readCache() !== null);
  const [loading, setLoading]  = useState(false);

  const setUserAndCache = useCallback((u: User | null) => {
    writeCache(u);
    setUser(u);
  }, []);

  const fetchMe = useCallback(async () => {
    try {
      const res = await authAPI.me();
      const userData = res.data;
      if (userData?.role === 'admin') {
        setUserAndCache(null);
        try { await authAPI.logout(); } catch {}
      } else {
        setUserAndCache(userData);
      }
    } catch {
      setUserAndCache(null);
    } finally {
      setInit(true);
    }
  }, [setUserAndCache]);

  useEffect(() => {
    fetchMe();
    const onExpiry = () => setUserAndCache(null);
    window.addEventListener('auth:expired', onExpiry);
    return () => window.removeEventListener('auth:expired', onExpiry);
  }, [fetchMe]);

  const login = async (identifier: string, password: string) => {
    setLoading(true);
    try {
      const res = await authAPI.login(identifier, password);
      // 2FA required — don't set user yet, caller handles the TOTP step
      if ((res.data as any).requires_2fa) return { requires_2fa: true as const };
      if ((res.data as any).access_token) localStorage.setItem('ayiti_token', (res.data as any).access_token);
      setUserAndCache((res.data as any).user);
      return { via: (res.data as any).via };
    } finally {
      setLoading(false);
    }
  };

  const complete2fa = async (totp_code: string) => {
    setLoading(true);
    try {
      const res = await authAPI.twofa.verifyLogin(totp_code);
      if (res.data.access_token) localStorage.setItem('ayiti_token', res.data.access_token);
      setUserAndCache(res.data.user);
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
      setUserAndCache(res.data.user);
      return { via: res.data.via || 'register' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try { await authAPI.logout(); } catch {}
    localStorage.removeItem('ayiti_token');
    setUserAndCache(null);
  };

  const refresh = async () => { await fetchMe(); };

  const updateBalance = (balance: number) =>
    setUserAndCache(user ? { ...user, balance } : null);

  const updateUser = (partial: Partial<User>) =>
    setUserAndCache(user ? { ...user, ...partial } : null);

  // Listen on user:<id> WS channel for real-time balance/bonus updates
  const wsRef = useRef<WebSocket | null>(null);
  const reconnRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    let unmounted = false;
    function connect(userId: string) {
      if (unmounted) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let ws: WebSocket;
      try { ws = new WebSocket(`${proto}//${window.location.host}/ws`); } catch { return; }
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'subscribe', channel: `user:${userId}` }));
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'user:balance_update') {
            setUser(u => {
              if (!u) return u;
              const newBalance = msg.balance       ?? u.balance;
              const newBonus   = msg.bonus_balance ?? u.bonus_balance;
              if (newBalance === u.balance && newBonus === u.bonus_balance) return u;
              const updated = { ...u, balance: newBalance, bonus_balance: newBonus };
              writeCache(updated);
              return updated;
            });
          }
        } catch {}
      };
      ws.onclose = () => {
        wsRef.current = null;
        // Exponential-style backoff capped at 30s to avoid hammering on bad connections
        if (!unmounted) reconnRef.current = setTimeout(() => connect(userId), 15000);
      };
      ws.onerror = () => {};
    }
    if (user?.id) connect(user.id);
    return () => {
      unmounted = true;
      clearTimeout(reconnRef.current);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null; }
    };
  }, [user?.id, fetchMe]);

  return (
    <AuthContext.Provider value={{
      user, initialized, loading,
      login, register, logout, refresh,
      updateBalance, updateUser, complete2fa
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
