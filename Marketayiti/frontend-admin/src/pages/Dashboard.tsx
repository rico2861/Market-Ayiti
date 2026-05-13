import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, BarChart2, DollarSign, TrendingUp, Activity, RefreshCw,
  AlertCircle, Clock, Lock, ArrowUpRight, ArrowDownRight,
  Wallet, Trophy, ChevronRight, Shield, Zap,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { adminAPI } from '../api';
import AdminLayout from '../components/AdminLayout';

interface Stats {
  users:    { total: number; active: number; suspended: number; banned: number; new_this_week: number };
  markets:  { total: number; active: number; resolved: number; closed: number };
  finance:  { total_volume: number; total_deposits: number; total_withdrawals: number; total_bets: number; active_bets: number; volume_this_week: number; pending_withdrawals: number; pending_amount: number; total_bonuses: number };
  bet_slips:{ total: number; active: number; won: number };
}
interface Tx {
  id: string; user_id: string; username: string; type: string;
  amount: number; status: string; description: string; created_at: string;
}

const TYPE_META: Record<string, { label: string; color: string; sign: 1 | -1 }> = {
  deposit:    { label: 'Dépôt',    color: '#3fb950', sign:  1 },
  withdrawal: { label: 'Retrait',  color: '#f85149', sign: -1 },
  bet:        { label: 'Pari',     color: '#58a6ff', sign: -1 },
  win:        { label: 'Gain',     color: '#a371f7', sign:  1 },
  refund:     { label: 'Remb.',    color: '#d29922', sign:  1 },
  bonus:      { label: 'Bonus',    color: '#f7b731', sign:  1 },
};

function fmt(n: number) { return Math.floor(n).toLocaleString('fr-FR'); }

// Animated counter hook
function useCountUp(target: number, duration = 800) {
  const [val, setVal] = useState(0);
  const frameRef = useRef<number>();
  const startRef = useRef<number>();
  const fromRef  = useRef(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    fromRef.current = 0;
    startRef.current = undefined;
    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const p = Math.min((now - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(fromRef.current + (target - fromRef.current) * eased));
      if (p < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration]);
  return val;
}

function buildVolumeData(txs: Tx[]) {
  const map: Record<string, number> = {};
  txs.forEach(tx => {
    const d = tx.created_at.slice(0, 10);
    map[d] = (map[d] || 0) + tx.amount;
  });
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([date, volume]) => ({
    date: `${date.slice(8)}/${date.slice(5, 7)}`,
    volume: Math.floor(volume),
  }));
}

function buildTypeData(txs: Tx[]) {
  const map: Record<string, number> = {};
  txs.forEach(tx => { map[tx.type] = (map[tx.type] || 0) + tx.amount; });
  return Object.entries(map).map(([type, amount]) => ({
    type: TYPE_META[type]?.label || type,
    amount: Math.floor(amount),
    fill: TYPE_META[type]?.color || '#8b949e',
  }));
}

const TT_STYLE = {
  background: '#1c2333', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8, fontSize: 12, color: '#e6edf3',
  boxShadow: '0 8px 24px rgba(0,0,0,.4)',
};

// KPI card with animated value
function KpiCard({ icon: Icon, label, value, rawValue, sub, color = '#388bfd', trend, loading, warn, to }: {
  icon: any; label: string; value: string; rawValue?: number; sub?: string;
  color?: string; trend?: { value: string; up: boolean } | null;
  loading?: boolean; warn?: boolean; to?: string;
}) {
  const animated = useCountUp(rawValue ?? 0);
  const c = warn ? '#f85149' : color;

  if (loading) return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20, height: 110 }}>
      <div className="skel" style={{ height: 12, width: '60%', marginBottom: 12, borderRadius: 4 }} />
      <div className="skel" style={{ height: 28, width: '80%', borderRadius: 6 }} />
    </div>
  );

  const displayValue = rawValue !== undefined ? fmt(animated) : value;

  const inner = (
    <div style={{
      background: warn ? 'rgba(248,81,73,0.06)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${warn ? 'rgba(248,81,73,0.2)' : 'rgba(255,255,255,0.07)'}`,
      borderLeft: `3px solid ${c}`, borderRadius: 14,
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10,
      position: 'relative', overflow: 'hidden', transition: 'transform .15s, box-shadow .15s',
      cursor: to ? 'pointer' : 'default', height: '100%', boxSizing: 'border-box' as const,
    }}
      onMouseEnter={e => { if (to) { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,.3)'; } }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em' }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: `${c}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={15} color={c} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: warn ? '#f85149' : '#f0f6fc', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
          {rawValue !== undefined ? displayValue : value}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
          {sub && <span style={{ fontSize: 11, color: '#6b7280' }}>{sub}</span>}
          {trend && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 700, color: trend.up ? '#3fb950' : '#f85149' }}>
              {trend.up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {trend.value}
            </span>
          )}
        </div>
      </div>
      {to && <ChevronRight size={13} color="#484f58" style={{ position: 'absolute', right: 14, bottom: 16 }} />}
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link> : inner;
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#484f58', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>
      {children}
    </div>
  );
}

function AlertBanner({ icon: Icon, color, children, to, action }: { icon: any; color: string; children: React.ReactNode; to?: string; action?: string }) {
  return (
    <div style={{ background: `${color}11`, border: `1px solid ${color}33`, borderRadius: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon size={15} color={color} />
        <span style={{ fontSize: 13, color, fontWeight: 600 }}>{children}</span>
      </div>
      {to && action && (
        <Link to={to} style={{ fontSize: 12, color, textDecoration: 'none', fontWeight: 700, border: `1px solid ${color}4d`, borderRadius: 8, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 5 }}>
          {action} <ChevronRight size={12} />
        </Link>
      )}
    </div>
  );
}

function TxRow({ tx }: { tx: Tx }) {
  const meta = TYPE_META[tx.type] || { label: tx.type, color: '#8b949e', sign: 1 as 1 };
  const sign = meta.sign === 1 ? '+' : '-';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: `${meta.color}15`, border: `1px solid ${meta.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <DollarSign size={13} color={meta.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: '#e6edf3', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tx.username || tx.user_id?.slice(0, 10)}
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
          {meta.label} · {new Date(tx.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: meta.color }}>
          {sign}{fmt(tx.amount)} HTG
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2, color: tx.status === 'completed' ? '#3fb950' : tx.status === 'pending' ? '#d29922' : '#f85149' }}>
          {tx.status}
        </div>
      </div>
    </div>
  );
}

// Tabs
type Tab = 'overview' | 'finance' | 'markets';

export default function Dashboard() {
  const [stats,     setStats]     = useState<Stats | null>(null);
  const [txs,       setTxs]       = useState<Tx[]>([]);
  const [locked,    setLocked]    = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [txLoading, setTxLoading] = useState(true);
  const [tab,       setTab]       = useState<Tab>('overview');
  const [lastAt,    setLastAt]    = useState(new Date());
  const [now,       setNow]       = useState(new Date());

  const loadAll = useCallback(async () => {
    setLoading(true); setTxLoading(true);
    try {
      const [statsRes, txRes, lockedRes] = await Promise.all([
        adminAPI.stats(),
        adminAPI.getTransactions({ limit: 60 }),
        adminAPI.getLockedCount(),
      ]);
      setStats(statsRes.data);
      setTxs(txRes.data?.rows ?? txRes.data ?? []);
      setLocked(lockedRes.data?.count ?? 0);
    } catch {}
    setLoading(false); setTxLoading(false);
    setLastAt(new Date());
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { const id = setInterval(loadAll, 30_000); return () => clearInterval(id); }, [loadAll]);
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);

  const volumeData = buildVolumeData(txs);
  const typeData   = buildTypeData(txs);
  const recent     = txs.slice(0, 8);
  const s          = stats;

  const userRate = s ? Math.round((s.users.active / (s.users.total || 1)) * 100) : 0;
  const winRate  = s ? Math.round((s.bet_slips.won / (s.bet_slips.total || 1)) * 100) : 0;

  // Estimate suspicious activity count for the fraud banner
  const suspiciousCount = txs.filter(tx => tx.amount > 50000).length;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Vue d\'ensemble' },
    { id: 'finance',  label: 'Finance' },
    { id: 'markets',  label: 'Marchés & Paris' },
  ];

  return (
    <AdminLayout>
      <div style={{ padding: '24px 24px 48px', maxWidth: 1400 }} className="fade-in">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#f0f6fc', letterSpacing: '-0.02em' }}>Dashboard</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#3fb950', background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.2)', borderRadius: 20, padding: '2px 10px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3fb950', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                EN DIRECT
              </span>
              <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'JetBrains Mono, monospace' }}>
                {now.toLocaleTimeString('fr-FR')}
              </span>
              <span style={{ fontSize: 11, color: '#484f58' }}>
                · Mis à jour {lastAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          <button onClick={loadAll} className="btn btn-ghost" style={{ fontSize: 12, gap: 6 }}>
            <RefreshCw size={13} /> Actualiser
          </button>
        </div>

        {/* Alert banners */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {/* Fraud AI banner — always prominent */}
          <Link to="/fraud" style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(163,113,247,0.12) 0%, rgba(56,139,253,0.08) 100%)',
              border: '1px solid rgba(163,113,247,0.3)', borderRadius: 12,
              padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
              cursor: 'pointer', transition: 'border-color .2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(163,113,247,0.6)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(163,113,247,0.3)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(163,113,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Shield size={16} color="#a371f7" />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#a371f7', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    Détecteur IA de Fraude
                    <span style={{ fontSize: 10, background: 'rgba(163,113,247,0.2)', color: '#a371f7', border: '1px solid rgba(163,113,247,0.3)', borderRadius: 20, padding: '1px 8px', fontWeight: 600 }}>
                      <Zap size={9} style={{ display: 'inline', marginRight: 3 }} />IA
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                    {suspiciousCount > 0
                      ? `${suspiciousCount} transaction${suspiciousCount > 1 ? 's' : ''} à haut volume détectée${suspiciousCount > 1 ? 's' : ''} · Cliquer pour analyser`
                      : 'Surveillance automatique des paris et utilisateurs suspects'}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#a371f7', fontWeight: 700, border: '1px solid rgba(163,113,247,0.3)', borderRadius: 8, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 5 }}>
                Analyser <ChevronRight size={12} />
              </div>
            </div>
          </Link>

          {s && s.finance.pending_withdrawals > 0 && (
            <AlertBanner icon={AlertCircle} color="#f85149" to="/transactions" action="Traiter">
              {s.finance.pending_withdrawals} retrait{s.finance.pending_withdrawals > 1 ? 's' : ''} en attente
              <span style={{ fontWeight: 400, color: '#8b949e', marginLeft: 8 }}>· {fmt(s.finance.pending_amount)} HTG à traiter</span>
            </AlertBanner>
          )}
          {locked > 0 && (
            <AlertBanner icon={Lock} color="#f85149" to="/users" action="Voir">
              {locked} compte{locked > 1 ? 's' : ''} bloqué{locked > 1 ? 's' : ''}
              <span style={{ fontWeight: 400, color: '#8b949e', marginLeft: 8 }}>· Tentatives de connexion échouées</span>
            </AlertBanner>
          )}
        </div>

        {/* Tab navigation */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: tab === t.id ? 'rgba(255,255,255,0.08)' : 'transparent',
              border: tab === t.id ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
              borderRadius: 9, padding: '7px 18px', fontSize: 12, fontWeight: tab === t.id ? 700 : 400,
              color: tab === t.id ? '#f0f6fc' : '#6b7280', cursor: 'pointer', transition: 'all .15s',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        {tab === 'overview' && (
          <>
            <div style={{ marginBottom: 28 }}>
              <SectionLabel>Utilisateurs</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                <KpiCard loading={loading} icon={Users}       label="Total inscrits"  color="#388bfd" value={fmt(s?.users.total ?? 0)}     rawValue={s?.users.total}     sub={`+${s?.users.new_this_week ?? 0} cette semaine`} to="/users" />
                <KpiCard loading={loading} icon={Activity}    label="Comptes actifs"  color="#3fb950" value={fmt(s?.users.active ?? 0)}    rawValue={s?.users.active}    sub={`${userRate}% du total`} trend={{ value: `${userRate}%`, up: userRate > 80 }} />
                <KpiCard loading={loading} icon={AlertCircle} label="Suspendus"       color="#d29922" value={String(s?.users.suspended ?? 0)} rawValue={s?.users.suspended}  warn={(s?.users.suspended ?? 0) > 0} to="/users" />
                <KpiCard loading={loading} icon={Lock}        label="Bloqués"         color="#f85149" value={String(locked)}              rawValue={locked}              warn={locked > 0} to="/users" />
              </div>
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, marginBottom: 24 }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20, gridColumn: 'span 2' }} className="dashboard-chart-wide">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f6fc' }}>Volume quotidien</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>14 derniers jours · HTG</div>
                  </div>
                  {volumeData.length > 0 && (
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#3fb950', fontFamily: 'JetBrains Mono, monospace' }}>
                      {fmt(volumeData.reduce((a, d) => a + d.volume, 0))} HTG
                    </div>
                  )}
                </div>
                {txLoading ? <div className="skel" style={{ height: 180, borderRadius: 8 }} /> : volumeData.length === 0 ? (
                  <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#484f58', fontSize: 13 }}>Aucune donnée</div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={volumeData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#388bfd" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#388bfd" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#484f58' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: '#484f58' }} axisLine={false} tickLine={false} width={50}
                        tickFormatter={v => v >= 1000 ? `${Math.floor(v / 1000)}k` : String(v)} />
                      <Tooltip contentStyle={TT_STYLE} labelStyle={{ color: '#8b949e', marginBottom: 4 }}
                        formatter={(v: any) => [`${Number(v).toLocaleString('fr-FR')} HTG`, 'Volume']} />
                      <Area type="monotone" dataKey="volume" stroke="#388bfd" strokeWidth={2}
                        fill="url(#volGrad)" dot={false} activeDot={{ r: 5, fill: '#388bfd', strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f6fc' }}>Par type</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Volume en HTG</div>
                </div>
                {txLoading ? <div className="skel" style={{ height: 180, borderRadius: 8 }} /> : typeData.length === 0 ? (
                  <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#484f58', fontSize: 13 }}>Aucune donnée</div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={typeData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barSize={22}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="type" tick={{ fontSize: 10, fill: '#484f58' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#484f58' }} axisLine={false} tickLine={false} width={50}
                        tickFormatter={v => v >= 1000 ? `${Math.floor(v / 1000)}k` : String(v)} />
                      <Tooltip contentStyle={TT_STYLE} formatter={(v: any) => [`${Number(v).toLocaleString('fr-FR')} HTG`, 'Volume']} />
                      <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                        {typeData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Recent activity + quick stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden', gridColumn: 'span 2' }} className="dashboard-chart-wide">
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f6fc' }}>Activité récente</div>
                  <Link to="/transactions" style={{ fontSize: 12, color: '#388bfd', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    Tout voir <ChevronRight size={12} />
                  </Link>
                </div>
                {txLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="skel" style={{ height: 14, borderRadius: 4 }} />
                    </div>
                  ))
                  : recent.length === 0
                  ? <div style={{ padding: 32, textAlign: 'center', color: '#484f58', fontSize: 13 }}>Aucune transaction</div>
                  : recent.map(tx => <TxRow key={tx.id} tx={tx} />)
                }
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f6fc' }}>Récapitulatif</div>
                </div>
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {loading ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div className="skel" style={{ height: 12, width: '40%', borderRadius: 4 }} />
                      <div className="skel" style={{ height: 12, width: '25%', borderRadius: 4 }} />
                    </div>
                  )) : [
                    { label: 'Total dépôts',    val: `${fmt(s?.finance.total_deposits ?? 0)} HTG`,    color: '#3fb950' },
                    { label: 'Total retraits',   val: `${fmt(s?.finance.total_withdrawals ?? 0)} HTG`, color: '#f85149' },
                    { label: 'Total bonus',      val: `${fmt(s?.finance.total_bonuses ?? 0)} HTG`,     color: '#f7b731' },
                    { label: 'Marchés fermés',   val: String(s?.markets.closed ?? 0),                  color: '#8b949e' },
                    { label: 'Taux gagnant',     val: `${winRate}%`,                                   color: '#a371f7' },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Tab: Finance */}
        {tab === 'finance' && (
          <>
            <div style={{ marginBottom: 28 }}>
              <SectionLabel>Indicateurs financiers</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                <KpiCard loading={loading} icon={TrendingUp} label="Volume total"         color="#a371f7" value={`${fmt(s?.finance.total_volume ?? 0)} HTG`}      rawValue={s?.finance.total_volume}      sub="Depuis le début" />
                <KpiCard loading={loading} icon={TrendingUp} label="Volume 7 jours"       color="#3fb950" value={`${fmt(s?.finance.volume_this_week ?? 0)} HTG`}   rawValue={s?.finance.volume_this_week}  sub="Cette semaine" />
                <KpiCard loading={loading} icon={Wallet}     label="Dépôts totaux"        color="#3fb950" value={`${fmt(s?.finance.total_deposits ?? 0)} HTG`}     rawValue={s?.finance.total_deposits} />
                <KpiCard loading={loading} icon={ArrowDownRight} label="Retraits totaux"  color="#f85149" value={`${fmt(s?.finance.total_withdrawals ?? 0)} HTG`}  rawValue={s?.finance.total_withdrawals} />
                <KpiCard loading={loading} icon={Clock}      label="Retraits en attente"  color="#f85149" value={String(s?.finance.pending_withdrawals ?? 0)}       rawValue={s?.finance.pending_withdrawals} warn={(s?.finance.pending_withdrawals ?? 0) > 0} sub={s?.finance.pending_amount ? `${fmt(s.finance.pending_amount)} HTG` : undefined} to="/transactions" />
                <KpiCard loading={loading} icon={Trophy}     label="Bonus émis"           color="#f7b731" value={`${fmt(s?.finance.total_bonuses ?? 0)} HTG`}      rawValue={s?.finance.total_bonuses} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20, gridColumn: 'span 2' }} className="dashboard-chart-wide">
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f6fc' }}>Volume quotidien</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>14 derniers jours · HTG</div>
                </div>
                {txLoading ? <div className="skel" style={{ height: 200, borderRadius: 8 }} /> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={volumeData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="volGrad2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#a371f7" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#a371f7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#484f58' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: '#484f58' }} axisLine={false} tickLine={false} width={50} tickFormatter={v => v >= 1000 ? `${Math.floor(v / 1000)}k` : String(v)} />
                      <Tooltip contentStyle={TT_STYLE} formatter={(v: any) => [`${Number(v).toLocaleString('fr-FR')} HTG`, 'Volume']} />
                      <Area type="monotone" dataKey="volume" stroke="#a371f7" strokeWidth={2} fill="url(#volGrad2)" dot={false} activeDot={{ r: 5, fill: '#a371f7', strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f6fc' }}>Par type</div>
                </div>
                {txLoading ? <div className="skel" style={{ height: 200, borderRadius: 8 }} /> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={typeData} barSize={22}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="type" tick={{ fontSize: 10, fill: '#484f58' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#484f58' }} axisLine={false} tickLine={false} width={50} tickFormatter={v => v >= 1000 ? `${Math.floor(v / 1000)}k` : String(v)} />
                      <Tooltip contentStyle={TT_STYLE} formatter={(v: any) => [`${Number(v).toLocaleString('fr-FR')} HTG`, 'Volume']} />
                      <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                        {typeData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </>
        )}

        {/* Tab: Markets & Bets */}
        {tab === 'markets' && (
          <>
            <div style={{ marginBottom: 28 }}>
              <SectionLabel>Marchés</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                <KpiCard loading={loading} icon={BarChart2} label="Marchés actifs"   color="#58a6ff" value={String(s?.markets.active ?? 0)}   rawValue={s?.markets.active}   sub={`${s?.markets.total ?? 0} total`} to="/markets" />
                <KpiCard loading={loading} icon={BarChart2} label="Marchés résolus"  color="#3fb950" value={String(s?.markets.resolved ?? 0)}  rawValue={s?.markets.resolved} />
                <KpiCard loading={loading} icon={BarChart2} label="Marchés fermés"   color="#8b949e" value={String(s?.markets.closed ?? 0)}    rawValue={s?.markets.closed} />
                <KpiCard loading={loading} icon={BarChart2} label="Total marchés"    color="#484f58" value={String(s?.markets.total ?? 0)}     rawValue={s?.markets.total} />
              </div>
            </div>
            <div>
              <SectionLabel>Paris</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                <KpiCard loading={loading} icon={Activity} label="Paris actifs"    color="#f7b731" value={fmt(s?.finance.active_bets ?? 0)}    rawValue={s?.finance.active_bets}    sub={`${fmt(s?.finance.total_bets ?? 0)} total`} />
                <KpiCard loading={loading} icon={Activity} label="Paris total"     color="#58a6ff" value={fmt(s?.finance.total_bets ?? 0)}     rawValue={s?.finance.total_bets} />
                <KpiCard loading={loading} icon={Trophy}   label="Slips gagnants"  color="#a371f7" value={String(s?.bet_slips.won ?? 0)}       rawValue={s?.bet_slips.won}      sub={`sur ${s?.bet_slips.total ?? 0} total`} />
                <KpiCard loading={loading} icon={Trophy}   label="Taux de gain"    color="#3fb950" value={`${winRate}%`}                                                        trend={{ value: `${winRate}%`, up: winRate > 40 }} />
              </div>
            </div>
          </>
        )}

      </div>
    </AdminLayout>
  );
}
