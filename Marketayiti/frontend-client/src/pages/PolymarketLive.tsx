/**
 * MacheLive — Real-time prediction markets page
 *
 * Features:
 *  - Live market grid with animated probability bars
 *  - ACTIVE / CLOSED / RESOLVED / YES-WON / NO-WON badges
 *  - Volume, liquidity, countdown timers
 *  - Category tabs (dynamic), search, sort
 *  - WebSocket real-time: price updates, resolutions, new markets
 *  - Auto-refresh every 30 s
 *  - Mobile-responsive
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, X, Clock, RefreshCw, BarChart2,
  CheckCircle, XCircle, Zap, TrendingUp, Activity,
} from 'lucide-react';
import { polymarketsAPI, categoriesAPI } from '../api';
import { useWebSocket } from '../hooks/useRealtime';
import { useLocale } from '../hooks/useLocale';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Market {
  id: string;
  slug: string;
  title: string;
  description?: string;
  category: string;
  status: 'active' | 'closed' | 'resolved';
  end_date: string;
  yes_prob: number;
  no_prob: number;
  local_volume: number;
  liquidity?: number;
  bet_count: number;
  resolution: 'yes' | 'no' | 'invalid' | null;
  option_a?: string;
  option_b?: string;
  updated_at: string;
}

interface Stats {
  total: number;
  active: number;
  closed: number;
  resolved: number;
  total_volume?: number;
  resolved_yes: number;
  resolved_no: number;
  last_updated: string | null;
}

interface Category {
  slug: string;
  name: string;
  name_fr: string;
  icon: string;
  color: string;
  market_count: number;
}

type StatusFilter = 'active' | 'closed' | 'resolved' | 'all';
type SortKey = 'volume' | 'new' | 'ending' | 'competitive' | 'prob_desc';

// ── Formatting helpers ────────────────────────────────────────────────────────
function fmtVol(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function timeLeft(end: string): string {
  const ms = new Date(end).getTime() - Date.now();
  if (ms <= 0) return 'Ekspire';
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}j ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

// ── Viewport hook ─────────────────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 640);
    window.addEventListener('resize', fn, { passive: true });
    return () => window.removeEventListener('resize', fn);
  }, []);
  return mobile;
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status, resolution }: { status: Market['status']; resolution: Market['resolution'] }) {
  if (status === 'resolved') {
    if (resolution === 'yes') return (
      <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10, fontWeight:700,
                     background:'rgba(34,197,94,0.15)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.35)',
                     borderRadius:5, padding:'2px 7px', letterSpacing:'0.05em' }}>
        <CheckCircle size={10} /> WI GENYEN
      </span>
    );
    if (resolution === 'no') return (
      <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10, fontWeight:700,
                     background:'rgba(239,68,68,0.15)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.35)',
                     borderRadius:5, padding:'2px 7px', letterSpacing:'0.05em' }}>
        <XCircle size={10} /> NON GENYEN
      </span>
    );
    return (
      <span style={{ fontSize:10, fontWeight:700, background:'rgba(100,116,139,0.2)', color:'#94a3b8',
                     border:'1px solid rgba(100,116,139,0.3)', borderRadius:5, padding:'2px 7px' }}>
        REZOUD
      </span>
    );
  }
  if (status === 'closed') return (
    <span style={{ fontSize:10, fontWeight:700, background:'rgba(245,158,11,0.15)', color:'#f59e0b',
                   border:'1px solid rgba(245,158,11,0.3)', borderRadius:5, padding:'2px 7px' }}>
      FÈMEN
    </span>
  );
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10, fontWeight:700,
                   background:'rgba(34,197,94,0.12)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.3)',
                   borderRadius:5, padding:'2px 7px' }}>
      <span style={{ width:5, height:5, borderRadius:'50%', background:'#22c55e',
                     animation:'pulse 1.4s ease-in-out infinite', display:'inline-block' }} />
      VIV
    </span>
  );
}

// ── Probability bar ───────────────────────────────────────────────────────────
function ProbBar({
  yesProb, noProb, resolution, optionA = 'Wi', optionB = 'Non',
}: {
  yesProb: number; noProb: number;
  resolution: Market['resolution'];
  optionA?: string; optionB?: string;
}) {
  const yesPct = Math.round(yesProb * 100);
  const yesWon = resolution === 'yes';
  const noWon  = resolution === 'no';

  return (
    <div>
      {/* Bar */}
      <div style={{ height:5, borderRadius:3, background:'rgba(239,68,68,0.3)',
                    overflow:'hidden', margin:'8px 0 6px' }}>
        <div style={{ width:`${yesPct}%`, height:'100%',
                      background: yesWon ? '#22c55e' : noWon ? '#ef4444' : '#22c55e',
                      borderRadius:3, transition:'width 0.6s ease' }} />
      </div>

      {/* Labels */}
      <div style={{ display:'flex', justifyContent:'space-between', gap:6 }}>
        <span style={{
          flex:1, textAlign:'center', fontSize:12, fontWeight:700, padding:'4px 0',
          borderRadius:5, border:'1px solid',
          background: yesWon ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.07)',
          color: yesWon ? '#22c55e' : '#4ade80',
          borderColor: yesWon ? '#22c55e' : 'rgba(34,197,94,0.25)',
        }}>
          {optionA} {pct(yesProb)}
        </span>
        <span style={{
          flex:1, textAlign:'center', fontSize:12, fontWeight:700, padding:'4px 0',
          borderRadius:5, border:'1px solid',
          background: noWon ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.07)',
          color: noWon ? '#ef4444' : '#f87171',
          borderColor: noWon ? '#ef4444' : 'rgba(239,68,68,0.25)',
        }}>
          {optionB} {pct(noProb)}
        </span>
      </div>
    </div>
  );
}

// ── Market card ───────────────────────────────────────────────────────────────
function MarketCard({
  market, flash, categories,
}: {
  market: Market;
  flash: boolean;
  categories: Category[];
}) {
  const cat = categories.find(c => c.slug === market.category);

  return (
    <div style={{
      background: flash ? 'rgba(31,111,235,0.08)' : '#161b22',
      border: `1px solid ${flash ? 'rgba(31,111,235,0.4)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: 12,
      padding: '16px 18px',
      transition: 'background 0.5s ease, border-color 0.5s ease',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          {cat && (
            <span style={{ fontSize:10, fontWeight:600, color: cat.color,
                           background:`${cat.color}18`, borderRadius:4,
                           padding:'2px 6px', border:`1px solid ${cat.color}30` }}>
              {cat.icon} {cat.name}
            </span>
          )}
          <StatusBadge status={market.status} resolution={market.resolution} />
        </div>
        {market.status === 'active' && (
          <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10,
                         color:'#6e7681', whiteSpace:'nowrap', flexShrink:0 }}>
            <Clock size={10} />
            {timeLeft(market.end_date)}
          </span>
        )}
      </div>

      {/* Title */}
      <p style={{ margin:0, color:'#e6edf3', fontSize:13, fontWeight:500, lineHeight:1.5 }}>
        {market.title}
      </p>

      {/* Prob bar */}
      <ProbBar
        yesProb={market.yes_prob}
        noProb={market.no_prob}
        resolution={market.resolution}
        optionA={market.option_a}
        optionB={market.option_b}
      />

      {/* Footer — no volume displayed on user-facing page */}
      <div style={{ display:'flex', justifyContent:'flex-end', alignItems:'center' }}>
        <span style={{ fontSize:10, color:'#484f58' }}>
          {market.bet_count > 0 ? `${market.bet_count} pari` : ''}
        </span>
      </div>
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ background:'#161b22', border:'1px solid rgba(255,255,255,0.06)',
                  borderRadius:12, padding:'16px 18px' }}>
      {[80, 100, 60, 40].map((w, i) => (
        <div key={i} style={{ height:i === 1 ? 14 : 10, borderRadius:6, marginBottom:10,
                              width:`${w}%`, background:'rgba(255,255,255,0.04)',
                              animation:'shimmer 1.5s ease-in-out infinite' }} />
      ))}
    </div>
  );
}

// ── Stats card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background:'#161b22', border:'1px solid rgba(255,255,255,0.07)',
                  borderRadius:10, padding:'12px 16px', textAlign:'center', flex:1, minWidth:90 }}>
      <div style={{ fontSize:18, fontWeight:800, color: color || '#e6edf3', letterSpacing:'-0.5px' }}>
        {value}
      </div>
      <div style={{ fontSize:11, color:'#6e7681', marginTop:2 }}>{label}</div>
    </div>
  );
}

// ── Sort options ──────────────────────────────────────────────────────────────
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'volume',      label: 'Volim ↓' },
  { key: 'competitive', label: 'Konpetitif' },
  { key: 'ending',      label: 'Fini byento' },
  { key: 'new',         label: 'Nouvo' },
  { key: 'prob_desc',   label: 'Pi wo Wi' },
];

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'active',   label: 'Aktif' },
  { key: 'resolved', label: 'Rezoud' },
  { key: 'closed',   label: 'Fèmen' },
  { key: 'all',      label: 'Tout' },
];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MacheLive() {
  const { locale: lang } = useLocale();
  const isMobile = useIsMobile();

  // Data state
  const [markets,    setMarkets]    = useState<Market[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync,   setLastSync]   = useState<Date | null>(null);

  // Filters
  const [status,   setStatus]   = useState<StatusFilter>('active');
  const [category, setCategory] = useState('');
  const [sort,     setSort]     = useState<SortKey>('volume');
  const [search,   setSearch]   = useState('');

  // Flash map: marketId -> bool
  const [flashes, setFlashes] = useState<Record<string, boolean>>({});
  const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const flash = useCallback((id: string) => {
    setFlashes(f => ({ ...f, [id]: true }));
    clearTimeout(flashTimers.current[id]);
    flashTimers.current[id] = setTimeout(() => {
      setFlashes(f => ({ ...f, [id]: false }));
    }, 2000);
  }, []);

  // ── Fetch markets ──────────────────────────────────────────────────────────
  const loadMarkets = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const params: Parameters<typeof polymarketsAPI.list>[0] = {
        status, sort, limit: 300,
        ...(category ? { category } : {}),
        ...(search.trim().length >= 2 ? { search: search.trim() } : {}),
      };
      const res = await polymarketsAPI.list(params);
      setMarkets(res.data.data || []);
      setLastSync(new Date());
    } catch { /* network error — keep existing data */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [status, sort, category, search]);

  // ── Fetch stats & categories ───────────────────────────────────────────────
  useEffect(() => {
    categoriesAPI.list()
      .then(r => setCategories(r.data.data ?? []))
      .catch(() => {});
    polymarketsAPI.stats()
      .then(r => setStats(r.data))
      .catch(() => {});
  }, []);

  // Reload when filters change
  useEffect(() => { loadMarkets(); }, [loadMarkets]);

  // Auto-refresh every 30 s
  useEffect(() => {
    const t = setInterval(() => loadMarkets(true), 30_000);
    return () => clearInterval(t);
  }, [loadMarkets]);

  // ── WebSocket ──────────────────────────────────────────────────────────────
  useWebSocket({ onMessage: (msg: any) => {
    if (!msg?.type) return;

    if (msg.type === 'polymarket:sync' || msg.type === 'market:new') {
      loadMarkets(true);
      polymarketsAPI.stats().then(r => setStats(r.data)).catch(() => {});
    }

    if (msg.type === 'market:update') {
      // broadcast sends market_id at root level (not nested in data)
      const id = msg.market_id ?? msg.data?.id;
      if (!id) return;
      setMarkets(prev => prev.map(m => {
        if (m.id !== id) return m;
        flash(m.id);
        return {
          ...m,
          yes_prob:  msg.yes_prob  ?? msg.data?.yes_prob  ?? m.yes_prob,
          no_prob:   msg.no_prob   ?? msg.data?.no_prob   ?? m.no_prob,
          bet_count: msg.bet_count ?? msg.data?.bet_count ?? m.bet_count,
        };
      }));
    }

    if (msg.type === 'market:resolved') {
      const id = msg.market_id ?? msg.data?.id;
      if (!id) return;
      setMarkets(prev => prev.map(m => {
        if (m.id !== id) return m;
        flash(m.id);
        return { ...m, status: 'resolved', resolution: msg.winner ?? msg.data?.winner };
      }));
    }
  } });

  // ── Filtered / sorted markets (client-side trim) ───────────────────────────
  const displayed = useMemo(() => markets.slice(0, 500), [markets]);

  // ── UI helpers ─────────────────────────────────────────────────────────────
  const S: React.CSSProperties = { fontFamily:'Inter,system-ui,sans-serif', color:'#e6edf3' };

  return (
    <div style={{ ...S, maxWidth:1200, margin:'0 auto', padding: isMobile ? '16px 12px' : '28px 20px' }}>

      {/* ── Page header ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ margin:0, fontSize: isMobile ? 20 : 26, fontWeight:800, letterSpacing:'-0.5px' }}>
            <Activity size={20} style={{ display:'inline', marginRight:8, color:'#1f6feb' }} />
            Mache Vivan
          </h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#6e7681' }}>
            Prediksyon an tan reyèl — mize sou sa ou kwè
          </p>
        </div>
        <button
          onClick={() => loadMarkets(true)}
          disabled={refreshing}
          style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 14px',
                   background:'rgba(31,111,235,0.12)', border:'1px solid rgba(31,111,235,0.3)',
                   borderRadius:8, color:'#1f6feb', cursor:'pointer', fontSize:12, fontWeight:600 }}>
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          {refreshing ? 'Aktyalize...' : 'Aktyalize'}
        </button>
      </div>

      {/* ── Stats row ── */}
      {stats && (
        <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
          <StatCard label="Aktif"   value={stats.active}              color="#22c55e" />
          <StatCard label="Rezoud"  value={stats.resolved}            color="#8b5cf6" />
          <StatCard label="Volim"   value={fmtVol(stats.total_volume ?? 0)} color="#f59e0b" />
          <StatCard label="Total"   value={stats.total}               />
          {stats.resolved_yes > 0 && (
            <StatCard label="Wi Genyen" value={stats.resolved_yes} color="#22c55e" />
          )}
          {stats.resolved_no > 0 && (
            <StatCard label="Non Genyen" value={stats.resolved_no} color="#ef4444" />
          )}
        </div>
      )}

      {/* ── Search ── */}
      <div style={{ position:'relative', marginBottom:14 }}>
        <Search size={14} style={{ position:'absolute', left:12, top:'50%',
                                   transform:'translateY(-50%)', color:'#6e7681', pointerEvents:'none' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Chèche yon pari..."
          style={{ width:'100%', boxSizing:'border-box', background:'#161b22',
                   border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'#e6edf3',
                   fontSize:13, padding:'9px 36px', outline:'none' }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ position:'absolute', right:10, top:'50%',
                                                          transform:'translateY(-50%)', background:'none',
                                                          border:'none', cursor:'pointer', color:'#6e7681', padding:0 }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── Status tabs ── */}
      <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => setStatus(t.key)}
            style={{ padding:'5px 12px', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer',
                     border: status === t.key ? '1px solid #1f6feb' : '1px solid rgba(255,255,255,0.1)',
                     background: status === t.key ? 'rgba(31,111,235,0.2)' : 'transparent',
                     color: status === t.key ? '#1f6feb' : '#8b949e' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Category tabs ── */}
      <div style={{ display:'flex', gap:6, marginBottom:12, overflowX:'auto',
                    paddingBottom:4, scrollbarWidth:'none' }}>
        <button onClick={() => setCategory('')}
          style={{ padding:'5px 12px', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer',
                   whiteSpace:'nowrap', border: !category ? '1px solid #1f6feb' : '1px solid rgba(255,255,255,0.1)',
                   background: !category ? 'rgba(31,111,235,0.2)' : 'transparent',
                   color: !category ? '#1f6feb' : '#8b949e' }}>
          Tout
        </button>
        {categories.map(cat => (
          <button key={cat.slug} onClick={() => setCategory(c => c === cat.slug ? '' : cat.slug)}
            style={{ padding:'5px 12px', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer',
                     whiteSpace:'nowrap',
                     border: category === cat.slug ? `1px solid ${cat.color}` : '1px solid rgba(255,255,255,0.1)',
                     background: category === cat.slug ? `${cat.color}22` : 'transparent',
                     color: category === cat.slug ? cat.color : '#8b949e' }}>
            {cat.icon} {lang === 'fr' ? cat.name_fr : cat.name}
            {cat.market_count > 0 && (
              <span style={{ marginLeft:5, fontSize:10, opacity:0.7 }}>({cat.market_count})</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Sort bar ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    marginBottom:16, flexWrap:'wrap', gap:8 }}>
        <span style={{ fontSize:12, color:'#6e7681' }}>
          {loading ? 'Chajman...' : `${displayed.length} mache`}
          {lastSync && !loading && (
            <span style={{ marginLeft:8, color:'#484f58' }}>
              — Aktyalize {lastSync.toLocaleTimeString()}
            </span>
          )}
        </span>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {SORTS.map(s => (
            <button key={s.key} onClick={() => setSort(s.key)}
              style={{ padding:'4px 10px', borderRadius:6, fontSize:11, cursor:'pointer',
                       border: sort === s.key ? '1px solid #1f6feb' : '1px solid rgba(255,255,255,0.08)',
                       background: sort === s.key ? 'rgba(31,111,235,0.15)' : 'transparent',
                       color: sort === s.key ? '#1f6feb' : '#6e7681', fontWeight: sort === s.key ? 600 : 400 }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Market grid ── */}
      {loading ? (
        <div style={{ display:'grid', gap:12,
                      gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(340px,1fr))' }}>
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} />)}
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:'#6e7681' }}>
          <TrendingUp size={36} style={{ opacity:0.3, marginBottom:12 }} />
          <p style={{ margin:0, fontSize:14 }}>Pa gen mache ki koresponn ak filtè ou a.</p>
          <button onClick={() => { setSearch(''); setCategory(''); setStatus('active'); }}
            style={{ marginTop:12, padding:'8px 16px', borderRadius:8, background:'rgba(31,111,235,0.15)',
                     border:'1px solid rgba(31,111,235,0.3)', color:'#1f6feb', cursor:'pointer', fontSize:13 }}>
            Efase filtè
          </button>
        </div>
      ) : (
        <div style={{ display:'grid', gap:12,
                      gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(340px,1fr))' }}>
          {displayed.map(m => (
            <MarketCard
              key={m.id}
              market={m}
              flash={!!flashes[m.id]}
              categories={categories}
            />
          ))}
        </div>
      )}

      {/* ── CSS animations ── */}
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes shimmer { 0%,100% { opacity:0.04; } 50% { opacity:0.1; } }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
