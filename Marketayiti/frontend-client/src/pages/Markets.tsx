import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, X, BarChart2, Vote, Trophy, Music, Users,
  Grid3X3, Zap, BookOpen, Bitcoin, Cpu, Globe, Flame,
  TrendingUp, Layers,
} from 'lucide-react';
import { useMarkets } from '../hooks/useMarkets';
import { useWebSocket } from '../hooks/useRealtime';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../hooks/useLocale';
import MarketCard from '../components/market/MarketCard';
import { marketsAPI, categoriesAPI } from '../api';
import type { MarketFilters } from '../types';

/* ─── viewport ─────────────────────────────────────────────────────────────── */
function useVP() {
  const [w, setW] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1280);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener('resize', fn, { passive: true });
    return () => window.removeEventListener('resize', fn);
  }, []);
  return { isMobile: w < 640, isTablet: w >= 640 && w < 1024, isDesktop: w >= 1024 };
}

/* ─── categories config ───────────────────────────────────────────────────── */
interface CategoryDef {
  key: string;
  labelFr: string;
  labelHt: string;
  color: string;
  icon: React.ReactNode;
  market_count?: number;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  all:        <Grid3X3 size={15} />,
  politik:    <Vote size={15} />,
  spo:        <Trophy size={15} />,
  ekonomi:    <BarChart2 size={15} />,
  kilti:      <Music size={15} />,
  sosyal:     <Users size={15} />,
  nouvo:      <Zap size={15} />,
  lot:        <Layers size={15} />,
  krypto:     <Bitcoin size={15} />,
  teknoloji:  <Cpu size={15} />,
  entènasyonal: <Globe size={15} />,
  tendans:    <Flame size={15} />,
  finans:     <TrendingUp size={15} />,
};

const ALL_CATEGORY: CategoryDef = {
  key: 'all', labelFr: 'Tous', labelHt: 'Tout', color: '#3b82f6', icon: <Grid3X3 size={15} />,
};

type SortBy = 'trending' | 'newest' | 'ending' | 'volume';

/* ─── skeleton card ───────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div style={{
      background: '#0d1117', border: '1px solid rgba(255,255,255,.06)',
      borderRadius: 14, padding: 15, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 9, flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div className="skeleton" style={{ height: 12, width: '85%' }} />
          <div className="skeleton" style={{ height: 12, width: '60%', opacity: 0.7 }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <div className="skeleton" style={{ flex: 1, height: 38, borderRadius: 9 }} />
        <div className="skeleton" style={{ flex: 1, height: 38, borderRadius: 9, opacity: 0.7 }} />
      </div>
      <div className="skeleton" style={{ height: 4, borderRadius: 4 }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MARKETS PAGE
═══════════════════════════════════════════════════════════════════════════════ */
export default function Markets() {
  const { user } = useAuth();
  const { locale } = useLocale();
  const { isMobile, isTablet, isDesktop } = useVP();

  // useMarkets drives category + status via URL params (server-side filtering)
  const { markets, loading, filters, setCategory, setSort, applyMarketUpdate } = useMarkets({ limit: 500 });

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortByLocal] = useState<SortBy>('trending');

  // Stable snapshot of markets for sort — updated at most once per 500ms to avoid
  // re-sorting the full list on every WebSocket price tick
  const sortTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [sortableMarkets, setSortableMarkets] = useState(markets);
  useEffect(() => {
    clearTimeout(sortTimerRef.current);
    sortTimerRef.current = setTimeout(() => setSortableMarkets(markets), 500);
    return () => clearTimeout(sortTimerRef.current);
  }, [markets]);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());

  // Derive selected category from URL param ('' = all)
  const selectedCategory = filters.category || 'all';

  // Dynamic categories from API
  const [categories, setCategories] = useState<CategoryDef[]>([ALL_CATEGORY]);
  useEffect(() => {
    categoriesAPI.list()
      .then(res => {
        const apiCats: CategoryDef[] = (res.data.data ?? []).map(c => ({
          key:      c.slug,
          labelFr:  c.name_fr,
          labelHt:  c.name,
          color:    c.color,
          icon:     ICON_MAP[c.slug] ?? <BarChart2 size={15} />,
          market_count: c.market_count,
        }));
        setCategories([ALL_CATEGORY, ...apiCats]);
      })
      .catch(() => {});
  }, []);

  /* Load favorites */
  useEffect(() => {
    if (!user) { setFavIds(new Set()); return; }
    marketsAPI.getFavorites()
      .then(r => setFavIds(new Set(r.data.map((m: any) => m.id))))
      .catch(() => {});
  }, [user]);

  /* WebSocket real-time price updates */
  useWebSocket({
    onMessage: (msg) => {
      if (msg.type === 'market:update') {
        applyMarketUpdate({
          id: msg.market_id,
          yes_prob: msg.yes_prob,
          no_prob: msg.no_prob,
          local_volume: msg.local_volume,
          bet_count: msg.bet_count,
        } as any);
      }
    },
  });

  /* Client-side: only search + sort (category already filtered server-side) */
  const filtered = useMemo(() => {
    let result = [...sortableMarkets];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m =>
        m.title?.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q)
      );
    }
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'ending':
        result.sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime());
        break;
      case 'volume':
        result.sort((a, b) => (b.bet_count || 0) - (a.bet_count || 0));
        break;
      default: // trending
        result.sort((a, b) => {
          if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
          return (b.bet_count || 0) - (a.bet_count || 0);
        });
    }
    return result;
  }, [sortableMarkets, searchQuery, sortBy]);

  const handleToggleFav = (marketId: string) => {
    if (!user) return;
    const next = !favIds.has(marketId);
    setFavIds(prev => { const s = new Set(prev); if (next) s.add(marketId); else s.delete(marketId); return s; });
    marketsAPI.toggleFavorite(marketId).catch(() => {
      setFavIds(prev => { const s = new Set(prev); if (!next) s.add(marketId); else s.delete(marketId); return s; });
    });
  };

  const handleCategoryClick = (key: string) => {
    setCategory(key === 'all' ? '' : key as any);
  };

  const handleSortChange = (v: SortBy) => {
    setSortByLocal(v);
    const apiSort: Record<SortBy, MarketFilters['sort']> = {
      trending: 'volume', newest: 'new', ending: 'ending', volume: 'volume',
    };
    setSort(apiSort[v]);
  };

  const gridCols = isDesktop ? 'repeat(3,1fr)' : isTablet ? 'repeat(2,1fr)' : '1fr';

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse  { 0%,100% { opacity:1; } 50% { opacity:.45; } }
        .am-up { animation: fadeUp .35s ease forwards; }
        .pulse-sk { animation: pulse 1.8s ease-in-out infinite; }

        .cat-bar::-webkit-scrollbar { display: none; }
        .cat-bar { -ms-overflow-style: none; scrollbar-width: none; }

        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 99px; }
      `}</style>

      <div style={{ background: '#090d12', minHeight: '100vh' }}>
        <div style={{
          maxWidth: 1440, margin: '0 auto',
          padding: isMobile ? '20px 14px' : isTablet ? '28px 22px' : '36px 40px',
        }}>

          {/* ═══ HEADER ═══ */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: isMobile ? 22 : 30, fontWeight: 800, color: 'white', margin: '0 0 6px', letterSpacing: '-.02em' }}>
                  {locale === 'fr' ? 'Tous les marchés' : 'Tout machè yo'}
                </h1>
                <p style={{ fontSize: 13, color: '#4b6376', margin: 0 }}>
                  {loading
                    ? (locale === 'fr' ? 'Chargement…' : 'Ap chaje…')
                    : locale === 'fr'
                      ? `${filtered.length} marché${filtered.length !== 1 ? 's' : ''} affiché${filtered.length !== 1 ? 's' : ''}`
                      : `${filtered.length} machè afiche`}
                </p>
              </div>

              {/* Sort + Search row */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: isDesktop ? 'unset' : 1, justifyContent: 'flex-end' }}>
                {!isMobile && (
                  <select
                    value={sortBy}
                    onChange={e => handleSortChange(e.target.value as SortBy)}
                    style={{
                      padding: '9px 32px 9px 12px', borderRadius: 10,
                      border: '1px solid rgba(255,255,255,.1)',
                      background: 'rgba(255,255,255,.04)', color: '#c9d1d9',
                      fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                      appearance: 'none', colorScheme: 'dark',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%236b7280' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
                    }}
                  >
                    <option value="trending">{locale === 'fr' ? 'Tendance' : 'Tandans'}</option>
                    <option value="newest">{locale === 'fr' ? 'Nouveau' : 'Nouvo'}</option>
                    <option value="ending">{locale === 'fr' ? 'Fin proche' : 'Fin prèch'}</option>
                    <option value="volume">Volume</option>
                  </select>
                )}
              </div>
            </div>

            {/* Search bar */}
            <div style={{ position: 'relative', marginBottom: 20 }}>
              <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#4b6376', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder={locale === 'fr' ? 'Rechercher un marché…' : 'Chèche yon machè…'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '11px 40px 11px 40px',
                  borderRadius: 12, border: '1px solid rgba(255,255,255,.08)',
                  background: 'rgba(255,255,255,.03)', color: 'white',
                  fontSize: 14, fontFamily: 'inherit', outline: 'none',
                  transition: 'border .15s, background .15s',
                }}
                onFocus={e => { e.target.style.border = '1px solid rgba(59,130,246,.35)'; e.target.style.background = 'rgba(59,130,246,.05)'; }}
                onBlur={e => { e.target.style.border = '1px solid rgba(255,255,255,.08)'; e.target.style.background = 'rgba(255,255,255,.03)'; }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4, display: 'flex' }}>
                  <X size={15} />
                </button>
              )}
            </div>

            {/* ═══ CATEGORY BAR ═══ */}
            <div
              className={isDesktop ? '' : 'cat-bar'}
              style={{
                display: 'flex', gap: 6,
                flexWrap: isDesktop ? 'wrap' : 'nowrap',
                overflowX: isDesktop ? 'visible' : 'auto',
                WebkitOverflowScrolling: 'touch', paddingBottom: 2,
              }}
            >
              {categories.map(cat => {
                const active = selectedCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    onClick={() => handleCategoryClick(cat.key)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px', borderRadius: 99, whiteSpace: 'nowrap',
                      border: active ? `1.5px solid ${cat.color}` : '1px solid rgba(255,255,255,.09)',
                      background: active ? `${cat.color}1a` : 'rgba(255,255,255,.03)',
                      color: active ? cat.color : '#6b7280',
                      fontWeight: active ? 700 : 500, fontSize: 13,
                      cursor: 'pointer', transition: 'all .15s',
                      fontFamily: 'inherit', flexShrink: 0,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', opacity: active ? 1 : 0.7 }}>
                      {cat.icon}
                    </span>
                    {locale === 'fr' ? cat.labelFr : cat.labelHt}
                    {cat.market_count != null && cat.market_count > 0 && (
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        background: active ? cat.color : 'rgba(255,255,255,.08)',
                        color: active ? '#000' : '#8b949e',
                        borderRadius: 99, padding: '1px 7px',
                      }}>
                        {cat.market_count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ═══ MARKETS GRID ═══ */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: isMobile ? 12 : 16 }}>
              {Array.from({ length: isMobile ? 2 : 9 }).map((_, i) => (
                <div key={i} className="pulse-sk" style={{ animationDelay: `${i * 80}ms` }}>
                  <SkeletonCard />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: isMobile ? '60px 20px' : '100px 40px',
              background: 'rgba(255,255,255,.02)', borderRadius: 16,
              border: '1px dashed rgba(255,255,255,.07)',
            }}>
              <BookOpen style={{ width: 44, height: 44, margin: '0 auto 16px', opacity: 0.13 }} />
              <p style={{ fontSize: 15, color: '#4b6376', fontWeight: 600, margin: '0 0 8px' }}>
                {locale === 'fr' ? 'Aucun marché trouvé' : 'Pa gen machè jwenn'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    marginTop: 12, padding: '8px 20px', borderRadius: 8,
                    border: '1px solid rgba(59,130,246,.3)', background: 'rgba(59,130,246,.08)',
                    color: '#3b82f6', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {locale === 'fr' ? 'Effacer la recherche' : 'Efase rechèch'}
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: isMobile ? 12 : 16 }}>
              {filtered.map((market, i) => (
                <div key={market.id} className="am-up" style={{ animationDelay: `${Math.min(i * 35, 280)}ms` }}>
                  <MarketCard
                    market={market}
                    index={i}
                    isFavorited={favIds.has(market.id)}
                    onToggleFavorite={() => handleToggleFav(market.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
