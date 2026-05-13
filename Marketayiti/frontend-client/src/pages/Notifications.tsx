import { useState, useEffect, useCallback } from 'react';
import { Bell, X, Check, Clock, AlertCircle, TrendingUp, TrendingDown, Gift, Wallet } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import http from '../api';
import { useWebSocket } from '../hooks/useRealtime';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  ref_type?: string;
  ref_id?: string;
  read: boolean;
  created_at: string;
}

function getIcon(type: string) {
  switch (type) {
    case 'bet_won':       return <TrendingUp size={20} color="#22c55e" />;
    case 'bet_lost':      return <TrendingDown size={20} color="#ef4444" />;
    case 'bet_placed':    return <TrendingUp size={20} color="#388bfd" />;
    case 'deposit_approved': return <Gift size={20} color="#a855f7" />;
    case 'deposit_rejected': return <AlertCircle size={20} color="#ef4444" />;
    case 'withdrawal_approved': return <Wallet size={20} color="#22c55e" />;
    case 'withdrawal_rejected': return <AlertCircle size={20} color="#f59e0b" />;
    default: return <Bell size={20} color="#388bfd" />;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

export default function Notifications() {
  const location = useLocation();
  const lang = (location.pathname.split('/')[1] as 'ht' | 'fr') || 'ht';
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  // Subscribe to user-specific WebSocket channel for real-time notifications
  useWebSocket({
    channels: user ? [`user:${user.id}`] : [],
    enabled: !!user,
    onMessage: (msg: any) => {
      if (msg.type !== 'notification:new') return;
      const n = msg.data as Notification;
      if (!n?.id) return;
      setNotifications(prev => [n, ...prev]);
      setUnread(c => c + 1);
    },
  });

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await http.get('/notifications', { params: { limit: 50 } });
      setNotifications(res.data.notifications || []);
      setUnread(res.data.unread || 0);
    } catch {
      // silently fail — user might not be logged in
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);


  const markRead = async (id: string) => {
    try {
      await http.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnread(c => Math.max(0, c - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await http.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnread(0);
    } catch {}
  };

  const deleteNotif = async (id: string, wasRead: boolean) => {
    try {
      await http.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (!wasRead) setUnread(c => Math.max(0, c - 1));
    } catch {}
  };

  const text = {
    ht: {
      title: 'Notifikasyon',
      unread: 'pa li',
      noNotifications: 'Pa gen notifikasyon',
      markRead: 'Li',
      markAll: 'Tout li',
    },
    fr: {
      title: 'Notifications',
      unread: 'non lue',
      noNotifications: 'Aucune notification',
      markRead: 'Lire',
      markAll: 'Tout lire',
    },
  }[lang];

  if (!user) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', background: '#0d1117' }}>
        <p style={{ color: '#8b949e', fontSize: 16 }}>Ou dwe konekte pou wè notifikasyon ou</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', padding: '20px 16px 120px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'white', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Bell size={28} color="#388bfd" />
              {text.title}
            </h1>
            {unread > 0 && (
              <p style={{ fontSize: 12, color: '#8b949e', margin: 0 }}>
                {unread} {text.unread}
              </p>
            )}
          </div>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              style={{
                background: 'rgba(56,139,253,0.15)',
                border: '1px solid rgba(56,139,253,0.4)',
                color: '#388bfd',
                fontSize: 12,
                fontWeight: 600,
                padding: '8px 14px',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              {text.markAll}
            </button>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ width: 36, height: 36, border: '3px solid rgba(56,139,253,0.2)', borderTopColor: '#388bfd', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(255,255,255,.02)', borderRadius: 14, border: '1px dashed rgba(255,255,255,.08)' }}>
                <Bell style={{ width: 48, height: 48, margin: '0 auto 16px', opacity: 0.15, display: 'block', color: '#8b949e' }} />
                <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>{text.noNotifications}</p>
              </div>
            ) : notifications.map(notif => (
              <div
                key={notif.id}
                onClick={() => { if (!notif.read) markRead(notif.id); }}
                style={{
                  padding: 16,
                  background: notif.read ? 'rgba(255,255,255,.02)' : 'rgba(56,139,253,0.08)',
                  border: `1px solid ${notif.read ? 'rgba(255,255,255,.08)' : 'rgba(56,139,253,0.2)'}`,
                  borderRadius: 12,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  cursor: notif.read ? 'default' : 'pointer',
                  transition: 'all .2s',
                }}
              >
                <div style={{ flexShrink: 0, marginTop: 2 }}>{getIcon(notif.type)}</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0 }}>{notif.title}</p>
                    {!notif.read && (
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#388bfd', flexShrink: 0 }} />
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: '#8b949e', margin: '0 0 8px' }}>{notif.message}</p>
                  <span style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} />
                    {timeAgo(notif.created_at)}
                  </span>
                </div>

                <button
                  onClick={e => { e.stopPropagation(); deleteNotif(notif.id, notif.read); }}
                  style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f85149')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#8b949e')}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
