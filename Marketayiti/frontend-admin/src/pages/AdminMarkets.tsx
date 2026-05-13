import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Check, X, Edit3, Trash2, Eye, RefreshCw, Upload, Link as LinkIcon, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminAPI } from '../api';
import AdminLayout from '../components/AdminLayout';

const CATS = ['politik', 'spo', 'ekonomi', 'kilti', 'sosyal', 'lot', 'nouvo'];
const CAT_LABELS: Record<string, string> = {
  politik: 'Politique', spo: 'Sport', ekonomi: 'Économie',
  kilti: 'Culture', sosyal: 'Social', lot: 'Autre', nouvo: 'Nouveau'
};
const STATUS_TABS = [
  { val: 'all', lbl: 'Tout' }, { val: 'active', lbl: 'Actifs' },
  { val: 'closed', lbl: 'Fermés' }, { val: 'resolved', lbl: 'Résolus' }, { val: 'draft', lbl: 'Brouillons' }
];
const STATUS_CLR: Record<string, string> = {
  active: '#3fb950', closed: '#8b949e', resolved: '#a371f7', draft: '#d29922', cancelled: '#f85149'
};
const STATUS_BADGE: Record<string, string> = {
  active: 'badge-green', closed: 'badge-gray', resolved: 'badge-purple', draft: 'badge-yellow', cancelled: 'badge-red'
};

interface Market {
  id: string; title: string; description: string; category: string; status: string;
  yes_prob: number; no_prob: number; total_volume: number; local_volume: number; bet_count: number;
  end_date: string; resolution?: string; image_url?: string; min_bet: number; max_bet: number;
  created_at: string; option_a?: string; option_b?: string;
}

const EMPTY_FORM = {
  title: '', description: '', category: 'politik', end_date: '',
  min_bet: '25', max_bet: '100000', image_url: '',
  option_a: 'Oui', option_b: 'Non', odds_a: '', odds_b: ''
};

type ImgMode = 'url' | 'file';

/* ── Reusable image section ───────────────────────────────────────────────── */
function ImageSection({
  imageUrl, imgMode, setImgMode,
  onUrlChange, onFileChange,
}: {
  imageUrl: string;
  imgMode: ImgMode;
  setImgMode: (m: ImgMode) => void;
  onUrlChange: (url: string) => void;
  onFileChange: (dataUri: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { toast.error('Image trop grande (max 4 Mo)'); return; }
    const reader = new FileReader();
    reader.onload = () => onFileChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  const isDataUri = imageUrl.startsWith('data:');
  const previewSrc = imageUrl;

  return (
    <div>
      <label className="label" style={{ marginBottom: 6, display: 'block' }}>Image du marché</label>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {(['url', 'file'] as ImgMode[]).map(m => (
          <button key={m} type="button" onClick={() => setImgMode(m)}
            style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: imgMode === m ? 'rgba(88,166,255,.15)' : 'rgba(255,255,255,.04)',
              border: `1px solid ${imgMode === m ? 'rgba(88,166,255,.4)' : 'rgba(255,255,255,.08)'}`,
              color: imgMode === m ? '#58a6ff' : '#8b949e', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
            {m === 'url' ? <><LinkIcon size={10} /> URL</> : <><Upload size={10} /> Fichier</>}
          </button>
        ))}
      </div>

      {imgMode === 'url' ? (
        <input
          type="url" value={isDataUri ? '' : imageUrl}
          onChange={e => onUrlChange(e.target.value)}
          placeholder="https://example.com/image.jpg"
          className="input"
        />
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            border: '2px dashed rgba(88,166,255,.25)', borderRadius: 8, padding: '16px',
            textAlign: 'center', cursor: 'pointer', background: 'rgba(88,166,255,.04)',
            transition: 'border-color .15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(88,166,255,.5)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(88,166,255,.25)')}
        >
          <Upload size={18} color="#58a6ff" style={{ marginBottom: 4 }} />
          <div style={{ fontSize: 12, color: '#8b949e' }}>
            {isDataUri ? 'Image chargée · cliquer pour changer' : 'Cliquer pour sélectionner (max 4 Mo)'}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        </div>
      )}

      {/* Preview */}
      {previewSrc && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={previewSrc} alt="aperçu"
            style={{ width: 80, height: 52, objectFit: 'cover', borderRadius: 7, border: '1px solid rgba(255,255,255,.08)', display: 'block' }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          <div>
            <div style={{ fontSize: 11, color: '#3fb950' }}>Aperçu</div>
            <button type="button" onClick={() => onUrlChange('')}
              style={{ fontSize: 10, color: '#f85149', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Supprimer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminMarkets() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('');
  const [search, setSearch] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [createImgMode, setCreateImgMode] = useState<ImgMode>('url');
  const [createBusy, setCreateBusy] = useState(false);

  const [editMarket, setEditMarket] = useState<Market | null>(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });
  const [editImgMode, setEditImgMode] = useState<ImgMode>('url');
  const [editBusy, setEditBusy] = useState(false);

  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveMarket, setResolveMarket] = useState<Market | null>(null);
  const [resolution, setResolution] = useState<'yes' | 'no'>('yes');
  const [resolveBusy, setResolveBusy] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [statsMarket, setStatsMarket] = useState<any | null>(null);
  const [statsData, setStatsData]     = useState<any | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const load = () => {
    setLoading(true);
    adminAPI.getMarkets({ limit: 200, status: statusFilter !== 'all' ? statusFilter : undefined, category: catFilter || undefined })
      .then(r => setMarkets(r.data))
      .catch(() => { })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [statusFilter, catFilter]);

  const visibleMarkets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return markets;
    return markets.filter(m => m.title.toLowerCase().includes(q) || m.category.toLowerCase().includes(q));
  }, [markets, search]);

  const F = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const EF = (k: string, v: string) => setEditForm(f => ({ ...f, [k]: v }));

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 16);

  const buildPayload = (f: typeof EMPTY_FORM) => {
    const pa = parseFloat(f.odds_a), pb = parseFloat(f.odds_b);
    return {
      title: f.title, description: f.description, category: f.category,
      end_date: f.end_date, min_bet: parseFloat(f.min_bet), max_bet: parseFloat(f.max_bet),
      image_url: f.image_url || undefined,
      option_a: f.option_a || 'Oui', option_b: f.option_b || 'Non',
      ...(pa >= 1.01 ? { odds_a: pa } : {}),
      ...(pb >= 1.01 ? { odds_b: pb } : {}),
    };
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setCreateBusy(true);
    try {
      await adminAPI.createMarket(buildPayload(form));
      toast.success('Marché créé');
      setForm({ ...EMPTY_FORM }); setCreateImgMode('url'); setShowCreate(false); load();
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Erreur'); }
    finally { setCreateBusy(false); }
  };

  const openEdit = (m: Market) => {
    setEditMarket(m);
    const isData = (m.image_url || '').startsWith('data:');
    setEditImgMode(isData ? 'file' : 'url');
    // Convert stored probability back to odds for display: odds = 1 / prob
    const storedOddsA = m.yes_prob > 0 ? (1 / m.yes_prob).toFixed(2) : '';
    const storedOddsB = m.no_prob  > 0 ? (1 / m.no_prob).toFixed(2)  : '';
    setEditForm({
      title: m.title, description: m.description || '', category: m.category,
      end_date: m.end_date?.slice(0, 16) || '', min_bet: String(m.min_bet), max_bet: String(m.max_bet),
      image_url: m.image_url || '', option_a: m.option_a || 'Oui', option_b: m.option_b || 'Non',
      odds_a: storedOddsA, odds_b: storedOddsB,
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editMarket) return; setEditBusy(true);
    try {
      await adminAPI.updateMarket(editMarket.id, buildPayload(editForm));
      toast.success('Marché mis à jour'); setEditMarket(null); load();
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Erreur'); }
    finally { setEditBusy(false); }
  };

  const openResolve = (m: Market) => { setResolveId(m.id); setResolveMarket(m); setResolution('yes'); };
  const handleResolve = async () => {
    if (!resolveId) return; setResolveBusy(true);
    try {
      const r = await adminAPI.resolveMarket(resolveId, { resolution });
      toast.success(`Résolu → ${resolution.toUpperCase()} · ${r.data.bets_settled} paris réglés`);
      setResolveId(null); setResolveMarket(null); load();
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Erreur'); }
    finally { setResolveBusy(false); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try { await adminAPI.updateMarket(id, { status }); toast.success('Statut mis à jour'); load(); }
    catch (e: any) { toast.error(e.response?.data?.detail || 'Erreur'); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return; setDeleteBusy(true);
    try { await adminAPI.deleteMarket(deleteId); toast.success('Marché supprimé, paris remboursés'); setDeleteId(null); load(); }
    catch (e: any) { toast.error(e.response?.data?.detail || 'Erreur'); }
    finally { setDeleteBusy(false); }
  };

  const openStats = async (m: Market) => {
    setStatsMarket(m); setStatsData(null); setStatsLoading(true);
    try { const r = await adminAPI.getMarketStats(m.id); setStatsData(r.data); }
    catch { setStatsData(null); }
    finally { setStatsLoading(false); }
  };

  /* ── Shared comparison section ─────────────────────────────────────────── */
  const ComparisonSection = ({ fa, setF }: { fa: typeof EMPTY_FORM; setF: (k: string, v: string) => void }) => (
    <div style={{ background: 'rgba(88,166,255,.04)', border: '1px solid rgba(88,166,255,.12)', borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#58a6ff', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
        Options de comparaison
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label className="label">Option A <span style={{ color: '#3fb950' }}>(Oui / Wi)</span></label>
          <input value={fa.option_a} onChange={e => setF('option_a', e.target.value)}
            placeholder='Ex: "Messi" ou "Oui"' className="input" maxLength={40} />
        </div>
        <div>
          <label className="label">Option B <span style={{ color: '#f85149' }}>(Non)</span></label>
          <input value={fa.option_b} onChange={e => setF('option_b', e.target.value)}
            placeholder='Ex: "Ronaldo" ou "Non"' className="input" maxLength={40} />
        </div>
        <div>
          <label className="label">Cote A <span style={{ color: '#f85149' }}>*</span></label>
          <input type="number" value={fa.odds_a} onChange={e => setF('odds_a', e.target.value)}
            placeholder="1.80" className="input" min={1.01} step={0.01} required />
        </div>
        <div>
          <label className="label">Cote B <span style={{ color: '#f85149' }}>*</span></label>
          <input type="number" value={fa.odds_b} onChange={e => setF('odds_b', e.target.value)}
            placeholder="2.20" className="input" min={1.01} step={0.01} required />
        </div>
      </div>
      {fa.odds_a && fa.odds_b && parseFloat(fa.odds_a) >= 1.01 && parseFloat(fa.odds_b) >= 1.01 && (() => {
        const pA = Math.round((1 / parseFloat(fa.odds_a)) * 100);
        const pB = Math.round((1 / parseFloat(fa.odds_b)) * 100);
        return (
          <div style={{ marginTop: 8, fontSize: 11, color: '#8b949e', display: 'flex', gap: 12 }}>
            <span style={{ color: '#3fb950' }}>A: {pA}% → cote réelle {parseFloat(fa.odds_a).toFixed(2)}×</span>
            <span style={{ color: '#f85149' }}>B: {pB}% → cote réelle {parseFloat(fa.odds_b).toFixed(2)}×</span>
          </div>
        );
      })()}
    </div>
  );

  return (
    <AdminLayout>
      <div style={{ padding: 24 }} className="fade-in">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'white' }}>
            Marchés <span style={{ color: '#484f58', fontSize: 14, fontWeight: 400 }}>({visibleMarkets.length}{search ? `/${markets.length}` : ''})</span>
          </h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => load()} className="btn btn-ghost btn-sm"><RefreshCw size={13} /></button>
            <button onClick={() => setShowCreate(s => !s)} className="btn btn-primary">
              {showCreate ? <><X size={15} /> Annuler</> : <><Plus size={15} /> Nouveau Marché</>}
            </button>
          </div>
        </div>

        {/* ── Create form ─────────────────────────────────────────────────── */}
        {showCreate && (
          <div className="card fade-in" style={{ marginBottom: 20 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'white' }}>Créer un Marché</h2>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Title */}
                <div>
                  <label className="label">Question du marché *</label>
                  <input value={form.title} onChange={e => F('title', e.target.value)}
                    placeholder="Ex: Messi va-t-il marquer lors du prochain match ?" className="input"
                    required minLength={3} />
                </div>

                {/* Description */}
                <div>
                  <label className="label">Description</label>
                  <textarea value={form.description} onChange={e => F('description', e.target.value)}
                    placeholder="Contexte et critères de résolution..."
                    className="input" style={{ minHeight: 72, resize: 'vertical' }} />
                </div>

                {/* Cat / Date / Bets */}
                <div className="form-row">
                  <div>
                    <label className="label">Catégorie *</label>
                    <select value={form.category} onChange={e => F('category', e.target.value)} className="input">
                      {CATS.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Date de fin *</label>
                    <input type="datetime-local" value={form.end_date} min={minDate}
                      onChange={e => F('end_date', e.target.value)} className="input" required />
                  </div>
                  <div>
                    <label className="label">Mise min (HTG)</label>
                    <input type="number" value={form.min_bet} onChange={e => F('min_bet', e.target.value)} className="input" min={1} />
                  </div>
                  <div>
                    <label className="label">Mise max (HTG)</label>
                    <input type="number" value={form.max_bet} onChange={e => F('max_bet', e.target.value)} className="input" min={1} />
                  </div>
                </div>

                {/* Comparison options */}
                <ComparisonSection fa={form} setF={F} />

                {/* Image */}
                <ImageSection
                  imageUrl={form.image_url}
                  imgMode={createImgMode}
                  setImgMode={setCreateImgMode}
                  onUrlChange={url => F('image_url', url)}
                  onFileChange={uri => { F('image_url', uri); }}
                />

                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" disabled={createBusy} className="btn btn-primary">
                    {createBusy ? '...' : <><Check size={14} /> Créer le marché</>}
                  </button>
                  <button type="button" onClick={() => { setShowCreate(false); setForm({ ...EMPTY_FORM }); }} className="btn btn-ghost">
                    <X size={14} /> Annuler
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Status tabs + search + category filter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <div className="tabs" style={{ margin: 0 }}>
            {STATUS_TABS.map(({ val, lbl }) => (
              <button key={val} className={`tab${statusFilter === val ? ' active' : ''}`} onClick={() => setStatusFilter(val)}>{lbl}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#484f58', pointerEvents: 'none' }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher..." className="input"
                style={{ width: 180, height: 34, fontSize: 12, paddingLeft: 28 }}
              />
            </div>
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="input" style={{ width: 140, height: 34, fontSize: 12 }}>
              <option value="">Toutes catégories</option>
              {CATS.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
            </select>
          </div>
        </div>

        {/* Markets table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>{['', 'Titre / Options', 'Cat.', 'Statut', 'Oui%', 'Volume / Paris', 'Fin', 'Actions'].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={8}><div className="skel" style={{ height: 40 }} /></td></tr>)
                  : visibleMarkets.length === 0
                    ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#484f58' }}>{search ? 'Aucun résultat' : 'Aucun marché'}</td></tr>
                    : visibleMarkets.map(m => (
                      <tr key={m.id}>
                        {/* Thumbnail */}
                        <td style={{ width: 52, paddingRight: 0 }}>
                          {m.image_url
                            ? <img src={m.image_url} alt="" style={{ width: 44, height: 32, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', display: 'block' }} onError={e => ((e.currentTarget as HTMLImageElement).style.opacity = '0')} />
                            : <div style={{ width: 44, height: 32, borderRadius: 6, background: '#21262d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Eye size={12} color="#484f58" /></div>}
                        </td>
                        {/* Title + options */}
                        <td style={{ maxWidth: 240 }}>
                          <div style={{ fontSize: 13, color: 'white', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.title}>{m.title}</div>
                          <div style={{ fontSize: 10, color: '#484f58', marginTop: 2, display: 'flex', gap: 6 }}>
                            <span style={{ color: '#3fb950' }}>A: {m.option_a || 'Oui'}</span>
                            <span>·</span>
                            <span style={{ color: '#f85149' }}>B: {m.option_b || 'Non'}</span>
                          </div>
                        </td>
                        <td><span className="badge badge-gray">{CAT_LABELS[m.category] || m.category}</span></td>
                        {/* Status */}
                        <td>
                          <span className={`badge ${STATUS_BADGE[m.status] || 'badge-gray'}`}>
                            {m.status}{m.resolution ? ` · ${m.resolution.toUpperCase()}` : ''}
                          </span>
                        </td>
                        {/* Yes% with progress bar */}
                        <td style={{ width: 100 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#3fb950', marginBottom: 4 }}>
                            {Math.round(m.yes_prob * 100)}%
                          </div>
                          <div className="progress-bar" style={{ width: 60 }}>
                            <div className="progress-fill" style={{ width: `${m.yes_prob * 100}%`, background: `${STATUS_CLR[m.status] || '#3fb950'}` }} />
                          </div>
                        </td>
                        {/* Volume + bets */}
                        <td>
                          <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#d29922' }}>{Math.floor(m.local_volume ?? 0).toLocaleString()} HTG</div>
                          <div style={{ fontSize: 10, color: '#484f58' }}>{m.bet_count} paris</div>
                        </td>
                        {/* End date */}
                        {(() => {
                          const end = new Date(m.end_date);
                          const now = new Date();
                          const msDiff = end.getTime() - now.getTime();
                          const daysLeft = msDiff / 86_400_000;
                          const expired = msDiff <= 0;
                          const expiringSoon = !expired && daysLeft <= 3;
                          const fmtDate = end.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
                          return (
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <div style={{ fontSize: 11, color: expired ? '#f85149' : expiringSoon ? '#d29922' : '#8b949e' }}>{fmtDate}</div>
                              {expiringSoon && (
                                <div style={{ marginTop: 3, display: 'inline-flex', alignItems: 'center', gap: 3, background: 'rgba(210,153,34,0.15)', border: '1px solid rgba(210,153,34,0.35)', borderRadius: 4, padding: '1px 5px', fontSize: 10, color: '#d29922', fontWeight: 600 }}>
                                  ⏳ {Math.ceil(daysLeft)}j restant{Math.ceil(daysLeft) > 1 ? 's' : ''}
                                </div>
                              )}
                              {expired && m.status === 'active' && (
                                <div style={{ marginTop: 3, display: 'inline-flex', alignItems: 'center', gap: 3, background: 'rgba(248,81,73,0.12)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: 4, padding: '1px 5px', fontSize: 10, color: '#f85149', fontWeight: 600 }}>
                                  ⚠ Expiré
                                </div>
                              )}
                            </td>
                          );
                        })()}
                        {/* Actions */}
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <button onClick={() => openStats(m)} className="btn btn-ghost btn-xs" title="Statistiques Paris"><Eye size={11} /></button>
                            <button onClick={() => openEdit(m)} className="btn btn-ghost btn-xs"><Edit3 size={11} /></button>
                            {m.status === 'active' && (
                              <>
                                <button onClick={() => openResolve(m)} className="btn btn-xs" style={{ background: 'rgba(163,113,247,.12)', color: '#a371f7', border: '1px solid rgba(163,113,247,.25)' }}>Résoudre</button>
                                <button onClick={() => handleStatusChange(m.id, 'closed')} className="btn btn-ghost btn-xs">Fermer</button>
                              </>
                            )}
                            {m.status === 'closed' && <button onClick={() => handleStatusChange(m.id, 'active')} className="btn btn-success btn-xs">Rouvrir</button>}
                            {m.status === 'draft' && <button onClick={() => handleStatusChange(m.id, 'active')} className="btn btn-primary btn-xs">Activer</button>}
                            <button onClick={() => setDeleteId(m.id)} className="btn btn-danger btn-xs"><Trash2 size={11} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Edit modal ──────────────────────────────────────────────────────── */}
      {editMarket && (
        <div className="modal-overlay" onClick={() => setEditMarket(null)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>Modifier le marché</div>
              <button onClick={() => setEditMarket(null)} className="btn btn-ghost btn-sm"><X size={15} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <form id="edit-form" onSubmit={handleEdit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                  <div>
                    <label className="label">Titre *</label>
                    <input value={editForm.title} onChange={e => EF('title', e.target.value)} className="input" required />
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <textarea value={editForm.description} onChange={e => EF('description', e.target.value)} className="input" style={{ minHeight: 72, resize: 'vertical' }} />
                  </div>
                  <div className="form-row">
                    <div>
                      <label className="label">Catégorie</label>
                      <select value={editForm.category} onChange={e => EF('category', e.target.value)} className="input">
                        {CATS.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Date de fin</label>
                      <input type="datetime-local" value={editForm.end_date} onChange={e => EF('end_date', e.target.value)} className="input" />
                    </div>
                    <div>
                      <label className="label">Mise min</label>
                      <input type="number" value={editForm.min_bet} onChange={e => EF('min_bet', e.target.value)} className="input" />
                    </div>
                    <div>
                      <label className="label">Mise max</label>
                      <input type="number" value={editForm.max_bet} onChange={e => EF('max_bet', e.target.value)} className="input" />
                    </div>
                  </div>

                  {/* Comparison options */}
                  <div style={{ background: 'rgba(88,166,255,.04)', border: '1px solid rgba(88,166,255,.12)', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#58a6ff', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                      Options de comparaison
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label className="label">Option A <span style={{ color: '#3fb950' }}>(Oui / Wi)</span></label>
                        <input value={editForm.option_a} onChange={e => EF('option_a', e.target.value)} placeholder='"Oui"' className="input" maxLength={40} />
                      </div>
                      <div>
                        <label className="label">Option B <span style={{ color: '#f85149' }}>(Non)</span></label>
                        <input value={editForm.option_b} onChange={e => EF('option_b', e.target.value)} placeholder='"Non"' className="input" maxLength={40} />
                      </div>
                      <div>
                        <label className="label">Cote A <span style={{ color: '#f85149' }}>*</span></label>
                        <input type="number" value={editForm.odds_a} onChange={e => EF('odds_a', e.target.value)} placeholder="1.80" className="input" min={1.01} step={0.01} required />
                      </div>
                      <div>
                        <label className="label">Cote B <span style={{ color: '#f85149' }}>*</span></label>
                        <input type="number" value={editForm.odds_b} onChange={e => EF('odds_b', e.target.value)} placeholder="2.20" className="input" min={1.01} step={0.01} required />
                      </div>
                    </div>
                    {editForm.odds_a && editForm.odds_b && parseFloat(editForm.odds_a) >= 1.01 && parseFloat(editForm.odds_b) >= 1.01 && (() => {
                      const pA = Math.round((1 / parseFloat(editForm.odds_a)) * 100);
                      const pB = Math.round((1 / parseFloat(editForm.odds_b)) * 100);
                      return (
                        <div style={{ marginTop: 8, fontSize: 11, color: '#8b949e', display: 'flex', gap: 12 }}>
                          <span style={{ color: '#3fb950' }}>A: {pA}% → {parseFloat(editForm.odds_a).toFixed(2)}×</span>
                          <span style={{ color: '#f85149' }}>B: {pB}% → {parseFloat(editForm.odds_b).toFixed(2)}×</span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Image */}
                  <ImageSection
                    imageUrl={editForm.image_url}
                    imgMode={editImgMode}
                    setImgMode={setEditImgMode}
                    onUrlChange={url => EF('image_url', url)}
                    onFileChange={uri => EF('image_url', uri)}
                  />
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button onClick={() => setEditMarket(null)} className="btn btn-ghost">Annuler</button>
              <button type="submit" form="edit-form" disabled={editBusy} className="btn btn-primary">
                {editBusy ? '...' : <><Check size={14} /> Sauvegarder </>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Resolve modal ───────────────────────────────────────────────────── */}
      {resolveId && resolveMarket && (
        <div className="modal-overlay" onClick={() => { setResolveId(null); setResolveMarket(null); }}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>Résoudre le marché</div>
              <button onClick={() => { setResolveId(null); setResolveMarket(null); }} className="btn btn-ghost btn-sm"><X size={15} /></button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 13, color: '#8b949e', marginBottom: 16, fontStyle: 'italic' }}>« {resolveMarket.title} »</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {(['yes', 'no'] as const).map(r => {
                  const label = r === 'yes'
                    ? (resolveMarket.option_a || 'Oui')
                    : (resolveMarket.option_b || 'Non');
                  const col = r === 'yes' ? '#3fb950' : '#f85149';
                  const isActive = resolution === r;
                  return (
                    <button key={r} onClick={() => setResolution(r)}
                      style={{
                        flex: 1, padding: '10px 8px', borderRadius: 8,
                        background: isActive ? col : 'rgba(255,255,255,.05)',
                        border: `1px solid ${isActive ? col : 'rgba(255,255,255,.08)'}`,
                        color: isActive ? '#fff' : '#8b949e',
                        fontWeight: isActive ? 700 : 400, fontSize: 13,
                        cursor: 'pointer', transition: 'all .15s',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                      }}>
                      <span style={{ fontSize: 16 }}>{r === 'yes' ? '✓' : '✗'}</span>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: '#484f58', lineHeight: 1.5 }}>
                Tous les paris sur «{' '}
                <strong style={{ color: resolution === 'yes' ? '#3fb950' : '#f85149' }}>
                  {resolution === 'yes' ? (resolveMarket.option_a || 'Oui') : (resolveMarket.option_b || 'Non')}
                </strong>
                {' »'} seront crédités immédiatement.
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => { setResolveId(null); setResolveMarket(null); }} className="btn btn-ghost">Annuler</button>
              <button onClick={handleResolve} disabled={resolveBusy} className="btn btn-primary">
                {resolveBusy ? '...' : 'Confirmer la résolution'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ──────────────────────────────────────────────────── */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f85149' }}>Supprimer le marché</div>
              <button onClick={() => setDeleteId(null)} className="btn btn-ghost btn-sm"><X size={15} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#8b949e', fontSize: 13 }}>Cette action est irréversible. Tous les paris actifs seront remboursés.</p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setDeleteId(null)} className="btn btn-ghost">Annuler</button>
              <button onClick={confirmDelete} disabled={deleteBusy} className="btn btn-danger">
                {deleteBusy ? '...' : <><Trash2 size={13} /> Supprimer</>}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Market Stats modal ────────────────────────────────────────────────── */}
      {statsMarket && (
        <div className="modal-overlay" onClick={() => setStatsMarket(null)}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{statsMarket.title}</div>
                <div style={{ fontSize: 11, color: '#484f58', marginTop: 2 }}>Statistiques des paris</div>
              </div>
              <button onClick={() => setStatsMarket(null)} className="btn btn-ghost btn-sm"><X size={15} /></button>
            </div>

            {statsLoading ? (
              <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,0.08)', borderTopColor: '#1f6feb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : statsData ? (
              <>
                {/* Totals */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                  {[
                    { lbl: 'Total misé', val: `${Math.floor(statsData.totals.total_wagered).toLocaleString()} HTG`, color: '#d29922' },
                    { lbl: `${statsMarket.option_a || 'Oui'} (HTG)`, val: `${Math.floor(statsData.totals.yes_total).toLocaleString()}`, color: '#3fb950' },
                    { lbl: `${statsMarket.option_b || 'Non'} (HTG)`, val: `${Math.floor(statsData.totals.no_total).toLocaleString()}`, color: '#f85149' },
                    { lbl: 'Nb paris', val: String(statsData.totals.bet_count), color: '#58a6ff' },
                    { lbl: `${statsMarket.option_a || 'Oui'} / ${statsMarket.option_b || 'Non'}`, val: `${statsData.totals.yes_count} / ${statsData.totals.no_count}`, color: '#8b949e' },
                  ].map(s => (
                    <div key={s.lbl} style={{ padding: '14px 16px', borderRight: '1px solid rgba(255,255,255,.06)', textAlign: 'center' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: s.color, fontFamily: 'JetBrains Mono, monospace' }}>{s.val}</div>
                      <div style={{ fontSize: 10, color: '#484f58', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 3 }}>{s.lbl}</div>
                    </div>
                  ))}
                </div>

                {/* Progress bar yes vs no */}
                {statsData.totals.total_wagered > 0 && (
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8b949e', marginBottom: 6 }}>
                      <span style={{ color: '#3fb950', fontWeight: 600 }}>{statsMarket.option_a || 'Oui'} · {Math.round(statsData.totals.yes_total / statsData.totals.total_wagered * 100)}%</span>
                      <span style={{ color: '#f85149', fontWeight: 600 }}>{Math.round(statsData.totals.no_total / statsData.totals.total_wagered * 100)}% · {statsMarket.option_b || 'Non'}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: 'rgba(248,81,73,.25)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#2ea043,#3fb950)', width: `${statsData.totals.yes_total / statsData.totals.total_wagered * 100}%`, transition: 'width .5s' }} />
                    </div>
                  </div>
                )}

                {/* Bets list */}
                <div className="modal-body" style={{ maxHeight: 320, overflowY: 'auto' }}>
                  {statsData.bets.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#484f58', padding: 24 }}>Aucun pari</div>
                  ) : (
                    <table className="tbl">
                      <thead><tr>{['Utilisateur', 'Option', 'Mise', 'Cote', 'Gain potentiel', 'Statut', 'Date'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                      <tbody>
                        {statsData.bets.map((b: any) => (
                          <tr key={b.id}>
                            <td style={{ fontSize: 12, color: 'white', fontWeight: 500 }}>{b.username}</td>
                            <td><span className={`badge ${b.option==='yes'?'badge-green':'badge-red'}`}>{b.option==='yes'?(statsMarket.option_a||'Oui'):(statsMarket.option_b||'Non')}</span></td>
                            <td style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#8b949e' }}>{Math.floor(b.amount).toLocaleString()} HTG</td>
                            <td style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#d29922', fontWeight: 700 }}>{parseFloat(b.odds_at_bet).toFixed(2)}×</td>
                            <td style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#3fb950' }}>{Math.floor(b.potential_payout).toLocaleString()} HTG</td>
                            <td><span className={`badge ${b.status==='won'?'badge-green':b.status==='active'?'badge-blue':'badge-red'}`}>{b.status}</span></td>
                            <td style={{ fontSize: 11, color: '#484f58', whiteSpace: 'nowrap' }}>{new Date(b.created_at).toLocaleString('en-US',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: '#484f58' }}>Erreur de chargement</div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
