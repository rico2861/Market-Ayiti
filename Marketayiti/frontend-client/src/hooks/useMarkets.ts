import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebouncedCallback } from 'use-debounce';
import { marketsAPI } from '../api';
import { useWebSocket } from './useRealtime';
import type { Market, MarketCategory, MarketFilters } from '../types';

interface UseMarketsResult {
  markets: Market[];
  loading: boolean;
  error: string | null;
  filters: MarketFilters;
  setCategory: (cat: MarketCategory | '') => void;
  setSearch: (q: string) => void;
  setSort: (sort: MarketFilters['sort']) => void;
  refresh: () => void;
  applyMarketUpdate: (update: Partial<Market> & { id: string }) => void;
  total: number;
}

export function useMarkets(initial: Partial<MarketFilters> = {}): UseMarketsResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const filters: MarketFilters = {
    category: (searchParams.get('category') as MarketCategory) || '',
    search:   searchParams.get('q') || '',
    sort:     (searchParams.get('sort') as MarketFilters['sort']) || 'volume',
    status:   (searchParams.get('status') as any) || 'active',
    ...initial
  };

  const fetchMarkets = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    // Only show loading skeleton on FIRST load, not on filter change
    setError(null);
    setLoading(prev => {
      // If we already have data (category change), show skeleton alongside previous
      return true;
    });
    try {
      const res = await marketsAPI.list({
        category: filters.category || undefined,
        search:   filters.search   || undefined,
        status:   filters.status   || 'active',
        sort:     filters.sort     || 'volume',
        limit:    (initial as any).limit ?? 500,
      });
      setMarkets(res.data);
    } catch (e: any) {
      if (e.name !== 'CanceledError' && e.name !== 'AbortError') {
        setError(e.response?.data?.detail || 'Erè chajman');
        setMarkets([]); // Clear only on real error
      }
    } finally {
      setLoading(false);
    }
  }, [filters.category, filters.search, filters.status, filters.sort]);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);

  // Real-time: refresh market list when a new market is added
  useWebSocket({
    channels: ['markets'],
    onMessage: (msg) => {
      if (msg.type === 'market:new' || msg.type === 'polymarket:sync') {
        fetchMarkets();
      }
    },
  });

  const debouncedSearch = useDebouncedCallback((value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set('q', value);
      else next.delete('q');
      return next;
    }, { replace: true });
  }, 350);

  const setCategory = useCallback((cat: MarketCategory | '') => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (cat) next.set('category', cat);
      else next.delete('category');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setSearch = useCallback((q: string) => debouncedSearch(q), [debouncedSearch]);

  const setSort = useCallback((sort: MarketFilters['sort']) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (sort && sort !== 'volume') next.set('sort', sort);
      else next.delete('sort');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const applyMarketUpdate = useCallback((update: Partial<Market> & { id: string }) => {
    setMarkets(prev => prev.map(m => m.id === update.id ? { ...m, ...update } : m));
  }, []);

  return {
    markets, loading, error, filters,
    setCategory, setSearch, setSort,
    refresh: fetchMarkets, applyMarketUpdate,
    total: markets.length
  };
}

// Single market hook
export function useMarket(idOrSlug: string) {
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idOrSlug) return;
    setLoading(true);
    marketsAPI.get(idOrSlug)
      .then(r => { setMarket(r.data); setError(null); })
      .catch(e => setError(e.response?.data?.detail || 'Pa jwenn'))
      .finally(() => setLoading(false));
  }, [idOrSlug]);

  const refresh = () => marketsAPI.get(idOrSlug).then(r => setMarket(r.data)).catch(() => {});

  return { market, loading, error, refresh, setMarket };
}

// User's bets
export function useMyBets() {
  const [bets, setBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    marketsAPI.myBets({ limit: 100 })
      .then(r => setBets(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  return { bets, loading };
}
