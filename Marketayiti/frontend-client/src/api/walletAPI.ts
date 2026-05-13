import http from './Authapi';
import type { PaymentMethod, Transaction } from '../types';

// ── Wallet Service ────────────────────────────────────────────
export const walletAPI = {
    methods: () => http.get<PaymentMethod[]>('/wallet/methods'),

    deposit: (data: { method: string; amount: number; phone?: string }) =>
        http.post<{ id: string; message: string }>('/wallet/deposit', data),

    withdraw: (data: { method: string; amount: number; phone: string }) =>
        http.post<{ id: string; message: string }>('/wallet/withdraw', data),

    getTransactions: (params?: { skip?: number; limit?: number; type?: string }) =>
        http.get<Transaction[]>('/wallet/transactions', { params }),
};

export default walletAPI;
