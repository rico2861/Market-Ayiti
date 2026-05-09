import { useState, useEffect, useMemo } from 'react';
import { Wallet, ArrowUpCircle, ArrowDownCircle, TrendingUp, TrendingDown, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { walletAPI } from '../api';
import { Link } from 'react-router-dom';
import WalletModal from '../components/wallet/WalletModal';

const TX_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; sign: string }> = {
  deposit: { label: 'Depozit', color: '#22c55e', icon: <ArrowDownCircle size={20} />, sign: '+' },
  withdrawal: { label: 'Retrè', color: '#ef4444', icon: <ArrowUpCircle size={20} />, sign: '-' },
  win: { label: 'Gain Pari', color: '#22c55e', icon: <TrendingUp size={20} />, sign: '+' },
  bet: { label: 'Mise Pari', color: '#ef4444', icon: <TrendingDown size={20} />, sign: '-' },
  bet_slip: { label: 'Fich Kombi', color: '#ef4444', icon: <TrendingDown size={20} />, sign: '-' },
  refund: { label: 'Rembourseman', color: '#eab308', icon: <ArrowDownCircle size={20} />, sign: '+' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'Konplè', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
  pending: { label: 'An kous', color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)' },
  rejected: { label: 'Rejte', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
  failed: { label: 'Echèk', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
};

const MONTHS = ['Janvye', 'Fevrye', 'Mas', 'Avril', 'Me', 'Jen', 'Jiyè', 'Out', 'Septanm', 'Oktòb', 'Novanm', 'Desanm'];
const PAGE_SIZE = 5;

export default function Portfolio() {
  const { user, refresh: refreshUser } = useAuth();
  const { path } = useLocale();
  const [walletOpen, setWalletOpen] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [page, setPage] = useState(1);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 200 };
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;
      if (month) params.month = month;
      if (year) params.year = year;

      const res = await walletAPI.getTransactions(params);
      setTransactions(res.data || []);
      setPage(1); // Reset to first page when filters change
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchTransactions();
  }, [user, typeFilter, statusFilter, month, year]);

  const years = useMemo(() =>
    Array.from(new Set(transactions.map(t => new Date(t.created_at).getFullYear())))
      .sort((a, b) => b - a), [transactions]
  );

  const totalDeposits = transactions.filter(t => t.type === 'deposit' && t.status === 'completed')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalWithdrawals = transactions.filter(t => t.type === 'withdrawal' && t.status === 'completed')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalWins = transactions.filter(t => t.type === 'win')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalPages = Math.ceil(transactions.length / PAGE_SIZE);
  const paginatedTransactions = transactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '140px 20px', background: '#0d1117' }}>
        <p style={{ color: '#8b949e', fontSize: 17, marginBottom: 28 }}>Ou dwe konekte pou wè pòtfolyo ou</p>
        <Link to={path('login')} style={{
          background: '#1f6feb', color: 'white', padding: '16px 36px',
          borderRadius: 14, textDecoration: 'none', fontWeight: 600, fontSize: 16
        }}>
          Konekte
        </Link>
      </div>
    );
  }

  return (
    <div style={{ background: '#0d1117', minHeight: '100vh', paddingBottom: '120px' }} className="fade-in">
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{
            fontSize: 38,
            fontWeight: 800,
            background: 'linear-gradient(90deg, #ffffff, #a1a1aa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0
          }}>
            Pòtfolyo
          </h1>
          <p style={{ color: '#8b949e', fontSize: 16, marginTop: 6 }}>Jere lajan ou ak tout aktivite finansye yo</p>
        </div>

        {/* Balance Card */}
        <div style={{
          background: 'linear-gradient(135deg, #1e2937 0%, #0f172a 100%)',
          border: '1px solid rgba(148, 163, 184, 0.15)',
          borderRadius: 24,
          padding: '32px 28px',
          marginBottom: 40,
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 20, right: 20, opacity: 0.08, fontSize: 140 }}>💰</div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
            <div>
              <div style={{ color: '#94a3b8', fontSize: 14, letterSpacing: '1px' }}>BALANS AKTYÈL</div>
              <div style={{
                fontSize: 52,
                fontWeight: 800,
                color: '#22c55e',
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '-0.04em',
                marginTop: 8
              }}>
                {user.balance.toLocaleString()} <span style={{ fontSize: 26, opacity: 0.7 }}>HTG</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setWalletOpen(true)} style={{
                background: '#22c55e', color: '#000', padding: '16px 32px', borderRadius: 16,
                fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 10, border: 'none'
              }}>
                <ArrowDownCircle size={22} /> Depozite
              </button>
              <button onClick={() => setWalletOpen(true)} style={{
                background: 'transparent', color: 'white', padding: '16px 32px', borderRadius: 16,
                fontWeight: 600, fontSize: 16, border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: 10
              }}>
                <ArrowUpCircle size={22} /> Retrè
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 40 }}>
          {[
            { title: "Total Depozit", value: totalDeposits, color: "#22c55e" },
            { title: "Total Retrè", value: totalWithdrawals, color: "#ef4444" },
            { title: "Total Genyen", value: totalWins, color: "#eab308" },
          ].map((stat, i) => (
            <div key={i} style={{
              background: '#161b22', border: '1px solid #30363d', borderRadius: 20,
              padding: '24px 26px'
            }}>
              <div style={{ color: '#8b949e', fontSize: 14 }}>{stat.title}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: stat.color, fontFamily: 'JetBrains Mono, monospace', marginTop: 10 }}>
                {stat.value.toLocaleString()} HTG
              </div>
            </div>
          ))}
        </div>

        {/* Filters + Info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0 }}>Istorik Transaksyon</h2>
            <p style={{ color: '#8b949e', fontSize: 14, marginTop: 4 }}>
              {transactions.length} transaksyon total
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} style={{
              background: '#161b22', border: '1px solid #30363d', color: '#cbd5e1', padding: '10px 16px', borderRadius: 12, fontSize: 14
            }}>
              <option value="">Tout Tip</option>
              {Object.keys(TX_CONFIG).map(k => <option key={k} value={k}>{TX_CONFIG[k].label}</option>)}
            </select>

            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={{
              background: '#161b22', border: '1px solid #30363d', color: '#cbd5e1', padding: '10px 16px', borderRadius: 12, fontSize: 14
            }}>
              <option value="">Tout Estati</option>
              <option value="completed">Konplè</option>
              <option value="pending">An kous</option>
              <option value="rejected">Rejte</option>
            </select>

            <select value={month} onChange={(e) => { setMonth(e.target.value); setPage(1); }} style={{
              background: '#161b22', border: '1px solid #30363d', color: '#cbd5e1', padding: '10px 16px', borderRadius: 12, fontSize: 14
            }}>
              <option value="">Tout mwa</option>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>

            <select value={year} onChange={(e) => { setYear(e.target.value); setPage(1); }} style={{
              background: '#161b22', border: '1px solid #30363d', color: '#cbd5e1', padding: '10px 16px', borderRadius: 12, fontSize: 14
            }}>
              <option value="">Tout ane</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Transactions List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px 20px', color: '#64748b' }}>
            <Clock size={42} style={{ animation: 'spin 1.4s linear infinite', marginBottom: 20 }} />
            <p>Chajman transaksyon yo...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '120px 20px', color: '#64748b' }}>
            <Wallet size={70} style={{ opacity: 0.15, marginBottom: 20 }} />
            <p style={{ fontSize: 17 }}>Pa gen transaksyon ankò</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {paginatedTransactions.map((tx, i) => {
                const cfg = TX_CONFIG[tx.type] || { label: tx.type, color: '#94a3b8', icon: null, sign: '' };
                const st = STATUS_CONFIG[tx.status] || STATUS_CONFIG.completed;

                return (
                  <div key={tx.id || i} style={{
                    background: '#161b22',
                    border: '1px solid #1f2937',
                    borderRadius: 20,
                    padding: '22px 26px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 20,
                    transition: 'all 0.25s ease'
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#22c55e'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#1f2937'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    <div style={{ color: cfg.color }}>{cfg.icon}</div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16.5, fontWeight: 600, color: 'white' }}>{cfg.label}</div>
                      {tx.description && <div style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>{tx.description}</div>}
                    </div>

                    <div style={{ textAlign: 'right', minWidth: 150 }}>
                      <div style={{ fontSize: 18.5, fontWeight: 700, color: cfg.color, fontFamily: 'JetBrains Mono, monospace' }}>
                        {cfg.sign}{Number(tx.amount).toLocaleString()} HTG
                      </div>
                      <div style={{ fontSize: 13.5, color: '#64748b', marginTop: 4 }}>
                        {new Date(tx.created_at).toLocaleDateString('fr-HT', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </div>

                    <div style={{
                      padding: '8px 20px',
                      borderRadius: 9999,
                      fontSize: 13.5,
                      fontWeight: 600,
                      background: st.bg,
                      color: st.color,
                      whiteSpace: 'nowrap'
                    }}>
                      {st.label}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 40 }}>
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: '#161b22', border: '1px solid #30363d',
                    color: page === 1 ? '#475569' : '#cbd5e1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: page === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <ChevronLeft size={20} />
                </button>

                <span style={{ color: '#8b949e', fontFamily: 'JetBrains Mono, monospace', fontSize: 15 }}>
                  Paj {page} sou {totalPages}
                </span>

                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: '#161b22', border: '1px solid #30363d',
                    color: page === totalPages ? '#475569' : '#cbd5e1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: page === totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </>
        )}

        {walletOpen && (
          <WalletModal onClose={() => {
            setWalletOpen(false);
            refreshUser?.();
            fetchTransactions();
          }} />
        )}
      </div>
    </div>
  );
}