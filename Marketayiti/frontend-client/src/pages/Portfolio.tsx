import { useState, useEffect, useMemo } from 'react';
import { Wallet, ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown, Eye, EyeOff, Filter, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { walletAPI } from '../api';
import { Link } from 'react-router-dom';
import DepositModal from '../components/wallet/DepositModal';
import WithdrawModal from '../components/wallet/WithdrawModal';

const TX_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode; sign: string }> = {
  deposit: { label: 'Depozit', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', icon: <ArrowDownLeft size={18} />, sign: '+' },
  withdrawal: { label: 'Retrè', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', icon: <ArrowUpRight size={18} />, sign: '-' },
  win: { label: 'Gain Pari', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', icon: <TrendingUp size={18} />, sign: '+' },
  bet: { label: 'Mise Pari', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', icon: <TrendingDown size={18} />, sign: '-' },
  bet_slip: { label: 'Fich Kombi', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', icon: <TrendingDown size={18} />, sign: '-' },
  refund: { label: 'Rembourseman', color: '#eab308', bg: 'rgba(234, 179, 8, 0.1)', icon: <ArrowDownLeft size={18} />, sign: '+' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'Konplè', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
  pending: { label: 'An kous', color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)' },
  rejected: { label: 'Rejte', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
  failed: { label: 'Echèk', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
};

const MONTHS = ['Janvye', 'Fevrye', 'Mas', 'Avril', 'Me', 'Jen', 'Jiyè', 'Out', 'Septanm', 'Oktòb', 'Novanm', 'Desanm'];
const PAGE_SIZE = 8;

export default function Portfolio() {
  const { user, refresh: refreshUser } = useAuth();
  const { path } = useLocale();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [page, setPage] = useState(1);
  const [showBalance, setShowBalance] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await walletAPI.getTransactions({ limit: 500 });
      let filtered = res.data || [];

      if (typeFilter) {
        filtered = filtered.filter(t => t.type === typeFilter);
      }
      if (statusFilter) {
        filtered = filtered.filter(t => t.status === statusFilter);
      }
      if (month) {
        filtered = filtered.filter(t => {
          const txMonth = new Date(t.created_at).getMonth() + 1;
          return txMonth === parseInt(month);
        });
      }
      if (year) {
        filtered = filtered.filter(t => {
          const txYear = new Date(t.created_at).getFullYear();
          return txYear === parseInt(year);
        });
      }

      setTransactions(filtered);
      setPage(1);
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
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', background: '#0d1117' }}>
        <p style={{ color: '#8b949e', fontSize: 16, marginBottom: 24 }}>Ou dwe konekte pou wè pòtfolyo ou</p>
        <Link to={path('login')} style={{
          background: 'linear-gradient(135deg, #388bfd, #1f6feb)', color: 'white', padding: '12px 28px',
          borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 14, transition: 'all 0.3s',
          boxShadow: '0 4px 20px rgba(56,139,253,0.3)', display: 'inline-block'
        }}>
          Konekte
        </Link>
      </div>
    );
  }

  return (
    <div className="portfolio-container" style={{
      background: '#0d1117',
      minHeight: '100vh',
      paddingTop: 32,
      paddingBottom: 60,
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 500,
        height: 500,
        background: 'radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)',
        borderRadius: '50%',
        pointerEvents: 'none',
        transform: 'translate(150px, -150px)',
        zIndex: 0
      }} />

      <div className="portfolio-content" style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '0 16px',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Header */}
        <div style={{
          marginBottom: 32,
          animation: 'fadeInDown 0.6s ease-out'
        }}>
          <h1 style={{
            fontSize: window.innerWidth < 640 ? 28 : 36,
            fontWeight: 700,
            color: 'white',
            margin: 0,
            letterSpacing: '-0.5px'
          }}>
            Pòtfolyo
          </h1>
          <p style={{ color: '#8b949e', fontSize: 14, margin: '8px 0 0' }}>
            Jere ak suiv aktivite finansye ou
          </p>
        </div>

        {/* Main Balance Card */}
        <div style={{
          background: '#161b22',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: window.innerWidth < 640 ? 24 : 32,
          marginBottom: 32,
          animation: 'fadeInUp 0.6s ease-out 0.1s both'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: window.innerWidth < 640 ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: window.innerWidth < 640 ? 'stretch' : 'center',
            gap: window.innerWidth < 640 ? 24 : 32
          }}>
            <div>
              <p style={{ color: '#8b949e', fontSize: 12, margin: '0 0 8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Balans Aktyèl
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <div style={{
                  fontSize: window.innerWidth < 640 ? 32 : 44,
                  fontWeight: 800,
                  color: '#22c55e',
                  fontFamily: 'JetBrains Mono, monospace',
                  letterSpacing: '-0.04em'
                }}>
                  {showBalance ? user.balance.toLocaleString() : '••••••'}
                </div>
                <span style={{ fontSize: window.innerWidth < 640 ? 18 : 24, opacity: 0.7, color: '#22c55e' }}>HTG</span>
                <button
                  onClick={() => setShowBalance(!showBalance)}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    width: 36,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#8b949e',
                    cursor: 'pointer',
                    transition: 'all 0.3s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  }}
                >
                  {showBalance ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: 12,
              flexDirection: window.innerWidth < 640 ? 'column' : 'row',
              width: window.innerWidth < 640 ? '100%' : 'auto'
            }}>
              <button
                onClick={() => setDepositOpen(true)}
                style={{
                  background: '#22c55e',
                  color: '#000',
                  padding: '12px 20px',
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  flex: window.innerWidth < 640 ? 1 : 'auto',
                  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(34, 197, 94, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)';
                }}
              >
                <ArrowDownLeft size={16} />
                Depozite
              </button>
              <button
                onClick={() => setWithdrawOpen(true)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: '#c9d1d9',
                  padding: '12px 20px',
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  flex: window.innerWidth < 640 ? 1 : 'auto'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                }}
              >
                <ArrowUpRight size={16} />
                Retrè
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: window.innerWidth < 640 ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
          marginBottom: 32,
          animation: 'fadeInUp 0.6s ease-out 0.2s both'
        }}>
          {[
            { title: 'Total Depozit', value: totalDeposits, color: '#22c55e', Icon: ArrowDownLeft },
            { title: 'Total Retrè', value: totalWithdrawals, color: '#ef4444', Icon: ArrowUpRight },
            { title: 'Total Genyen', value: totalWins, color: '#eab308', Icon: TrendingUp },
          ].map((stat, i) => (
            <div key={i} style={{
              background: '#161b22',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: 20,
              transition: 'all 0.3s',
              cursor: 'pointer'
            }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#1c2128';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#161b22';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: `${stat.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: stat.color
                }}>
                  <stat.Icon size={18} />
                </div>
                <p style={{ color: '#8b949e', fontSize: 12, margin: 0, fontWeight: 600, textTransform: 'uppercase' }}>
                  {stat.title}
                </p>
              </div>
              <p style={{
                fontSize: 22,
                fontWeight: 700,
                color: stat.color,
                fontFamily: 'JetBrains Mono, monospace',
                margin: 0
              }}>
                {stat.value.toLocaleString()} <span style={{ fontSize: 12, opacity: 0.6 }}>HTG</span>
              </p>
            </div>
          ))}
        </div>

        {/* Transactions Section */}
        <div style={{
          animation: 'fadeInUp 0.6s ease-out 0.3s both'
        }}>
          {/* Header + Filters */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: window.innerWidth < 640 ? 'stretch' : 'center',
            flexDirection: window.innerWidth < 640 ? 'column' : 'row',
            gap: 16,
            marginBottom: 20
          }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white', margin: '0 0 4px' }}>
                Istorik Transaksyon
              </h2>
              <p style={{ color: '#8b949e', fontSize: 13, margin: 0 }}>
                {transactions.length} transaksyon total
              </p>
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                background: showFilters ? 'rgba(56,139,253,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${showFilters ? 'rgba(56,139,253,0.4)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 10,
                color: showFilters ? '#388bfd' : '#8b949e',
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.3s',
                width: window.innerWidth < 640 ? '100%' : 'auto'
              }}
              onMouseEnter={(e) => {
                if (!showFilters) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                }
              }}
              onMouseLeave={(e) => {
                if (!showFilters) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                }
              }}
            >
              <Filter size={16} />
              Filtè
              <ChevronDown size={14} style={{ transition: 'all 0.3s', transform: showFilters ? 'rotate(180deg)' : 'rotate(0)' }} />
            </button>
          </div>

          {/* Filter Dropdowns */}
          {showFilters && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: window.innerWidth < 640 ? '1fr' : 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
              padding: 16,
              background: '#161b22',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              marginBottom: 20,
              animation: 'slideInDown 0.3s ease-out'
            }}>
              <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} style={{
                background: '#0d1117',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#c9d1d9',
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}>
                <option value="">Tout Tip</option>
                <option value="deposit">Depozit</option>
                <option value="withdrawal">Retrè</option>
                <option value="win">Gain Pari</option>
                <option value="bet">Mise Pari</option>
                <option value="bet_slip">Fich Kombi</option>
                <option value="refund">Rembourseman</option>
              </select>

              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={{
                background: '#0d1117',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#c9d1d9',
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}>
                <option value="">Tout Estati</option>
                <option value="completed">Konplè</option>
                <option value="pending">An kous</option>
                <option value="rejected">Rejte</option>
                <option value="failed">Echèk</option>
              </select>

              <select value={month} onChange={(e) => { setMonth(e.target.value); setPage(1); }} style={{
                background: '#0d1117',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#c9d1d9',
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}>
                <option value="">Tout mwa</option>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>

              <select value={year} onChange={(e) => { setYear(e.target.value); setPage(1); }} style={{
                background: '#0d1117',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#c9d1d9',
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}>
                <option value="">Tout ane</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          {/* Transactions List */}
          {loading ? (
            <div style={{
              textAlign: 'center',
              padding: window.innerWidth < 640 ? 60 : 100,
              color: '#64748b'
            }}>
              <div style={{
                width: 40,
                height: 40,
                border: '3px solid rgba(56,139,253,0.2)',
                borderTopColor: '#388bfd',
                borderRadius: '50%',
                margin: '0 auto 16px',
                animation: 'spin 1s linear infinite'
              }} />
              <p style={{ margin: 0, fontSize: 14 }}>Chajman transaksyon yo...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: window.innerWidth < 640 ? 60 : 100,
              color: '#64748b'
            }}>
              <Wallet size={48} style={{ opacity: 0.2, marginBottom: 16, margin: '0 auto 16px' }} />
              <p style={{ fontSize: 15, margin: 0 }}>Pa gen transaksyon ankò</p>
            </div>
          ) : (
            <>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                marginBottom: 28
              }}>
                {paginatedTransactions.map((tx, i) => {
                  const cfg = TX_CONFIG[tx.type] || { label: tx.type, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)', icon: null, sign: '' };
                  const st = STATUS_CONFIG[tx.status] || STATUS_CONFIG.completed;

                  return (
                    <div key={tx.id || i} style={{
                      background: '#161b22',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 12,
                      padding: window.innerWidth < 640 ? 16 : 20,
                      display: 'flex',
                      alignItems: 'center',
                      gap: window.innerWidth < 640 ? 12 : 16,
                      transition: 'all 0.3s',
                      animation: `fadeInUp 0.5s ease-out ${i * 0.05}s both`
                    }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#1c2128';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#161b22';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}>
                      {/* Icon */}
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: cfg.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: cfg.color,
                        flexShrink: 0
                      }}>
                        {cfg.icon}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 4 }}>
                          {cfg.label}
                        </div>
                        {tx.description && (
                          <div style={{ color: '#8b949e', fontSize: 12 }}>
                            {tx.description}
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                          {new Date(tx.created_at).toLocaleDateString('fr-HT', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </div>

                      {/* Amount */}
                      <div style={{
                        fontSize: window.innerWidth < 640 ? 13 : 15,
                        fontWeight: 700,
                        color: cfg.color,
                        fontFamily: 'JetBrains Mono, monospace',
                        whiteSpace: 'nowrap',
                        textAlign: 'right'
                      }}>
                        {cfg.sign}{Number(tx.amount).toLocaleString()}
                      </div>

                      {/* Status */}
                      <div style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 600,
                        background: st.bg,
                        color: st.color,
                        whiteSpace: 'nowrap',
                        display: window.innerWidth < 640 ? 'none' : 'block'
                      }}>
                        {st.label}
                      </div>

                      {/* Status Mobile */}
                      {window.innerWidth < 640 && (
                        <div style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: st.color
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 16,
                  padding: 20,
                  background: '#161b22',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12
                }}>
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      background: page === 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: page === 1 ? '#475569' : '#8b949e',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: page === 1 ? 'not-allowed' : 'pointer',
                      transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                      if (page !== 1) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (page !== 1) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                      }
                    }}
                  >
                    ←
                  </button>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13,
                    color: '#8b949e',
                    fontFamily: 'JetBrains Mono, monospace'
                  }}>
                    {page} / {totalPages}
                  </div>

                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(p => p + 1)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      background: page === totalPages ? 'rgba(255,255,255,0.02)' : 'rgba(56,139,253,0.15)',
                      border: `1px solid ${page === totalPages ? 'rgba(255,255,255,0.08)' : 'rgba(56,139,253,0.4)'}`,
                      color: page === totalPages ? '#475569' : '#388bfd',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: page === totalPages ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                      if (page !== totalPages) {
                        e.currentTarget.style.background = 'rgba(56,139,253,0.25)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (page !== totalPages) {
                        e.currentTarget.style.background = 'rgba(56,139,253,0.15)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }
                    }}
                  >
                    →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Deposit Modal */}
      {depositOpen && (
        <DepositModal onClose={() => {
          setDepositOpen(false);
          refreshUser?.();
          fetchTransactions();
        }} />
      )}

      {/* Withdraw Modal */}
      {withdrawOpen && (
        <WithdrawModal onClose={() => {
          setWithdrawOpen(false);
          refreshUser?.();
          fetchTransactions();
        }} />
      )}

      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .portfolio-container {
          color: #c9d1d9;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
        }

        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        select:focus {
          outline: none;
          border-color: rgba(56, 139, 253, 0.5) !important;
          box-shadow: 0 0 0 3px rgba(56, 139, 253, 0.1);
        }

        button:focus {
          outline: none;
        }
      `}</style>
    </div>
  );
}