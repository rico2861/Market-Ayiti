import { useEffect, useState } from 'react';
import { Users, BarChart2, DollarSign, TrendingUp, Activity } from 'lucide-react';
import { adminAPI } from '../api';
import AdminLayout from '../components/AdminLayout';

interface Stats {
  users: { total: number; active: number; new_this_week: number };
  markets: { total: number; active: number };
  finance: { total_volume: number; total_deposits: number; total_bets: number; volume_this_week: number };
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: `${color || '#1f6feb'}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <Icon size={18} color={color || '#1f6feb'} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: '#484f58', textTransform: 'uppercase',
          letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'white',
          fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.stats().then(r => setStats(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <AdminLayout>
      <div style={{ padding: 24 }} className="fade-in">
        <h1 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: 'white' }}>
          Dashboard
        </h1>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skel" style={{ height: 100 }} />)}
          </div>
        ) : stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 16 }}>
            <StatCard icon={Users}     label="Utilisateurs"  value={stats.users.total}
              sub={`+${stats.users.new_this_week} cette semaine`} />
            <StatCard icon={Users}     label="Actifs"        value={stats.users.active}
              color="#3fb950" />
            <StatCard icon={BarChart2} label="Marchés"       value={stats.markets.total}
              sub={`${stats.markets.active} actifs`} color="#a371f7" />
            <StatCard icon={DollarSign} label="Volume Total" color="#d29922"
              value={`${Math.floor(stats.finance.total_volume).toLocaleString()}`}
              sub="HTG" />
            <StatCard icon={TrendingUp} label="Vol. Semaine" color="#3fb950"
              value={`${Math.floor(stats.finance.volume_this_week).toLocaleString()}`}
              sub="HTG" />
            <StatCard icon={Activity} label="Total Paris"
              value={stats.finance.total_bets} color="#58a6ff" />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
