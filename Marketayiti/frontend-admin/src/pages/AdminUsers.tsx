import { useState, useEffect, useCallback } from 'react';
import { Search, UserX, UserCheck, Shield, DollarSign, Key, X, ChevronLeft, ChevronRight, RefreshCw, UserPlus, ShieldOff, Gift, Minus, Lock, Unlock, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminAPI } from '../api';
import AdminLayout from '../components/AdminLayout';

interface User {
  id: string; email: string; username: string; full_name: string; phone?: string;
  role: string; status: string; balance: number; last_login: string; created_at: string;
}
interface UserDetail extends User {
  last_ip?: string; updated_at?: string;
  bonus_balance: number;
  ban_reason?: string;
  failed_attempts?: number;
  locked_until?: string | null;
  stats: { total_bets: number; won_bets: number; total_wagered: number; total_won: number };
  bets: any[];
  transactions: any[];
}

const STATUS_BG: Record<string, string>  = { active: 'badge-green', suspended: 'badge-yellow', banned: 'badge-red' };
const TYPE_CLR: Record<string, string>   = { deposit: '#3fb950', withdrawal: '#f85149', bet: '#58a6ff', win: '#a371f7', refund: '#d29922' };

const PER_PAGE = 50;

export default function AdminUsers() {
  const [users, setUsers]       = useState<User[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]         = useState(1);

  // Detail modal
  const [detail, setDetail]     = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tab, setTab]           = useState<'profile' | 'transactions' | 'bets'>('profile');

  // Action forms
  const [depositAmt, setDepositAmt]   = useState('');
  const [depositDesc, setDepositDesc] = useState('');
  const [depositBusy, setDepositBusy] = useState(false);
  const [newPass, setNewPass]         = useState('');
  const [passBusy, setPassBusy]       = useState(false);

  // Bonus management
  const [bonusAmt, setBonusAmt]         = useState('');
  const [bonusDesc, setBonusDesc]       = useState('');
  const [bonusBusy, setBonusBusy]       = useState(false);
  const [removeAmt, setRemoveAmt]       = useState('');
  const [removeAll, setRemoveAll]       = useState(false);
  const [removeBusy, setRemoveBusy]     = useState(false);

  // Ban with reason
  const [banModal, setBanModal]         = useState<{ userId: string; username: string } | null>(null);
  const [banReason, setBanReason]       = useState('');
  const [banBusy, setBanBusy]           = useState(false);

  // Create user modal
  const [showCreate, setShowCreate]   = useState(false);
  const [createForm, setCreateForm]   = useState({ identifier: '', password: '', full_name: '', role: 'user' });
  const [createBusy, setCreateBusy]   = useState(false);

  // Locked accounts panel
  const [showLocked, setShowLocked]         = useState(false);
  const [lockedUsers, setLockedUsers]       = useState<any[]>([]);
  const [lockedLoading, setLockedLoading]   = useState(false);
  const [unlockModal, setUnlockModal]       = useState<{ id: string; username: string } | null>(null);
  const [unlockReason, setUnlockReason]     = useState('');
  const [unlockBusy, setUnlockBusy]         = useState(false);

  const loadLocked = useCallback(() => {
    setLockedLoading(true);
    adminAPI.getLockedUsers()
      .then(r => setLockedUsers(r.data))
      .catch(() => toast.error('Impossible de charger les comptes bloqués'))
      .finally(() => setLockedLoading(false));
  }, []);

  // Load locked count on mount for badge; reload when panel opens
  useEffect(() => { loadLocked(); }, []);
  useEffect(() => { if (showLocked) loadLocked(); }, [showLocked]);

  const handleForceUnlock = async () => {
    if (!unlockModal || !unlockReason.trim()) return;
    setUnlockBusy(true);
    try {
      await adminAPI.forceUnlock(unlockModal.id, unlockReason.trim());
      toast.success(`Kont ${unlockModal.username} debloke`);
      // Clear lockout fields in open detail modal without full reload
      if (detail?.id === unlockModal.id) {
        setDetail(d => d ? { ...d, failed_attempts: 0, locked_until: null } : d);
      }
      setUnlockModal(null); setUnlockReason('');
      loadLocked();
      load();
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Erreur déblocage'); }
    finally { setUnlockBusy(false); }
  };

  const load = useCallback(() => {
    setLoading(true);
    adminAPI.getUsers({ limit: 500, search: search || undefined, status: statusFilter || undefined })
      .then(r => { setUsers(r.data); setPage(1); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [statusFilter]);

  const openDetail = async (id: string) => {
    setDetail(null); setDetailLoading(true); setTab('profile');
    setDepositAmt(''); setDepositDesc(''); setNewPass('');
    setBonusAmt(''); setBonusDesc(''); setRemoveAmt(''); setRemoveAll(false);
    try {
      const r = await adminAPI.getUserDetail(id);
      setDetail(r.data);
    } catch { toast.error('Impossible de charger les détails'); }
    finally { setDetailLoading(false); }
  };

  const updateUser = async (id: string, data: any, msg = 'Mis à jour') => {
    try {
      await adminAPI.updateUser(id, data);
      toast.success(msg);
      load();
      if (detail?.id === id) setDetail(d => d ? { ...d, ...data } : d);
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Erreur'); }
  };

  const handleDeposit = async () => {
    if (!detail || !depositAmt) return;
    setDepositBusy(true);
    try {
      const r = await adminAPI.depositToUser(detail.id, { amount: parseFloat(depositAmt), description: depositDesc || undefined });
      toast.success(`+${parseFloat(depositAmt).toLocaleString()} HTG crédité`);
      setDepositAmt(''); setDepositDesc('');
      setDetail(d => d ? { ...d, balance: r.data.new_balance } : d);
      load();
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Erreur'); }
    finally { setDepositBusy(false); }
  };

  const handleBan = async () => {
    if (!banModal || !banReason.trim()) return;
    setBanBusy(true);
    try {
      await adminAPI.updateUser(banModal.userId, { status: 'banned', ban_reason: banReason.trim() });
      toast.success(`${banModal.username} banni`);
      setBanModal(null); setBanReason('');
      load();
      if (detail?.id === banModal.userId) setDetail(d => d ? { ...d, status: 'banned', ban_reason: banReason.trim() } : d);
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Erreur'); }
    finally { setBanBusy(false); }
  };

  const handleAddBonus = async () => {
    if (!detail || !bonusAmt) return;
    setBonusBusy(true);
    try {
      const r = await adminAPI.addBonus(detail.id, { amount: parseFloat(bonusAmt), description: bonusDesc || undefined });
      toast.success(`+${parseFloat(bonusAmt).toLocaleString()} HTG bonus crédité`);
      setBonusAmt(''); setBonusDesc('');
      setDetail(d => d ? { ...d, bonus_balance: r.data.new_bonus_balance } : d);
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Erreur'); }
    finally { setBonusBusy(false); }
  };

  const handleRemoveBonus = async () => {
    if (!detail) return;
    if (!removeAll && !removeAmt) return;
    setRemoveBusy(true);
    try {
      const payload = removeAll
        ? { amount: 'all' }
        : { amount: parseFloat(removeAmt) };
      const r = await adminAPI.removeBonus(detail.id, payload);
      const removed = r.data.removed;
      toast.success(`-${removed.toLocaleString()} HTG bonus retiré`);
      setRemoveAmt(''); setRemoveAll(false);
      setDetail(d => d ? { ...d, bonus_balance: r.data.new_bonus_balance } : d);
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Erreur'); }
    finally { setRemoveBusy(false); }
  };

  const handleResetPass = async () => {
    if (!detail || !newPass) return;
    setPassBusy(true);
    try {
      await adminAPI.resetUserPassword(detail.id, { new_password: newPass });
      toast.success('Mot de passe réinitialisé');
      setNewPass('');
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Erreur'); }
    finally { setPassBusy(false); }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.identifier || !createForm.password) return;
    setCreateBusy(true);
    try {
      await adminAPI.createUser(createForm);
      toast.success('Utilisateur créé');
      setShowCreate(false);
      setCreateForm({ identifier: '', password: '', full_name: '', role: 'user' });
      load();
    } catch (er: any) { toast.error(er.response?.data?.detail || 'Erreur création'); }
    finally { setCreateBusy(false); }
  };

  // Search on Enter
  const handleSearchSubmit = (e: React.FormEvent) => { e.preventDefault(); load(); };

  // Filtered + paginated
  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchQ = !search || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.phone || '').includes(q);
    const matchS = !statusFilter || u.status === statusFilter;
    return matchQ && matchS;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paged      = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Stats bar
  const totals = { active: users.filter(u => u.status === 'active').length, suspended: users.filter(u => u.status === 'suspended').length, banned: users.filter(u => u.status === 'banned').length };

  return (
    <AdminLayout>
      <div style={{ padding: 24 }} className="fade-in">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'white' }}>
              Utilisateurs <span style={{ color: '#484f58', fontSize: 14, fontWeight: 400 }}>({filtered.length})</span>
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Status filter */}
            {[['', 'Tous'], ['active', 'Actifs'], ['suspended', 'Suspendus'], ['banned', 'Bannis']].map(([val, lbl]) => (
              <button key={val} onClick={() => { setStatusFilter(val); setPage(1); }}
                className="btn btn-sm" style={{
                  background: statusFilter === val ? 'rgba(31,111,235,0.15)' : 'rgba(255,255,255,0.04)',
                  color: statusFilter === val ? '#388bfd' : '#8b949e',
                  border: `1px solid ${statusFilter === val ? 'rgba(31,111,235,0.3)' : 'rgba(255,255,255,0.08)'}`,
                }}>{lbl}</button>
            ))}
            {/* Search */}
            <form onSubmit={handleSearchSubmit} style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#484f58', pointerEvents: 'none' }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher..." className="input" style={{ paddingLeft: 30, width: 200, height: 34, fontSize: 12 }} />
            </form>
            <button onClick={() => load()} className="btn btn-ghost btn-sm"><RefreshCw size={13} /></button>
            <button onClick={() => { setShowLocked(v => !v); }} className="btn btn-sm" style={{
              background: showLocked ? 'rgba(218,54,51,0.15)' : 'rgba(255,255,255,0.04)',
              color: showLocked ? '#f85149' : '#8b949e',
              border: `1px solid ${showLocked ? 'rgba(218,54,51,0.3)' : 'rgba(255,255,255,0.08)'}`,
            }}>
              <Lock size={13} /> Bloke {lockedUsers.length > 0 && !showLocked && <span style={{ background: '#da3633', color: 'white', borderRadius: 99, fontSize: 10, padding: '0 5px', marginLeft: 2 }}>{lockedUsers.length}</span>}
            </button>
            <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm">
              <UserPlus size={13} /> Créer utilisateur
            </button>
          </div>
        </div>

        {/* Locked accounts panel */}
        {showLocked && (
          <div className="card" style={{ marginBottom: 20, border: '1px solid rgba(218,54,51,0.3)', padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(218,54,51,0.08)', borderBottom: '1px solid rgba(218,54,51,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lock size={14} color="#f85149" />
                <span style={{ fontWeight: 700, color: '#f85149', fontSize: 13 }}>
                  Comptes bloqués ({lockedUsers.length})
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={loadLocked} className="btn btn-ghost btn-sm"><RefreshCw size={12} /></button>
                <button onClick={() => setShowLocked(false)} className="btn btn-ghost btn-sm"><X size={13} /></button>
              </div>
            </div>

            {lockedLoading ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#8b949e', fontSize: 13 }}>Chargement…</div>
            ) : lockedUsers.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#8b949e', fontSize: 13 }}>
                <UserCheck size={20} style={{ display: 'block', margin: '0 auto 8px', color: '#3fb950' }} />
                Aucun compte bloqué
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Utilisateur', 'Email', 'Tentatives', 'Bloqué jusqu\'à', 'Dernière IP', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#8b949e', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lockedUsers.map(u => {
                    const isActive = u.locked_until && new Date(u.locked_until) > new Date();
                    const minsLeft = u.locked_until ? Math.max(0, Math.round((new Date(u.locked_until).getTime() - Date.now()) / 60000)) : 0;
                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '8px 12px', color: 'white', fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isActive ? <Lock size={11} color="#f85149" /> : <AlertTriangle size={11} color="#d29922" />}
                            {u.username}
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px', color: '#8b949e' }}>{u.email || '—'}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ background: 'rgba(218,54,51,0.15)', color: '#f85149', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                            {u.failed_attempts}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: isActive ? '#f85149' : '#8b949e' }}>
                          {isActive
                            ? `${minsLeft} min restant`
                            : u.locked_until ? 'Expiré' : '—'}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#8b949e', fontFamily: 'monospace', fontSize: 11 }}>{u.last_ip || '—'}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <button
                            onClick={() => { setUnlockModal({ id: u.id, username: u.username }); setUnlockReason(''); }}
                            className="btn btn-sm"
                            style={{ background: 'rgba(63,185,80,0.1)', color: '#3fb950', border: '1px solid rgba(63,185,80,0.25)', fontSize: 11 }}
                          >
                            <Unlock size={11} /> Débloquer
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Force-unlock confirmation modal */}
        {unlockModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="card" style={{ width: 420, padding: 24, border: '1px solid rgba(63,185,80,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <Unlock size={16} color="#3fb950" />
                <span style={{ fontWeight: 700, color: 'white', fontSize: 14 }}>Débloquer {unlockModal.username}</span>
              </div>
              <p style={{ color: '#8b949e', fontSize: 12, margin: '0 0 16px' }}>
                Cela remettra à zéro les tentatives, annulera le verrouillage et révoquera toutes les sessions actives.
              </p>
              <label style={{ fontSize: 10, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>
                Raison du déblocage *
              </label>
              <textarea
                className="input"
                value={unlockReason}
                onChange={e => setUnlockReason(e.target.value)}
                placeholder="Ex: Compte bloqué par erreur, identité vérifiée..."
                rows={3}
                style={{ resize: 'none', marginBottom: 16 }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setUnlockModal(null)} className="btn btn-ghost btn-sm">Annuler</button>
                <button
                  onClick={handleForceUnlock}
                  disabled={!unlockReason.trim() || unlockBusy}
                  className="btn btn-sm"
                  style={{ background: 'rgba(63,185,80,0.15)', color: '#3fb950', border: '1px solid rgba(63,185,80,0.3)' }}
                >
                  {unlockBusy ? '…' : <><Unlock size={12} /> Confirmer le déblocage</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create user modal */}
        {showCreate && (
          <div className="card" style={{ marginBottom: 20, padding: 20, border: '1px solid rgba(31,111,235,.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontWeight: 700, color: 'white', fontSize: 14 }}>Créer un utilisateur</span>
              <button onClick={() => setShowCreate(false)} className="btn btn-ghost btn-sm"><X size={13} /></button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 10, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>
                    Email / Téléphone / Username *
                  </label>
                  <input className="input" value={createForm.identifier}
                    onChange={e => setCreateForm(f => ({ ...f, identifier: e.target.value }))}
                    placeholder="jean@email.com" required />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>
                    Mot de passe *
                  </label>
                  <input className="input" type="password" value={createForm.password}
                    onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min 6 caractères" required minLength={6} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>
                    Nom complet
                  </label>
                  <input className="input" value={createForm.full_name}
                    onChange={e => setCreateForm(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="Jean Dupont" />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>
                    Rôle
                  </label>
                  <select className="input" value={createForm.role}
                    onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="user">Utilisateur</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button type="submit" disabled={createBusy} className="btn btn-primary btn-sm">
                  {createBusy ? '...' : <><UserPlus size={13} /> Créer</>}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn btn-ghost btn-sm">Annuler</button>
              </div>
            </form>
          </div>
        )}

        {/* Stats chips */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { lbl: 'Total', val: users.length, color: '#e6edf3' },
            { lbl: 'Actifs',    val: totals.active,    color: '#3fb950' },
            { lbl: 'Suspendus', val: totals.suspended, color: '#d29922' },
            { lbl: 'Bannis',    val: totals.banned,    color: '#f85149' },
          ].map(({ lbl, val, color }) => (
            <div key={lbl} className="stat-chip">
              <span className="stat-chip-val" style={{ color }}>{val}</span>
              <span className="stat-chip-lbl">{lbl}</span>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  {['Utilisateur', 'Email', 'Rôle', 'Statut', 'Solde', 'Inscrit le', 'Actions'].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => <tr key={i}><td colSpan={7}><div className="skel" style={{ height: 16 }} /></td></tr>)
                  : paged.map(u => (
                    <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(u.id)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                            background: 'rgba(31,111,235,0.12)', border: '1px solid rgba(31,111,235,0.25)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, color: '#388bfd'
                          }}>{u.username[0].toUpperCase()}</div>
                          <div>
                            <div style={{ fontSize: 13, color: 'white', fontWeight: 500 }}>{u.username}</div>
                            {u.full_name && <div style={{ fontSize: 11, color: '#484f58' }}>{u.full_name}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: '#8b949e' }}>{u.email}</td>
                      <td>
                        <span className={`badge ${u.role === 'admin' ? 'badge-purple' : 'badge-gray'}`}>{u.role}</span>
                      </td>
                      <td>
                        <span className={`badge ${STATUS_BG[u.status] || 'badge-gray'}`}>{u.status}</span>
                      </td>
                      <td style={{ fontSize: 12, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#3fb950' }}>
                        {Math.floor(u.balance).toLocaleString()} HTG
                      </td>
                      <td style={{ fontSize: 11, color: '#8b949e' }}>{new Date(u.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {u.status === 'active' && <button onClick={() => updateUser(u.id, { status: 'suspended' })} className="btn btn-warn btn-xs" title="Suspendre"><UserX size={11} /></button>}
                          {u.status === 'suspended' && <button onClick={() => updateUser(u.id, { status: 'active' }, 'Réactivé')} className="btn btn-success btn-xs" title="Réactiver"><UserCheck size={11} /></button>}
                          {u.status === 'banned' && <button onClick={() => updateUser(u.id, { status: 'active' }, 'Débanni')} className="btn btn-success btn-xs" title="Débannir"><ShieldOff size={11} /></button>}
                          {u.status !== 'banned' && <button onClick={() => { setBanModal({ userId: u.id, username: u.username }); setBanReason(''); }} className="btn btn-danger btn-xs" title="Bannir"><Shield size={11} /></button>}
                          <button onClick={() => openDetail(u.id)} className="btn btn-ghost btn-xs">Détails</button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /></button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
              return <button key={p} className={`page-btn${p === page ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>;
            })}
            <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight size={14} /></button>
            <span style={{ fontSize: 11, color: '#484f58', marginLeft: 8 }}>{filtered.length} résultats</span>
          </div>
        )}
      </div>

      {/* User detail modal */}
      {(detail || detailLoading) && (
        <div className="modal-overlay" onClick={() => { if (!detailLoading) setDetail(null); }}>
          <div className="modal" style={{ maxWidth: 760 }} onClick={e => e.stopPropagation()}>
            {detailLoading ? (
              <div style={{ padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,0.08)', borderTopColor: '#1f6feb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : detail && (
              <>
                {/* Modal header */}
                <div className="modal-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: 'rgba(31,111,235,0.15)', border: '2px solid rgba(31,111,235,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 17, fontWeight: 800, color: '#388bfd', flexShrink: 0
                    }}>{detail.username[0].toUpperCase()}</div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>{detail.username}</div>
                      <div style={{ fontSize: 12, color: '#8b949e' }}>{detail.email} {detail.phone && `· ${detail.phone}`}</div>
                    </div>
                    <span className={`badge ${STATUS_BG[detail.status] || 'badge-gray'}`} style={{ marginLeft: 4 }}>{detail.status}</span>
                    <span className={`badge ${detail.role === 'admin' ? 'badge-purple' : 'badge-gray'}`}>{detail.role}</span>
                  </div>
                  <button onClick={() => setDetail(null)} className="btn btn-ghost btn-sm"><X size={15} /></button>
                </div>

                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {[
                    { lbl: 'Solde', val: `${Math.floor(detail.balance).toLocaleString()} HTG`, color: '#3fb950' },
                    { lbl: 'Paris',    val: detail.stats?.total_bets ?? 0,  color: '#58a6ff' },
                    { lbl: 'Gagnés',   val: detail.stats?.won_bets ?? 0,    color: '#3fb950' },
                    { lbl: 'Misé',     val: `${Math.floor(detail.stats?.total_wagered ?? 0).toLocaleString()} HTG`, color: '#d29922' },
                  ].map(({ lbl, val, color }) => (
                    <div key={lbl} style={{ padding: '14px 16px', borderRight: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace' }}>{val}</div>
                      <div style={{ fontSize: 10, color: '#484f58', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>{lbl}</div>
                    </div>
                  ))}
                </div>

                {/* Tabs */}
                <div style={{ padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', gap: 0 }}>
                    {(['profile', 'transactions', 'bets'] as const).map(t => (
                      <button key={t} onClick={() => setTab(t)} className={`tab${tab === t ? ' active' : ''}`} style={{ textTransform: 'capitalize' }}>
                        {t === 'profile' ? 'Profil' : t === 'transactions' ? `Transactions (${detail.transactions?.length ?? 0})` : `Paris (${detail.bets?.length ?? 0})`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Modal body */}
                <div className="modal-body">

                  {tab === 'profile' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* Lockout status banner */}
                      {(() => {
                        const isCurrentlyLocked = detail.locked_until && new Date(detail.locked_until) > new Date();
                        if (!isCurrentlyLocked) return null;
                        const minsLeft = detail.locked_until
                          ? Math.max(0, Math.round((new Date(detail.locked_until).getTime() - Date.now()) / 60000))
                          : 0;
                        return (
                          <div style={{
                            padding: '12px 16px', borderRadius: 10,
                            background: isCurrentlyLocked ? 'rgba(218,54,51,0.08)' : 'rgba(240,136,62,0.07)',
                            border: `1px solid ${isCurrentlyLocked ? 'rgba(218,54,51,0.3)' : 'rgba(240,136,62,0.25)'}`,
                            display: 'flex', gap: 10, alignItems: 'flex-start',
                          }}>
                            <Lock size={16} color={isCurrentlyLocked ? '#f85149' : '#f0883e'} style={{ flexShrink: 0, marginTop: 1 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: isCurrentlyLocked ? '#f85149' : '#f0883e', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                                {isCurrentlyLocked ? 'Compte bloqué' : 'Tentatives échouées'}
                              </div>
                              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                                <div>
                                  <div style={{ fontSize: 10, color: '#484f58', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Tentatives</div>
                                  <span style={{ fontSize: 14, fontWeight: 800, color: '#f85149', fontFamily: 'JetBrains Mono, monospace' }}>
                                    {detail.failed_attempts ?? 0}
                                  </span>
                                </div>
                                {detail.locked_until && (
                                  <div>
                                    <div style={{ fontSize: 10, color: '#484f58', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>
                                      {isCurrentlyLocked ? 'Débloquage dans' : 'Verrouillé jusqu\'au'}
                                    </div>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: isCurrentlyLocked ? '#f85149' : '#8b949e', fontFamily: 'JetBrains Mono, monospace' }}>
                                      {isCurrentlyLocked
                                        ? `${minsLeft} min`
                                        : new Date(detail.locked_until).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {isCurrentlyLocked && (
                                <button
                                  onClick={() => { setUnlockModal({ id: detail.id, username: detail.username }); setUnlockReason(''); }}
                                  className="btn btn-sm"
                                  style={{ background: 'rgba(63,185,80,0.1)', color: '#3fb950', border: '1px solid rgba(63,185,80,0.25)', fontSize: 11 }}
                                >
                                  <Unlock size={11} /> Débloquer ce compte
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Ban reason banner */}
                      {detail.status === 'banned' && (
                        <div style={{
                          padding: '12px 16px', borderRadius: 10,
                          background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.3)',
                          display: 'flex', gap: 10, alignItems: 'flex-start',
                        }}>
                          <Shield size={16} color="#f85149" style={{ flexShrink: 0, marginTop: 1 }} />
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#f85149', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Compte Banni</div>
                            <div style={{ fontSize: 13, color: '#e6edf3', lineHeight: 1.5 }}>
                              {detail.ban_reason || 'Aucune raison enregistrée'}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Info */}
                      <div className="form-section">
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Informations</div>
                        <div className="form-row">
                          {[
                            { lbl: 'Email',             val: detail.email },
                            { lbl: 'Téléphone',         val: detail.phone || '—' },
                            { lbl: 'Nom complet',       val: detail.full_name || '—' },
                            { lbl: 'Dernière IP',       val: detail.last_ip || '—' },
                            { lbl: 'Inscrit le',        val: new Date(detail.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) },
                            { lbl: 'Dernière connexion',val: detail.last_login ? new Date(detail.last_login).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' },
                          ].map(({ lbl, val }) => (
                            <div key={lbl}>
                              <div style={{ fontSize: 10, color: '#484f58', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{lbl}</div>
                              <div style={{ fontSize: 13, color: '#e6edf3' }}>{val}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Quick actions */}
                      <div className="form-section">
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Actions rapides</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {detail.status === 'active'    && <button onClick={() => updateUser(detail.id, { status: 'suspended' }, 'Suspendu')} className="btn btn-warn btn-sm"><UserX size={13} /> Suspendre</button>}
                          {detail.status === 'suspended' && <button onClick={() => updateUser(detail.id, { status: 'active' }, 'Réactivé')} className="btn btn-success btn-sm"><UserCheck size={13} /> Réactiver</button>}
                          {detail.status === 'banned'    && <button onClick={() => updateUser(detail.id, { status: 'active' }, 'Débanni')} className="btn btn-success btn-sm"><ShieldOff size={13} /> Débannir</button>}
                          {detail.status !== 'banned'    && <button onClick={() => { setBanModal({ userId: detail.id, username: detail.username }); setBanReason(''); }} className="btn btn-danger btn-sm"><Shield size={13} /> Bannir</button>}
                        </div>
                      </div>

                      {/* Manual deposit */}
                      <div className="form-section">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                          <DollarSign size={14} color="#3fb950" />
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.05em' }}>Dépôt Manuel</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <input type="number" value={depositAmt} onChange={e => setDepositAmt(e.target.value)}
                            placeholder="Montant HTG" className="input" style={{ maxWidth: 160, flex: 1 }} min={1} />
                          <input value={depositDesc} onChange={e => setDepositDesc(e.target.value)}
                            placeholder="Description (optionnel)" className="input" style={{ flex: 2, minWidth: 200 }} />
                          <button onClick={handleDeposit} disabled={depositBusy || !depositAmt} className="btn btn-success">
                            {depositBusy ? '...' : <><DollarSign size={13} /> Créditer</>}
                          </button>
                        </div>
                      </div>

                      {/* Bonus management */}
                      <div className="form-section" style={{ border: '1px solid rgba(168,85,247,0.2)', borderRadius: 10, padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Gift size={14} color="#a855f7" />
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.05em' }}>Gestion Bonus</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 10, color: '#8b949e' }}>Solde actuel :</span>
                            <span style={{
                              fontSize: 13, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace',
                              color: (detail.bonus_balance ?? 0) > 0 ? '#c084fc' : '#484f58',
                            }}>
                              {Math.floor(detail.bonus_balance ?? 0).toLocaleString()} HTG
                            </span>
                          </div>
                        </div>

                        {/* Add bonus */}
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 10, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Ajouter bonus</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <input type="number" value={bonusAmt} onChange={e => setBonusAmt(e.target.value)}
                              placeholder="Montant HTG" className="input" style={{ maxWidth: 150, flex: 1 }} min={1} />
                            <input value={bonusDesc} onChange={e => setBonusDesc(e.target.value)}
                              placeholder="Raison (optionnel)" className="input" style={{ flex: 2, minWidth: 160 }} />
                            <button onClick={handleAddBonus} disabled={bonusBusy || !bonusAmt}
                              className="btn btn-sm" style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)', whiteSpace: 'nowrap' }}>
                              {bonusBusy ? '...' : <><Gift size={12} /> + Ajouter</>}
                            </button>
                          </div>
                        </div>

                        {/* Remove bonus */}
                        <div>
                          <div style={{ fontSize: 10, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Retirer bonus</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            {/* Toggle all / partial */}
                            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
                              <button onClick={() => setRemoveAll(false)}
                                style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                  background: !removeAll ? 'rgba(248,81,73,0.15)' : 'transparent',
                                  color: !removeAll ? '#f85149' : '#8b949e' }}>
                                Partiel
                              </button>
                              <button onClick={() => setRemoveAll(true)}
                                style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                  background: removeAll ? 'rgba(248,81,73,0.15)' : 'transparent',
                                  color: removeAll ? '#f85149' : '#8b949e' }}>
                                Tout
                              </button>
                            </div>
                            {!removeAll && (
                              <input type="number" value={removeAmt} onChange={e => setRemoveAmt(e.target.value)}
                                placeholder="Montant à retirer" className="input" style={{ maxWidth: 170, flex: 1 }}
                                min={1} max={detail.bonus_balance ?? 0} />
                            )}
                            {removeAll && (
                              <span style={{ fontSize: 12, color: '#f85149', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                                Tout le bonus sera retiré ({Math.floor(detail.bonus_balance ?? 0).toLocaleString()} HTG)
                              </span>
                            )}
                            <button
                              onClick={handleRemoveBonus}
                              disabled={removeBusy || (!removeAll && !removeAmt) || (detail.bonus_balance ?? 0) <= 0}
                              className="btn btn-danger btn-sm" style={{ whiteSpace: 'nowrap' }}>
                              {removeBusy ? '...' : <><Minus size={12} /> Retirer</>}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Reset password */}
                      <div className="form-section">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                          <Key size={14} color="#d29922" />
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.05em' }}>Réinitialiser le mot de passe</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
                            placeholder="Nouveau mot de passe (min 6 car.)" className="input" style={{ flex: 1 }} />
                          <button onClick={handleResetPass} disabled={passBusy || newPass.length < 6} className="btn btn-warn">
                            {passBusy ? '...' : <><Key size={13} /> Réinitialiser</>}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {tab === 'transactions' && (
                    <div style={{ overflowX: 'auto' }}>
                      {detail.transactions?.length === 0
                        ? <div style={{ textAlign: 'center', color: '#484f58', padding: 32 }}>Aucune transaction</div>
                        : <table className="tbl">
                          <thead><tr>{['Type', 'Montant', 'Détail', 'Avant', 'Après', 'Statut', 'Date'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                          <tbody>
                            {detail.transactions.map((tx: any) => (
                              <tr key={tx.id}>
                                <td><span className="badge" style={{ background: `${TYPE_CLR[tx.type]||'#8b949e'}22`, color: TYPE_CLR[tx.type]||'#8b949e' }}>{tx.type}</span></td>
                                <td style={{ fontSize: 12, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: ['deposit','win','bonus','refund'].includes(tx.type)?'#3fb950':'#f85149' }}>
                                  {['deposit','win','bonus','refund'].includes(tx.type)?'+':'-'}{Math.floor(tx.amount).toLocaleString()} HTG
                                </td>
                                <td style={{ fontSize: 11, color: '#8b949e', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.description}>{tx.description || '—'}</td>
                                <td style={{ fontSize: 11, color: '#8b949e', fontFamily: 'JetBrains Mono, monospace' }}>{Math.floor(tx.balance_before).toLocaleString()}</td>
                                <td style={{ fontSize: 11, color: '#8b949e', fontFamily: 'JetBrains Mono, monospace' }}>{Math.floor(tx.balance_after).toLocaleString()}</td>
                                <td><span className={`badge ${tx.status==='completed'?'badge-green':tx.status==='pending'?'badge-yellow':'badge-red'}`}>{tx.status}</span></td>
                                <td style={{ fontSize: 11, color: '#8b949e', whiteSpace: 'nowrap' }}>{new Date(tx.created_at).toLocaleString('fr', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>}
                    </div>
                  )}

                  {tab === 'bets' && (
                    <div style={{ overflowX: 'auto' }}>
                      {detail.bets?.length === 0
                        ? <div style={{ textAlign: 'center', color: '#484f58', padding: 32 }}>Aucun pari</div>
                        : <table className="tbl">
                          <thead><tr>{['Marché', 'Option', 'Mise', 'Cote', 'Gain potentiel', 'Gain réel', 'Statut', 'Date'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                          <tbody>
                            {detail.bets.map((b: any) => (
                              <tr key={b.id}>
                                <td style={{ fontSize: 12, color: 'white', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.market_title}>{b.market_title || '—'}</td>
                                <td><span className={`badge ${b.option==='yes'?'badge-green':'badge-red'}`}>{b.option?.toUpperCase()}</span></td>
                                <td style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#8b949e' }}>{Math.floor(b.amount).toLocaleString()} HTG</td>
                                <td style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#d29922', fontWeight: 700 }}>
                                  {b.odds_at_bet ? parseFloat(b.odds_at_bet).toFixed(2) + '×' : '—'}
                                </td>
                                <td style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#3fb950' }}>{Math.floor(b.potential_payout).toLocaleString()} HTG</td>
                                <td style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: b.actual_payout > 0 ? '#3fb950' : '#484f58' }}>
                                  {b.actual_payout > 0 ? Math.floor(b.actual_payout).toLocaleString() + ' HTG' : '—'}
                                </td>
                                <td><span className={`badge ${b.status==='won'?'badge-green':b.status==='active'?'badge-blue':'badge-red'}`}>{b.status}</span></td>
                                <td style={{ fontSize: 11, color: '#8b949e', whiteSpace: 'nowrap' }}>{new Date(b.created_at).toLocaleString('fr', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* Ban reason modal */}
      {banModal && (
        <div className="modal-overlay" onClick={() => { setBanModal(null); setBanReason(''); }}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(248,81,73,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Shield size={16} color="#f85149" />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>Bannir @{banModal.username}</div>
                  <div style={{ fontSize: 11, color: '#8b949e' }}>Cette action sera enregistrée dans les logs</div>
                </div>
              </div>
              <button onClick={() => { setBanModal(null); setBanReason(''); }} className="btn btn-ghost btn-sm"><X size={15} /></button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 8, fontWeight: 600 }}>
                  Raison du bannissement *
                </label>
                <textarea
                  value={banReason}
                  onChange={e => setBanReason(e.target.value)}
                  placeholder="Ex: Fraude détectée — paris suspects, multiples comptes, manipulation de marchés..."
                  rows={4}
                  style={{
                    width: '100%', background: '#0d1117', border: '1px solid rgba(248,81,73,0.3)',
                    borderRadius: 8, padding: '10px 12px', color: 'white', fontSize: 13,
                    fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                    lineHeight: 1.5,
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#f85149'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(248,81,73,0.3)'; }}
                />
                <div style={{ fontSize: 10, color: '#484f58', marginTop: 6 }}>
                  Cette raison sera visible dans le profil de l'utilisateur et dans les logs d'audit.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => { setBanModal(null); setBanReason(''); }} className="btn btn-ghost btn-sm">Annuler</button>
                <button
                  onClick={handleBan}
                  disabled={banBusy || !banReason.trim()}
                  className="btn btn-danger btn-sm">
                  {banBusy ? '...' : <><Shield size={13} /> Confirmer le bannissement</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
