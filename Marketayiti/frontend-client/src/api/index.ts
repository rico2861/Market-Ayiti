import axios, { AxiosInstance, AxiosError } from 'axios';
import type { Market, MarketFilters, Bet, User, Transaction, PaymentMethod } from '../types';

// ── Slug utilities ─────────────────────────────────────────────
export function slugify(title: string): string {
  return title.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u').replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-')
    .slice(0, 80);
}

export function marketDeepLink(locale: 'ht' | 'fr', market: Market): string {
  const slug = market.slug || slugify(market.title);
  return `/${locale}/market/${market.category}/${slug}`;
}

// ── HTTP client with token refresh queue ──────────────────────
let isRefreshing = false;
let refreshQueue: Array<() => void> = [];

const http: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000
});

http.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const original = err.config as any;
    if (original?.url?.includes('/auth/')) return Promise.reject(err);

    if (err.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        // Wait for ongoing refresh
        return new Promise((resolve, reject) => {
          refreshQueue.push(() => http(original).then(resolve).catch(reject));
        });
      }
      original._retry = true;
      isRefreshing = true;
      try {
        await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
        isRefreshing = false;
        refreshQueue.forEach(cb => cb());
        refreshQueue = [];
        return http(original);
      } catch {
        isRefreshing = false;
        refreshQueue = [];
        // Notify app of expiry — UI handles gracefully
        window.dispatchEvent(new CustomEvent('auth:expired'));
        return Promise.reject(err);
      }
    }
    return Promise.reject(err);
  }
);

// ── Auth Service ──────────────────────────────────────────────
export const authAPI = {
  register: (data: {
    identifier: string;
    password: string;
    email?: string;
    phone?: string;
    username?: string;
    full_name?: string;
  }) => http.post<{ access_token: string; user: User; via: string }>('/auth/register', data),

  login: (identifier: string, password: string) =>
    http.post<{ access_token: string; user: User; via: string }>('/auth/login', { identifier, password }),

  detect: (identifier: string) =>
    http.post<{ type: 'email' | 'phone' | 'username' | 'invalid'; value: string; error?: string }>('/auth/detect', { identifier }),
  requestReset: (identifier: string) => http.post<any>('/auth/request-reset', { identifier }),
  verifyReset: (identifier: string, code: string, new_password: string) => http.post<any>('/auth/verify-reset', { identifier, code, new_password }),
  unlockAccount: (identifier: string, code: string, new_password: string, confirm_password: string) => http.post<any>('/auth/unlock-account', { identifier, code, new_password, confirm_password }),
  getProfile: () => http.get<any>('/auth/profile'),
  updateProfile: (d: any) => http.patch<any>('/auth/profile', d),

  logout: () => http.post('/auth/logout'),
  me: () => http.get<User>('/auth/me'),
  refresh: () => http.post('/auth/refresh'),

  changePassword: (current_password: string, new_password: string) =>
    http.post('/auth/change-password', { current_password, new_password }),

  twofa: {
    status:      () => http.get<{ enabled: boolean }>('/auth/2fa/status'),
    setup:       () => http.post<{ secret: string; qr_image: string; otpauth: string }>('/auth/2fa/setup'),
    enable:      (totp_code: string) => http.post('/auth/2fa/enable', { totp_code }),
    disable:     (totp_code: string, password: string) => http.post('/auth/2fa/disable', { totp_code, password }),
    verifyLogin: (totp_code: string) => http.post<{ access_token: string; user: User }>('/auth/2fa/verify-login', { totp_code }),
  },
};

// ── Markets Service ───────────────────────────────────────────
export const marketsAPI = {
  list: (filters: MarketFilters = {}) =>
    http.get<Market[]>('/markets', { params: { status: 'active', limit: 200, ...filters } }),

  get: (idOrSlug: string) =>
    http.get<Market>(`/markets/${idOrSlug}`),

  placeBet: (marketId: string, option: 'yes' | 'no', amount: number) =>
    http.post<{ new_balance: number; new_bonus_balance: number; use_bonus: boolean; bet: Bet; market: Market }>(`/markets/${marketId}/bet`, { option, amount }),

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

// ── Polymarket Live Service ───────────────────────────────────
export const polymarketsAPI = {
  list: (params: {
    status?:   'active' | 'closed' | 'resolved' | 'all';
    category?: string;
    search?:   string;
    sort?:     'volume' | 'new' | 'ending' | 'competitive' | 'prob_asc' | 'prob_desc';
    limit?:    number;
    skip?:     number;
    winner?:   'yes' | 'no';
  } = {}) =>
    http.get<{ data: any[]; limit: number; skip: number; count: number }>('/polymarkets', { params }),

  get: (id: string) =>
    http.get<any>(`/polymarkets/${id}`),

  history: (id: string, hours = 168) =>
    http.get<Array<{ yes_price: number; no_price: number; volume: number; timestamp: string }>>(
      `/polymarkets/${id}/history`, { params: { hours } }
    ),

  stats: () =>
    http.get<any>('/polymarkets/stats'),
};

// ── Categories Service ────────────────────────────────────────
export const categoriesAPI = {
  list: () => http.get<{ success: boolean; data: Array<{
    id: number;
    slug: string;
    name: string;
    name_fr: string;
    icon: string;
    color: string;
    market_count: number;
  }> }>('/categories'),
};

// ── Wallet Service ────────────────────────────────────────────
export const walletAPI = {
  methods: () => http.get<PaymentMethod[]>('/wallet/methods'),
  deposit: (d: any) => http.post('/wallet/deposit', d),
  withdraw: (d: any) => http.post('/wallet/withdraw', d),
  getTransactions: (p?: any) => http.get('/wallet/transactions', { params: p }),
  transactions: (params?: { skip?: number; limit?: number; type?: string }) =>
    http.get<Transaction[]>('/wallet/transactions', { params }),
};

// ── Notifications Service ─────────────────────────────────────
export const notificationsAPI = {
  list: (limit = 50) => http.get<{ notifications: any[]; unread: number }>('/notifications', { params: { limit } }),
  markRead: (id: string) => http.patch(`/notifications/${id}/read`),
  markAllRead: () => http.patch('/notifications/read-all'),
  delete: (id: string) => http.delete(`/notifications/${id}`),
};

export default http;


