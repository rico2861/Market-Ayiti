import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminAPI } from '../api';
import AdminLayout from '../components/AdminLayout';

interface User {
  id: string; email: string; username: string; full_name: string;
  role: string; status: string; balance: number; last_login: string; created_at: string;
}

const STATUS_CLR: Record<string, string> = { active: '#3fb950', suspended: '#d29922', banned: '#f85149' };

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = (q?: string) => {
    setLoading(true);
    adminAPI.getUsers({ search: q || undefined, limit: 100 })
      .then(r => setUsers(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleUpdate = async (id: string, data: any) => {
    try {
      await adminAPI.updateUser(id, data);
      toast.success('Utilisateur mis à jour');
      load();
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Erè'); }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(search);
  };

  return (
    <AdminLayout>
      <div style={{ padding: 24 }} className="fade-in">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'white' }}>
            Utilisateurs <span style={{ color: '#484f58', fontSize: 14, fontWeight: 400 }}>({users.length})</span>
          </h1>
          <form onSubmit={handleSearch} style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#484f58' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..." className="input"
              style={{ paddingLeft: 32, width: 220 }} />
          </form>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Utilisateur', 'Email', 'Rôle', 'Statut', 'Balans', 'Dernière connexion', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left',
                      fontSize: 10, color: '#484f58', textTransform: 'uppercase',
                      letterSpacing: '0.06em', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}><td colSpan={7} style={{ padding: '12px 14px' }}>
                      <div className="skel" style={{ height: 16 }} />
                    </td></tr>
                  ))
                  : users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                            background: 'rgba(31,111,235,0.15)',
                            border: '1px solid rgba(31,111,235,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, color: '#1f6feb'
                          }}>{u.username[0].toUpperCase()}</div>
                          <div>
                            <div style={{ fontSize: 13, color: 'white', fontWeight: 500 }}>{u.username}</div>
                            {u.full_name && <div style={{ fontSize: 11, color: '#8b949e' }}>{u.full_name}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#8b949e' }}>{u.email}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <select value={u.role}
                          onChange={e => handleUpdate(u.id, { role: e.target.value })}
                          style={{
                            background: '#21262d', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 6, color: u.role === 'admin' ? '#a371f7' : '#8b949e',
                            fontSize: 11, padding: '3px 6px', fontFamily: 'inherit', cursor: 'pointer'
                          }}>
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <select value={u.status}
                          onChange={e => handleUpdate(u.id, { status: e.target.value })}
                          style={{
                            background: '#21262d', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 6, color: STATUS_CLR[u.status] || '#8b949e',
                            fontSize: 11, padding: '3px 6px', fontFamily: 'inherit', cursor: 'pointer'
                          }}>
                          <option value="active">active</option>
                          <option value="suspended">suspended</option>
                          <option value="banned">banned</option>
                        </select>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#3fb950',
                        fontFamily: 'JetBrains Mono, monospace' }}>
                        {Math.floor(u.balance).toLocaleString()} HTG
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#8b949e' }}>
                        {u.last_login ? new Date(u.last_login).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <button onClick={() => {
                          const v = prompt('Nouveau solde HTG:', String(Math.floor(u.balance)));
                          if (v && !isNaN(parseFloat(v))) handleUpdate(u.id, { balance: parseFloat(v) });
                        }} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}>
                          Solde
                        </button>
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
