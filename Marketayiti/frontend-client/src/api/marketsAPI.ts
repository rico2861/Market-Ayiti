import http from './Authapi';
import type { Market, MarketFilters, Bet } from '../types';

// ── Markets Service ───────────────────────────────────────────
export const marketsAPI = {
    list: (filters: MarketFilters = {}) =>
        http.get<Market[]>('/markets', { params: { status: 'active', limit: 200, ...filters } }),

    get: (idOrSlug: string) =>
        http.get<Market>(`/markets/${idOrSlug}`),

    placeBet: (marketId: string, option: 'yes' | 'no', amount: number) =>
        http.post<{ new_balance: number; bet: Bet; market: Market }>(`/markets/${marketId}/bet`, { option, amount }),

    myBets: (params?: { skip?: number; limit?: number }) =>
        http.get<Bet[]>('/markets/my-bets', { params }),

    priceHistory: (marketId: string, hours = 168) =>
        http.get<Array<{ timestamp: string; yes_price: number; no_price: number; volume: number }>>(
            `/markets/${marketId}/price-history`, { params: { hours } }
        ),

    getComments: (marketId: string) =>
        http.get<Array<{ id: string; text: string; created_at: string; user_id: string; username: string }>>(
            `/markets/${marketId}/comments`
        ),

    addComment: (marketId: string, text: string) =>
        http.post<{ id: string; text: string; created_at: string; user_id: string; username: string }>(
            `/markets/${marketId}/comments`, { text }
        ),

    deleteComment: (marketId: string, commentId: string) =>
        http.delete(`/markets/${marketId}/comments/${commentId}`),

    getFavoriteStatus: (marketId: string) =>
        http.get<{ favorited: boolean }>(`/markets/${marketId}/favorite-status`),

    toggleFavorite: (marketId: string) =>
        http.post<{ favorited: boolean }>(`/markets/${marketId}/favorite`),

    getFavorites: () =>
        http.get<Market[]>('/markets/favorites'),

    getMarketBets: (marketId: string, limit = 20) =>
        http.get<Array<{ id: string; option: string; amount: number; odds_at_bet: number; created_at: string; username: string }>>(
            `/markets/${marketId}/bets`, { params: { limit } }
        ),
};

export default marketsAPI;
