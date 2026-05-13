import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, Wallet, Activity, BarChart2,
  ArrowDownLeft, ArrowUpRight, ChevronRight,
  Vote, Trophy, Music, Users, Grid3X3, Zap,
  Bitcoin, Cpu, Globe, Flame, Layers,
  Target, Award, Bookmark, CheckCircle,
  ShieldCheck, Clock, Star,
} from 'lucide-react';
import { useMarkets } from '../hooks/useMarkets';
import { useWebSocket } from '../hooks/useRealtime';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../hooks/useLocale';
import MarketCard from '../components/market/MarketCard';
import { walletAPI, marketsAPI, categoriesAPI } from '../api';
import WalletModal from '../components/wallet/WalletModal';

/* ─── viewport ── */
function useVP() {
  const [w, setW] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1280);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener('resize', fn, { passive: true });
    return () => window.removeEventListener('resize', fn);
  }, []);
  return { isMobile: w < 640, isTablet: w >= 640 && w < 1024, isDesktop: w >= 1024 };
}

function fmtHTG(v: number | string | null | undefined) {
  const n = parseFloat(String(v ?? 0)) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return Math.floor(n).toLocaleString();
}

const ICON_MAP: Record<string, React.ReactNode> = {
  politik: <Vote size={16} />, spo: <Trophy size={16} />, ekonomi: <BarChart2 size={16} />,
  kilti: <Music size={16} />, sosyal: <Users size={16} />, lot: <Layers size={16} />,
  nouvo: <Zap size={16} />, krypto: <Bitcoin size={16} />, teknoloji: <Cpu size={16} />,
  entènasyonal: <Globe size={16} />, tendans: <Flame size={16} />,
};

const TX_CONF: Record<string, { icon: React.ReactNode; color: string; bg: string; sign: string; label: string }> = {
  deposit:    { icon: <ArrowDownLeft size={13} />,  color: '#10b981', bg: 'rgba(16,185,129,.12)',  sign: '+', label: 'Depozit' },
  withdrawal: { icon: <ArrowUpRight size={13} />,   color: '#ef4444', bg: 'rgba(239,68,68,.12)',   sign: '-', label: 'Retrè' },
  win:        { icon: <Award size={13} />,           color: '#10b981', bg: 'rgba(16,185,129,.12)',  sign: '+', label: 'Genyen' },
  bet:        { icon: <Target size={13} />,          color: '#ef4444', bg: 'rgba(239,68,68,.12)',   sign: '-', label: 'Pari' },
  bet_slip:   { icon: <Bookmark size={13} />,        color: '#ef4444', bg: 'rgba(239,68,68,.12)',   sign: '-', label: 'Kombi' },
  refund:     { icon: <CheckCircle size={13} />,     color: '#d29922', bg: 'rgba(210,153,34,.12)',  sign: '+', label: 'Ranbousman' },
  bonus:      { icon: <Zap size={13} />,             color: '#a371f7', bg: 'rgba(163,113,247,.12)', sign: '+', label: 'Bonus' },
};

/* ─── skeleton ── */
const SkeletonCard = memo(function SkeletonCard() {
  return (
    <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,.05)', borderRadius: 14, padding: 15, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 9, flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div className="skeleton" style={{ height: 11, width: '80%' }} />
          <div className="skeleton" style={{ height: 11, width: '55%', opacity: 0.7 }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <div className="skeleton" style={{ flex: 1, height: 36, borderRadius: 9 }} />
        <div className="skeleton" style={{ flex: 1, height: 36, borderRadius: 9, opacity: 0.7 }} />
      </div>
      <div className="skeleton" style={{ height: 4, borderRadius: 4 }} />
    </div>
  );
});

/* ═══════════════════════════════════════════════════════ HOME ═══ */
export default function Home() {
  const { user } = useAuth();
  const { locale, path } = useLocale();
  const { isMobile, isTablet, isDesktop } = useVP();
  const { markets, loading, applyMarketUpdate } = useMarkets({ limit: 500, status: 'active' } as any);

  const [activity, setActivity]   = useState<any[]>([]);
  const [apiCats, setApiCats]     = useState<any[]>([]);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletMode, setWalletMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [favIds, setFavIds]        = useState<Set<string>>(new Set());

  const openWallet = (m: 'deposit' | 'withdraw') => { setWalletMode(m); setWalletOpen(true); };

  /* WebSocket */
  useWebSocket({
    onMessage: (msg) => {
      if (msg.type === 'market:update')
        applyMarketUpdate({ id: msg.market_id, yes_prob: msg.yes_prob, no_prob: msg.no_prob, local_volume: msg.local_volume, bet_count: msg.bet_count } as any);
    },
  });

  /* Data fetches */
  useEffect(() => {
    if (user) walletAPI.getTransactions({ limit: 5 }).then(r => setActivity(r.data || [])).catch(() => {});
  }, [user]);

  useEffect(() => {
    categoriesAPI.list().then(r => setApiCats(r.data.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) { setFavIds(new Set()); return; }
    marketsAPI.getFavorites().then(r => setFavIds(new Set(r.data.map((m: any) => m.id)))).catch(() => {});
  }, [user]);

  const handleToggleFav = useCallback((id: string) => {
    if (!user) return;
    const next = !favIds.has(id);
    setFavIds(p => { const s = new Set(p); next ? s.add(id) : s.delete(id); return s; });
    marketsAPI.toggleFavorite(id).catch(() =>
      setFavIds(p => { const s = new Set(p); next ? s.delete(id) : s.add(id); return s; })
    );
  }, [user, favIds]);

  /* Derived */
  const balance    = parseFloat(String(user?.balance ?? 0)) || 0;
  const totalBets  = useMemo(() => markets.reduce((a, m) => a + (m.bet_count || 0), 0), [markets]);
  const totalVol   = useMemo(() => markets.reduce((a, m) => a + (m.local_volume || 0), 0), [markets]);
  const featured   = useMemo(() => markets.filter(m => m.status === 'active').slice(0, 12), [markets]);
  const cols       = isDesktop ? 'repeat(2,1fr)' : isMobile ? '1fr' : 'repeat(2,1fr)';

  /* ─── sidebar content ─── */
  const SidebarContent = useMemo(() => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Wallet card */}
      <div style={{ background: '#111820', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(59,130,246,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
              <Wallet size={14} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>
              {locale === 'fr' ? 'Portefeuille' : 'Pòtfolyo'}
            </span>
          </div>
          {user && (
            <Link to={path('portfolio')} style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
              {locale === 'fr' ? 'Voir tout' : 'Wè tout'} <ChevronRight size={10} />
            </Link>
          )}
        </div>

        {user ? (
          <>
            <div style={{ background: 'linear-gradient(135deg,rgba(16,185,129,.08),rgba(5,150,105,.04))', border: '1px solid rgba(16,185,129,.14)', borderRadius: 12, padding: '16px 18px', marginBottom: 14 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#4b6376', textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 6px' }}>
                {locale === 'fr' ? 'Solde disponible' : 'Balans disponib'}
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: '#10b981', fontFamily: 'JetBrains Mono,monospace', lineHeight: 1 }}>
                  {fmtHTG(balance)}
                </span>
                <span style={{ fontSize: 12, color: '#4b6376', fontWeight: 700 }}>HTG</span>
              </div>
              <p style={{ fontSize: 10, color: 'rgba(52,211,153,.4)', fontFamily: 'JetBrains Mono,monospace', margin: '4px 0 0' }}>
                ≈ ${(balance / 132).toFixed(2)} USD
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => openWallet('deposit')} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '11px 8px', borderRadius: 10,
                background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
                color: 'white', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <ArrowDownLeft size={13} /> {locale === 'fr' ? 'Déposer' : 'Depoze'}
              </button>
              <button onClick={() => openWallet('withdraw')} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '11px 8px', borderRadius: 10,
                background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.09)',
                color: '#94a3b8', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <ArrowUpRight size={13} /> {locale === 'fr' ? 'Retirer' : 'Retire'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 12, color: '#4b6376', margin: '0 0 14px', lineHeight: 1.7 }}>
              {locale === 'fr' ? 'Créez un compte gratuit et commencez à parier en HTG.' : 'Kreye yon kont gratis pou kòmanse pari an HTG.'}
            </p>
            <Link to={path('register')} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '12px', borderRadius: 10,
              background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
              color: 'white', fontWeight: 700, fontSize: 13, textDecoration: 'none',
            }}>
              {locale === 'fr' ? "S'inscrire — c'est gratuit" : 'Enskri gratis'} →
            </Link>
          </>
        )}
      </div>

      {/* How it works */}
      {!user && (
        <div style={{ background: '#111820', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 14px' }}>
            {locale === 'fr' ? 'Comment ça marche' : 'Kijan li travay'}
          </p>
          {[
            { icon: <Wallet size={13} />, color: '#3b82f6', title: locale === 'fr' ? 'Déposez des HTG' : 'Depoze HTG', desc: locale === 'fr' ? 'Via MonCash facilement' : 'Via MonCash fasil' },
            { icon: <TrendingUp size={13} />, color: '#10b981', title: locale === 'fr' ? 'Pariez' : 'Parie', desc: locale === 'fr' ? 'Choisissez Wi ou Non' : 'Chwazi Wi oswa Non' },
            { icon: <Star size={13} />, color: '#a371f7', title: locale === 'fr' ? 'Gagnez' : 'Genyen', desc: locale === 'fr' ? 'Recevez vos gains' : 'Resevwa gain ou' },
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: i < 2 ? 14 : 0 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${step.color}15`, color: step.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {step.icon}
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', margin: '0 0 2px' }}>{step.title}</p>
                <p style={{ fontSize: 11, color: '#4b6376', margin: 0 }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent activity */}
      {user && (
        <div style={{ background: '#111820', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Activity size={13} color="#10b981" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>
              {locale === 'fr' ? 'Activité récente' : 'Aktivite resan'}
            </span>
          </div>
          {activity.length === 0 ? (
            <p style={{ fontSize: 12, color: '#4b6376', textAlign: 'center', padding: '16px 0', margin: 0 }}>
              {locale === 'fr' ? "Pas encore d'activité" : 'Poko gen aktivite'}
            </p>
          ) : activity.slice(0, 5).map((tx, i) => {
            const cfg = TX_CONF[tx.type] || TX_CONF.bet;
            return (
              <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: i < Math.min(activity.length, 5) - 1 ? '1px solid rgba(255,255,255,.04)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: cfg.bg, color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {cfg.icon}
                  </div>
                  <div>
                    <p style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 12, margin: 0 }}>{cfg.label}</p>
                    <p style={{ color: '#4b6376', fontSize: 10, margin: '2px 0 0' }}>
                      {new Date(tx.created_at).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'fr-HT', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                </div>
                <span style={{ color: cfg.color, fontFamily: 'JetBrains Mono,monospace', fontWeight: 700, fontSize: 12 }}>
                  {cfg.sign}{fmtHTG(tx.amount)}<span style={{ fontSize: 9, color: '#4b6376', marginLeft: 2 }}>G</span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Trust badges */}
      <div style={{ background: '#111820', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: 18 }}>
        {[
          { icon: <ShieldCheck size={13} />, color: '#10b981', label: locale === 'fr' ? 'Sécurisé & chiffré' : 'Sekirize & chifre' },
          { icon: <Clock size={13} />, color: '#3b82f6', label: locale === 'fr' ? 'Résolution en 24h' : 'Rezolisyon an 24h' },
          { icon: <Wallet size={13} />, color: '#a371f7', label: locale === 'fr' ? 'Paiement via MonCash' : 'Peman via MonCash' },
        ].map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: i > 0 ? '9px 0 0' : '0 0 9px', borderBottom: i < 2 ? '1px solid rgba(255,255,255,.04)' : 'none' }}>
            <span style={{ color: b.color }}>{b.icon}</span>
            <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  ), [user, balance, locale, activity, path]);

  /* ────────────────────────────────────────────────────────────── */
  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse  { 0%,100%{opacity:1;} 50%{opacity:.45;} }
        @keyframes liveDot{ 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.6);} 60%{box-shadow:0 0 0 5px rgba(16,185,129,0);} }
        @keyframes shimmer{ from{background-position:-400px 0;} to{background-position:400px 0;} }

        .am-up { animation: fadeUp .32s ease backwards; }
        .sk { animation: pulse 1.8s ease-in-out infinite; }
        .live-dot { animation: liveDot 2.2s ease-in-out infinite; }

        .cat-pill::-webkit-scrollbar { display:none; }
        .cat-pill { -ms-overflow-style:none; scrollbar-width:none; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,.1); border-radius:99px; }
      `}</style>

      <div style={{ background: '#090d12', minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <div style={{ maxWidth: 1380, margin: '0 auto', padding: isMobile ? '20px 14px' : isTablet ? '28px 20px' : '40px 48px' }}>

          {/* ═══ HERO ═══ */}
          <div style={{ marginBottom: isMobile ? 28 : 44 }}>
            <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 320px' : '1fr', gap: 16 }}>

              {/* Hero card */}
              <div style={{
                position: 'relative', overflow: 'hidden',
                background: 'linear-gradient(135deg,#0c1524 0%,#0f1f35 40%,#0c1117 100%)',
                border: '1px solid rgba(59,130,246,.2)',
                borderRadius: 20, padding: isMobile ? '28px 22px' : '40px 44px',
              }}>
                {/* Glows */}
                <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle,rgba(59,130,246,.1) 0%,transparent 70%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: -40, left: 60, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(16,185,129,.06) 0%,transparent 70%)', pointerEvents: 'none' }} />

                <div style={{ position: 'relative' }}>
                  {/* Badge */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 18, padding: '5px 12px', borderRadius: 99, background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.22)' }}>
                    <span className="live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                      Ayiti Market — Live
                    </span>
                  </div>

                  <h1 style={{ fontSize: isMobile ? 26 : isTablet ? 34 : 44, fontWeight: 900, color: 'white', margin: '0 0 10px', lineHeight: 1.1, letterSpacing: '-.03em' }}>
                    {locale === 'fr' ? (
                      <>Pariez sur<br /><span style={{ color: '#3b82f6' }}>l'avenir d'Haïti</span></>
                    ) : (
                      <>Pari sou<br /><span style={{ color: '#3b82f6' }}>avni Ayiti</span></>
                    )}
                  </h1>
                  <p style={{ fontSize: isMobile ? 13 : 15, color: 'rgba(255,255,255,.4)', margin: '0 0 28px', lineHeight: 1.65, maxWidth: 480 }}>
                    {locale === 'fr'
                      ? 'Marchés de prédiction en temps réel — politique, sport, économie, crypto et plus.'
                      : 'Machè prediksyon an tan reyèl — politik, spò, ekonomi, kripto ak plis.'}
                  </p>

                  {/* Stats row */}
                  <div style={{ display: 'flex', gap: isMobile ? 10 : 16, flexWrap: 'wrap', marginBottom: 28 }}>
                    {[
                      { label: locale === 'fr' ? 'Marchés actifs' : 'Machè aktif', value: markets.filter(m => m.status === 'active').length, color: '#3b82f6', icon: <Globe size={12} /> },
                      { label: locale === 'fr' ? 'Paris placés' : 'Pari fè', value: totalBets.toLocaleString(), color: '#a371f7', icon: <TrendingUp size={12} /> },
                      { label: 'Volume (HTG)', value: fmtHTG(totalVol), color: '#10b981', icon: <BarChart2 size={12} /> },
                    ].map(s => (
                      <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)' }}>
                        <span style={{ color: s.color }}>{s.icon}</span>
                        <span style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: 'white', fontFamily: 'JetBrains Mono,monospace' }}>{s.value}</span>
                        <span style={{ fontSize: 10, color: '#4b6376', fontWeight: 600 }}>{s.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {!user ? (
                      <>
                        <Link to={path('register')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: 'white', fontWeight: 700, fontSize: 14, textDecoration: 'none', boxShadow: '0 4px 20px rgba(37,99,235,.35)', transition: 'transform .15s, box-shadow .15s' }}
                          onMouseEnter={e => { (e.currentTarget as any).style.transform = 'translateY(-1px)'; (e.currentTarget as any).style.boxShadow = '0 6px 24px rgba(37,99,235,.45)'; }}
                          onMouseLeave={e => { (e.currentTarget as any).style.transform = ''; (e.currentTarget as any).style.boxShadow = '0 4px 20px rgba(37,99,235,.35)'; }}
                        >
                          {locale === 'fr' ? "S'inscrire gratuitement" : 'Enskri gratis'} →
                        </Link>
                        <Link to={path('markets')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 12, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: '#94a3b8', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                          {locale === 'fr' ? 'Explorer les marchés' : 'Eksplore machè yo'}
                        </Link>
                      </>
                    ) : (
                      <Link to={path('markets')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: 'white', fontWeight: 700, fontSize: 14, textDecoration: 'none', boxShadow: '0 4px 20px rgba(37,99,235,.35)' }}>
                        <TrendingUp size={16} /> {locale === 'fr' ? 'Voir tous les marchés' : 'Wè tout machè yo'}
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* Desktop side quick-nav */}
              {isDesktop && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#4b6376', textTransform: 'uppercase', letterSpacing: '.1em', margin: '0 0 8px 2px' }}>
                    {locale === 'fr' ? 'Catégories' : 'Kategori'}
                  </p>
                  {apiCats.slice(0, 8).map(cat => {
                    const Icon = ICON_MAP[cat.slug] ?? <BarChart2 size={15} />;
                    return (
                      <Link
                        key={cat.slug}
                        to={`${path('markets')}?category=${cat.slug}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: '#111820', border: '1px solid rgba(255,255,255,.06)', textDecoration: 'none', color: 'white', fontSize: 13, fontWeight: 600, transition: 'all .15s', flex: 1 }}
                        onMouseEnter={e => { (e.currentTarget as any).style.background = `${cat.color}0c`; (e.currentTarget as any).style.borderColor = `${cat.color}35`; }}
                        onMouseLeave={e => { (e.currentTarget as any).style.background = '#111820'; (e.currentTarget as any).style.borderColor = 'rgba(255,255,255,.06)'; }}
                      >
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${cat.color}18`, color: cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {Icon}
                        </div>
                        <span style={{ flex: 1 }}>{locale === 'fr' ? cat.name_fr : cat.name}</span>
                        {cat.market_count > 0 && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: cat.color, background: `${cat.color}18`, borderRadius: 99, padding: '1px 7px' }}>
                            {cat.market_count}
                          </span>
                        )}
                        <ChevronRight size={12} color="rgba(255,255,255,.2)" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Mobile category scroll */}
            {!isDesktop && (
              <div className="cat-pill" style={{ marginTop: 16, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <div style={{ display: 'flex', gap: 8, paddingBottom: 2 }}>
                  {apiCats.map(cat => {
                    const Icon = ICON_MAP[cat.slug] ?? <BarChart2 size={13} />;
                    return (
                      <Link key={cat.slug} to={`${path('markets')}?category=${cat.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 99, background: '#111820', border: `1px solid ${cat.color}28`, textDecoration: 'none', color: cat.color, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {Icon}
                        {locale === 'fr' ? cat.name_fr : cat.name}
                        {cat.market_count > 0 && <span style={{ fontSize: 10, opacity: .75 }}>({cat.market_count})</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ═══ MAIN GRID ═══ */}
          <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'minmax(0,1fr) 300px' : '1fr', columnGap: 32, rowGap: 28, alignItems: 'start' }}>

            {/* Markets column */}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="live-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  <h2 style={{ fontSize: isMobile ? 15 : 17, fontWeight: 700, color: 'white', letterSpacing: '-.01em', margin: 0 }}>
                    {locale === 'fr' ? 'Marchés en vedette' : 'Machè an vedèt'}
                  </h2>
                  {!loading && featured.length > 0 && (
                    <span style={{ fontSize: 11, color: '#4b6376', fontWeight: 600, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 99, padding: '2px 8px' }}>
                      {featured.length}
                    </span>
                  )}
                </div>
                <Link to={path('markets')} style={{ fontSize: 12, color: '#4b6376', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, whiteSpace: 'nowrap' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#4b6376')}
                >
                  {locale === 'fr' ? 'Tout voir' : 'Wè tout'} <ChevronRight size={13} />
                </Link>
              </div>

              {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12 }}>
                  {Array.from({ length: 6 }).map((_, i) => <div key={i} className="sk"><SkeletonCard /></div>)}
                </div>
              ) : featured.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '72px 32px', background: 'rgba(255,255,255,.02)', borderRadius: 14, border: '1px dashed rgba(255,255,255,.06)' }}>
                  <TrendingUp style={{ width: 40, height: 40, margin: '0 auto 14px', opacity: .15, display: 'block' }} />
                  <p style={{ fontSize: 14, color: '#334155', margin: 0 }}>
                    {locale === 'fr' ? 'Aucun marché actif' : 'Pa gen machè aktif'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: cols, gap: isMobile ? 10 : 14 }}>
                  {featured.map((m, i) => (
                    <div key={m.id} className="am-up" style={{ animationDelay: `${Math.min(i * 40, 320)}ms` }}>
                      <MarketCard market={m} index={i} isFavorited={favIds.has(m.id)} onToggleFavorite={() => handleToggleFav(m.id)} />
                    </div>
                  ))}
                </div>
              )}

              {/* See all button */}
              {featured.length >= 12 && (
                <div style={{ textAlign: 'center', marginTop: 28 }}>
                  <Link to={path('markets')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 12, border: '1px solid rgba(59,130,246,.25)', background: 'rgba(59,130,246,.07)', color: '#3b82f6', fontWeight: 700, fontSize: 13, textDecoration: 'none', transition: 'all .15s' }}
                    onMouseEnter={e => { (e.currentTarget as any).style.background = 'rgba(59,130,246,.14)'; }}
                    onMouseLeave={e => { (e.currentTarget as any).style.background = 'rgba(59,130,246,.07)'; }}
                  >
                    {locale === 'fr' ? 'Voir tous les marchés' : 'Wè tout machè yo'} <ChevronRight size={14} />
                  </Link>
                </div>
              )}
            </div>

            {/* Sidebar */}
            {isDesktop && (
              <aside style={{ position: 'sticky', top: 'calc(var(--header-h,64px) + 20px)' }}>
                {SidebarContent}
              </aside>
            )}
          </div>

          {/* Mobile sidebar below markets */}
          {!isDesktop && (
            <div style={{ marginTop: 28 }}>
              {SidebarContent}
            </div>
          )}

          <div style={{ height: isMobile ? 60 : 40 }} />
        </div>
      </div>

      {walletOpen && user && (
        <WalletModal initialMode={walletMode} onClose={() => { setWalletOpen(false); }} />
      )}
    </>
  );
}
