import axios from 'axios';

const http = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000
});

http.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    window.dispatchEvent(new CustomEvent('admin:unauthorized'));
  }
  return Promise.reject(err);
});

export const adminAPI = {
  // Auth
  login:   (identifier: string, password: string) => http.post('/auth/admin/login', { identifier, password }),
  logout:  () => http.post('/auth/admin/logout'),
  me:      () => http.get('/auth/admin/me'),

  // Dashboard
  stats: () => http.get('/admin/stats'),

  // Users
  getUsers:            (params?: any)                  => http.get('/admin/users', { params }),
  createUser:          (data: any)                     => http.post('/admin/users', data),
  getUserDetail:       (id: string)                    => http.get(`/admin/users/${id}`),
  updateUser:          (id: string, data: any)         => http.patch(`/admin/users/${id}`, data),
  depositToUser:       (id: string, data: any)         => http.post(`/admin/users/${id}/deposit`, data),
  addBonus:            (id: string, data: any)         => http.post(`/admin/users/${id}/bonus`, data),
  removeBonus:         (id: string, data: any)         => http.post(`/admin/users/${id}/remove-bonus`, data),
  resetUserPassword:   (id: string, data: any)         => http.post(`/admin/users/${id}/reset-password`, data),
  getLockedCount:      ()                              => http.get('/admin/users/locked-count'),
  getLockedUsers:      ()                              => http.get('/admin/users/locked'),
  forceUnlock:         (id: string, reason: string)   => http.post(`/admin/users/${id}/force-unlock`, { reason }),

  // Markets (admin routes)
  getMarkets:       (params?: any)               => http.get('/admin/markets', { params }),
  getMarketStats:   (id: string)                 => http.get(`/admin/markets/${id}/stats`),
  createMarket:     (data: any)                  => http.post('/admin/markets', data),
  updateMarket:     (id: string, data: any)      => http.patch(`/admin/markets/${id}`, data),
  deleteMarket:     (id: string)                 => http.delete(`/admin/markets/${id}`),
  resolveMarket:    (id: string, data: any)      => http.post(`/admin/markets/${id}/resolve`, data),

  // Transactions, deposits & withdrawals
  getTransactions:   (params?: any) => http.get('/admin/transactions', { params }),
  getBets:           (params?: any) => http.get('/admin/bets', { params }),
  getDeposits:       ()             => http.get('/admin/deposits'),
  approveDeposit:    (id: string)   => http.post(`/admin/deposits/${id}/approve`),
  rejectDeposit:     (id: string)   => http.post(`/admin/deposits/${id}/reject`),
  getWithdrawals:    ()             => http.get('/admin/withdrawals'),
  approveWithdrawal: (id: string)   => http.post(`/admin/withdrawals/${id}/approve`),
  rejectWithdrawal:  (id: string)   => http.post(`/admin/withdrawals/${id}/reject`),

  // Logs
  getLogs: (params?: any) => http.get('/admin/logs', { params }),

  // Categories
  getCategories: () => http.get<any[]>('/admin/categories'),
};

export default http;
