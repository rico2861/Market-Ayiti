import { useState, useMemo } from 'react';
import { BarChart2, Filter, CheckCircle, XCircle, Clock, ChevronDown } from 'lucide-react';
import { useMyBets } from '../hooks/useMarkets';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { Link } from 'react-router-dom';

const STATUS_CFG: Record<string, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  active: { color: '#388bfd', bg: 'rgba(31,111,235,0.12)', label: 'Aktif', icon: <Clock size={11} /> },
  won: { color: '#3fb950', bg: 'rgba(63,185,80,0.12)', label: 'Genyen', icon: <CheckCircle size={11} /> },
  lost: { color: '#f85149', bg: 'rgba(248,81,73,0.12)', label: 'Pèdi', icon: <XCircle size={11} /> },
  cancelled: { color: '#8b949e', bg: 'rgba(139,148,158,0.1)', label: 'Anile', icon: null },
  refunded: { color: '#8b949e', bg: 'rgba(139,148,158,0.1)', label: 'Remboure', icon: null },
};

const MONTHS = ['Janvye', 'Fevrye', 'Mas', 'Avril', 'Me', 'Jen', 'Jiyè', 'Out', 'Septanm', 'Oktòb', 'Novanm', 'Desanm'];
const PAGE_SIZE = 20;

export default function MyBets() {
  const { user } = useAuth();
  const { path } = useLocale();
  const { bets, loading } = useMyBets();
  const [filter, setFilter] = useState<'all' | 'active' | 'won' | 'lost'>('all');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [page, setPage] = useState(1);

  if (!user) return (
    <div style={{ textAlign: 'center', padding: '60px 16px' }}>
      <p style={{ color: '#8b949e', marginBottom: 16 }}>Ou dwe konekte pou wè pari ou yo</p>
      <Link to={path('login')} className="btn-primary">Konekte</Link>
    </div>
  );

  const years = Array.from(new Set(bets.map(b => new Date(b.created_at).getFullYear()))).sort((a, b) => b - a);

  const filtered = useMemo(() => {
    let r = filter === 'all' ? bets : bets.filter(b => b.status === filter);
    if (month) r = r.filter(b => new Date(b.created_at).getMonth() + 1 === parseInt(month));
    if (year) r = r.filter(b => new Date(b.created_at).getFullYear() === parseInt(year));
    return r;
  }, [bets, filter, month, year]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const SEL: React.CSSProperties = {
    background: '#161b22', border: '1px solid rgba(255,255,255,0.1)',
    color: '#8b949e', borderRadius: 8, padding: '5px 10px', fontSize: 12, cursor: 'pointer'
  };

  return (
    <div className="container py-5 fade-in" style={{ maxWidth: 800 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 4 }}>Pari Mwen</h1>
      <p style={{ color: '#8b949e', fontSize: 13, marginBottom: 20 }}>{bets.length} pari an total</p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['all', 'active', 'won', 'lost'] as const).map(s => (
          <button key={s} onClick={() => { setFilter(s); setPage(1); }} style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
            background: filter === s ? '#1f6feb' : 'rgba(255,255,255,0.05)',
            color: filter === s ? 'white' : '#8b949e',
            border: '1px solid ' + (filter === s ? '#1f6feb' : 'rgba(255,255,255,0.1)'),
            fontWeight: filter === s ? 600 : 400
          }}>
            {s === 'all' ? 'Tout' : STATUS_CFG[s]?.label}
            {s !== 'all' && <span style={{ marginLeft: 4, opacity: 0.7 }}>({bets.filter(b => b.status === s).length})</span>}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <select value={month} onChange={e => { setMonth(e.target.value); setPage(1); }} style={SEL}>
          <option value="">Tout mwa</option>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => { setYear(e.target.value); setPage(1); }} style={SEL}>
          <option value="">Tout ane</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#8b949e' }}>Chajman pari yo...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <BarChart2 style={{ width: 44, height: 44, margin: '0 auto 12px', opacity: 0.2, display: 'block', color: '#8b949e' }} />
          <p style={{ color: '#8b949e', margin: 0 }}>
            {bets.length === 0 ? "Ou pa ankò fè yon pari." : "Pa gen pari pou filtè sa a."}
          </p>
          {bets.length === 0 && (
            <Link to={path('markets')} className="btn-primary" style={{ marginTop: 16, display: 'inline-flex' }}>
              Wè mache yo →
            </Link>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {paged.map(bet => {
              const st = STATUS_CFG[bet.status] || STATUS_CFG.cancelled;
              return (
                <div key={bet.id} style={{
                  background: '#161b22', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12, padding: '14px 16px',
                  display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start'
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 8, lineHeight: 1.4 }}>
                      {bet.market_title}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{
                        padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: bet.option === 'yes' ? 'rgba(63,185,80,0.12)' : 'rgba(248,81,73,0.12)',
                        color: bet.option === 'yes' ? '#3fb950' : '#f85149'
                      }}>{bet.option === 'yes' ? '✓ Wi' : '✗ Non'}</span>
                      <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color, display: 'flex', alignItems: 'center', gap: 3 }}>
                        {st.icon}{st.label}
                      </span>
                      <span style={{ fontSize: 11, color: '#484f58' }}>
                        Cote: <span style={{ color: '#8b949e', fontFamily: 'JetBrains Mono,monospace' }}>{bet.odds_at_bet?.toFixed(2)}</span>
                      </span>
                      <span style={{ fontSize: 11, color: '#484f58' }}>
                        {new Date(bet.created_at).toLocaleDateString('fr-HT', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'white', fontFamily: 'JetBrains Mono,monospace' }}>
                      {bet.amount.toLocaleString()} HTG
                    </div>
                    <div style={{ fontSize: 11, marginTop: 3 }}>
                      {bet.status === 'won' && bet.actual_payout ? (
                        <span style={{ color: '#3fb950', fontWeight: 600 }}>+{bet.actual_payout.toLocaleString()} HTG</span>
                      ) : bet.status === 'active' ? (
                        <span style={{ color: '#d29922' }}>~{bet.potential_payout.toLocaleString()} HTG</span>
                      ) : bet.status === 'lost' ? (
                        <span style={{ color: '#f85149' }}>-{bet.amount.toLocaleString()} HTG</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{
                padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', color: page === 1 ? '#484f58' : '#8b949e',
                cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 13
              }}>← Avan</button>
              <span style={{ color: '#8b949e', fontSize: 13, display: 'flex', alignItems: 'center' }}>
                {page} / {totalPages}
              </span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{
                padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', color: page === totalPages ? '#484f58' : '#8b949e',
                cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: 13
              }}>Apre →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
