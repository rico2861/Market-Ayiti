import { useState, useEffect, useCallback } from 'react';
import { FileText, ChevronLeft, ChevronRight, RefreshCw, ChevronDown } from 'lucide-react';
import { adminAPI } from '../api';
import AdminLayout from '../components/AdminLayout';

interface Log {
  id: string; action: string; entity_type: string; entity_id: string;
  username?: string; user_id?: string; details?: string; ip?: string; created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string; badge: string }> = {
  CREATE_MARKET:       { label: 'Marché créé',           color: '#3fb950', badge: 'badge-green'  },
  UPDATE_MARKET:       { label: 'Marché modifié',        color: '#58a6ff', badge: 'badge-blue'   },
  RESOLVE_MARKET:      { label: 'Marché résolu',         color: '#a371f7', badge: 'badge-purple' },
  DELETE_MARKET:       { label: 'Marché supprimé',       color: '#f85149', badge: 'badge-red'    },
  UPDATE_USER:         { label: 'Utilisateur modifié',   color: '#d29922', badge: 'badge-yellow' },
  MANUAL_DEPOSIT:      { label: 'Dépôt manuel',          color: '#3fb950', badge: 'badge-green'  },
  ADMIN_RESET_PASSWORD:{ label: 'Reset mot de passe',    color: '#f85149', badge: 'badge-red'    },
  APPROVE_WITHDRAWAL:  { label: 'Retrait approuvé',      color: '#3fb950', badge: 'badge-green'  },
  REJECT_WITHDRAWAL:   { label: 'Retrait rejeté',        color: '#f85149', badge: 'badge-red'    },
  ACCOUNT_LOCKED:      { label: 'Compte bloqué',         color: '#f85149', badge: 'badge-red'    },
  ACCOUNT_UNLOCKED:    { label: 'Compte débloqué (auto)',color: '#3fb950', badge: 'badge-green'  },
  FORCE_UNLOCK:        { label: 'Déblocage admin',       color: '#a371f7', badge: 'badge-purple' },
  BAN_USER:            { label: 'Utilisateur banni',     color: '#f85149', badge: 'badge-red'    },
  SUSPEND_USER:        { label: 'Utilisateur suspendu',  color: '#d29922', badge: 'badge-yellow' },
  UNBAN_USER:          { label: 'Utilisateur débanni',   color: '#3fb950', badge: 'badge-green'  },
  CREATE_USER:         { label: 'Utilisateur créé',      color: '#58a6ff', badge: 'badge-blue'   },
};

const ALL_ACTIONS = Object.keys(ACTION_LABELS);
const PER_PAGE = 100;

export default function AdminLogs() {
  const [logs, setLogs]     = useState<Log[]>([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage]     = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adminAPI.getLogs({ limit: PER_PAGE, skip: (page - 1) * PER_PAGE, action: actionFilter || undefined })
      .then(r => {
        const d = r.data;
        setLogs(d?.rows ?? d ?? []);
        setTotal(d?.total ?? d?.length ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, actionFilter]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const parseDetails = (raw?: string) => {
    if (!raw) return null;
    try { return JSON.stringify(JSON.parse(raw), null, 2); }
    catch { return raw; }
  };

  return (
    <AdminLayout>
      <div style={{ padding: 24 }} className="fade-in">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'white' }}>
              Logs Système <span style={{ color: '#484f58', fontSize: 14, fontWeight: 400 }}>({total.toLocaleString()})</span>
            </h1>
            <div style={{ fontSize: 12, color: '#484f58', marginTop: 2 }}>Audit trail — toutes les actions administrateur</div>
          </div>
          <button onClick={() => { setPage(1); load(); }} className="btn btn-ghost btn-sm"><RefreshCw size={13} /></button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}
            className="input" style={{ width: 220, height: 34, fontSize: 12 }}>
            <option value="">Toutes les actions</option>
            {ALL_ACTIONS.map(a => <option key={a} value={a}>{ACTION_LABELS[a]?.label || a}</option>)}
          </select>
          {actionFilter && (
            <button onClick={() => { setActionFilter(''); setPage(1); }} className="btn btn-ghost btn-sm">Effacer</button>
          )}
          <span style={{ fontSize: 12, color: '#484f58', marginLeft: 'auto' }}>{total.toLocaleString()} entrées</span>
        </div>

        {/* Logs */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>{['Action', 'Par', 'Entité', 'IP', 'Date', 'Détails'].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 10 }).map((_, i) => <tr key={i}><td colSpan={6}><div className="skel" style={{ height: 14 }} /></td></tr>)
                  : logs.length === 0
                  ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#484f58' }}><FileText size={24} style={{ display: 'block', margin: '0 auto 8px' }} />Aucun log trouvé</td></tr>
                  : logs.map(log => {
                    const meta = ACTION_LABELS[log.action];
                    const details = parseDetails(log.details);
                    const isOpen = expanded === log.id;
                    return (
                      <>
                        <tr key={log.id}>
                          <td>
                            <span className={`badge ${meta?.badge || 'badge-gray'}`}>{meta?.label || log.action}</span>
                          </td>
                          <td style={{ fontSize: 12, color: 'white', fontWeight: 500 }}>
                            {log.username || <span style={{ color: '#484f58' }}>système</span>}
                          </td>
                          <td style={{ fontSize: 11, color: '#8b949e' }}>
                            <span style={{ color: '#484f58' }}>{log.entity_type}</span>
                            {log.entity_id && <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#484f58' }}>{log.entity_id.slice(0, 8)}…</div>}
                          </td>
                          <td style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#484f58' }}>
                            {log.ip || '—'}
                          </td>
                          <td style={{ fontSize: 11, color: '#8b949e', whiteSpace: 'nowrap' }}>
                            {new Date(log.created_at).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td>
                            {details && (
                              <button onClick={() => setExpanded(isOpen ? null : log.id)} className="btn btn-ghost btn-xs">
                                <ChevronDown size={12} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                              </button>
                            )}
                          </td>
                        </tr>
                        {isOpen && details && (
                          <tr key={`${log.id}-detail`} style={{ background: '#0d1117' }}>
                            <td colSpan={6} style={{ padding: '0 14px 12px' }}>
                              <pre style={{ margin: 0, fontSize: 11, color: '#8b949e', background: '#161b22', borderRadius: 6, padding: '10px 14px', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.06)', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.6 }}>{details}</pre>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 12, color: '#484f58' }}>Page {page}/{totalPages}</span>
            <div className="pagination">
              <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /></button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = totalPages <= 5 ? i + 1 : Math.min(Math.max(page - 2 + i, 1), totalPages - 4 + i);
                return <button key={p} className={`page-btn${p === page ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>;
              })}
              <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
