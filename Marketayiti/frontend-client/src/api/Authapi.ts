import axios, { AxiosInstance, AxiosError } from 'axios';
import type { User } from '../types';

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
  
  // ── PASSWORD RESET - NEW ────────────────────────────────────
  requestReset: (identifier: string) => 
    http.post<{ message: string }>('/auth/request-reset', { identifier }),
  
  verifyReset: (identifier: string, code: string, new_password: string) => 
    http.post<{ message: string }>('/auth/verify-reset', { identifier, code, new_password }),
  
  // ────────────────────────────────────────────────────────────
  
  getProfile: () => http.get<any>('/auth/profile'),
  updateProfile: (d: any) => http.patch<any>('/auth/profile', d),

  logout: () => http.post('/auth/logout'),
  me: () => http.get<User>('/auth/me'),
  refresh: () => http.post('/auth/refresh'),

  changePassword: (current_password: string, new_password: string) =>
    http.post('/auth/change-password', { current_password, new_password })
};

export default http;