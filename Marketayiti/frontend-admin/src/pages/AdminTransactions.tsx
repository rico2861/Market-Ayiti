import { useState, useEffect } from 'react';
import { adminAPI } from '../api';
import AdminLayout from '../components/AdminLayout';

interface Tx {
  id: string; user_id: string; username: string; type: string;
  amount: number; balance_before: number; balance_after: number;
  status: string; description: string; payment_method: string; created_at: string;
}

const TYPE_CLR: Record<string, string> = {
  deposit: '#3fb950', withdrawal: '#f85149', bet: '#58a6ff',
  win: '#3fb950', refund: '#d29922', adjustment: '#a371f7'
};
const STATUS_CLR: Record<string, string> = {
  completed: '#3fb950', pending: '#d29922', failed: '#f85149', cancelled: '#8b949e'
};

export default function AdminTransactions() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');

  const load = (type?: string) => {
    setLoading(true);
    adminAPI.getTransactions({ limit: 200, type: type || undefined })
      .then(r => setTxs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <AdminLayout>
      <div style={{ padding: 24 }} className="fade-in">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'white' }}>Transactions</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            {['', 'deposit', 'withdrawal', 'bet', 'win'].map(t => (
              <button key={t} onClick={() => { setTypeFilter(t); load(t); }}
                className="btn" style={{
                  padding: '5px 12px', fontSize: 11,
                  background: typeFilter === t ? 'rgba(31,111,235,0.15)' : 'rgba(255,255,255,0.04)',
                  color: typeFilter === t ? '#388bfd' : '#8b949e',
                  border: `1px solid ${typeFilter === t ? 'rgba(31,111,235,0.3)' : 'rgba(255,255,255,0.08)'}`
                }}>
                {t || 'Tous'}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Utilisateur', 'Type', 'Montant', 'Solde Avant', 'Solde Après', 'Statut', 'Méthode', 'Date'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left',
                      fontSize: 10, color: '#484f58', textTransform: 'uppercase',
                      letterSpacing: '0.06em', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}><td colSpan={8} style={{ padding: '12px 14px' }}>
                      <div className="skel" style={{ height: 16 }} />
                    </td></tr>
                  ))
                  : txs.map(tx => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'white', fontWeight: 500 }}>
                        {tx.username || tx.user_id.slice(0, 8)}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                          background: `${TYPE_CLR[tx.type] || '#8b949e'}22`,
                          color: TYPE_CLR[tx.type] || '#8b949e',
                          textTransform: 'uppercase'
                        }}>{tx.type}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700,
                        fontFamily: 'JetBrains Mono, monospace',
                        color: ['deposit','win'].includes(tx.type) ? '#3fb950' : '#f85149' }}>
                        {['deposit','win'].includes(tx.type) ? '+' : '-'}{Math.floor(tx.amount).toLocaleString()} HTG
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#8b949e',
                        fontFamily: 'JetBrains Mono, monospace' }}>
                        {Math.floor(tx.balance_before).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#8b949e',
                        fontFamily: 'JetBrains Mono, monospace' }}>
                        {Math.floor(tx.balance_after).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                          background: `${STATUS_CLR[tx.status] || '#8b949e'}22`,
                          color: STATUS_CLR[tx.status] || '#8b949e'
                        }}>{tx.status}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#8b949e' }}>
                        {tx.payment_method || '—'}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#8b949e', whiteSpace: 'nowrap' }}>
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
