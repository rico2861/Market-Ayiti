import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, Wallet, Activity,
  ArrowUpRight, ArrowDownRight, Zap,
  ChevronRight, X,
} from 'lucide-react';
import { useMarkets }         from '../hooks/useMarkets';
import { useWebSocket }       from '../hooks/useRealtime';
import { useAuth }            from '../context/AuthContext';
import { useLocale }          from '../hooks/useLocale';
import MarketCard             from '../components/market/MarketCard';
import { MarketGridSkeleton } from '../components/ui/Skeleton';
import { walletAPI }          from '../api';

/* ═══════════════════════════════════════════════════════════════
   VIEWPORT HOOK
═══════════════════════════════════════════════════════════════ */
function useViewport() {
  const [w, setW] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener('resize', fn, { passive: true });
    return () => window.removeEventListener('resize', fn);
  }, []);
  return {
    isMobile:  w < 640,
    isTablet:  w >= 640 && w < 1024,
    isDesktop: w >= 1024,
    w,
  };
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
function fmtHTG(v: number | string | null | undefined): string {
  const n = parseFloat(String(v ?? 0)) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return Math.floor(n).toLocaleString();
}

/* ═══════════════════════════════════════════════════════════════
   DRAWER  (mobile sidebar)
═══════════════════════════════════════════════════════════════ */
function Drawer({
  open, onClose, children,
}: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .25s',
        }}
      />
      <aside
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 201,
          width: 'min(88vw, 320px)',
          background: '#0d1117',
          borderLeft: '1px solid rgba(255,255,255,.07)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform .3s cubic-bezier(.4,0,.2,1)',
          overflowY: 'auto', padding: 20,
          display: 'flex', flexDirection: 'column', gap: 14,
          boxSizing: 'border-box',
        }}
      >
        <button
          onClick={onClose}
          style={{
            alignSelf: 'flex-end',
            background: 'rgba(255,255,255,.06)',
            border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 8, color: '#8b949e', cursor: 'pointer',
            padding: '6px 12px',
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          <X size={13} /> Fèmen
        </button>
        {children}
      </aside>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR CARD
═══════════════════════════════════════════════════════════════ */
function SCard({ children, noPad }: { children: React.ReactNode; noPad?: boolean }) {
  return (
    <div style={{
      background: '#111820',
      border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 14,
      padding: noPad ? 0 : 20,
      overflow: 'hidden',
    }}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HERO BANNER
═══════════════════════════════════════════════════════════════ */
interface BannerProps {
  to: string;
  gradient: string;
  accent: string;
  emoji: string;
  eyebrow: string;
  title: string;
  desc: string;
  foot?: React.ReactNode;
  decor?: string;
  minH?: number;
}
function HeroBanner({ to, gradient, accent, emoji, eyebrow, title, desc, foot, decor, minH = 210 }: BannerProps) {
  const [hov, setHov] = useState(false);
  return (
    <Link
      to={to}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        textDecoration: 'none', position: 'relative', overflow: 'hidden',
        borderRadius: 16, background: gradient,
        padding: '22px 22px 18px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        minHeight: minH,
        border: `1px solid ${hov ? accent + '44' : accent + '1a'}`,
        transform: hov ? 'translateY(-2px)' : 'none',
        boxShadow: hov ? `0 12px 40px ${accent}14` : 'none',
        transition: 'border .2s, transform .2s, box-shadow .2s',
        cursor: 'pointer', boxSizing: 'border-box',
      }}
    >
      {decor && (
        <div style={{
          position: 'absolute', bottom: -24, right: -14,
          fontSize: 100, opacity: .07, lineHeight: 1, pointerEvents: 'none',
          userSelect: 'none',
        }}>
          {decor}
        </div>
      )}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 20 }}>{emoji}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, color: accent,
            textTransform: 'uppercase', letterSpacing: '.12em',
          }}>
            {eyebrow}
          </span>
        </div>
        <h2 style={{
          fontSize: 22, fontWeight: 800, color: 'white',
          margin: '0 0 7px', lineHeight: 1.1, letterSpacing: '-.02em',
        }}>
          {title}
        </h2>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', margin: 0, lineHeight: 1.6 }}>
          {desc}
        </p>
      </div>
      {foot && <div style={{ marginTop: 16 }}>{foot}</div>}
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HOME PAGE
═══════════════════════════════════════════════════════════════ */
export default function Home() {
  const { user }             = useAuth();
  const { locale, path }     = useLocale();
  const { markets, loading, applyMarketUpdate } = useMarkets({ limit: 24 });
  const [activity, setActivity] = useState<any[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isMobile, isTablet, isDesktop, w } = useViewport();

  useWebSocket({
    onMessage: (msg) => {
      if (msg.type === 'market:update') {
        applyMarketUpdate({
          id: msg.market_id,
          yes_prob:     msg.yes_prob,
          no_prob:      msg.no_prob,
          total_volume: msg.total_volume,
          bet_count:    msg.bet_count,
        } as any);
      }
    },
  });

  useEffect(() => {
    walletAPI.getTransactions({ limit: 5 })
      .then(r => setActivity(r.data || []))
      .catch(() => {});
  }, [user]);

  const balance    = parseFloat(String(user?.balance ?? 0)) || 0;
  const balanceUSD = (balance / 132).toFixed(2);

  /* market grid columns */
  const cols = isDesktop ? 'repeat(2,1fr)' : isMobile ? '1fr' : 'repeat(2,1fr)';

  const topMkts  = markets.slice(0, 6);
  const restMkts = markets.slice(6);

  /* ─ sidebar ─────────────────────────────────────────────── */
  const Sidebar = () => (
    <>
      {/* Portfolio card */}
      <SCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wallet size={14} color="#3b82f6" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>
              {locale === 'fr' ? 'Portefeuille' : 'Pòtfolyo'}
            </span>
          </div>
          {user && (
            <Link to={path('portfolio')} style={{
              fontSize: 11, color: '#3b82f6', fontWeight: 600,
              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3,
            }}>
              {locale === 'fr' ? 'Voir tout' : 'Wè tout'} <ChevronRight size={10} />
            </Link>
          )}
        </div>

        {user ? (
          <>
            {/* Balance */}
            <div style={{
              background: 'rgba(16,185,129,.07)',
              border: '1px solid rgba(16,185,129,.13)',
              borderRadius: 12, padding: '16px 18px', marginBottom: 14,
            }}>
              <p style={{
                fontSize: 10, fontWeight: 700, color: '#4b6376',
                textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 8px',
              }}>
                {locale === 'fr' ? 'Solde disponible' : 'Balans disponib'}
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{
                  fontSize: 30, fontWeight: 800, color: '#10b981',
                  fontFamily: 'JetBrains Mono, monospace', lineHeight: 1,
                }}>
                  {fmtHTG(balance)}
                </span>
                <span style={{ fontSize: 11, color: '#4b6376', fontWeight: 700 }}>HTG</span>
              </div>
              <p style={{
                fontSize: 11, color: 'rgba(52,211,153,.4)',
                fontFamily: 'JetBrains Mono, monospace', margin: '4px 0 12px',
              }}>
                ≈ ${balanceUSD} USD
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Zap size={11} color="#34d399" />
                <span style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>
                  +2.4% {locale === 'fr' ? 'cette semaine' : 'semèn sa a'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Link to={path('deposit')} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '11px 8px', borderRadius: 10,
                background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
                color: 'white', fontSize: 12, fontWeight: 700,
                textDecoration: 'none', transition: 'opacity .15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '.8')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <ArrowUpRight size={13} />
                {locale === 'fr' ? 'Déposer' : 'Depoze'}
              </Link>
              <Link to={path('withdraw')} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '11px 8px', borderRadius: 10,
                background: 'rgba(255,255,255,.06)',
                border: '1px solid rgba(255,255,255,.09)',
                color: '#94a3b8', fontSize: 12, fontWeight: 700,
                textDecoration: 'none', transition: 'all .15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.11)'; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.06)'; e.currentTarget.style.color = '#94a3b8'; }}
              >
                <ArrowDownRight size={13} />
                {locale === 'fr' ? 'Retirer' : 'Retire'}
              </Link>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 12, color: '#4b6376', margin: '0 0 16px', lineHeight: 1.7 }}>
              {locale === 'fr'
                ? 'Créez un compte gratuit et commencez à parier en HTG.'
                : 'Kreye yon kont gratis pou kòmanse pari an HTG.'}
            </p>
            <Link to={path('register')} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '12px', borderRadius: 10,
              background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
              color: 'white', fontWeight: 700, fontSize: 13,
              textDecoration: 'none',
            }}>
              {locale === 'fr' ? "S'inscrire gratuitement" : 'Enskri gratis'} →
            </Link>
          </>
        )}
      </SCard>

      {/* Recent Activity */}
      <SCard>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Activity size={13} color="#10b981" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>
            {locale === 'fr' ? 'Activité Récente' : 'Aktivite Resan'}
          </span>
        </div>

        {activity.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: '#4b6376', margin: 0 }}>
              {locale === 'fr' ? "Pas encore d'activité" : 'Poko gen aktivite'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {activity.slice(0, 5).map((tx, i) => (
              <div key={tx.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0',
                borderBottom: i < 4 ? '1px solid rgba(255,255,255,.04)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                    background:
                      tx.type === 'win'     ? 'rgba(16,185,129,.12)' :
                      tx.type === 'deposit' ? 'rgba(59,130,246,.12)' :
                                              'rgba(255,255,255,.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                  }}>
                    {tx.type === 'bet' ? '🎯' : tx.type === 'deposit' ? '⬇️' : '🏆'}
                  </div>
                  <div>
                    <p style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 12, margin: 0 }}>
                      {tx.type === 'bet' ? 'Pari' : tx.type === 'deposit' ? 'Depot' : 'Genyen'}
                    </p>
                    <p style={{ color: '#4b6376', fontSize: 10, margin: '2px 0 0' }}>
                      {new Date(tx.created_at).toLocaleDateString(
                        locale === 'fr' ? 'fr-FR' : 'fr-HT',
                        { day: '2-digit', month: 'short' }
                      )}
                    </p>
                  </div>
                </div>
                <span style={{
                  color: tx.type === 'deposit' || tx.type === 'win' ? '#10b981' : '#ef4444',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 700, fontSize: 12,
                }}>
                  {tx.type === 'deposit' || tx.type === 'win' ? '+' : '−'}
                  {parseFloat(String(tx.amount ?? 0)).toLocaleString()}
                  <span style={{ fontSize: 9, color: '#4b6376', marginLeft: 3 }}>HTG</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </SCard>
    </>
  );

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── Global styles ───────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=JetBrains+Mono:wght@400;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', system-ui, sans-serif; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes livePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(248,81,73,.5); }
          50%       { box-shadow: 0 0 0 6px rgba(248,81,73,0); }
        }

        .am-up   { animation: fadeUp .3s ease backwards; }
        .am-live { animation: livePulse 2s ease-in-out infinite; }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 99px; }
      `}</style>

      <div style={{ background: '#090d12', minHeight: '100vh', paddingBottom: 60 }}>

        {/* ── Page container ──────────────────────────────────── */}
        <div style={{
          maxWidth: 1360,
          margin: '0 auto',
          padding: isMobile ? '20px 16px' : isTablet ? '28px 24px' : '36px 40px',
        }}>

          {/* ════════════════════════════════════════════════════
              TOP BAR
          ════════════════════════════════════════════════════ */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: isMobile ? 24 : 36,
            gap: 12,
          }}>
            {/* Title */}
            <div>
              <h1 style={{
                fontSize: isMobile ? 20 : 26,
                fontWeight: 800, color: 'white',
                letterSpacing: '-.025em', lineHeight: 1.1,
              }}>
                {locale === 'fr' ? 'Marchés' : 'Machè'}
                <span style={{ color: '#3b82f6', marginLeft: 6 }}>Ayiti</span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center',
                  marginLeft: 10, fontSize: isMobile ? 9 : 10,
                  fontWeight: 700, color: '#ef4444',
                  background: 'rgba(239,68,68,.1)',
                  border: '1px solid rgba(239,68,68,.25)',
                  borderRadius: 99, padding: '2px 8px',
                  verticalAlign: 'middle', letterSpacing: '.08em',
                  textTransform: 'uppercase', gap: 4,
                }}>
                  <span className="am-live" style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: '#ef4444', display: 'inline-block',
                  }} />
                  LIVE
                </span>
              </h1>
              <p style={{ fontSize: isMobile ? 11 : 12, color: '#4b6376', marginTop: 4, fontWeight: 500 }}>
                {locale === 'fr' ? "Prédisez l'avenir d'Haïti" : 'Predi avni Ayiti'}
              </p>
            </div>

            {/* Right side — single unified action per breakpoint */}
            <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {isMobile ? (
                /* Mobile: ONE button — balance if logged in, wallet icon if not */
                <button
                  onClick={() => setDrawerOpen(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: user
                      ? 'rgba(16,185,129,.08)'
                      : 'rgba(255,255,255,.05)',
                    border: `1px solid ${user ? 'rgba(16,185,129,.18)' : 'rgba(255,255,255,.09)'}`,
                    borderRadius: 10,
                    padding: '8px 14px',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all .15s',
                  }}
                >
                  {user ? (
                    <>
                      <span style={{
                        fontSize: 14, fontWeight: 800, color: '#10b981',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}>
                        {fmtHTG(balance)}
                      </span>
                      <span style={{ fontSize: 9, color: '#4b6376', fontWeight: 700 }}>HTG</span>
                    </>
                  ) : (
                    <Wallet size={15} color="#94a3b8" />
                  )}
                </button>
              ) : isTablet ? (
                /* Tablet: labelled wallet button */
                <button
                  onClick={() => setDrawerOpen(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    background: 'rgba(255,255,255,.05)',
                    border: '1px solid rgba(255,255,255,.09)',
                    borderRadius: 10, color: '#94a3b8', cursor: 'pointer',
                    padding: '9px 18px',
                    fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                    transition: 'all .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.09)'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.05)'; e.currentTarget.style.color = '#94a3b8'; }}
                >
                  <Wallet size={14} />
                  {locale === 'fr' ? 'Portefeuille' : 'Pòtfolyo'}
                </button>
              ) : null /* desktop has no button here — sidebar is always visible */}
            </div>
          </div>

          {/* ════════════════════════════════════════════════════
              HERO BANNERS
          ════════════════════════════════════════════════════ */}
          <section style={{ marginBottom: isMobile ? 32 : isTablet ? 40 : 48 }}>
            {isDesktop ? (
              /* Desktop: 3 columns */
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16 }}>
                <HeroBanner
                  to={`${path('markets')}?category=politik`}
                  gradient="linear-gradient(140deg,#0c1a3d 0%,#0f172a 100%)"
                  accent="#3b82f6" emoji="🗳️"
                  eyebrow={locale === 'fr' ? 'En vedette' : 'Pwomote'}
                  title={locale === 'fr' ? 'Élections 2026' : 'Eleksyon 2026'}
                  desc={locale === 'fr' ? "Pariez sur l'avenir politique d'Haïti" : 'Pari sou avni politik Ayiti'}
                  decor="📊" minH={230}
                  foot={
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <ChevronRight size={16} color="rgba(255,255,255,.4)" />
                    </div>
                  }
                />
                <HeroBanner
                  to={`${path('markets')}?category=spo`}
                  gradient="linear-gradient(140deg,#042010 0%,#0a1a0e 100%)"
                  accent="#22c55e" emoji="⚽"
                  eyebrow={locale === 'fr' ? 'Sport' : 'Spò'}
                  title={locale === 'fr' ? 'Football' : 'Foutbòl'}
                  desc="Mondyal · MLS · UCL"
                  decor="⚽" minH={230}
                  foot={
                    <span style={{ fontSize: 11, color: '#86efac', fontWeight: 700 }}>
                      12 {locale === 'fr' ? 'marchés actifs' : 'machè aktif'}
                    </span>
                  }
                />
                {!user ? (
                  <HeroBanner
                    to={path('register')}
                    gradient="linear-gradient(140deg,#3b0800 0%,#1c0400 100%)"
                    accent="#f97316" emoji="🚀"
                    eyebrow={locale === 'fr' ? 'Gratuit' : 'Gratis'}
                    title={locale === 'fr' ? 'Commencer' : 'Kòmanse'}
                    desc={locale === 'fr' ? 'Compte en 30 secondes.' : 'Kont an 30 segonn.'}
                    minH={230}
                    foot={
                      <span style={{
                        display: 'inline-block', padding: '8px 20px', borderRadius: 8,
                        background: 'rgba(255,255,255,.92)', color: '#c2410c',
                        fontSize: 12, fontWeight: 800,
                      }}>
                        {locale === 'fr' ? "S'inscrire" : 'Enskri'} →
                      </span>
                    }
                  />
                ) : (
                  <HeroBanner
                    to={`${path('markets')}?category=ekonomi`}
                    gradient="linear-gradient(140deg,#1a1000 0%,#0d0900 100%)"
                    accent="#d97706" emoji="💰"
                    eyebrow="Ekonomi"
                    title="Bitcoin & HTG"
                    desc={locale === 'fr' ? 'Crypto et finances haïtiennes' : 'Krypto ak finans ayisyen'}
                    decor="₿" minH={230}
                    foot={
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <ChevronRight size={16} color="rgba(255,255,255,.4)" />
                      </div>
                    }
                  />
                )}
              </div>
            ) : isTablet ? (
              /* Tablet: main full-width + 2 side-by-side */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <HeroBanner
                  to={`${path('markets')}?category=politik`}
                  gradient="linear-gradient(140deg,#0c1a3d 0%,#0f172a 100%)"
                  accent="#3b82f6" emoji="🗳️"
                  eyebrow={locale === 'fr' ? 'En vedette' : 'Pwomote'}
                  title={locale === 'fr' ? 'Élections 2026' : 'Eleksyon 2026'}
                  desc={locale === 'fr' ? "Pariez sur l'avenir politique d'Haïti" : 'Pari sou avni politik Ayiti'}
                  decor="📊" minH={190}
                  foot={<div style={{ display: 'flex', justifyContent: 'flex-end' }}><ChevronRight size={16} color="rgba(255,255,255,.4)" /></div>}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <HeroBanner
                    to={`${path('markets')}?category=spo`}
                    gradient="linear-gradient(140deg,#042010 0%,#0a1a0e 100%)"
                    accent="#22c55e" emoji="⚽"
                    eyebrow={locale === 'fr' ? 'Sport' : 'Spò'}
                    title={locale === 'fr' ? 'Football' : 'Foutbòl'}
                    desc="Mondyal · MLS"
                    decor="⚽" minH={170}
                    foot={<span style={{ fontSize: 11, color: '#86efac', fontWeight: 700 }}>12 {locale === 'fr' ? 'marchés' : 'machè'}</span>}
                  />
                  {!user ? (
                    <HeroBanner
                      to={path('register')}
                      gradient="linear-gradient(140deg,#3b0800 0%,#1c0400 100%)"
                      accent="#f97316" emoji="🚀"
                      eyebrow={locale === 'fr' ? 'Gratuit' : 'Gratis'}
                      title={locale === 'fr' ? 'Commencer' : 'Kòmanse'}
                      desc={locale === 'fr' ? 'Compte en 30s.' : 'Kont an 30 segonn.'}
                      minH={170}
                      foot={<span style={{ display: 'inline-block', padding: '7px 14px', borderRadius: 8, background: 'rgba(255,255,255,.92)', color: '#c2410c', fontSize: 11, fontWeight: 800 }}>{locale === 'fr' ? "S'inscrire" : 'Enskri'} →</span>}
                    />
                  ) : (
                    <HeroBanner
                      to={`${path('markets')}?category=ekonomi`}
                      gradient="linear-gradient(140deg,#1a1000 0%,#0d0900 100%)"
                      accent="#d97706" emoji="💰"
                      eyebrow="Ekonomi"
                      title="Bitcoin & HTG"
                      desc={locale === 'fr' ? 'Crypto haïtiennes' : 'Krypto ayisyen'}
                      decor="₿" minH={170}
                      foot={<div style={{ display: 'flex', justifyContent: 'flex-end' }}><ChevronRight size={14} color="rgba(255,255,255,.4)" /></div>}
                    />
                  )}
                </div>
              </div>
            ) : (
              /* Mobile: all stacked, uniform height */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <HeroBanner
                  to={`${path('markets')}?category=politik`}
                  gradient="linear-gradient(140deg,#0c1a3d 0%,#0f172a 100%)"
                  accent="#3b82f6" emoji="🗳️"
                  eyebrow={locale === 'fr' ? 'En vedette' : 'Pwomote'}
                  title={locale === 'fr' ? 'Élections 2026' : 'Eleksyon 2026'}
                  desc={locale === 'fr' ? "Pariez sur l'avenir politique d'Haïti" : 'Pari sou avni politik Ayiti'}
                  minH={160}
                  foot={<div style={{ display: 'flex', justifyContent: 'flex-end' }}><ChevronRight size={15} color="rgba(255,255,255,.4)" /></div>}
                />
                <HeroBanner
                  to={`${path('markets')}?category=spo`}
                  gradient="linear-gradient(140deg,#042010 0%,#0a1a0e 100%)"
                  accent="#22c55e" emoji="⚽"
                  eyebrow={locale === 'fr' ? 'Sport' : 'Spò'}
                  title={locale === 'fr' ? 'Football' : 'Foutbòl'}
                  desc="Mondyal · MLS · UCL"
                  minH={150}
                  foot={<span style={{ fontSize: 11, color: '#86efac', fontWeight: 700 }}>12 {locale === 'fr' ? 'marchés actifs' : 'machè aktif'}</span>}
                />
                {!user ? (
                  <HeroBanner
                    to={path('register')}
                    gradient="linear-gradient(140deg,#3b0800 0%,#1c0400 100%)"
                    accent="#f97316" emoji="🚀"
                    eyebrow={locale === 'fr' ? 'Gratuit' : 'Gratis'}
                    title={locale === 'fr' ? 'Commencer' : 'Kòmanse'}
                    desc={locale === 'fr' ? 'Compte en 30 secondes.' : 'Kont an 30 segonn.'}
                    minH={150}
                    foot={<span style={{ display: 'inline-block', padding: '7px 14px', borderRadius: 8, background: 'rgba(255,255,255,.92)', color: '#c2410c', fontSize: 11, fontWeight: 800 }}>{locale === 'fr' ? "S'inscrire" : 'Enskri'} →</span>}
                  />
                ) : (
                  <HeroBanner
                    to={`${path('markets')}?category=ekonomi`}
                    gradient="linear-gradient(140deg,#1a1000 0%,#0d0900 100%)"
                    accent="#d97706" emoji="💰"
                    eyebrow="Ekonomi"
                    title="Bitcoin & HTG"
                    desc={locale === 'fr' ? 'Crypto et finances haïtiennes' : 'Krypto ak finans ayisyen'}
                    minH={150}
                    foot={<div style={{ display: 'flex', justifyContent: 'flex-end' }}><ChevronRight size={14} color="rgba(255,255,255,.4)" /></div>}
                  />
                )}
              </div>
            )}
          </section>

          {/* ════════════════════════════════════════════════════
              MAIN LAYOUT: markets + sidebar
          ════════════════════════════════════════════════════ */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isDesktop ? 'minmax(0,1fr) 296px' : '1fr',
            columnGap: 48,
            rowGap: 32,
            alignItems: 'start',
          }}>

            {/* ── LEFT: Markets ── */}
            <div style={{ minWidth: 0 }}>

              {/* Section header */}
              <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: isMobile ? 16 : 20,
                paddingBottom: isMobile ? 14 : 18,
                borderBottom: '1px solid rgba(255,255,255,.05)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="am-live" style={{
                    display: 'inline-block', width: 8, height: 8,
                    borderRadius: '50%', background: '#f85149', flexShrink: 0,
                  }} />
                  <h2 style={{
                    fontSize: isMobile ? 15 : 17,
                    fontWeight: 700, color: 'white', letterSpacing: '-.01em',
                  }}>
                    {locale === 'fr' ? 'Tous les marchés' : 'Tout machè yo'}
                  </h2>
                  {!loading && markets.length > 0 && (
                    <span style={{
                      fontSize: 11, color: '#4b6376', fontWeight: 600,
                      background: 'rgba(255,255,255,.05)',
                      border: '1px solid rgba(255,255,255,.07)',
                      borderRadius: 99, padding: '2px 8px',
                    }}>
                      {markets.length}
                    </span>
                  )}
                </div>
                <Link
                  to={path('markets')}
                  style={{
                    fontSize: 12, color: '#4b6376', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontWeight: 600, transition: 'color .15s', whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#4b6376')}
                >
                  {locale === 'fr' ? 'Tout voir' : 'Wè tout'} <ChevronRight size={13} />
                </Link>
              </div>

              {/* Grid */}
              {loading ? (
                <MarketGridSkeleton count={6} />
              ) : markets.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '64px 32px',
                  background: 'rgba(255,255,255,.02)', borderRadius: 14,
                  border: '1px dashed rgba(255,255,255,.06)',
                }}>
                  <TrendingUp style={{ width: 40, height: 40, margin: '0 auto 14px', opacity: .2, display: 'block' }} />
                  <p style={{ fontSize: 14, color: '#334155' }}>
                    {locale === 'fr' ? 'Aucun marché disponible' : 'Pa gen machè disponib'}
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: cols, gap: isMobile ? 10 : 14, marginBottom: 32 }}>
                    {topMkts.map((m, i) => (
                      <div key={m.id} className="am-up" style={{ animationDelay: `${i * 50}ms` }}>
                        <MarketCard market={m} index={i} />
                      </div>
                    ))}
                  </div>

                  {restMkts.length > 0 && (
                    <>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        margin: '0 0 20px',
                      }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: '#334155',
                          textTransform: 'uppercase', letterSpacing: '.12em', whiteSpace: 'nowrap',
                        }}>
                          {locale === 'fr' ? 'Plus de marchés' : 'Plis machè'}
                        </span>
                        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.05)' }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: isMobile ? 10 : 14 }}>
                        {restMkts.map((m, i) => (
                          <div key={m.id} className="am-up" style={{ animationDelay: `${i * 40}ms` }}>
                            <MarketCard market={m} index={i} />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* ── RIGHT: Desktop sidebar ── */}
            {isDesktop && (
              <aside style={{
                position: 'sticky',
                top: 'calc(var(--header-h, 64px) + 24px)',
                display: 'flex', flexDirection: 'column', gap: 14,
              }}>
                <Sidebar />
              </aside>
            )}
          </div>
        </div>

        {/* ── Mobile / Tablet drawer ── */}
        {!isDesktop && (
          <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
            <Sidebar />
          </Drawer>
        )}
      </div>
    </>
  );
}