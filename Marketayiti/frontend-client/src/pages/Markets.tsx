import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Filter, X, Grid3x3, List, ChevronDown } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { marketsAPI } from '../api';
import MarketCard from '../components/market/MarketCard';
import { MarketGridSkeleton } from '../components/ui/Skeleton';
import type { Market, MarketCategory } from '../types';
import clsx from 'clsx';

const SORTS = [
  { v: 'volume',      l_fr:'Plus populaire', l_ht:'Pi popilè' },
  { v: 'new',         l_fr:'Plus récent',    l_ht:'Pi nouvo' },
  { v: 'ending',      l_fr:'Se termine',     l_ht:'Prèske fini' },
  { v: 'competitive', l_fr:'Plus serré',     l_ht:'Pi konpetitif' },
] as const;

export default function Markets() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0,2) === 'fr' ? 'fr' : 'ht';
  const [searchParams, setSearchParams] = useSearchParams();

  const [markets, setMarkets]   = useState<Market[]>([]);
  const [loading, setLoading]   = useState(true);
  const [searchVal, setSearchVal] = useState(() => searchParams.get('q') || '');
  const [category, setCategory] = useState((searchParams.get('category') as MarketCategory) || '');
  const [sort, setSort]         = useState(searchParams.get('sort') || 'volume');
  const [view, setView]         = useState<'grid'|'list'>('grid');
  const [sortOpen, setSortOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const sortRef = useRef<HTMLDivElement>(null);

  const fetchMarkets = useCallback(async (params: { category?: string; search?: string; sort?: string }) => {
    setLoading(true);
    try {
      const res = await marketsAPI.list({
        category: params.category || undefined,
        search:   params.search   || undefined,
        sort:     params.sort     || 'volume',
        status:   'active',
        limit: 100
      });
      setMarkets(res.data);
    } catch {} finally { setLoading(false); }
  }, []);

  // Sync from URL
  useEffect(() => {
    const urlQ   = searchParams.get('q') || '';
    const urlCat = (searchParams.get('category') || '') as MarketCategory | '';
    const urlSort = searchParams.get('sort') || 'volume';
    setSearchVal(urlQ);
    setCategory(urlCat);
    setSort(urlSort);
    fetchMarkets({ category: urlCat, search: urlQ, sort: urlSort });
  }, [searchParams.get('q'), searchParams.get('category'), searchParams.get('sort')]);

  // Debounce typing search → URL
  const handleSearchChange = (val: string) => {
    setSearchVal(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchParams(prev => {
        const n = new URLSearchParams(prev);
        if (val.trim()) n.set('q', val.trim());
        else n.delete('q');
        return n;
      }, { replace: true });
    }, 300);
  };

  const updateSort = (s: string) => {
    setSort(s); setSortOpen(false);
    setSearchParams(prev => {
      const n = new URLSearchParams(prev);
      if (s !== 'volume') n.set('sort', s); else n.delete('sort');
      return n;
    }, { replace: true });
  };

  // Close sort dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const currentSortLabel = SORTS.find(s => s.v === sort)?.[locale==='fr'?'l_fr':'l_ht'] || 'Tri';

  return (
    <div className="container py-4 fade-in">
      {/* Title row */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:8 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:'white', margin:0 }}>
          {category ? (locale==='fr' ? `Marchés ${category}` : `Machè ${category}`) : (locale==='fr' ? 'Tous les marchés' : 'Tout machè yo')}
        </h1>
        <span style={{ fontSize:12, color:'#8b949e' }}>
          {markets.length} {locale==='fr'?'marchés actifs':'machè aktif'}
        </span>
      </div>

      {/* Search + Sort + View toggle row — Polymarket style */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        {/* Filter icon */}
        <button style={{ padding:'8px 10px', borderRadius:8, background:'#161b22',
          border:'1px solid rgba(255,255,255,0.08)', cursor:'pointer', color:'#8b949e' }}>
          <Filter size={14}/>
        </button>

        {/* Search */}
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#484f58', pointerEvents:'none' }}/>
          <input
            type="search" value={searchVal}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder={locale==='fr' ? 'Rechercher un marché...' : 'Chèche yon machè...'}
            style={{ width:'100%', background:'#161b22', border:'1px solid rgba(255,255,255,0.08)',
              borderRadius:8, padding:'8px 36px 8px 36px', color:'white', fontSize:13,
              outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}
          />
          {searchVal && (
            <button onClick={() => handleSearchChange('')}
              style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                background:'none', border:'none', color:'#8b949e', cursor:'pointer' }}>
              <X size={14}/>
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <div ref={sortRef} style={{ position:'relative' }}>
          <button onClick={() => setSortOpen(v=>!v)} style={{
            padding:'8px 14px', background:'#161b22', border:'1px solid rgba(255,255,255,0.08)',
            borderRadius:8, color:'white', fontSize:13, cursor:'pointer',
            display:'flex', alignItems:'center', gap:8, fontFamily:'inherit'
          }}>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}>✨ {currentSortLabel}</span>
            <ChevronDown size={13} color="#8b949e"/>
          </button>
          {sortOpen && (
            <div style={{ position:'absolute', right:0, top:'calc(100% + 6px)', background:'#161b22',
              border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:6, zIndex:50,
              minWidth:170, boxShadow:'0 8px 32px rgba(0,0,0,0.5)' }}>
              {SORTS.map(s => (
                <button key={s.v} onClick={() => updateSort(s.v)}
                  style={{ display:'block', width:'100%', padding:'8px 12px', borderRadius:7,
                    background: sort===s.v ? 'rgba(31,111,235,0.15)' : 'none',
                    border:'none', cursor:'pointer', textAlign:'left', fontSize:13,
                    color: sort===s.v ? '#388bfd' : '#e6edf3', fontFamily:'inherit',
                    fontWeight: sort===s.v ? 600 : 400 }}>
                  {s[locale==='fr'?'l_fr':'l_ht']}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* View toggle */}
        <div style={{ display:'flex', background:'#161b22', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:3 }}>
          <button onClick={() => setView('grid')} style={{
            padding:'6px 8px', borderRadius:6, cursor:'pointer',
            background: view==='grid' ? 'rgba(255,255,255,0.08)' : 'none',
            border:'none', color: view==='grid' ? 'white' : '#8b949e' }}>
            <Grid3x3 size={14}/>
          </button>
          <button onClick={() => setView('list')} style={{
            padding:'6px 8px', borderRadius:6, cursor:'pointer',
            background: view==='list' ? 'rgba(255,255,255,0.08)' : 'none',
            border:'none', color: view==='list' ? 'white' : '#8b949e' }}>
            <List size={14}/>
          </button>
        </div>
      </div>

      {/* Active filters chips */}
      {(category || searchVal) && (
        <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
          {category && (
            <button onClick={() => setSearchParams(p => { const n = new URLSearchParams(p); n.delete('category'); return n; })}
              style={{ padding:'4px 10px 4px 12px', borderRadius:20, fontSize:12,
                background:'rgba(31,111,235,0.15)', border:'1px solid rgba(31,111,235,0.3)',
                color:'#388bfd', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5 }}>
              {category} <X size={10}/>
            </button>
          )}
          {searchVal && (
            <button onClick={() => handleSearchChange('')}
              style={{ padding:'4px 10px 4px 12px', borderRadius:20, fontSize:12,
                background:'rgba(31,111,235,0.15)', border:'1px solid rgba(31,111,235,0.3)',
                color:'#388bfd', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5 }}>
              "{searchVal}" <X size={10}/>
            </button>
          )}
        </div>
      )}

      {/* Markets */}
      {loading && markets.length === 0 ? (
        <MarketGridSkeleton count={12}/>
      ) : !loading && markets.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0' }}>
          <Search style={{ width:40, height:40, margin:'0 auto 12px', opacity:0.2, display:'block', color:'#8b949e' }}/>
          <p style={{ color:'#8b949e', margin:'0 0 8px' }}>
            {searchVal
              ? (locale==='fr' ? `Aucun résultat pour "${searchVal}"` : `Pa gen rezilta pou "${searchVal}"`)
              : (locale==='fr' ? 'Aucun marché' : 'Pa gen machè')}
          </p>
          {searchVal && (
            <button onClick={() => handleSearchChange('')}
              style={{ background:'none', border:'none', color:'#1f6feb', cursor:'pointer', fontSize:12 }}>
              {locale==='fr'?'Effacer la recherche':'Efase rechèch'} →
            </button>
          )}
        </div>
      ) : (
        <div style={{
          display: view==='grid' ? 'grid' : 'flex',
          gridTemplateColumns: view==='grid' ? 'repeat(auto-fill, minmax(260px, 1fr))' : undefined,
          flexDirection: view==='list' ? 'column' : undefined,
          gap: 12, position:'relative'
        }} className="stagger">
          {loading && (
            <div style={{ position:'absolute', top:0, right:0, zIndex:5 }}>
              <div style={{ width:18, height:18, border:'2px solid rgba(255,255,255,0.1)',
                borderTopColor:'#1f6feb', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
            </div>
          )}
          {markets.map((m, i) => <MarketCard key={m.id} market={m} index={i}/>)}
        </div>
      )}
    </div>
  );
}
