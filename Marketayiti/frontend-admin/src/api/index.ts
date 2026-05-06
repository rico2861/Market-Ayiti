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
  login:  (identifier: string, password: string) =>
    http.post('/auth/login', { identifier, password }),
  logout: () => http.post('/auth/logout'),
  me:     () => http.get('/auth/me'),

  // Dashboard
  stats:    () => http.get('/admin/stats'),

  // Users
  getUsers:   (params?: any) => http.get('/admin/users', { params }),
  updateUser: (id: string, data: any) => http.patch(`/admin/users/${id}`, data),

  // Markets
  getMarkets:    (params?: any) => http.get('/markets', { params }),
  createMarket:  (data: any) => http.post('/admin/markets', data),
  updateMarket:  (id: string, data: any) => http.patch(`/admin/markets/${id}`, data),
  deleteMarket:  (id: string) => http.delete(`/admin/markets/${id}`),
  resolveMarket: (id: string, data: any) => http.post(`/admin/markets/${id}/resolve`, data),

  // Transactions & withdrawals
  getTransactions:  (params?: any) => http.get('/admin/transactions', { params }),
  getWithdrawals:   () => http.get('/admin/withdrawals'),
  approveWithdrawal:(id: string) => http.post(`/admin/withdrawals/${id}/approve`),
  rejectWithdrawal: (id: string) => http.post(`/admin/withdrawals/${id}/reject`),

  // Categories
  getCategories: () => http.get<any[]>('/admin/categories'),
};

export default http;
