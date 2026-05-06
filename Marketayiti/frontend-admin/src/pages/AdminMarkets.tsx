import { useState, useEffect } from 'react';
import { Plus, Check, X, Edit3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminAPI } from '../api';
import AdminLayout from '../components/AdminLayout';

const CATS = ['politik', 'spo', 'ekonomi', 'kilti', 'sosyal', 'lot', 'nouvo'];
const STATUS_COLOR: Record<string, string> = {
  active: '#3fb950', closed: '#8b949e', resolved: '#a371f7',
  draft: '#d29922', cancelled: '#f85149'
};

interface Market {
  id: string; title: string; category: string; status: string;
  yes_prob: number; total_volume: number; bet_count: number;
  end_date: string; resolution?: string;
}

const EMPTY_FORM = {
  title: '', description: '', category: 'politik',
  end_date: '', min_bet: '50', max_bet: '100000', image_url: ''
};

export default function AdminMarkets() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [busy, setBusy] = useState(false);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<'yes' | 'no'>('yes');

  const load = () => {
    setLoading(true);
    adminAPI.getMarkets({ status: 'all', limit: 100 })
      .then(r => setMarkets(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await adminAPI.createMarket({
        ...form,
        min_bet: parseFloat(form.min_bet),
        max_bet: parseFloat(form.max_bet)
      });
      toast.success('Machè kreye!');
      setForm({ ...EMPTY_FORM });
      setShowCreate(false);
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Erè');
    } finally { setBusy(false); }
  };

  const handleResolve = async () => {
    if (!resolveId) return;
    setBusy(true);
    try {
      await adminAPI.resolveMarket(resolveId, { resolution });
      toast.success(`Rezoud: ${resolution.toUpperCase()}`);
      setResolveId(null);
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Erè');
    } finally { setBusy(false); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await adminAPI.updateMarket(id, { status });
      toast.success('Estati chanje');
      load();
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Erè'); }
  };

  const F = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Minimum end_date = tomorrow
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 16);

  return (
    <AdminLayout>
      <div style={{ padding: 24 }} className="fade-in">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'white' }}>Marchés</h1>
          <button onClick={() => setShowCreate(s => !s)} className="btn btn-primary">
            <Plus size={15} /> Nouveau Marché
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="card fade-in" style={{ marginBottom: 20 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'white' }}>
              Créer un Marché
            </h2>
            <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase',
                  letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 5 }}>
                  Titre *
                </label>
                <input value={form.title} onChange={e => F('title', e.target.value)}
                  placeholder="Question du marché..." className="input" required minLength={10} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase',
                  letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 5 }}>
                  Description
                </label>
                <textarea value={form.description} onChange={e => F('description', e.target.value)}
                  placeholder="Contexte et critères de résolution..." className="input"
                  style={{ minHeight: 80, resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase',
                  letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 5 }}>
                  Catégorie *
                </label>
                <select value={form.category} onChange={e => F('category', e.target.value)} className="input">
                  {CATS.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase',
                  letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 5 }}>
                  Date de fin *
                </label>
                <input type="datetime-local" value={form.end_date} min={minDate}
                  onChange={e => F('end_date', e.target.value)} className="input" required />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase',
                  letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 5 }}>
                  Mise min (HTG)
                </label>
                <input type="number" value={form.min_bet} onChange={e => F('min_bet', e.target.value)}
                  className="input" min={1} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase',
                  letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 5 }}>
                  Mise max (HTG)
                </label>
                <input type="number" value={form.max_bet} onChange={e => F('max_bet', e.target.value)}
                  className="input" min={1} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase',
                  letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 5 }}>
                  Image URL
                </label>
                <input type="url" value={form.image_url} onChange={e => F('image_url', e.target.value)}
                  placeholder="https://..." className="input" />
              </div>
              <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8 }}>
                <button type="submit" disabled={busy} className="btn btn-primary">
                  {busy ? '...' : <><Check size={14} /> Créer</>}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn btn-ghost">
                  <X size={14} /> Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Resolve modal */}
        {resolveId && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
          }}>
            <div className="card" style={{ maxWidth: 360, width: '100%' }}>
              <h3 style={{ margin: '0 0 16px', color: 'white', fontSize: 16 }}>Résoudre le marché</h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {(['yes', 'no'] as const).map(r => (
                  <button key={r} onClick={() => setResolution(r)}
                    className="btn" style={{
                      flex: 1,
                      background: resolution === r
                        ? (r === 'yes' ? '#3fb950' : '#f85149')
                        : 'rgba(255,255,255,0.05)',
                      color: resolution === r ? '#fff' : '#8b949e',
                      border: 'none'
                    }}>
                    {r === 'yes' ? 'Oui (Wi)' : 'Non'}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleResolve} disabled={busy} className="btn btn-primary" style={{ flex: 1 }}>
                  {busy ? '...' : 'Confirmer'}
                </button>
                <button onClick={() => setResolveId(null)} className="btn btn-ghost">Annuler</button>
              </div>
            </div>
          </div>
        )}

        {/* Markets table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Titre', 'Cat.', 'Statut', 'Wi%', 'Volume', 'Paris', 'Fin', 'Actions'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left',
                      fontSize: 10, color: '#484f58', textTransform: 'uppercase',
                      letterSpacing: '0.06em', fontWeight: 600, whiteSpace: 'nowrap'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={8} style={{ padding: '12px 14px' }}>
                      <div className="skel" style={{ height: 16 }} />
                    </td></tr>
                  ))
                  : markets.map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 14px', maxWidth: 260 }}>
                        <div style={{ fontSize: 13, color: 'white', fontWeight: 500,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.title}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 10, color: '#8b949e', fontWeight: 600 }}>
                          {m.category.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                          background: `${STATUS_COLOR[m.status] || '#8b949e'}22`,
                          color: STATUS_COLOR[m.status] || '#8b949e'
                        }}>
                          {m.status.toUpperCase()}
                          {m.resolution && ` (${m.resolution.toUpperCase()})`}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#3fb950' }}>
                        {Math.round(m.yes_prob * 100)}%
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#8b949e' }}>
                        {Math.floor(m.total_volume).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#8b949e' }}>
                        {m.bet_count}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#8b949e', whiteSpace: 'nowrap' }}>
                        {new Date(m.end_date).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {m.status === 'active' && (
                            <>
                              <button onClick={() => setResolveId(m.id)}
                                className="btn" style={{
                                  padding: '4px 10px', fontSize: 11,
                                  background: 'rgba(163,113,247,0.12)',
                                  color: '#a371f7', border: '1px solid rgba(163,113,247,0.25)'
                                }}>
                                Résoudre
                              </button>
                              <button onClick={() => handleStatusChange(m.id, 'closed')}
                                className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}>
                                Fermer
                              </button>
                            </>
                          )}
                          {m.status === 'draft' && (
                            <button onClick={() => handleStatusChange(m.id, 'active')}
                              className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 11 }}>
                              Activer
                            </button>
                          )}
                        </div>
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
