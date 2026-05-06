import { Link, useLocation, useNavigate } from 'react-router-dom';
import { TrendingUp, LayoutDashboard, BarChart2, Users, ArrowLeftRight, LogOut } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import clsx from 'clsx';

const LINKS = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/markets',      icon: BarChart2,        label: 'Marchés' },
  { to: '/users',        icon: Users,            label: 'Utilisateurs' },
  { to: '/transactions', icon: ArrowLeftRight,   label: 'Transactions' },
  { to: '/categories',   icon: LayoutDashboard, label: 'Catégories' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { admin, logout } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <nav style={{
        width: 220, flexShrink: 0,
        background: '#161b22',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh', overflow: 'auto'
      }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: '#1f6feb',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={14} color="white" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>AyitiMarket</div>
              <div style={{ fontSize: 10, color: '#484f58' }}>Admin Panel</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, padding: '8px 8px' }}>
          {LINKS.map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 8, marginBottom: 2,
                background: location.pathname === to || location.pathname.startsWith(to + '/')
                  ? 'rgba(31,111,235,0.12)' : 'none',
                color: location.pathname.startsWith(to)
                  ? '#388bfd' : '#8b949e',
                fontSize: 13, fontWeight: 500,
                cursor: 'pointer', transition: 'all .15s'
              }}>
                <Icon size={15} />
                {label}
              </div>
            </Link>
          ))}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8 }}>
            {admin?.username} <span style={{ color: '#484f58' }}>· admin</span>
          </div>
          <button onClick={handleLogout} className="btn btn-ghost" style={{ width: '100%', fontSize: 12 }}>
            <LogOut size={13} /> Déconnexion
          </button>
        </div>
      </nav>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
