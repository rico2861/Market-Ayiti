import { useState, useEffect, useMemo } from 'react';
import { Search, Trash2, MessageSquare, X, RefreshCw } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import axios from 'axios';
import toast from 'react-hot-toast';

const http = axios.create({ baseURL: '/api/v1', withCredentials: true });

interface Comment {
  id: string;
  text: string;
  created_at: string;
  username: string;
  user_id: string;
  market_title: string;
  market_id: string;
  market_slug?: string;
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `il y a ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `il y a ${d}j`;
  return new Date(iso).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
}

function truncate(str: string, max = 80): string {
  return str.length > max ? str.slice(0, max).trimEnd() + '…' : str;
}

export default function AdminComments() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    http.get<Comment[]>('/admin/comments')
      .then(r => setComments(r.data))
      .catch(() => toast.error('Impossible de charger les commentaires'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return comments;
    const q = search.toLowerCase();
    return comments.filter(c =>
      c.username.toLowerCase().includes(q) ||
      c.text.toLowerCase().includes(q)
    );
  }, [comments, search]);

  const handleDelete = async (id: string) => {
    // optimistic remove
    setComments(prev => prev.filter(c => c.id !== id));
    setDeletingId(id);
    try {
      await http.delete(`/admin/comments/${id}`);
      toast.success('Commentaire supprimé');
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Erreur lors de la suppression');
      // rollback — reload from server
      load();
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDelete = (c: Comment) => {
    toast(t => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 13, color: '#e6edf3', fontWeight: 600 }}>
          Supprimer ce commentaire ?
        </div>
        <div style={{ fontSize: 12, color: '#8b949e' }}>
          {truncate(c.text, 60)} — <strong style={{ color: '#c9d1d9' }}>{c.username}</strong>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { toast.dismiss(t.id); handleDelete(c.id); }}
            style={{
              flex: 1, padding: '6px 12px', borderRadius: 6, border: 'none',
              background: '#f85149', color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}>
            Supprimer
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            style={{
              flex: 1, padding: '6px 12px', borderRadius: 6, fontSize: 12,
              border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)',
              color: '#8b949e', cursor: 'pointer',
            }}>
            Annuler
          </button>
        </div>
      </div>
    ), { duration: 8000 });
  };

  return (
    <AdminLayout>
      <div style={{ padding: 24 }} className="fade-in">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MessageSquare size={18} color="#58a6ff" />
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'white' }}>
              Commentaires{' '}
              <span style={{ color: '#484f58', fontSize: 14, fontWeight: 400 }}>
                ({filtered.length}{search ? ` / ${comments.length}` : ''})
              </span>
            </h1>
          </div>
          <button onClick={load} className="btn btn-ghost btn-sm">
            <RefreshCw size={13} />
          </button>
        </div>

        {/* Search bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
            <Search
              size={13}
              style={{
                position: 'absolute', left: 10, top: '50%',
                transform: 'translateY(-50%)', color: '#484f58', pointerEvents: 'none',
              }}
            />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par utilisateur ou commentaire…"
              className="input"
              style={{ paddingLeft: 30, height: 34, fontSize: 12, width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          {search && (
            <button onClick={() => setSearch('')} className="btn btn-ghost btn-sm">
              <X size={13} /> Effacer
            </button>
          )}
        </div>

        {/* Stats chip */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div className="stat-chip">
            <span className="stat-chip-val" style={{ color: '#58a6ff' }}>{comments.length}</span>
            <span className="stat-chip-lbl">Total</span>
          </div>
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  {['Marché', 'Utilisateur', 'Commentaire', 'Date', 'Actions'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5}><div className="skel" style={{ height: 14 }} /></td>
                    </tr>
                  ))
                  : filtered.length === 0
                  ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: '#484f58' }}>
                        {search ? `Aucun résultat pour "${search}"` : 'Aucun commentaire'}
                      </td>
                    </tr>
                  )
                  : filtered.map(c => (
                    <tr
                      key={c.id}
                      style={{ opacity: deletingId === c.id ? 0.4 : 1, transition: 'opacity 0.2s' }}
                    >
                      {/* Market */}
                      <td style={{ maxWidth: 180 }}>
                        <div style={{ fontSize: 12, color: 'white', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.market_title || '—'}
                        </div>
                        {c.market_slug && (
                          <div style={{ fontSize: 10, color: '#484f58', marginTop: 1 }}>/{c.market_slug}</div>
                        )}
                      </td>

                      {/* User */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                            background: 'rgba(88,166,255,0.12)', border: '1px solid rgba(88,166,255,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: 700, color: '#58a6ff',
                          }}>
                            {c.username?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <span style={{ fontSize: 12, color: '#c9d1d9', fontWeight: 500 }}>{c.username}</span>
                        </div>
                      </td>

                      {/* Comment text */}
                      <td style={{ maxWidth: 320 }}>
                        <span
                          style={{ fontSize: 12, color: '#8b949e', lineHeight: 1.5 }}
                          title={c.text}
                        >
                          {truncate(c.text, 90)}
                        </span>
                      </td>

                      {/* Date */}
                      <td style={{ fontSize: 11, color: '#484f58', whiteSpace: 'nowrap' }}>
                        {relativeDate(c.created_at)}
                      </td>

                      {/* Actions */}
                      <td>
                        <button
                          onClick={() => confirmDelete(c)}
                          disabled={deletingId === c.id}
                          className="btn btn-danger btn-xs"
                          title="Supprimer le commentaire"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f85149'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = ''; }}
                        >
                          <Trash2 size={12} />
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
