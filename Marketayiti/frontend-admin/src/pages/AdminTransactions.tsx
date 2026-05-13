import { useState, useEffect, useCallback } from 'react';
import {
  Search, Download, Check, X, ChevronLeft, ChevronRight,
  AlertCircle, Eye, Copy, CheckCheck,
  ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown,
  Gift, RefreshCw, User, Calendar, Hash, CreditCard, Phone, FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminAPI } from '../api';
import AdminLayout from '../components/AdminLayout';

interface Tx {
  id: string; user_id: string; username: string; email: string; type: string;
  amount: number; balance_before: number; balance_after: number;
  status: string; description: string; payment_method: string;
  phone_number?: string; reference_id?: string; created_at: string;
}

const TYPE_TABS = [
  { val: '', lbl: 'Tout' },
  { val: 'deposit', lbl: 'Dépôts' },
  { val: 'bonus', lbl: 'Bonus' },
  { val: 'withdrawal', lbl: 'Retraits' },
  { val: 'bet', lbl: 'Paris' },
  { val: 'win', lbl: 'Gains' },
];

const TYPE_CLR: Record<string, string> = {
  deposit: '#3fb950', bonus: '#a371f7', withdrawal: '#f85149',
  bet: '#58a6ff', win: '#3fb950', refund: '#d29922', adjustment: '#8b949e',
};
const TYPE_ICON: Record<string, React.ReactNode> = {
  deposit:    <ArrowDownLeft size={14} />,
  bonus:      <Gift size={14} />,
  withdrawal: <ArrowUpRight size={14} />,
  bet:        <TrendingDown size={14} />,
  win:        <TrendingUp size={14} />,
  refund:     <RefreshCw size={14} />,
};
const TYPE_SIGN: Record<string, string> = {
  deposit: '+', bonus: '+', win: '+', refund: '+',
  withdrawal: '-', bet: '-', bet_slip: '-',
};
const STATUS_CLR: Record<string, string> = {
  completed: 'badge-green', pending: 'badge-yellow',
  failed: 'badge-red', rejected: 'badge-red', cancelled: 'badge-gray',
};
const STATUS_LABEL: Record<string, string> = {
  completed: 'Complété', pending: 'En attente', failed: 'Échoué',
  rejected: 'Rejeté', cancelled: 'Annulé',
};
const PER_PAGE = 50;

function fmt(n: number) { return Math.floor(n).toLocaleString(); }

/* ── Copy button ── */
function CopyBtn({ text, short }: { text: string; short?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <button onClick={copy} title="Copier" style={{
      background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex',
      alignItems: 'center', gap: 4, padding: '2px 5px', borderRadius: 4,
      color: copied ? '#3fb950' : '#58a6ff', transition: 'color .15s', fontFamily: 'inherit',
    }}>
      {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
      {short && <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono,monospace' }}>{text.slice(0, 8)}…</span>}
    </button>
  );
}

/* ── Detail modal ── */
function TxDetailModal({ tx, onClose }: { tx: Tx; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const color = TYPE_CLR[tx.type] || '#8b949e';
  const sign  = TYPE_SIGN[tx.type] || '';
  const icon  = TYPE_ICON[tx.type] ?? <FileText size={14} />;
  const isCredit = ['deposit', 'bonus', 'win', 'refund'].includes(tx.type);

  const Row = ({ icon: ic, label, value, mono = false, copy = false }: {
    icon: React.ReactNode; label: string; value: string; mono?: boolean; copy?: boolean;
  }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', flexShrink: 0 }}>
        {ic}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.07em', margin: '0 0 3px' }}>{label}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#e2e8f0', fontFamily: mono ? 'JetBrains Mono,monospace' : 'inherit', wordBreak: 'break-all' }}>
            {value}
          </span>
          {copy && <CopyBtn text={value} />}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 520,
        background: '#161b22', border: '1px solid rgba(255,255,255,.1)',
        borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.6)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}1a`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {icon}
            </div>
            <div>
              <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '.07em' }}>Détail Transaction</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'white', margin: 0 }}>{tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.07)', border: 'none', borderRadius: 8, color: '#6b7280', cursor: 'pointer', padding: '6px 10px', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* Amount hero */}
        <div style={{ padding: '20px 24px', background: `${color}08`, borderBottom: '1px solid rgba(255,255,255,.05)', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '.08em' }}>Montant</p>
          <p style={{ fontSize: 36, fontWeight: 900, color: isCredit ? '#3fb950' : '#f85149', fontFamily: 'JetBrains Mono,monospace', margin: 0 }}>
            {sign}{fmt(tx.amount)} <span style={{ fontSize: 16, color: '#4b6376' }}>HTG</span>
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 }}>
            <span className={`badge ${STATUS_CLR[tx.status] || 'badge-gray'}`}>{STATUS_LABEL[tx.status] || tx.status}</span>
            <span className="badge" style={{ background: `${color}22`, color }}>{tx.type}</span>
          </div>
        </div>

        {/* Details */}
        <div style={{ padding: '4px 24px 0', maxHeight: '50vh', overflowY: 'auto' }}>
          <Row icon={<Hash size={14} />}    label="ID Transaction" value={tx.id}              mono copy />
          <Row icon={<User size={14} />}    label="Utilisateur"    value={`${tx.username} — ${tx.email}`} />
          <Row icon={<Hash size={14} />}    label="User ID"        value={tx.user_id}          mono copy />
          <Row icon={<TrendingDown size={14} />} label="Solde avant"  value={`${fmt(tx.balance_before)} HTG`} mono />
          <Row icon={<TrendingUp size={14} />}   label="Solde après"  value={`${fmt(tx.balance_after)} HTG`}  mono />
          {tx.payment_method && <Row icon={<CreditCard size={14} />} label="Méthode paiement" value={tx.payment_method} />}
          {tx.phone_number   && <Row icon={<Phone size={14} />}      label="Téléphone"         value={tx.phone_number} copy />}
          {tx.reference_id   && <Row icon={<Hash size={14} />}       label="Référence"         value={tx.reference_id} mono copy />}
          {tx.description    && <Row icon={<FileText size={14} />}   label="Description"       value={tx.description} />}
          <Row icon={<Calendar size={14} />} label="Date & heure" value={new Date(tx.created_at).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'medium' })} />
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,.07)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ fontSize: 13 }}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════ */
export default function AdminTransactions() {
  const [txs, setTxs]         = useState<Tx[]>([]);
  const [total, setTotal]      = useState(0);
  const [loading, setLoading]  = useState(true);
  const [page, setPage]        = useState(1);
  const [selectedTx, setSelectedTx] = useState<Tx | null>(null);

  const [typeFilter, setTypeFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]             = useState('');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');

  const [pendingDep, setPendingDep] = useState<Tx[]>([]);
  const [depBusy, setDepBusy]       = useState<string | null>(null);
  const [pendingWd, setPendingWd]   = useState<Tx[]>([]);
  const [wdBusy, setWdBusy]         = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params: any = { limit: PER_PAGE, skip: (page - 1) * PER_PAGE };
    if (typeFilter)   params.type      = typeFilter;
    if (statusFilter) params.status    = statusFilter;
    if (search)       params.search    = search;
    if (dateFrom)     params.date_from = dateFrom;
    if (dateTo)       params.date_to   = dateTo;
    adminAPI.getTransactions(params)
      .then(r => {
        const data = r.data;
        if (data?.rows) { setTxs(data.rows); setTotal(data.total); }
        else { setTxs(data); setTotal(data.length); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, typeFilter, statusFilter, search, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    adminAPI.getDeposits().then(r => setPendingDep((r.data as Tx[]).filter(t => t.status === 'pending'))).catch(() => {});
    adminAPI.getWithdrawals().then(r => setPendingWd((r.data as Tx[]).filter(t => t.status === 'pending'))).catch(() => {});
  }, []);

  const handleApproveDeposit = async (id: string) => {
    setDepBusy(id);
    try { await adminAPI.approveDeposit(id); toast.success('Dépôt approuvé'); setPendingDep(p => p.filter(t => t.id !== id)); load(); }
    catch (e: any) { toast.error(e.response?.data?.detail || 'Erreur'); }
    finally { setDepBusy(null); }
  };
  const handleRejectDeposit = async (id: string) => {
    setDepBusy(id);
    try { await adminAPI.rejectDeposit(id); toast.success('Dépôt rejeté'); setPendingDep(p => p.filter(t => t.id !== id)); load(); }
    catch (e: any) { toast.error(e.response?.data?.detail || 'Erreur'); }
    finally { setDepBusy(null); }
  };
  const handleApproveWd = async (id: string) => {
    setWdBusy(id);
    try { await adminAPI.approveWithdrawal(id); toast.success('Retrait approuvé'); setPendingWd(p => p.filter(t => t.id !== id)); load(); }
    catch (e: any) { toast.error(e.response?.data?.detail || 'Erreur'); }
    finally { setWdBusy(null); }
  };
  const handleRejectWd = async (id: string) => {
    setWdBusy(id);
    try { await adminAPI.rejectWithdrawal(id); toast.success('Retrait rejeté'); setPendingWd(p => p.filter(t => t.id !== id)); load(); }
    catch (e: any) { toast.error(e.response?.data?.detail || 'Erreur'); }
    finally { setWdBusy(null); }
  };

  const exportCSV = async () => {
    try {
      const r = await adminAPI.getTransactions({ limit: 5000, type: typeFilter || undefined, status: statusFilter || undefined, search: search || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined });
      const rows: Tx[] = r.data?.rows ?? r.data ?? [];
      const headers = ['ID', 'Date', 'Utilisateur', 'Email', 'Type', 'Montant', 'Avant', 'Après', 'Statut', 'Méthode', 'Téléphone', 'Référence', 'Description'];
      const body = rows.map(tx => [
        tx.id, new Date(tx.created_at).toLocaleString('fr'), tx.username, tx.email,
        tx.type, tx.amount, tx.balance_before, tx.balance_after, tx.status,
        tx.payment_method || '', tx.phone_number || '', tx.reference_id || '',
        (tx.description || '').replace(/"/g, '""'),
      ].map(v => `"${v}"`));
      const csv = [headers, ...body].map(r => r.join(',')).join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `transactions-${new Date().toISOString().slice(0, 10)}.csv` });
      a.click(); URL.revokeObjectURL(a.href);
      toast.success(`${rows.length} transactions exportées`);
    } catch { toast.error('Export échoué'); }
  };

  const resetFilters = () => { setTypeFilter(''); setStatusFilter(''); setSearch(''); setDateFrom(''); setDateTo(''); setPage(1); };
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <AdminLayout>
      <div style={{ padding: 24 }} className="fade-in">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'white' }}>
            Transactions <span style={{ color: '#484f58', fontSize: 14, fontWeight: 400 }}>({total.toLocaleString()})</span>
          </h1>
          <button onClick={exportCSV} className="btn btn-ghost" style={{ fontSize: 12 }}>
            <Download size={13} /> Export CSV
          </button>
        </div>

        {/* Pending deposits */}
        {pendingDep.length > 0 && (
          <div className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden', border: '1px solid rgba(63,185,80,0.2)', background: 'rgba(63,185,80,0.05)' }}>
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(63,185,80,0.15)' }}>
              <AlertCircle size={14} color="#3fb950" />
              <span style={{ fontSize: 13, color: '#3fb950', fontWeight: 600 }}>{pendingDep.length} dépôt{pendingDep.length > 1 ? 's' : ''} en attente</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead><tr>{['Utilisateur','Montant','Tél MonCash','Date','Actions'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {pendingDep.map(tx => (
                    <tr key={tx.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedTx(tx)}>
                      <td style={{ fontSize: 12, color: 'white', fontWeight: 500 }}>{tx.username}<br /><span style={{ fontSize: 10, color: '#484f58' }}>{tx.email}</span></td>
                      <td style={{ fontSize: 13, fontWeight: 800, fontFamily: 'JetBrains Mono,monospace', color: '#3fb950' }}>{fmt(tx.amount)} HTG</td>
                      <td style={{ fontSize: 12, color: '#8b949e' }}>{tx.phone_number || '—'}</td>
                      <td style={{ fontSize: 11, color: '#8b949e', whiteSpace: 'nowrap' }}>{new Date(tx.created_at).toLocaleString('fr', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => handleApproveDeposit(tx.id)} disabled={depBusy === tx.id} className="btn btn-success btn-xs"><Check size={12} /> Confirmer</button>
                          <button onClick={() => handleRejectDeposit(tx.id)}  disabled={depBusy === tx.id} className="btn btn-danger btn-xs"><X size={12} /> Rejeter</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pending withdrawals */}
        {pendingWd.length > 0 && (
          <div className="card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden', border: '1px solid rgba(248,81,73,0.2)', background: 'rgba(248,81,73,0.05)' }}>
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(248,81,73,0.15)' }}>
              <AlertCircle size={14} color="#f85149" />
              <span style={{ fontSize: 13, color: '#f85149', fontWeight: 600 }}>{pendingWd.length} retrait{pendingWd.length > 1 ? 's' : ''} en attente</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead><tr>{['Utilisateur','Montant','Méthode','Date','Actions'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {pendingWd.map(tx => (
                    <tr key={tx.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedTx(tx)}>
                      <td style={{ fontSize: 12, color: 'white', fontWeight: 500 }}>{tx.username}<br /><span style={{ fontSize: 10, color: '#484f58' }}>{tx.phone_number}</span></td>
                      <td style={{ fontSize: 13, fontWeight: 800, fontFamily: 'JetBrains Mono,monospace', color: '#f85149' }}>{fmt(tx.amount)} HTG</td>
                      <td style={{ fontSize: 12, color: '#8b949e' }}>{tx.payment_method || '—'}</td>
                      <td style={{ fontSize: 11, color: '#8b949e', whiteSpace: 'nowrap' }}>{new Date(tx.created_at).toLocaleString('fr', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => handleApproveWd(tx.id)} disabled={wdBusy === tx.id} className="btn btn-success btn-xs"><Check size={12} /> Approuver</button>
                          <button onClick={() => handleRejectWd(tx.id)}  disabled={wdBusy === tx.id} className="btn btn-danger btn-xs"><X size={12} /> Rejeter</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Type tabs */}
        <div className="tabs">
          {TYPE_TABS.map(({ val, lbl }) => (
            <button key={val} className={`tab${typeFilter === val ? ' active' : ''}`}
              onClick={() => { setTypeFilter(val); setPage(1); }}>{lbl}</button>
          ))}
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#484f58', pointerEvents: 'none' }} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="ID, utilisateur, description..." className="input" style={{ paddingLeft: 30, height: 34, fontSize: 12 }} />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="input" style={{ width: 130, height: 34, fontSize: 12 }}>
            <option value="">Tous statuts</option>
            <option value="completed">Complété</option>
            <option value="pending">En attente</option>
            <option value="failed">Échoué</option>
            <option value="rejected">Rejeté</option>
          </select>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="input" style={{ width: 140, height: 34, fontSize: 12 }} />
          <span style={{ color: '#484f58', fontSize: 12 }}>→</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="input" style={{ width: 140, height: 34, fontSize: 12 }} />
          {(search || statusFilter || dateFrom || dateTo) && (
            <button onClick={resetFilters} className="btn btn-ghost btn-sm"><X size={13} /> Effacer</button>
          )}
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  {['ID Transaction', 'Utilisateur', 'Type', 'Montant', 'Avant → Après', 'Statut', 'Date', ''].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => <tr key={i}><td colSpan={8}><div className="skel" style={{ height: 14 }} /></td></tr>)
                  : txs.length === 0
                  ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#484f58' }}>Aucune transaction trouvée</td></tr>
                  : txs.map(tx => {
                    const color = TYPE_CLR[tx.type] || '#8b949e';
                    const sign  = TYPE_SIGN[tx.type] || '';
                    const isCredit = ['deposit','bonus','win','refund'].includes(tx.type);
                    return (
                      <tr key={tx.id} onClick={() => setSelectedTx(tx)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono,monospace', color: '#58a6ff' }}>
                              {tx.id.slice(0, 8)}…
                            </span>
                            <CopyBtn text={tx.id} />
                          </div>
                          {tx.description && (
                            <div style={{ fontSize: 10, color: '#484f58', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {tx.description}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: 12, color: 'white', fontWeight: 500 }}>{tx.username}</div>
                          <div style={{ fontSize: 10, color: '#484f58' }}>{tx.email}</div>
                        </td>
                        <td>
                          <span className="badge" style={{ background: `${color}22`, color, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            {TYPE_ICON[tx.type] && <span style={{ display: 'flex' }}>{TYPE_ICON[tx.type]}</span>}
                            {tx.type}
                          </span>
                        </td>
                        <td style={{ fontSize: 13, fontWeight: 800, fontFamily: 'JetBrains Mono,monospace', color: isCredit ? '#3fb950' : '#f85149', whiteSpace: 'nowrap' }}>
                          {sign}{fmt(tx.amount)} HTG
                        </td>
                        <td style={{ fontSize: 11, color: '#8b949e', fontFamily: 'JetBrains Mono,monospace', whiteSpace: 'nowrap' }}>
                          {fmt(tx.balance_before)} → {fmt(tx.balance_after)}
                        </td>
                        <td>
                          <span className={`badge ${STATUS_CLR[tx.status] || 'badge-gray'}`}>{STATUS_LABEL[tx.status] || tx.status}</span>
                          {tx.status === 'pending' && tx.type === 'withdrawal' && (
                            <div style={{ display: 'flex', gap: 4, marginTop: 4 }} onClick={e => e.stopPropagation()}>
                              <button onClick={() => handleApproveWd(tx.id)} disabled={wdBusy === tx.id} className="btn btn-success btn-xs"><Check size={10} /></button>
                              <button onClick={() => handleRejectWd(tx.id)}  disabled={wdBusy === tx.id} className="btn btn-danger btn-xs"><X size={10} /></button>
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: 11, color: '#8b949e', whiteSpace: 'nowrap' }}>
                          {new Date(tx.created_at).toLocaleString('fr', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td>
                          <button
                            onClick={e => { e.stopPropagation(); setSelectedTx(tx); }}
                            className="btn btn-ghost btn-xs"
                            title="Voir détails"
                          >
                            <Eye size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 12, color: '#484f58' }}>Page {page}/{totalPages} · {total.toLocaleString()} résultats</span>
            <div className="pagination">
              <button className="page-btn" disabled={page === 1} onClick={() => setPage(1)}><ChevronLeft size={12} /><ChevronLeft size={12} /></button>
              <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /></button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = totalPages <= 5 ? i + 1 : Math.min(Math.max(page - 2 + i, 1), totalPages - 4 + i);
                return <button key={p} className={`page-btn${p === page ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>;
              })}
              <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight size={14} /></button>
              <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)}><ChevronRight size={12} /><ChevronRight size={12} /></button>
            </div>
          </div>
        )}
      </div>

      {selectedTx && <TxDetailModal tx={selectedTx} onClose={() => setSelectedTx(null)} />}
    </AdminLayout>
  );
}
