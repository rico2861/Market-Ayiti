import { useState, useMemo } from 'react';
import { BarChart2, Filter, CheckCircle, XCircle, Clock, Calendar } from 'lucide-react';
import { useMyBets } from '../hooks/useMarkets';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { Link } from 'react-router-dom';

const STATUS_CFG = {
  active: { color: '#388bfd', bg: 'rgba(31,111,235,0.12)', label: 'Aktif', icon: <Clock size={14} strokeWidth={2.5} /> },
  won: { color: '#3fb950', bg: 'rgba(63,185,80,0.12)', label: 'Genyen', icon: <CheckCircle size={14} strokeWidth={2.5} /> },
  lost: { color: '#f85149', bg: 'rgba(248,81,73,0.12)', label: 'Pèdi', icon: <XCircle size={14} strokeWidth={2.5} /> },
  cancelled: { color: '#8b949e', bg: 'rgba(139,148,158,0.1)', label: 'Anile', icon: <Clock size={14} strokeWidth={2.5} /> },
  refunded: { color: '#8b949e', bg: 'rgba(139,148,158,0.1)', label: 'Remboure', icon: null },
};

const MONTHS = ['Janvye', 'Fevrye', 'Mas', 'Avril', 'Me', 'Jen', 'Jiyè', 'Out', 'Septanm', 'Oktòb', 'Novanm', 'Desanm'];
const PAGE_SIZE = 6;

export default function MyBets() {
  const { user, initialized } = useAuth();
  const { path } = useLocale();
  const { bets, loading } = useMyBets();
  const [filter, setFilter] = useState<'all' | 'active' | 'won' | 'lost'>('all');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  if (!initialized || loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)', paddingTop: 32, paddingBottom: 40 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
          <style>{`@keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }`}</style>
          <div style={{ height: 36, width: 180, borderRadius: 8, marginBottom: 8, background: 'linear-gradient(90deg,#21262d 25%,#30363d 50%,#21262d 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite' }} />
          <div style={{ height: 16, width: 260, borderRadius: 6, marginBottom: 28, background: 'linear-gradient(90deg,#21262d 25%,#30363d 50%,#21262d 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 32 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ height: 80, borderRadius: 12, background: 'linear-gradient(90deg,#21262d 25%,#30363d 50%,#21262d 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite' }} />
            ))}
          </div>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ height: 88, borderRadius: 12, marginBottom: 12, background: 'linear-gradient(90deg,#21262d 25%,#30363d 50%,#21262d 75%)', backgroundSize: '400px 100%', animation: `shimmer 1.4s ${i * 0.07}s infinite` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg, #388bfd, #1f6feb)', borderRadius: 16, margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }} />
          <p style={{ color: '#8b949e', marginBottom: 24, fontSize: 16 }}>Ou dwe konekte pou wè pari ou yo</p>
          <Link to={path('login')} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px',
            background: 'linear-gradient(135deg, #388bfd, #1f6feb)', color: 'white',
            borderRadius: 10, fontWeight: 600, textDecoration: 'none', transition: 'all 0.3s',
            boxShadow: '0 4px 20px rgba(56,139,253,0.3)'
          }}>
            Konekte
          </Link>
        </div>
      </div>
    );
  }

  const years = Array.from(new Set(bets.map(b => new Date(b.created_at).getFullYear()))).sort((a, b) => b - a);

  const filtered = useMemo(() => {
    let r = filter === 'all' ? bets : bets.filter(b => b.status === filter);
    if (month) r = r.filter(b => new Date(b.created_at).getMonth() + 1 === parseInt(month));
    if (year) r = r.filter(b => new Date(b.created_at).getFullYear() === parseInt(year));
    return r;
  }, [bets, filter, month, year]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Stats
  const stats = {
    total: bets.length,
    won: bets.filter(b => b.status === 'won').length,
    active: bets.filter(b => b.status === 'active').length,
    winRate: bets.filter(b => b.status === 'won').length > 0
      ? Math.round((bets.filter(b => b.status === 'won').length / bets.length) * 100)
      : 0,
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)',
      paddingTop: 32,
      paddingBottom: 40,
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 400,
        height: 400,
        background: 'radial-gradient(circle, rgba(56,139,253,0.08) 0%, transparent 70%)',
        borderRadius: '50%',
        pointerEvents: 'none',
        transform: 'translate(100px, -100px)'
      }} />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'white', margin: 0, letterSpacing: '-0.5px' }}>
                Pari Mwen
              </h1>
              <p style={{ fontSize: 14, color: '#8b949e', margin: '4px 0 0' }}>
                Jere ak suiv tout pari ou
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
            marginTop: 20
          }}>
            {[
              { label: 'Total', value: stats.total, color: '#388bfd' },
              { label: 'Genyen', value: stats.won, color: '#3fb950' },
              { label: 'Aktif', value: stats.active, color: '#d29922' },
              { label: 'Pousantaj', value: `${stats.winRate}%`, color: '#58a6ff' },
            ].map((stat, idx) => (
              <div key={idx} style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                padding: 16,
                transition: 'all 0.3s',
                cursor: 'pointer'
              }} onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }} onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}>
                <p style={{ fontSize: 12, color: '#8b949e', margin: '0 0 8px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {stat.label}
                </p>
                <p style={{ fontSize: 28, fontWeight: 700, color: stat.color, margin: 0 }}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Filters Section */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            display: 'flex',
            gap: 12,
            marginBottom: 16,
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {(['all', 'active', 'won', 'lost'] as const).map(s => {
                const count = s === 'all' ? bets.length : bets.filter(b => b.status === s).length;
                return (
                  <button
                    key={s}
                    onClick={() => { setFilter(s); setPage(1); setShowFilters(false); }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: filter === s ? 600 : 500,
                      cursor: 'pointer',
                      background: filter === s ? 'rgba(56,139,253,0.15)' : 'rgba(255,255,255,0.05)',
                      color: filter === s ? '#58a6ff' : '#8b949e',
                      border: `1px solid ${filter === s ? 'rgba(56,139,253,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      transition: 'all 0.3s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                    onMouseEnter={(e) => {
                      if (filter !== s) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (filter !== s) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                      }
                    }}
                  >
                    {s === 'all' ? 'Tout' : STATUS_CFG[s]?.label}
                    <span style={{ fontSize: 11, opacity: 0.6 }}>({count})</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                background: showFilters ? 'rgba(56,139,253,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${showFilters ? 'rgba(56,139,253,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: showFilters ? '#58a6ff' : '#8b949e',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 500,
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                if (!showFilters) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                }
              }}
              onMouseLeave={(e) => {
                if (!showFilters) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                }
              }}
            >
              <Filter size={16} />
              Avanse
            </button>
          </div>

          {/* Filter Dropdowns */}
          {showFilters && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 12,
              padding: 16,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              marginBottom: 16,
              animation: 'slideDown 0.2s ease-out'
            }}>
              <div>
                <label style={{ fontSize: 12, color: '#8b949e', display: 'block', marginBottom: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Mwa
                </label>
                <select
                  value={month}
                  onChange={e => { setMonth(e.target.value); setPage(1); }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    color: '#c9d1d9',
                    fontSize: 13,
                    cursor: 'pointer',
                    transition: 'all 0.3s'
                  }}
                >
                  <option value="">Tout mwa</option>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#8b949e', display: 'block', marginBottom: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Ane
                </label>
                <select
                  value={year}
                  onChange={e => { setYear(e.target.value); setPage(1); }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    color: '#c9d1d9',
                    fontSize: 13,
                    cursor: 'pointer',
                    transition: 'all 0.3s'
                  }}
                >
                  <option value="">Tout ane</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: 60,
            background: 'rgba(255,255,255,0.02)',
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.08)'
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
            <p style={{ color: '#8b949e', margin: 0, fontSize: 14 }}>Chajman pari yo...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 32px',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.08)'
          }}>
            <div style={{
              width: 64,
              height: 64,
              background: 'rgba(56,139,253,0.08)',
              borderRadius: 12,
              margin: '0 auto 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <BarChart2 size={32} color="#388bfd" opacity={0.5} />
            </div>
            <p style={{ color: '#8b949e', margin: 0, fontSize: 16, fontWeight: 500 }}>
              {bets.length === 0 ? "Ou pa ankò fè yon pari." : "Pa gen pari pou filtè sa a."}
            </p>
            {bets.length === 0 && (
              <Link to={path('markets')} style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 24,
                padding: '10px 24px',
                background: 'linear-gradient(135deg, #388bfd, #1f6feb)',
                color: 'white',
                borderRadius: 8,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 14,
                transition: 'all 0.3s',
                boxShadow: '0 4px 12px rgba(56,139,253,0.2)'
              }}>
                Wè mache yo →
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Bets Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 16,
              marginBottom: 32
            }}>
              {paged.map((bet, idx) => {
                const st = STATUS_CFG[bet.status] || STATUS_CFG.cancelled;
                return (
                  <div
                    key={bet.id}
                    style={{
                      background: '#161b22',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 12,
                      padding: 20,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                      transition: 'all 0.3s',
                      cursor: 'pointer',
                      animation: `fadeInUp 0.5s ease-out ${idx * 0.08}s both`
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#1c2128';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 12px 32px rgba(56,139,253,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#161b22';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div>
                      <h3 style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: 'white',
                        margin: '0 0 12px',
                        lineHeight: 1.4
                      }}>
                        {bet.market_title}
                      </h3>
                      <div style={{
                        display: 'flex',
                        gap: 8,
                        flexWrap: 'wrap',
                        alignItems: 'center'
                      }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          background: bet.option === 'yes' ? 'rgba(63,185,80,0.12)' : 'rgba(248,81,73,0.12)',
                          color: bet.option === 'yes' ? '#3fb950' : '#f85149'
                        }}>
                          {bet.option === 'yes' ? '✓ Wi' : '✗ Non'}
                        </span>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          background: st.bg,
                          color: st.color,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          {st.icon}{st.label}
                        </span>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      paddingTop: 12,
                      borderTop: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 12
                      }}>
                        <span style={{ color: '#8b949e' }}>Cote</span>
                        <span style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#388bfd',
                          fontFamily: 'JetBrains Mono, monospace'
                        }}>
                          {bet.odds_at_bet?.toFixed(2)}x
                        </span>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 12
                      }}>
                        <span style={{ color: '#8b949e', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={14} />
                          Dat
                        </span>
                        <span style={{ color: '#c9d1d9', fontSize: 12 }}>
                          {new Date(bet.created_at).toLocaleDateString('fr-HT', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    <div style={{
                      paddingTop: 12,
                      borderTop: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      <p style={{ color: '#8b949e', fontSize: 11, margin: '0 0 6px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Montan
                      </p>
                      <div style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: 'white',
                        fontFamily: 'JetBrains Mono, monospace',
                        marginBottom: 8
                      }}>
                        {bet.amount.toLocaleString()} HTG
                      </div>
                      {bet.status === 'won' && bet.actual_payout ? (
                        <p style={{ color: '#3fb950', fontWeight: 600, margin: 0, fontSize: 13 }}>
                          +{bet.actual_payout.toLocaleString()} HTG
                        </p>
                      ) : bet.status === 'active' ? (
                        <p style={{ color: '#d29922', fontWeight: 600, margin: 0, fontSize: 13 }}>
                          ~{bet.potential_payout.toLocaleString()} HTG
                        </p>
                      ) : bet.status === 'lost' ? (
                        <p style={{ color: '#f85149', fontWeight: 600, margin: 0, fontSize: 13 }}>
                          -{bet.amount.toLocaleString()} HTG
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modern Pagination - Affiche après 6 items */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 12,
                padding: '32px 24px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14,
                animation: 'slideUp 0.3s ease-out'
              }}>
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 8,
                    background: page === 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: page === 1 ? '#484f58' : '#8b949e',
                    cursor: page === 1 ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                    transition: 'all 0.3s'
                  }}
                  onMouseEnter={(e) => {
                    if (page !== 1) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (page !== 1) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                    }
                  }}
                >
                  ← Avan
                </button>

                {/* Pages numerotées */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0 16px'
                }}>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalPages > 5 && page > 3) {
                      pageNum = page - 2 + i;
                    }
                    if (pageNum > totalPages) return null;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          background: page === pageNum ? 'rgba(56,139,253,0.25)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${page === pageNum ? 'rgba(56,139,253,0.4)' : 'rgba(255,255,255,0.08)'}`,
                          color: page === pageNum ? '#58a6ff' : '#8b949e',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: page === pageNum ? 600 : 400,
                          transition: 'all 0.3s',
                          minWidth: 36
                        }}
                        onMouseEnter={(e) => {
                          if (page !== pageNum) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (page !== pageNum) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                          }
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                {/* Bouton Suivant moderne */}
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 8,
                    background: page === totalPages ? 'rgba(255,255,255,0.02)' : 'rgba(56,139,253,0.15)',
                    border: `1px solid ${page === totalPages ? 'rgba(255,255,255,0.08)' : 'rgba(56,139,253,0.4)'}`,
                    color: page === totalPages ? '#484f58' : '#388bfd',
                    cursor: page === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    transition: 'all 0.3s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                  onMouseEnter={(e) => {
                    if (page !== totalPages) {
                      e.currentTarget.style.background = 'rgba(56,139,253,0.25)';
                      e.currentTarget.style.borderColor = 'rgba(56,139,253,0.5)';
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (page !== totalPages) {
                      e.currentTarget.style.background = 'rgba(56,139,253,0.15)';
                      e.currentTarget.style.borderColor = 'rgba(56,139,253,0.4)';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }
                  }}
                >
                  Suivant
                  <span style={{ fontSize: 16 }}>→</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
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

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        select:focus {
          outline: none;
          border-color: rgba(56, 139, 253, 0.5) !important;
          box-shadow: 0 0 0 2px rgba(56, 139, 253, 0.1);
        }

        button:focus {
          outline: none;
        }
      `}</style>
    </div>
  );
}