import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, Wallet, Activity,
  ArrowUpRight, ArrowDownRight, Zap,
  ChevronRight, X,
} from 'lucide-react';
import { useMarkets }    from '../hooks/useMarkets';
import { useWebSocket }  from '../hooks/useRealtime';
import { useAuth }       from '../context/AuthContext';
import { useLocale }     from '../hooks/useLocale';
import MarketCard        from '../components/market/MarketCard';
import { MarketGridSkeleton } from '../components/ui/Skeleton';
import { walletAPI }     from '../api';

/* ─── responsive hook ───────────────────────────────────────────────────────── */
function useViewport() {
  const [w, setW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280));
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener('resize', fn, { passive: true });
    return () => window.removeEventListener('resize', fn);
  }, []);
  return { isMobile: w < 640, isTablet: w >= 640 && w < 1024, isDesktop: w >= 1024 };
}

/* ─── constants ─────────────────────────────────────────────────────────────── */

function fmtHTG(v: number): string {
  if (!v && v !== 0) return '0';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return Math.floor(v).toLocaleString();
}

/* ─── micro: sidebar card ───────────────────────────────────────────────────── */
function SCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#111820', border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 12, padding: 18,
    }}>
      {children}
    </div>
  );
}

/* ─── micro: mobile drawer ──────────────────────────────────────────────────── */
function Drawer({ open, onClose, children }: { open:boolean; onClose:()=>void; children:React.ReactNode }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  return (
    <>
      <div onClick={onClose} style={{
        position:'fixed', inset:0, zIndex:100,
        background:'rgba(0,0,0,.65)', backdropFilter:'blur(4px)',
        opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
        transition:'opacity .25s',
      }}/>
      <aside style={{
        position:'fixed', top:0, right:0, bottom:0, zIndex:101,
        width:'min(90vw,340px)', background:'#0d1117',
        borderLeft:'1px solid rgba(255,255,255,.07)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition:'transform .3s cubic-bezier(.4,0,.2,1)',
        overflowY:'auto', padding:20,
        display:'flex', flexDirection:'column', gap:14,
        boxSizing:'border-box',
      }}>
        <button onClick={onClose} style={{
          alignSelf:'flex-end', background:'rgba(255,255,255,.05)',
          border:'1px solid rgba(255,255,255,.09)', borderRadius:8,
          color:'#8b949e', cursor:'pointer', padding:'6px 12px',
          display:'flex', alignItems:'center', gap:6,
          fontSize:12, fontWeight:600, fontFamily:'inherit',
        }}>
          <X size={13}/> Fèmen
        </button>
        {children}
      </aside>
    </>
  );
}

/* ─── hero banner ───────────────────────────────────────────────────────────── */
interface BannerProps {
  to:string; gradient:string; accent:string;
  emoji:string; tag:string; title:string; desc:string;
  foot?:React.ReactNode; decorEmoji?:string; compact?:boolean;
}
function HeroBanner({ to, gradient, accent, emoji, tag, title, desc, foot, decorEmoji, compact }: BannerProps) {
  const [hov, setHov] = useState(false);
  return (
    <Link to={to}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        textDecoration:'none', position:'relative', overflow:'hidden',
        borderRadius:14, background:gradient,
        padding: compact ? '18px 16px' : 24,
        display:'flex', flexDirection:'column', justifyContent:'space-between',
        minHeight: compact ? 160 : 220,
        border:`1px solid ${hov ? accent+'55' : accent+'22'}`,
        transform: hov ? 'translateY(-2px)' : 'none',
        transition:'border .2s, transform .2s, box-shadow .2s',
        boxShadow: hov ? `0 8px 28px ${accent}18` : 'none',
        cursor:'pointer', boxSizing:'border-box',
      }}>
      {decorEmoji && (
        <div style={{ position:'absolute', bottom:-20, right:-10, fontSize:90, opacity:.08, pointerEvents:'none', lineHeight:1 }}>
          {decorEmoji}
        </div>
      )}
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <span style={{ fontSize:18 }}>{emoji}</span>
          <span style={{ fontSize:10, fontWeight:700, color:accent, textTransform:'uppercase', letterSpacing:'.1em' }}>{tag}</span>
        </div>
        <h2 style={{ fontSize: compact ? 20 : 26, fontWeight:800, color:'white', margin:'0 0 6px', lineHeight:1.1, letterSpacing:'-.02em' }}>
          {title}
        </h2>
        <p style={{ fontSize:12, color:'rgba(255,255,255,.6)', margin:0, lineHeight:1.6 }}>{desc}</p>
      </div>
      {foot && <div style={{ marginTop:14 }}>{foot}</div>}
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   HOME PAGE
═══════════════════════════════════════════════════════════════════════════════ */
export default function Home() {
  const { user }    = useAuth();
  const { locale, path } = useLocale();
  const { markets, loading, applyMarketUpdate } = useMarkets({ limit: 24 });
  const [activity, setActivity]   = useState<any[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isMobile, isTablet, isDesktop } = useViewport();

  useWebSocket({
    onMessage: (msg) => {
      if (msg.type === 'market:update') {
        applyMarketUpdate({
          id: msg.market_id, yes_prob: msg.yes_prob,
          no_prob: msg.no_prob, total_volume: msg.total_volume,
          bet_count: msg.bet_count,
        } as any);
      }
    },
  });

  useEffect(() => {
    walletAPI.getTransactions({ limit: 5 })
      .then(r => setActivity(r.data || []))
      .catch(() => {});
  }, [user]);

  const topMkts  = markets.slice(0, 6);
  const restMkts = markets.slice(6);
  const cols     = isDesktop ? 'repeat(3,1fr)' : isTablet ? 'repeat(2,1fr)' : '1fr';

  /* ── balance helper — handles string|number|null|undefined from API ── */
  const balance = parseFloat(String(user?.balance ?? 0)) || 0;
  const balanceUSD = (balance / 132).toFixed(2);

  /* ── sidebar content (desktop aside + mobile drawer) ── */
  /* ★ Watchlist & Trending supprimés — déjà présents dans le menu de navigation */
  const SidebarContent = () => (
    <>
      {/* ── Portfolio / CTA ── */}
      <SCard>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Wallet size={14} color="#1d6ef5"/>
            <span style={{ fontSize:13, fontWeight:700, color:'white' }}>
              {locale==='fr' ? 'Portefeuille' : 'Pòtfolyo'}
            </span>
          </div>
          {user && (
            <Link to={path('portfolio')} style={{ fontSize:10, color:'#1d6ef5', fontWeight:700, textDecoration:'none', display:'flex', alignItems:'center', gap:3 }}>
              {locale==='fr' ? 'Voir tout' : 'Wè tout'} <ChevronRight size={10}/>
            </Link>
          )}
        </div>

        {user ? (
          <>
            {/* ★ Balance — robust string/number/null handling */}
            <div style={{
              background:'rgba(16,185,129,.07)', border:'1px solid rgba(16,185,129,.12)',
              borderRadius:10, padding:'16px 18px', marginBottom:16,
            }}>
              <div style={{ fontSize:10, color:'#4b6376', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>
                {locale==='fr' ? 'Solde disponible' : 'Balans disponib'}
              </div>
              <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:4 }}>
                <span style={{ fontSize:32, fontWeight:800, color:'#10b981', fontFamily:'JetBrains Mono,monospace', lineHeight:1 }}>
                  {fmtHTG(balance)}
                </span>
                <span style={{ fontSize:12, color:'#4b6376', fontWeight:700 }}>HTG</span>
              </div>
              <div style={{ fontSize:11, color:'rgba(52,211,153,.4)', fontFamily:'JetBrains Mono,monospace', marginBottom:12 }}>
                ≈ ${balanceUSD} USD
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                <Zap size={11} color="#34d399"/>
                <span style={{ fontSize:11, color:'#34d399', fontWeight:600 }}>
                  +2.4% {locale==='fr' ? 'cette semaine' : 'semèn sa a'}
                </span>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <Link to={path('deposit')} style={{
                display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                padding:'11px 8px', borderRadius:9,
                background:'linear-gradient(135deg,#1d6ef5,#1558d6)',
                color:'white', fontSize:12, fontWeight:700,
                textDecoration:'none', transition:'opacity .15s',
              }}
                onMouseEnter={e=>(e.currentTarget.style.opacity='.82')}
                onMouseLeave={e=>(e.currentTarget.style.opacity='1')}
              >
                <ArrowUpRight size={13}/> {locale==='fr' ? 'Déposer' : 'Depoze'}
              </Link>
              <Link to={path('withdraw')} style={{
                display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                padding:'11px 8px', borderRadius:9,
                background:'rgba(255,255,255,.06)',
                border:'1px solid rgba(255,255,255,.09)',
                color:'#94a3b8', fontSize:12, fontWeight:700,
                textDecoration:'none', transition:'all .15s',
              }}
                onMouseEnter={e=>{ e.currentTarget.style.background='rgba(255,255,255,.11)'; e.currentTarget.style.color='white'; }}
                onMouseLeave={e=>{ e.currentTarget.style.background='rgba(255,255,255,.06)'; e.currentTarget.style.color='#94a3b8'; }}
              >
                <ArrowDownRight size={13}/> {locale==='fr' ? 'Retirer' : 'Retire'}
              </Link>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize:12, color:'#4b6376', margin:'0 0 16px', lineHeight:1.7 }}>
              {locale==='fr'
                ? 'Créez un compte gratuit pour commencer à parier en HTG.'
                : 'Kreye yon kont gratis pou kòmanse pari an HTG.'}
            </p>
            <Link to={path('register')} style={{
              display:'flex', alignItems:'center', justifyContent:'center',
              padding:'12px', borderRadius:9,
              background:'linear-gradient(135deg,#1d6ef5,#1558d6)',
              color:'white', fontWeight:700, fontSize:13,
              textDecoration:'none', boxSizing:'border-box',
            }}>
              {locale==='fr' ? "S'inscrire" : 'Enskri'} →
            </Link>
          </>
        )}
      </SCard>

      {/* ── Activité récente ── */}
      <SCard>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
          <Activity size={13} color="#10b981"/>
          <span style={{ fontSize:13, fontWeight:700, color:'white' }}>
            {locale==='fr' ? 'Activité Récente' : 'Aktivite Resan'}
          </span>
        </div>
        {activity.length === 0 ? (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <p style={{ fontSize:12, color:'#4b6376', margin:0 }}>
              {locale==='fr' ? "Pas encore d'activité" : 'Poko gen aktivite'}
            </p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column' }}>
            {activity.slice(0,5).map((tx, i) => (
              <div key={tx.id} style={{
                display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'10px 0',
                borderBottom: i<4 ? '1px solid rgba(255,255,255,.04)' : 'none',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{
                    width:30, height:30, borderRadius:8, flexShrink:0,
                    background: tx.type==='bet' ? 'rgba(29,110,245,.12)' : tx.type==='win' ? 'rgba(16,185,129,.12)' : 'rgba(255,255,255,.06)',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:14,
                  }}>
                    {tx.type==='bet' ? '🎯' : tx.type==='deposit' ? '⬇️' : '🏆'}
                  </div>
                  <div>
                    <div style={{ color:'#e2e8f0', fontWeight:600, fontSize:12 }}>
                      {tx.type==='bet' ? 'Pari' : tx.type==='deposit' ? 'Depot' : 'Genyen'}
                    </div>
                    <div style={{ color:'#4b6376', fontSize:10, marginTop:1 }}>
                      {new Date(tx.created_at).toLocaleDateString(locale==='fr' ? 'fr-FR' : 'fr-HT', { day:'2-digit', month:'short' })}
                    </div>
                  </div>
                </div>
                <div style={{
                  color: tx.type==='deposit'||tx.type==='win' ? '#10b981' : '#ef4444',
                  fontFamily:'JetBrains Mono,monospace', fontWeight:700, fontSize:12,
                }}>
                  {tx.type==='deposit'||tx.type==='win' ? '+' : '−'}
                  {parseFloat(String(tx.amount ?? 0)).toLocaleString()}
                  <span style={{ fontSize:9, color:'#4b6376', marginLeft:3 }}>HTG</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SCard>

    </>
  );

  /* ───────────────────────────────────────────────────────────────────────── */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&family=JetBrains+Mono:wght@400;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'DM Sans',system-ui,sans-serif;}

        @keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
        @keyframes pulseLive{0%,100%{box-shadow:0 0 0 0 rgba(248,81,73,.45);}50%{box-shadow:0 0 0 5px rgba(248,81,73,0);}}

        .am-up{animation:fadeUp .35s ease backwards;}
        .am-live{animation:pulseLive 2s ease-in-out infinite;}

        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:99px;}
      `}</style>

      <div style={{ background:'#090d12', minHeight:'100vh', paddingBottom:60 }}>
        <div style={{
          maxWidth:1340, margin:'0 auto',
          padding: isMobile ? '18px 14px' : isTablet ? '22px 20px' : '28px 28px',
        }}>

          {/* ── Top bar ── */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: isMobile ? 18 : 26, gap:12 }}>
            <div>
              <h1 style={{ fontSize: isMobile ? 19 : 24, fontWeight:800, color:'white', letterSpacing:'-.025em', lineHeight:1.1 }}>
                {locale==='fr' ? 'Marchés Haïti' : 'Machè Ayiti'}
                <span style={{
                  display:'inline-block', marginLeft:10, fontSize: isMobile ? 9 : 11,
                  fontWeight:700, color:'#1d6ef5',
                  background:'rgba(29,110,245,.12)', border:'1px solid rgba(29,110,245,.25)',
                  borderRadius:99, padding:'2px 8px', verticalAlign:'middle',
                  letterSpacing:'.06em', textTransform:'uppercase',
                }}>LIVE</span>
              </h1>
              <p style={{ fontSize:12, color:'#475569', fontWeight:500, marginTop:3 }}>
                {locale==='fr' ? "Prédisez l'avenir d'Haïti" : 'Predi avni Ayiti'}
              </p>
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              {/* Balance pill — mobile only when logged in */}
              {isMobile && user && (
                <Link to={path('portfolio')} style={{
                  background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.2)',
                  borderRadius:99, padding:'7px 13px',
                  display:'flex', alignItems:'center', gap:6, textDecoration:'none',
                }}>
                  <span style={{ fontSize:14, fontWeight:800, color:'#10b981', fontFamily:'JetBrains Mono,monospace' }}>
                    {fmtHTG(balance)}
                  </span>
                  <span style={{ fontSize:9, color:'#4b6376', fontWeight:700 }}>HTG</span>
                </Link>
              )}

              {!isDesktop && (
                <button onClick={()=>setDrawerOpen(true)} style={{
                  background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.09)',
                  borderRadius:10, color:'#94a3b8', cursor:'pointer',
                  padding: isMobile ? '9px 11px' : '8px 14px',
                  display:'flex', alignItems:'center', gap:7,
                  fontSize:12, fontWeight:600, fontFamily:'inherit',
                }}>
                  <Wallet size={14}/>
                  {!isMobile && (locale==='fr' ? 'Tableau de bord' : 'Tablo')}
                </button>
              )}
            </div>
          </div>

          {/* ── Hero banners ── */}
          <section style={{ marginBottom: isMobile ? 28 : isTablet ? 36 : 44 }}>
            {isDesktop ? (
              /* Desktop — 3 columns */
              <div style={{ display:'grid', gridTemplateColumns:'2.2fr 1fr 1fr', gap:16 }}>
                <HeroBanner to={`${path('markets')}?category=politik`}
                  gradient="linear-gradient(140deg,#0f1f4a 0%,#111827 100%)" accent="#3b82f6"
                  emoji="🗳️" tag={locale==='fr' ? 'En vedette' : 'Pwomote'}
                  title={locale==='fr' ? 'Élections 2026' : 'Eleksyon 2026'}
                  desc={locale==='fr' ? "Pariez sur l'avenir politique d'Haïti" : 'Pari sou avni politik Ayiti'}
                  decorEmoji="📊"
                  foot={<div style={{display:'flex',justifyContent:'flex-end'}}><ChevronRight size={16} color="rgba(255,255,255,.4)"/></div>}
                />
                <HeroBanner to={`${path('markets')}?category=spo`}
                  gradient="linear-gradient(140deg,#052e16 0%,#0a1a0f 100%)" accent="#22c55e"
                  emoji="⚽" tag={locale==='fr' ? 'Nouveau' : 'Nouvo'}
                  title={locale==='fr' ? 'Football' : 'Foutbòl'} desc="Mondyal · MLS · UCL"
                  decorEmoji="⚽"
                  foot={<span style={{fontSize:11,color:'#86efac',fontWeight:700}}>12 {locale==='fr'?'marchés actifs':'machè aktif'}</span>}
                />
                {!user ? (
                  <HeroBanner to={path('register')}
                    gradient="linear-gradient(140deg,#431407 0%,#1a0a04 100%)" accent="#f97316"
                    emoji="🚀" tag={locale==='fr' ? 'Gratuit' : 'Gratis'}
                    title={locale==='fr' ? 'Commencer' : 'Kòmanse'}
                    desc={locale==='fr' ? 'Compte en 30 secondes.' : 'Kont an 30 segonn.'}
                    foot={<span style={{display:'inline-block',padding:'8px 18px',borderRadius:8,background:'rgba(255,255,255,.9)',color:'#c2410c',fontSize:12,fontWeight:800}}>{locale==='fr'?"S'inscrire":'Enskri'} →</span>}
                  />
                ) : (
                  <HeroBanner to={`${path('markets')}?category=ekonomi`}
                    gradient="linear-gradient(140deg,#1c1200 0%,#0d0900 100%)" accent="#d29922"
                    emoji="💰" tag="Ekonomi" title="Bitcoin & HTG"
                    desc={locale==='fr' ? 'Dola, crypto et finans haïtiens' : 'Dola, krypto ak finans ayisyen'}
                    decorEmoji="₿"
                    foot={<div style={{display:'flex',justifyContent:'flex-end'}}><ChevronRight size={16} color="rgba(255,255,255,.4)"/></div>}
                  />
                )}
              </div>
            ) : isTablet ? (
              /* Tablet — main banner full width + 2 small below */
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <HeroBanner to={`${path('markets')}?category=politik`}
                  gradient="linear-gradient(140deg,#0f1f4a 0%,#111827 100%)" accent="#3b82f6"
                  emoji="🗳️" tag={locale==='fr' ? 'En vedette' : 'Pwomote'}
                  title={locale==='fr' ? 'Élections 2026' : 'Eleksyon 2026'}
                  desc={locale==='fr' ? "Pariez sur l'avenir politique d'Haïti" : 'Pari sou avni politik Ayiti'}
                  decorEmoji="📊"
                  foot={<div style={{display:'flex',justifyContent:'flex-end'}}><ChevronRight size={16} color="rgba(255,255,255,.4)"/></div>}
                />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <HeroBanner to={`${path('markets')}?category=spo`}
                    gradient="linear-gradient(140deg,#052e16 0%,#0a1a0f 100%)" accent="#22c55e"
                    emoji="⚽" tag={locale==='fr' ? 'Nouveau' : 'Nouvo'}
                    title={locale==='fr' ? 'Football' : 'Foutbòl'} desc="Mondyal · MLS"
                    decorEmoji="⚽" compact
                    foot={<span style={{fontSize:11,color:'#86efac',fontWeight:700}}>12 {locale==='fr'?'marchés':'machè'}</span>}
                  />
                  {!user ? (
                    <HeroBanner to={path('register')}
                      gradient="linear-gradient(140deg,#431407 0%,#1a0a04 100%)" accent="#f97316"
                      emoji="🚀" tag={locale==='fr' ? 'Gratuit' : 'Gratis'}
                      title={locale==='fr' ? 'Commencer' : 'Kòmanse'}
                      desc={locale==='fr' ? 'Compte en 30s.' : 'Kont an 30 segonn.'} compact
                      foot={<span style={{display:'inline-block',padding:'7px 14px',borderRadius:8,background:'rgba(255,255,255,.9)',color:'#c2410c',fontSize:11,fontWeight:800}}>{locale==='fr'?"S'inscrire":'Enskri'} →</span>}
                    />
                  ) : (
                    <HeroBanner to={`${path('markets')}?category=ekonomi`}
                      gradient="linear-gradient(140deg,#1c1200 0%,#0d0900 100%)" accent="#d29922"
                      emoji="💰" tag="Ekonomi" title="Bitcoin & HTG"
                      desc={locale==='fr' ? 'Dola & krypto' : 'Dola ak krypto'}
                      decorEmoji="₿" compact
                      foot={<div style={{display:'flex',justifyContent:'flex-end'}}><ChevronRight size={14} color="rgba(255,255,255,.4)"/></div>}
                    />
                  )}
                </div>
              </div>
            ) : (
              /* Mobile — stacked, compact */
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <HeroBanner to={`${path('markets')}?category=politik`}
                  gradient="linear-gradient(140deg,#0f1f4a 0%,#111827 100%)" accent="#3b82f6"
                  emoji="🗳️" tag={locale==='fr' ? 'En vedette' : 'Pwomote'}
                  title={locale==='fr' ? 'Élections 2026' : 'Eleksyon 2026'}
                  desc={locale==='fr' ? "Pariez sur l'avenir politique d'Haïti" : 'Pari sou avni politik Ayiti'}
                  compact
                  foot={<div style={{display:'flex',justifyContent:'flex-end'}}><ChevronRight size={15} color="rgba(255,255,255,.4)"/></div>}
                />
                <HeroBanner to={`${path('markets')}?category=spo`}
                  gradient="linear-gradient(140deg,#052e16 0%,#0a1a0f 100%)" accent="#22c55e"
                  emoji="⚽" tag={locale==='fr' ? 'Nouveau' : 'Nouvo'}
                  title={locale==='fr' ? 'Football' : 'Foutbòl'} desc="Mondyal · MLS · UCL"
                  compact decorEmoji="⚽"
                  foot={<span style={{fontSize:11,color:'#86efac',fontWeight:700}}>12 {locale==='fr'?'marchés actifs':'machè aktif'}</span>}
                />
                {!user ? (
                  <HeroBanner to={path('register')}
                    gradient="linear-gradient(140deg,#431407 0%,#1a0a04 100%)" accent="#f97316"
                    emoji="🚀" tag={locale==='fr' ? 'Gratuit' : 'Gratis'}
                    title={locale==='fr' ? 'Commencer' : 'Kòmanse'}
                    desc={locale==='fr' ? 'Compte en 30 secondes.' : 'Kont an 30 segonn.'} compact
                    foot={<span style={{display:'inline-block',padding:'7px 14px',borderRadius:8,background:'rgba(255,255,255,.9)',color:'#c2410c',fontSize:11,fontWeight:800}}>{locale==='fr'?"S'inscrire":'Enskri'} →</span>}
                  />
                ) : (
                  <HeroBanner to={`${path('markets')}?category=ekonomi`}
                    gradient="linear-gradient(140deg,#1c1200 0%,#0d0900 100%)" accent="#d29922"
                    emoji="💰" tag="Ekonomi" title="Bitcoin & HTG"
                    desc={locale==='fr' ? 'Dola, crypto et finans haïtiens' : 'Dola, krypto ak finans ayisyen'}
                    compact decorEmoji="₿"
                    foot={<div style={{display:'flex',justifyContent:'flex-end'}}><ChevronRight size={14} color="rgba(255,255,255,.4)"/></div>}
                  />
                )}
              </div>
            )}
          </section>

          {/* ── Markets + Sidebar ── */}
          <div style={{
            display:'grid',
            gridTemplateColumns: isDesktop ? 'minmax(0,1fr) 300px' : '1fr',
            gap: isDesktop ? 56 : 0,
            alignItems:'start',
          }}>
            {/* LEFT */}
            <div style={{ minWidth:0 }}>

              {/* Section header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
                <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                  <span className="am-live" style={{
                    display:'inline-block', width:8, height:8,
                    borderRadius:'50%', background:'#f85149', flexShrink:0,
                  }}/>
                  <h2 style={{ fontSize: isMobile ? 15 : 18, fontWeight:700, color:'white', letterSpacing:'-.01em' }}>
                    {locale==='fr' ? 'Tous les marchés' : 'Tout machè yo'}
                  </h2>
                  {!loading && (
                    <span style={{ fontSize:11, color:'#475569', fontWeight:600 }}>({markets.length})</span>
                  )}
                </div>
                <Link to={path('markets')} style={{
                  fontSize:12, color:'#475569', textDecoration:'none',
                  display:'flex', alignItems:'center', gap:4, fontWeight:600, transition:'color .15s',
                }}
                  onMouseEnter={e=>(e.currentTarget.style.color='#94a3b8')}
                  onMouseLeave={e=>(e.currentTarget.style.color='#475569')}
                >
                  {locale==='fr' ? 'Tout voir' : 'Wè tout'} <ChevronRight size={13}/>
                </Link>
              </div>

              {loading ? (
                <MarketGridSkeleton count={6}/>
              ) : markets.length===0 ? (
                <div style={{
                  textAlign:'center', padding:'64px 32px', color:'#334155',
                  background:'rgba(255,255,255,.02)', borderRadius:12,
                  border:'1px dashed rgba(255,255,255,.05)',
                }}>
                  <TrendingUp style={{ width:40, height:40, margin:'0 auto 12px', opacity:.2, display:'block' }}/>
                  <p style={{ fontSize:14 }}>
                    {locale==='fr' ? 'Aucun marché dans cette catégorie' : 'Pa gen machè nan kategori sa a'}
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:cols, gap: isMobile ? 10 : 14, marginBottom:28 }}>
                    {topMkts.map((m, i) => (
                      <div key={m.id} className="am-up" style={{ animationDelay:`${i*55}ms` }}>
                        <MarketCard market={m} index={i}/>
                      </div>
                    ))}
                  </div>

                  {restMkts.length>0 && (
                    <>
                      <div style={{ display:'flex', alignItems:'center', gap:14, margin:'32px 0 16px' }}>
                        <span style={{ fontSize:10, fontWeight:700, color:'#334155', textTransform:'uppercase', letterSpacing:'.12em', whiteSpace:'nowrap' }}>
                          {locale==='fr' ? 'Plus de marchés' : 'Plis machè'}
                        </span>
                        <div style={{ flex:1, height:1, background:'rgba(255,255,255,.05)' }}/>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:cols, gap: isMobile ? 10 : 14 }}>
                        {restMkts.map((m,i) => (
                          <div key={m.id} className="am-up" style={{ animationDelay:`${i*40}ms` }}>
                            <MarketCard market={m} index={i}/>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* RIGHT sidebar — desktop */}
            {isDesktop && (
              <aside style={{ position:'sticky', top:'calc(var(--header-h,64px) + 16px)', display:'flex', flexDirection:'column', gap:14, height:'fit-content' }}>
                <SidebarContent/>
              </aside>
            )}
          </div>
        </div>

        {/* Mobile drawer */}
        {!isDesktop && (
          <Drawer open={drawerOpen} onClose={()=>setDrawerOpen(false)}>
            <SidebarContent/>
          </Drawer>
        )}
      </div>
    </>
  );
}