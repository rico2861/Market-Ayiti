import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  TrendingUp, LayoutDashboard, BarChart2, Users, ArrowLeftRight,
  Tag, Settings, FileText, LogOut, Menu, X, Bell, ChevronRight,
  AlertCircle, MessageSquare, Lock, Shield,
} from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { adminAPI } from '../api';

const NAV = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard',      group: 'main' },
  { to: '/markets',      icon: BarChart2,        label: 'Marchés',        group: 'main' },
  { to: '/users',        icon: Users,            label: 'Utilisateurs',   group: 'main', badge: 'users' },
  { to: '/transactions', icon: ArrowLeftRight,   label: 'Transactions',   group: 'main', badge: 'pending' },
  { to: '/fraud',        icon: Shield,           label: 'Fraude IA',      group: 'config' },
  { to: '/categories',   icon: Tag,              label: 'Catégories',     group: 'config' },
  { to: '/comments',     icon: MessageSquare,    label: 'Commentaires',   group: 'config' },
  { to: '/settings',     icon: Settings,         label: 'Paramètres',     group: 'config' },
  { to: '/logs',         icon: FileText,         label: 'Logs Système',   group: 'config' },
];

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':    'Dashboard',
  '/markets':      'Marchés',
  '/users':        'Utilisateurs',
  '/transactions': 'Transactions',
  '/categories':   'Catégories',
  '/comments':     'Commentaires',
  '/settings':     'Paramètres',
  '/logs':         'Logs Système',
  '/fraud':        'Fraude IA',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { admin, logout } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lockedCount, setLockedCount]   = useState(0);

  useEffect(() => {
    adminAPI.stats().then(r => {
      setPendingCount(r.data?.finance?.pending_withdrawals ?? 0);
    }).catch(() => {});
    adminAPI.getLockedCount().then(r => {
      setLockedCount(r.data?.count ?? 0);
    }).catch(() => {});
  }, [location.pathname]);

  // Poll locked count every 60 s so admin sees new lockouts quickly
  useEffect(() => {
    const id = setInterval(() => {
      adminAPI.getLockedCount().then(r => setLockedCount(r.data?.count ?? 0)).catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Close sidebar when route changes
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const handleLogout = async () => { await logout(); navigate('/login', { replace: true }); };
  const isActive = (to: string) => location.pathname === to || location.pathname.startsWith(to + '/');

  const pageTitle = PAGE_TITLES[location.pathname] || 'Admin';

  const NavItem = ({ to, icon: Icon, label, badge }: typeof NAV[0]) => {
    const active = isActive(to);
    const count  = badge === 'pending' ? pendingCount : badge === 'users' ? lockedCount : 0;
    const isLockBadge = badge === 'users' && lockedCount > 0;
    return (
      <Link to={to} style={{ textDecoration: 'none', display: 'block' }}>
        <div className={`nav-item${active ? ' nav-item-active' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Icon size={15} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: active ? 600 : 400 }}>{label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {count > 0 && (
              <span className="nav-badge" style={isLockBadge ? { background: '#da3633' } : {}}>
                {count > 99 ? '99+' : count}
              </span>
            )}
            {active && <ChevronRight size={12} style={{ opacity: 0.5 }} />}
          </div>
        </div>
      </Link>
    );
  };

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="brand-logo">
          <TrendingUp size={16} color="white" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>AyitiMarket</div>
          <div style={{ fontSize: 10, color: '#484f58', fontWeight: 500, letterSpacing: '0.04em' }}>Admin Panel</div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        <div className="nav-section-label">Principal</div>
        {NAV.filter(l => l.group === 'main').map(l => <NavItem key={l.to} {...l} />)}

        <div className="nav-divider" />

        <div className="nav-section-label">Configuration</div>
        {NAV.filter(l => l.group === 'config').map(l => <NavItem key={l.to} {...l} />)}
      </div>

      {/* Alerts */}
      {lockedCount > 0 && (
        <Link to="/users" style={{ textDecoration: 'none' }}>
          <div className="sidebar-alert" style={{ background: 'rgba(218,54,51,0.12)', borderColor: 'rgba(218,54,51,0.3)', color: '#f85149', cursor: 'pointer' }}>
            <Lock size={12} />
            <span>{lockedCount} compte{lockedCount > 1 ? 's' : ''} bloqué{lockedCount > 1 ? 's' : ''}</span>
          </div>
        </Link>
      )}
      {pendingCount > 0 && (
        <div className="sidebar-alert">
          <AlertCircle size={12} />
          <span>{pendingCount} retrait{pendingCount > 1 ? 's' : ''} en attente</span>
        </div>
      )}

      {/* Admin info */}
      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div className="avatar-sm">{admin?.username?.[0]?.toUpperCase() || 'A'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {admin?.username || 'Admin'}
            </div>
            <div style={{ fontSize: 10, color: '#484f58' }}>Administrateur</div>
          </div>
        </div>
        <button onClick={handleLogout} className="btn btn-ghost" style={{ width: '100%', fontSize: 12, gap: 6 }}>
          <LogOut size={13} /> Déconnexion
        </button>
      </div>
    </div>
  );

  return (
    <div className="admin-layout">
      {/* Mobile overlay */}
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <nav className={`admin-sidebar${open ? ' open' : ''}`}>
        <SidebarContent />
      </nav>

      {/* Main */}
      <div className="admin-main-wrap">
        {/* Sticky top bar */}
        <header className="admin-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-ghost btn-sm topbar-menu-btn" onClick={() => setOpen(o => !o)}>
              {open ? <X size={17} /> : <Menu size={17} />}
            </button>
            <div className="topbar-brand">AyitiMarket</div>
            <div className="topbar-divider" />
            <span className="topbar-page">{pageTitle}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {lockedCount > 0 && (
              <Link to="/users" style={{ textDecoration: 'none' }}>
                <button className="btn btn-ghost btn-sm" style={{ position: 'relative', color: '#f85149', borderColor: 'rgba(218,54,51,0.25)' }} title={`${lockedCount} compte${lockedCount > 1 ? 's' : ''} bloqué${lockedCount > 1 ? 's' : ''}`}>
                  <Lock size={14} />
                  <span className="topbar-notif-badge" style={{ background: '#da3633' }}>{lockedCount > 99 ? '99+' : lockedCount}</span>
                </button>
              </Link>
            )}
            {pendingCount > 0 && (
              <Link to="/transactions" style={{ textDecoration: 'none' }}>
                <button className="btn btn-ghost btn-sm" style={{ position: 'relative', color: '#f85149', borderColor: 'rgba(248,81,73,0.25)' }}>
                  <Bell size={14} />
                  <span className="topbar-notif-badge">{pendingCount}</span>
                </button>
              </Link>
            )}
            <div className="avatar-sm" style={{ cursor: 'default' }}>{admin?.username?.[0]?.toUpperCase() || 'A'}</div>
          </div>
        </header>

        {/* Page content */}
        <main className="admin-main">
          {children}
        </main>
      </div>
    </div>
  );
}
