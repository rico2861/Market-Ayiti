import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Wallet, ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown,
  Eye, EyeOff, Filter, Gift, Search, X, Copy, CheckCheck,
  ChevronLeft, ChevronRight, RefreshCw, Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { walletAPI } from '../api';
import { Link } from 'react-router-dom';
import WalletModal from '../components/wallet/WalletModal';

/* ── viewport ── */
function useVP() {
  const [w, setW] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1280);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener('resize', fn, { passive: true });
    return () => window.removeEventListener('resize', fn);
  }, []);
  return { isMobile: w < 640, isTablet: w >= 640 && w < 1024 };
}

/* ── config ── */
const TX_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode; sign: string }> = {
  deposit:    { label: 'Depozit',      color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   icon: <ArrowDownLeft size={16} />, sign: '+' },
  bonus:      { label: 'Bonus Admin',  color: '#a855f7', bg: 'rgba(168,85,247,0.1)',  icon: <Gift size={16} />,          sign: '+' },
  withdrawal: { label: 'Retrè',        color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   icon: <ArrowUpRight size={16} />,  sign: '-' },
  win:        { label: 'Gain Pari',    color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   icon: <TrendingUp size={16} />,    sign: '+' },
  bet:        { label: 'Mise Pari',    color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   icon: <TrendingDown size={16} />,  sign: '-' },
  bet_slip:   { label: 'Fich Kombi',   color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   icon: <TrendingDown size={16} />,  sign: '-' },
  refund:     { label: 'Rembourseman', color: '#eab308', bg: 'rgba(234,179,8,0.1)',   icon: <ArrowDownLeft size={16} />, sign: '+' },
};
const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'Konplè',  color: '#22c55e', bg: 'rgba(34,197,94,0.15)'  },
  pending:   { label: 'An kous', color: '#eab308', bg: 'rgba(234,179,8,0.15)'  },
  rejected:  { label: 'Rejte',   color: '#ef4444', bg: 'rgba(239,68,68,0.15)'  },
  failed:    { label: 'Echèk',   color: '#ef4444', bg: 'rgba(239,68,68,0.15)'  },
};
const MONTHS = ['Janvye','Fevrye','Mas','Avril','Me','Jen','Jiyè','Out','Septanm','Oktòb','Novanm','Desanm'];
const IS_CREDIT = (type: string) => ['deposit','bonus','win','refund'].includes(type);
const PAGE_SIZE = 10;

interface Tx {
  id: string; user_id: string; type: string; amount: number;
  balance_before: number; balance_after: number; status: string;
  description?: string; payment_method?: string; phone_number?: string;
  reference_id?: string; created_at: string;
}

/* ── Copy button ── */
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} title="Kopye ID" style={{
      background: 'none', border: 'none', cursor: 'pointer',
      color: copied ? '#22c55e' : '#8b949e', display: 'inline-flex',
      alignItems: 'center', padding: '2px 4px', borderRadius: 4, transition: 'color .2s',
    }}>
      {copied ? <CheckCheck size={13} /> : <Copy size={13} />}
    </button>
  );
}

/* ── Transaction detail modal ── */
function TxModal({ tx, onClose }: { tx: Tx; onClose: () => void }) {
  const cfg  = TX_CONFIG[tx.type] || TX_CONFIG.deposit;
  const sCfg = STATUS_CFG[tx.status] || STATUS_CFG.completed;
  const credit = IS_CREDIT(tx.type);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize: 12, color: '#8b949e', fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: '#c9d1d9', textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      backdropFilter: 'blur(4px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#161b22', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16, padding: 24, width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflowY: 'auto',
        animation: 'fadeInUp 0.2s ease-out',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color }}>
              {cfg.icon}
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'white', margin: 0 }}>{cfg.label}</p>
              <p style={{ fontSize: 11, color: '#8b949e', margin: 0 }}>{new Date(tx.created_at).toLocaleString('fr-HT', { dateStyle: 'long', timeStyle: 'short' })}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Amount */}
        <div style={{
          textAlign: 'center', padding: '20px 0', marginBottom: 8,
          background: credit ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
          borderRadius: 12, border: `1px solid ${credit ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
        }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: credit ? '#22c55e' : '#ef4444', fontFamily: 'JetBrains Mono, monospace' }}>
            {credit ? '+' : '-'}{tx.amount.toLocaleString()} HTG
          </div>
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: sCfg.bg, color: sCfg.color }}>
              {sCfg.label}
            </span>
          </div>
        </div>

        {/* Details */}
        <div style={{ marginTop: 16 }}>
          {row('ID Tranzaksyon',
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#58a6ff' }}>{tx.id}</span>
              <CopyBtn text={tx.id} />
            </span>
          )}
          {row('Tip', <span style={{ color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>)}
          {row('Balans Anvan', <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{tx.balance_before.toLocaleString()} HTG</span>)}
          {row('Balans Apre',  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{tx.balance_after.toLocaleString()} HTG</span>)}
          {tx.description && row('Deskripsyon', tx.description)}
          {tx.payment_method && row('Metòd', tx.payment_method)}
          {tx.phone_number && row('Nimewo', tx.phone_number)}
          {tx.reference_id && row('Referans',
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{tx.reference_id}</span>
          )}
          {row('Dat', new Date(tx.created_at).toLocaleString('fr-HT', { dateStyle: 'full', timeStyle: 'medium' }))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   PORTFOLIO PAGE
══════════════════════════════════════════════════════════════════════════════ */
export default function Portfolio() {
  const { user, initialized, refresh: refreshUser } = useAuth();
  const { path } = useLocale();
  const { isMobile } = useVP();
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletMode, setWalletMode] = useState<'deposit' | 'withdraw'>('deposit');

  const openWallet = (mode: 'deposit' | 'withdraw') => { setWalletMode(mode); setWalletOpen(true); };

  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchId, setSearchId] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [txLimit, setTxLimit] = useState(200);
  const [hasMore, setHasMore] = useState(false);

  // UI
  const [showBalance, setShowBalance] = useState(true);
  const [selectedTx, setSelectedTx] = useState<Tx | null>(null);

  const fetchTransactions = useCallback(async (silent = false, limit = txLimit) => {
    if (!user) return;
    if (!silent) setLoading(true); else setRefreshing(true);
    setError('');
    try {
      const res = await walletAPI.getTransactions({ limit });
      const data = Array.isArray(res.data) ? res.data : [];
      setTransactions(data);
      setHasMore(data.length === limit);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erè chajman tranzaksyon yo');
      setTransactions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, txLimit]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  // Client-side filtering (fast, no roundtrip)
  const filtered = useMemo(() => {
    let r = [...transactions];
    if (typeFilter)  r = r.filter(t => t.type === typeFilter);
    if (statusFilter) r = r.filter(t => t.status === statusFilter);
    if (searchId.trim()) {
      const q = searchId.trim().toLowerCase();
      r = r.filter(t =>
        t.id.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.reference_id || '').toLowerCase().includes(q) ||
        (t.phone_number || '').includes(q)
      );
    }
    if (month) r = r.filter(t => new Date(t.created_at).getMonth() + 1 === parseInt(month));
    if (year)  r = r.filter(t => new Date(t.created_at).getFullYear() === parseInt(year));
    return r;
  }, [transactions, typeFilter, statusFilter, searchId, month, year]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [typeFilter, statusFilter, searchId, month, year]);

  // Stats
  const stats = useMemo(() => ({
    totalDeposits:    transactions.filter(t => t.type === 'deposit' && t.status === 'completed').reduce((s, t) => s + t.amount, 0),
    totalBonus:       transactions.filter(t => t.type === 'bonus' && t.status === 'completed').reduce((s, t) => s + t.amount, 0),
    totalWithdrawals: transactions.filter(t => t.type === 'withdrawal' && t.status === 'completed').reduce((s, t) => s + t.amount, 0),
    totalWins:        transactions.filter(t => t.type === 'win').reduce((s, t) => s + t.amount, 0),
    totalBets:        transactions.filter(t => ['bet','bet_slip'].includes(t.type)).reduce((s, t) => s + t.amount, 0),
    pending:          transactions.filter(t => t.status === 'pending').length,
  }), [transactions]);

  const years = useMemo(() =>
    [...new Set(transactions.map(t => new Date(t.created_at).getFullYear()))].sort((a, b) => b - a),
    [transactions]
  );

  if (!initialized || (initialized && user && loading)) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d1117', padding: '32px 16px' }}>
        <style>{`@keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }`}</style>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ height: 36, width: 200, borderRadius: 8, marginBottom: 8, background: 'linear-gradient(90deg,#21262d 25%,#30363d 50%,#21262d 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite' }} />
          <div style={{ height: 16, width: 140, borderRadius: 6, marginBottom: 28, background: 'linear-gradient(90deg,#21262d 25%,#30363d 50%,#21262d 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 28 }}>
            {[1,2,3].map(i => <div key={i} style={{ height: 90, borderRadius: 12, background: 'linear-gradient(90deg,#21262d 25%,#30363d 50%,#21262d 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite' }} />)}
          </div>
          {[1,2,3,4,5,6,7].map(i => (
            <div key={i} style={{ height: 56, borderRadius: 10, marginBottom: 8, background: 'linear-gradient(90deg,#21262d 25%,#30363d 50%,#21262d 75%)', backgroundSize: '400px 100%', animation: `shimmer 1.4s ${i * 0.06}s infinite` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', background: '#0d1117' }}>
        <Wallet size={48} color="#388bfd" style={{ marginBottom: 24, opacity: 0.4 }} />
        <p style={{ color: '#8b949e', fontSize: 16, marginBottom: 24 }}>Ou dwe konekte pou wè pòtfolyo ou</p>
        <Link to={path('login')} style={{
          background: 'linear-gradient(135deg, #388bfd, #1f6feb)', color: 'white', padding: '12px 28px',
          borderRadius: 10, textDecoration: 'none', fontWeight: 600,
        }}>Konekte</Link>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn    { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin      { to { transform: rotate(360deg); } }
        .tx-row { transition: background .15s; }
        .tx-row:hover { background: rgba(255,255,255,0.04) !important; cursor: pointer; }
        .filter-chip { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 6px 12px; color: #8b949e; font-size: 12px; cursor: pointer; transition: all .2s; }
        .filter-chip.active { background: rgba(56,139,253,0.15); border-color: rgba(56,139,253,0.4); color: #58a6ff; font-weight: 600; }
        .filter-chip:hover:not(.active) { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.14); color: #c9d1d9; }
      `}</style>

      {/* Transaction detail modal */}
      {selectedTx && <TxModal tx={selectedTx} onClose={() => setSelectedTx(null)} />}

      {/* Wallet Modal */}
      {walletOpen && (
        <WalletModal
          initialMode={walletMode}
          onClose={() => { setWalletOpen(false); refreshUser(); fetchTransactions(true); }}
        />
      )}

      <div style={{ background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)', minHeight: '100vh', paddingTop: 32, paddingBottom: 80 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px' }}>

          {/* ── HEADER ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ fontSize: isMobile ? 24 : 30, fontWeight: 800, color: 'white', margin: 0 }}>Pòtfolyo</h1>
              <p style={{ color: '#8b949e', fontSize: 13, margin: '4px 0 0' }}>Jere ak suiv aktivite finansye ou</p>
            </div>
            <button onClick={() => fetchTransactions(true)} style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#8b949e', borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, transition: 'all .2s',
            }}>
              <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              {refreshing ? 'Rafrechisman...' : 'Rafrechir'}
            </button>
          </div>

          {/* ── BALANCE CARD ── */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(56,139,253,0.12) 0%, rgba(34,197,94,0.07) 100%)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20,
            padding: isMobile ? 20 : 28, marginBottom: 24,
            animation: 'fadeInUp 0.4s ease-out',
          }}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: 20 }}>
              <div>
                <p style={{ color: '#8b949e', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 8px' }}>Balans Aktyèl</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontSize: isMobile ? 36 : 48, fontWeight: 800, color: '#22c55e', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.04em' }}>
                    {showBalance ? (user.balance || 0).toLocaleString() : '••••••'}
                  </span>
                  <span style={{ fontSize: 18, opacity: 0.6, color: '#22c55e' }}>HTG</span>
                  <button onClick={() => setShowBalance(v => !v)} style={{
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#8b949e', cursor: 'pointer',
                  }}>
                    {showBalance ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </div>
                {(user.bonus_balance ?? 0) > 0 && (
                  <p style={{ color: '#c084fc', fontSize: 12, margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Gift size={12} style={{ color: '#c084fc' }} />
                    Bonus: {showBalance ? Math.floor(user.bonus_balance).toLocaleString() : '••••'} HTG
                  </p>
                )}
                {stats.pending > 0 && (
                  <p style={{ color: '#eab308', fontSize: 12, margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#eab308', display: 'inline-block', animation: 'spin 2s linear infinite' }} />
                    {stats.pending} tranzaksyon an kous
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, flexDirection: isMobile ? 'column' : 'row' }}>
                <button onClick={() => openWallet('deposit')} style={{
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white',
                  padding: '12px 20px', borderRadius: 10, fontWeight: 700, fontSize: 14,
                  display: 'flex', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(34,197,94,0.3)', transition: 'all .2s',
                }}>
                  <ArrowDownLeft size={16} /> Depozite
                </button>
                <button onClick={() => openWallet('withdraw')} style={{
                  background: 'rgba(255,255,255,0.06)', color: '#c9d1d9',
                  padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14,
                  display: 'flex', alignItems: 'center', gap: 8,
                  border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', transition: 'all .2s',
                }}>
                  <ArrowUpRight size={16} /> Retrè
                </button>
              </div>
            </div>
          </div>

          {/* ── STATS GRID ── */}
          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)',
            gap: 12, marginBottom: 28, animation: 'fadeInUp 0.5s ease-out 0.1s both',
          }}>
            {[
              { label: 'Total Depozit',  value: stats.totalDeposits,    color: '#22c55e', Icon: ArrowDownLeft },
              { label: 'Bonus Disponib', value: user.bonus_balance ?? 0,  color: '#a855f7', Icon: Gift          },
              { label: 'Total Genyen',   value: stats.totalWins,         color: '#eab308', Icon: TrendingUp    },
              { label: 'Total Mise',     value: stats.totalBets,         color: '#58a6ff', Icon: TrendingDown  },
            ].map((s, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12, padding: isMobile ? '14px 12px' : 18, transition: 'all .2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
                    <s.Icon size={15} />
                  </div>
                  <p style={{ color: '#8b949e', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', margin: 0 }}>{s.label}</p>
                </div>
                <p style={{ fontSize: isMobile ? 16 : 20, fontWeight: 800, color: s.color, margin: 0, fontFamily: 'JetBrains Mono, monospace' }}>
                  {s.value.toLocaleString()}
                  <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 3 }}>HTG</span>
                </p>
              </div>
            ))}
          </div>

          {/* ── TRANSACTIONS ── */}
          <div style={{ animation: 'fadeInUp 0.5s ease-out 0.2s both' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: 0 }}>Istorik Transaksyon</h2>
                <p style={{ fontSize: 12, color: '#8b949e', margin: '3px 0 0' }}>
                  {filtered.length} transaksyon total
                  {transactions.length !== filtered.length && ` (filtre sou ${transactions.length})`}
                </p>
              </div>
              <button onClick={() => setShowFilters(v => !v)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                background: showFilters ? 'rgba(56,139,253,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${showFilters ? 'rgba(56,139,253,0.4)' : 'rgba(255,255,255,0.1)'}`,
                color: showFilters ? '#58a6ff' : '#8b949e', borderRadius: 8, cursor: 'pointer', fontSize: 12, transition: 'all .2s',
              }}>
                <Filter size={13} /> Filtè {(typeFilter || statusFilter || searchId || month || year) ? '●' : ''}
              </button>
            </div>

            {/* Filter panel */}
            {showFilters && (
              <div style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12, padding: 16, marginBottom: 16, animation: 'fadeIn .2s ease-out',
              }}>
                {/* Search by ID */}
                <div style={{ position: 'relative', marginBottom: 12 }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#484f58', pointerEvents: 'none' }} />
                  <input
                    value={searchId}
                    onChange={e => setSearchId(e.target.value)}
                    placeholder="Chèche pa ID, deskripsyon, nimewo..."
                    style={{
                      width: '100%', paddingLeft: 32, padding: '9px 12px 9px 32px',
                      background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8, color: '#c9d1d9', fontSize: 12, boxSizing: 'border-box',
                    }}
                  />
                  {searchId && (
                    <button onClick={() => setSearchId('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer' }}>
                      <X size={13} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  {/* Type chips */}
                  {[{ v: '', l: 'Tout' }, { v: 'deposit', l: 'Depozit' }, { v: 'bonus', l: 'Bonus' }, { v: 'withdrawal', l: 'Retrè' }, { v: 'bet', l: 'Pari' }, { v: 'win', l: 'Genyen' }, { v: 'refund', l: 'Rembourseman' }].map(({ v, l }) => (
                    <button key={v} onClick={() => setTypeFilter(v)} className={`filter-chip${typeFilter === v ? ' active' : ''}`}>{l}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {/* Status + date chips */}
                  {[{ v: '', l: 'Tout Stati' }, { v: 'completed', l: 'Konplè' }, { v: 'pending', l: 'An kous' }, { v: 'rejected', l: 'Rejte' }].map(({ v, l }) => (
                    <button key={v} onClick={() => setStatusFilter(v)} className={`filter-chip${statusFilter === v ? ' active' : ''}`}>{l}</button>
                  ))}
                  <select value={month} onChange={e => setMonth(e.target.value)} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#8b949e', fontSize: 12, padding: '6px 10px' }}>
                    <option value="">Tout mwa</option>
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                  <select value={year} onChange={e => setYear(e.target.value)} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#8b949e', fontSize: 12, padding: '6px 10px' }}>
                    <option value="">Tout ane</option>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  {(typeFilter || statusFilter || searchId || month || year) && (
                    <button onClick={() => { setTypeFilter(''); setStatusFilter(''); setSearchId(''); setMonth(''); setYear(''); }} className="filter-chip" style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                      Efase tout
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── TABLE / CARDS ── */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <div style={{ width: 36, height: 36, border: '3px solid rgba(56,139,253,0.2)', borderTopColor: '#388bfd', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
                <p style={{ color: '#8b949e', margin: 0, fontSize: 13 }}>Chajman tranzaksyon yo...</p>
              </div>
            ) : error ? (
              <div style={{ textAlign: 'center', padding: 40, background: 'rgba(239,68,68,0.05)', borderRadius: 12, border: '1px solid rgba(239,68,68,0.15)' }}>
                <p style={{ color: '#ef4444', margin: 0 }}>{error}</p>
                <button onClick={() => fetchTransactions()} style={{ marginTop: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
                  Eseye ankò
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: 14, border: '1px dashed rgba(255,255,255,0.08)' }}>
                <Wallet size={44} style={{ margin: '0 auto 16px', display: 'block', color: '#8b949e', opacity: 0.2 }} />
                <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>
                  {transactions.length === 0 ? 'Pa gen tranzaksyon ankò. Fè premye depozit ou!' : 'Pa gen rezilta pou filtè sa a.'}
                </p>
                {transactions.length === 0 && (
                  <button onClick={() => openWallet('deposit')} style={{
                    marginTop: 20, background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    color: 'white', padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600,
                  }}>
                    Depozite Kounye
                  </button>
                )}
              </div>
            ) : isMobile ? (
              /* ── MOBILE: card list ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {paged.map(tx => {
                  const cfg = TX_CONFIG[tx.type] || TX_CONFIG.deposit;
                  const sCfg = STATUS_CFG[tx.status] || STATUS_CFG.completed;
                  const credit = IS_CREDIT(tx.type);
                  return (
                    <div key={tx.id} onClick={() => setSelectedTx(tx)} style={{
                      background: '#161b22', border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 12, padding: 14, cursor: 'pointer', transition: 'all .15s',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 9, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color, flexShrink: 0 }}>
                            {cfg.icon}
                          </div>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: 'white', margin: 0 }}>{cfg.label}</p>
                            <p style={{ fontSize: 10, color: '#484f58', margin: 0, fontFamily: 'JetBrains Mono, monospace' }}>{tx.id.slice(0, 12)}…</p>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: 15, fontWeight: 800, color: credit ? '#22c55e' : '#ef4444', margin: 0, fontFamily: 'JetBrains Mono, monospace' }}>
                            {credit ? '+' : '-'}{tx.amount.toLocaleString()}
                          </p>
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: sCfg.bg, color: sCfg.color, fontWeight: 600 }}>{sCfg.label}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ fontSize: 10, color: '#8b949e', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                          {tx.description || '—'}
                        </p>
                        <p style={{ fontSize: 10, color: '#484f58', margin: 0, whiteSpace: 'nowrap' }}>
                          {new Date(tx.created_at).toLocaleDateString('fr-HT', { day: '2-digit', month: 'short' })}
                          {' '}{new Date(tx.created_at).toLocaleTimeString('fr-HT', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ── DESKTOP: table ── */
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      {['ID / Deskripsyon', 'Tip', 'Montan', 'Balans', 'Stati', 'Dat', ''].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#484f58', textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map(tx => {
                      const cfg  = TX_CONFIG[tx.type]  || TX_CONFIG.deposit;
                      const sCfg = STATUS_CFG[tx.status] || STATUS_CFG.completed;
                      const credit = IS_CREDIT(tx.type);
                      return (
                        <tr key={tx.id} className="tx-row" onClick={() => setSelectedTx(tx)} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#58a6ff' }}>{tx.id.slice(0, 8)}…</span>
                              <CopyBtn text={tx.id} />
                            </div>
                            {tx.description && (
                              <div style={{ fontSize: 11, color: '#484f58', marginTop: 2, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {tx.description}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <div style={{ width: 28, height: 28, borderRadius: 7, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color, flexShrink: 0 }}>
                                {cfg.icon}
                              </div>
                              <span style={{ fontSize: 12, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 800, color: credit ? '#22c55e' : '#ef4444', whiteSpace: 'nowrap' }}>
                            {credit ? '+' : '-'}{tx.amount.toLocaleString()} HTG
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 11, color: '#8b949e', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>
                            {tx.balance_before.toLocaleString()} → {tx.balance_after.toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: sCfg.bg, color: sCfg.color }}>{sCfg.label}</span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 11, color: '#8b949e', whiteSpace: 'nowrap' }}>
                            {new Date(tx.created_at).toLocaleDateString('fr-HT', { day: '2-digit', month: 'short', year: '2-digit' })}
                            <br />
                            <span style={{ fontSize: 10, color: '#484f58' }}>
                              {new Date(tx.created_at).toLocaleTimeString('fr-HT', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <button style={{ background: 'rgba(255,255,255,0.04)', border: 'none', color: '#8b949e', cursor: 'pointer', borderRadius: 6, padding: '5px 8px', display: 'flex', alignItems: 'center' }}>
                              <Info size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── PAGINATION ── */}
            {totalPages > 1 && !loading && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#484f58' }}>
                  Paj {page}/{totalPages} · {filtered.length} rezilta
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: page === 1 ? '#484f58' : '#8b949e', borderRadius: 7, padding: '6px 12px', cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}>
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let n = i + 1;
                    if (totalPages > 5 && page > 3) n = page - 2 + i;
                    if (n > totalPages) return null;
                    return (
                      <button key={n} onClick={() => setPage(n)} style={{
                        background: n === page ? 'rgba(56,139,253,0.2)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${n === page ? 'rgba(56,139,253,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        color: n === page ? '#58a6ff' : '#8b949e', borderRadius: 7, padding: '6px 11px', cursor: 'pointer', fontSize: 12, fontWeight: n === page ? 700 : 400,
                      }}>{n}</button>
                    );
                  })}
                  <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: page === totalPages ? '#484f58' : '#8b949e', borderRadius: 7, padding: '6px 12px', cursor: page === totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Load more — visible only when server has more than current limit */}
            {hasMore && !loading && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                <button
                  onClick={() => {
                    const next = txLimit + 200;
                    setTxLimit(next);
                    fetchTransactions(true, next);
                  }}
                  style={{
                    background: 'rgba(56,139,253,0.08)', border: '1px solid rgba(56,139,253,0.2)',
                    color: '#58a6ff', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 13,
                  }}
                >
                  Chaje plis tranzaksyon
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
