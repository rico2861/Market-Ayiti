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
  getProfile: () => http.get<any>('/auth/profile'),
  updateProfile: (d: any) => http.patch<any>('/auth/profile', d),

  logout: () => http.post('/auth/logout'),
  me: () => http.get<User>('/auth/me'),
  refresh: () => http.post('/auth/refresh'),

  changePassword: (current_password: string, new_password: string) =>
    http.post('/auth/change-password', { current_password, new_password })
};

// ── Markets Service ───────────────────────────────────────────
export const marketsAPI = {
  list: (filters: MarketFilters = {}) =>
    http.get<Market[]>('/markets', { params: { status: 'active', limit: 50, ...filters } }),

  get: (idOrSlug: string) =>
    http.get<Market>(`/markets/${idOrSlug}`),

  placeBet: (marketId: string, option: 'yes' | 'no', amount: number) =>
    http.post<{ new_balance: number; bet: Bet; market: Market }>(`/markets/${marketId}/bet`, { option, amount }),

  myBets: (params?: { skip?: number; limit?: number }) =>
    http.get<Bet[]>('/markets/my-bets', { params }),

  priceHistory: (marketId: string, hours = 168) =>
    http.get<Array<{ timestamp: string; yes_price: number; no_price: number; volume: number }>>(
      `/markets/${marketId}/price-history`, { params: { hours } }
    )
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

export default http;


