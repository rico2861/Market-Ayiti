import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Filter, X, Grid3x3, List, ChevronDown, TrendingUp, Zap } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { marketsAPI } from '../api';
import MarketCard from '../components/market/MarketCard';
import { MarketGridSkeleton } from '../components/ui/Skeleton';
import type { Market, MarketCategory } from '../types';

const SORTS = [
  { v: 'volume', l_fr: 'Plus populaire', l_ht: 'Pi popilè' },
  { v: 'new', l_fr: 'Plus récent', l_ht: 'Pi nouvo' },
  { v: 'ending', l_fr: 'Se termine', l_ht: 'Prèske fini' },
  { v: 'competitive', l_fr: 'Plus serré', l_ht: 'Pi konpetitif' },
] as const;

const CATEGORIES = [
  { id: '', label_fr: 'Tous les marchés', label_ht: 'Tout machè yo' },
  { id: 'politik', label_fr: 'Politique', label_ht: 'Politik' },
  { id: 'spo', label_fr: 'Sports', label_ht: 'Spo' },
  { id: 'ekonomi', label_fr: 'Économie', label_ht: 'Ekonomi' },
  { id: 'kilti', label_fr: 'Culture', label_ht: 'Kilti' },
  { id: 'sosyal', label_fr: 'Société', label_ht: 'Sosyal' },
] as const;

export default function Markets() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === 'fr' ? 'fr' : 'ht';
  const [searchParams, setSearchParams] = useSearchParams();

  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchVal, setSearchVal] = useState(() => searchParams.get('q') || '');
  const [category, setCategory] = useState((searchParams.get('category') as MarketCategory) || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'volume');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const sortRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const fetchMarkets = useCallback(async (params: { category?: string; search?: string; sort?: string }) => {
    setLoading(true);
    try {
      const res = await marketsAPI.list({
        category: params.category || undefined,
        search: params.search || undefined,
        sort: params.sort || 'volume',
        status: 'active',
        limit: 100
      });
      setMarkets(res.data);
    } catch { } finally { setLoading(false); }
  }, []);

  // Sync from URL
  useEffect(() => {
    const urlQ = searchParams.get('q') || '';
    const urlCat = (searchParams.get('category') || '') as MarketCategory | '';
    const urlSort = searchParams.get('sort') || 'volume';
    setSearchVal(urlQ);
    setCategory(urlCat);
    setSort(urlSort);
    fetchMarkets({ category: urlCat, search: urlQ, sort: urlSort });
  }, [searchParams.get('q'), searchParams.get('category'), searchParams.get('sort')]);

  // Debounce search
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
    setSort(s);
    setSortOpen(false);
    setSearchParams(prev => {
      const n = new URLSearchParams(prev);
      if (s !== 'volume') n.set('sort', s);
      else n.delete('sort');
      return n;
    }, { replace: true });
  };

  const updateCategory = (cat: string) => {
    setCategory(cat as MarketCategory | '');
    setFilterOpen(false);
    setSearchParams(prev => {
      const n = new URLSearchParams(prev);
      if (cat) n.set('category', cat);
      else n.delete('category');
      return n;
    }, { replace: true });
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const currentSortLabel = SORTS.find(s => s.v === sort)?.[locale === 'fr' ? 'l_fr' : 'l_ht'] || 'Tri';
  const currentCatLabel = CATEGORIES.find(c => c.id === category)?.[locale === 'fr' ? 'label_fr' : 'label_ht'];

  return (
    <div style={{
      maxWidth: 1400,
      margin: '0 auto',
      padding: '32px 16px'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: 40,
        animation: 'fadeInDown 0.6s ease-out'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 12,
          flexWrap: 'wrap'
        }}>
          <div>
            <h1 style={{
              fontSize: window.innerWidth < 640 ? 28 : 36,
              fontWeight: 700,
              color: 'white',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}>
              <TrendingUp size={32} color="#388bfd" />
              Markets
            </h1>
            <p style={{
              fontSize: 14,
              color: '#8b949e',
              margin: '8px 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <Zap size={13} style={{ color: '#f85149' }} />
              {markets.length} {locale === 'fr' ? 'marchés actifs' : 'machè aktif'}
            </p>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 24,
        flexWrap: 'wrap',
        alignItems: 'center',
        animation: 'fadeInUp 0.6s ease-out 0.1s both'
      }}>
        {/* Search Input */}
        <div style={{
          position: 'relative',
          flex: 1,
          minWidth: window.innerWidth < 640 ? '100%' : 240
        }}>
          <Search size={14} style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#484f58',
            pointerEvents: 'none'
          }} />
          <input
            type="search"
            value={searchVal}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder={locale === 'fr' ? 'Rechercher...' : 'Chèche...'}
            style={{
              width: '100%',
              background: '#161b22',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 10,
              padding: '10px 36px 10px 36px',
              color: 'white',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              transition: 'all 0.3s'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(56, 139, 253, 0.3)';
              e.currentTarget.style.background = 'rgba(56, 139, 253, 0.05)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.background = '#161b22';
            }}
          />
          {searchVal && (
            <button onClick={() => handleSearchChange('')} style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: '#8b949e',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center'
            }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category Filter Dropdown */}
        <div ref={filterRef} style={{ position: 'relative' }}>
          <button onClick={() => setFilterOpen(!filterOpen)} style={{
            padding: '10px 14px',
            background: '#161b22',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 10,
            color: 'white',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'inherit',
            transition: 'all 0.3s',
            whiteSpace: 'nowrap'
          }}
            onMouseEnter={(e) => {
              if (!filterOpen) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
              }
            }}
            onMouseLeave={(e) => {
              if (!filterOpen) {
                e.currentTarget.style.background = '#161b22';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              }
            }}>
            <Filter size={14} />
            <span>{currentCatLabel || 'Catégorie'}</span>
            <ChevronDown size={12} style={{
              transition: 'transform 0.3s',
              transform: filterOpen ? 'rotate(180deg)' : 'rotate(0)'
            }} />
          </button>

          {filterOpen && (
            <div style={{
              position: 'absolute',
              left: 0,
              top: 'calc(100% + 8px)',
              background: '#161b22',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 12,
              padding: 8,
              minWidth: 200,
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)',
              zIndex: 100,
              animation: 'slideInDown 0.3s ease-out'
            }}>
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => updateCategory(cat.id)} style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: category === cat.id ? 'rgba(56, 139, 253, 0.15)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 13,
                  color: category === cat.id ? '#388bfd' : '#c9d1d9',
                  fontFamily: 'inherit',
                  fontWeight: category === cat.id ? 600 : 400,
                  transition: 'all 0.3s',
                  marginBottom: 4
                }}
                  onMouseEnter={(e) => {
                    if (category !== cat.id) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (category !== cat.id) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}>
                  {locale === 'fr' ? cat.label_fr : cat.label_ht}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sort Dropdown */}
        <div ref={sortRef} style={{ position: 'relative' }}>
          <button onClick={() => setSortOpen(!sortOpen)} style={{
            padding: '10px 14px',
            background: '#161b22',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 10,
            color: 'white',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'inherit',
            transition: 'all 0.3s',
            whiteSpace: 'nowrap'
          }}
            onMouseEnter={(e) => {
              if (!sortOpen) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
              }
            }}
            onMouseLeave={(e) => {
              if (!sortOpen) {
                e.currentTarget.style.background = '#161b22';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              }
            }}>
            <span>{currentSortLabel}</span>
            <ChevronDown size={12} style={{
              transition: 'transform 0.3s',
              transform: sortOpen ? 'rotate(180deg)' : 'rotate(0)'
            }} />
          </button>

          {sortOpen && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 8px)',
              background: '#161b22',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 12,
              padding: 8,
              minWidth: 200,
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)',
              zIndex: 100,
              animation: 'slideInDown 0.3s ease-out'
            }}>
              {SORTS.map(s => (
                <button key={s.v} onClick={() => updateSort(s.v)} style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: sort === s.v ? 'rgba(56, 139, 253, 0.15)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 13,
                  color: sort === s.v ? '#388bfd' : '#c9d1d9',
                  fontFamily: 'inherit',
                  fontWeight: sort === s.v ? 600 : 400,
                  transition: 'all 0.3s',
                  marginBottom: 4
                }}
                  onMouseEnter={(e) => {
                    if (sort !== s.v) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (sort !== s.v) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}>
                  {locale === 'fr' ? s.l_fr : s.l_ht}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* View Toggle */}
        <div style={{
          display: 'flex',
          background: '#161b22',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 10,
          padding: 4,
          gap: 2
        }}>
          <button onClick={() => setView('grid')} style={{
            padding: '8px 10px',
            borderRadius: 8,
            cursor: 'pointer',
            background: view === 'grid' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
            border: 'none',
            color: view === 'grid' ? 'white' : '#8b949e',
            transition: 'all 0.3s',
            display: 'flex',
            alignItems: 'center'
          }}
            title="Grid view">
            <Grid3x3 size={14} />
          </button>
          <button onClick={() => setView('list')} style={{
            padding: '8px 10px',
            borderRadius: 8,
            cursor: 'pointer',
            background: view === 'list' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
            border: 'none',
            color: view === 'list' ? 'white' : '#8b949e',
            transition: 'all 0.3s',
            display: 'flex',
            alignItems: 'center'
          }}
            title="List view">
            <List size={14} />
          </button>
        </div>
      </div>

      {/* Active Filters Chips */}
      {(category || searchVal) && (
        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: 24,
          flexWrap: 'wrap',
          animation: 'slideInUp 0.3s ease-out'
        }}>
          {category && (
            <button onClick={() => updateCategory('')} style={{
              padding: '6px 12px 6px 14px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 500,
              background: 'rgba(56, 139, 253, 0.15)',
              border: '1px solid rgba(56, 139, 253, 0.3)',
              color: '#388bfd',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.3s'
            }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(56, 139, 253, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(56, 139, 253, 0.15)';
              }}>
              {currentCatLabel}
              <X size={12} />
            </button>
          )}
          {searchVal && (
            <button onClick={() => handleSearchChange('')} style={{
              padding: '6px 12px 6px 14px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 500,
              background: 'rgba(56, 139, 253, 0.15)',
              border: '1px solid rgba(56, 139, 253, 0.3)',
              color: '#388bfd',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.3s',
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(56, 139, 253, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(56, 139, 253, 0.15)';
              }}>
              "{searchVal}"
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Markets Grid/List */}
      {loading && markets.length === 0 ? (
        <MarketGridSkeleton count={12} />
      ) : !loading && markets.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '80px 16px',
          animation: 'fadeIn 0.5s ease-out'
        }}>
          <Search style={{
            width: 48,
            height: 48,
            margin: '0 auto 16px',
            opacity: 0.15,
            color: '#8b949e'
          }} />
          <p style={{
            fontSize: 15,
            color: '#8b949e',
            margin: '0 0 12px'
          }}>
            {searchVal
              ? (locale === 'fr' ? `Aucun résultat pour "${searchVal}"` : `Pa gen rezilta pou "${searchVal}"`)
              : (locale === 'fr' ? 'Aucun marché' : 'Pa gen machè')}
          </p>
          {searchVal && (
            <button onClick={() => handleSearchChange('')} style={{
              background: 'none',
              border: 'none',
              color: '#388bfd',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              transition: 'all 0.3s'
            }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#1f6feb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#388bfd';
              }}>
              {locale === 'fr' ? 'Effacer la recherche' : 'Efase rechèch'} →
            </button>
          )}
        </div>
      ) : (
        <div style={{
          display: view === 'grid' ? 'grid' : 'flex',
          gridTemplateColumns: view === 'grid'
            ? window.innerWidth < 640
              ? '1fr'
              : window.innerWidth < 1024
                ? 'repeat(2, 1fr)'
                : 'repeat(auto-fill, minmax(280px, 1fr))'
            : undefined,
          flexDirection: view === 'list' ? 'column' : undefined,
          gap: 16,
          position: 'relative'
        }}>
          {loading && (
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              zIndex: 5
            }}>
              <div style={{
                width: 20,
                height: 20,
                border: '2px solid rgba(255, 255, 255, 0.1)',
                borderTopColor: '#388bfd',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
            </div>
          )}
          {markets.map((m, i) => (
            <div key={m.id} style={{ animation: `fadeInUp 0.5s ease-out ${i * 0.05}s both` }}>
              <MarketCard market={m} index={i} />
            </div>
          ))}
        </div>
      )}

      <style>{`
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

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}