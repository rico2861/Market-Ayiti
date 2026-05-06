import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Star, Wallet, Bell, Search, ChevronRight, Activity, MessageCircle, Gift } from 'lucide-react';
import { useMarkets } from '../hooks/useMarkets';
import { useWebSocket } from '../hooks/useRealtime';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../hooks/useLocale';
import MarketCard from '../components/market/MarketCard';
import { MarketGridSkeleton } from '../components/ui/Skeleton';
import { walletAPI } from '../api';

const TRENDING_TOPICS_HT = ['Eleksyon', 'Sekirite', 'MMAS', 'Dyaspora', 'Dolar HTG', 'Foutbòl', 'Bitcoin', 'Klima'];
const TRENDING_TOPICS_FR = ['Élections', 'Sécurité', 'MMAS', 'Diaspora', 'Dollar HTG', 'Football', 'Bitcoin', 'Climat'];

export default function Home() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { locale, path } = useLocale();
  const { markets, loading, applyMarketUpdate } = useMarkets({ limit: 24 });
  const [activity, setActivity] = useState<any[]>([]);

  useWebSocket({ onMessage: (msg) => {
    if (msg.type === 'market:update') {
      applyMarketUpdate({ id:msg.market_id, yes_prob:msg.yes_prob, no_prob:msg.no_prob, total_volume:msg.total_volume, bet_count:msg.bet_count } as any);
    }
  }});

  // Load recent activity (transactions for any user)
  useEffect(() => {
    walletAPI.getTransactions({ limit: 5 }).then(r => setActivity(r.data || [])).catch(() => {});
  }, [user]);

  const trending = locale === 'fr' ? TRENDING_TOPICS_FR : TRENDING_TOPICS_HT;
  const featured = markets.slice(0, 3);
  const top = markets.slice(0, 4);
  const rest = markets.slice(4);

  return (
    <div className="container py-4 fade-in">
      <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) 320px', gap:20, alignItems:'start' }} className="hp-grid">

        {/* ─── MAIN COLUMN ─── */}
        <div style={{ minWidth:0 }}>

          {/* HERO BANNERS — Polymarket style */}
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:12, marginBottom:24 }} className="hero-grid">
            {/* Big featured banner */}
            <Link to={`${path('markets')}?category=politik`}
              style={{ textDecoration:'none', position:'relative', overflow:'hidden', borderRadius:16,
                background:'linear-gradient(135deg, #1e40af 0%, #1e3a8a 50%, #1e1b4b 100%)',
                minHeight:200, padding:24, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
              <div>
                <h2 style={{ fontSize:28, fontWeight:800, color:'white', margin:'0 0 6px', lineHeight:1.1 }}>
                  {locale==='fr' ? 'Élections 2026' : 'Eleksyon 2026'}
                </h2>
                <p style={{ fontSize:14, color:'rgba(255,255,255,0.85)', margin:0 }}>
                  {locale==='fr' ? 'Pariez sur l\'avenir politique d\'Haïti' : 'Pari sou avni politik Ayiti'}
                </p>
              </div>
              <button style={{ alignSelf:'flex-start', padding:'8px 18px', borderRadius:8,
                background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)',
                color:'white', fontSize:13, fontWeight:600, backdropFilter:'blur(8px)', cursor:'pointer' }}>
                {locale==='fr' ? 'Voir les marchés' : 'Wè machè yo'} <ChevronRight size={13} style={{display:'inline',marginLeft:4,verticalAlign:'middle'}}/>
              </button>
              <div style={{ position:'absolute', top:-30, right:-30, width:200, height:200, opacity:0.1, fontSize:140 }}>🗳️</div>
            </Link>

            {/* Sport banner */}
            <Link to={`${path('markets')}?category=spo`}
              style={{ textDecoration:'none', position:'relative', overflow:'hidden', borderRadius:16,
                background:'linear-gradient(135deg, #166534 0%, #14532d 100%)',
                padding:18, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#bbf7d0', letterSpacing:'0.1em', marginBottom:4 }}>
                  {locale==='fr' ? 'NOUVEAU' : 'NOUVO'}
                </div>
                <h3 style={{ fontSize:18, fontWeight:700, color:'white', margin:'0 0 4px', lineHeight:1.2 }}>
                  {locale==='fr' ? 'Football' : 'Foutbòl'}
                </h3>
                <p style={{ fontSize:12, color:'rgba(255,255,255,0.7)', margin:0 }}>
                  {locale==='fr' ? 'Coupe du Monde, MLS' : 'Mondyal, MLS'}
                </p>
              </div>
              <div style={{ fontSize:11, color:'#bbf7d0', fontWeight:600 }}>
                {locale==='fr' ? 'Voir →' : 'Wè →'}
              </div>
              <div style={{ position:'absolute', bottom:-10, right:-10, fontSize:80, opacity:0.15 }}>⚽</div>
            </Link>

            {/* Deposit/Wallet banner */}
            {!user ? (
              <Link to={path('register')}
                style={{ textDecoration:'none', position:'relative', overflow:'hidden', borderRadius:16,
                  background:'linear-gradient(135deg, #ca8a04 0%, #a16207 100%)',
                  padding:18, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
                <div>
                  <h3 style={{ fontSize:16, fontWeight:700, color:'white', margin:'0 0 4px', lineHeight:1.2 }}>
                    {locale==='fr' ? 'Commencez à parier' : 'Kòmanse pari'}
                  </h3>
                  <p style={{ fontSize:12, color:'rgba(255,255,255,0.85)', margin:0 }}>
                    {locale==='fr' ? 'Créez votre compte gratuit' : 'Kreye kont gratis ou'}
                  </p>
                </div>
                <button style={{ alignSelf:'flex-start', padding:'6px 14px', borderRadius:7,
                  background:'rgba(255,255,255,0.95)', border:'none', color:'#854d0e',
                  fontSize:12, fontWeight:700, cursor:'pointer' }}>
                  {locale==='fr' ? 'S\'inscrire' : 'Enskri'}
                </button>
                <div style={{ position:'absolute', bottom:-10, right:-10, fontSize:80, opacity:0.2 }}>💰</div>
              </Link>
            ) : (
              <Link to={path('portfolio')}
                style={{ textDecoration:'none', position:'relative', overflow:'hidden', borderRadius:16,
                  background:'linear-gradient(135deg, #047857 0%, #064e3b 100%)',
                  padding:18, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)', marginBottom:2 }}>
                    {locale==='fr' ? 'Solde' : 'Balans'}
                  </div>
                  <div style={{ fontSize:24, fontWeight:800, color:'white', fontFamily:'JetBrains Mono,monospace', margin:'0 0 2px' }}>
                    {user.balance.toLocaleString()}
                  </div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)' }}>HTG</div>
                </div>
                <button style={{ alignSelf:'flex-start', padding:'6px 14px', borderRadius:7,
                  background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)',
                  color:'white', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  {locale==='fr' ? 'Déposer' : 'Depoze'} +
                </button>
              </Link>
            )}
          </div>

          {/* TOP markets header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <h2 style={{ fontSize:18, fontWeight:700, color:'white', margin:0, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:'#f85149', boxShadow:'0 0 8px #f85149' }}/>
              {locale==='fr' ? 'Tendances' : 'Tendans'}
            </h2>
            <Link to={path('markets')} style={{ fontSize:12, color:'#8b949e', textDecoration:'none', display:'flex', alignItems:'center', gap:3 }}>
              {locale==='fr' ? 'Tout voir' : 'Wè tout'} <ChevronRight size={12}/>
            </Link>
          </div>

          {/* Grid of markets */}
          {loading ? (
            <MarketGridSkeleton count={8}/>
          ) : markets.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:'#8b949e' }}>
              <TrendingUp style={{ width:40, height:40, margin:'0 auto 12px', opacity:0.3, display:'block' }}/>
              <p>{locale==='fr' ? 'Aucun marché disponible' : 'Pa gen machè disponib'}</p>
            </div>
          ) : (
            <>
              {/* Top 4 cards larger */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:12, marginBottom:24 }} className="stagger">
                {top.map((m, i) => <MarketCard key={m.id} market={m} index={i}/>)}
              </div>

              {/* Section divider */}
              {rest.length > 0 && (
                <>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', margin:'8px 0 14px' }}>
                    <h3 style={{ fontSize:14, fontWeight:700, color:'#8b949e', margin:0, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                      {locale==='fr' ? 'Plus de marchés' : 'Plis machè'}
                    </h3>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:12 }} className="stagger">
                    {rest.map((m, i) => <MarketCard key={m.id} market={m} index={i}/>)}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* ─── SIDEBAR ─── */}
        <aside style={{ position:'sticky', top:'calc(var(--header-h,64px) + 16px)', display:'flex', flexDirection:'column', gap:14 }} className="hp-sidebar">

          {/* Portfolio widget */}
          <div style={{ background:'#161b22', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:18 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <Wallet size={16} color="#1f6feb"/>
              <span style={{ fontSize:14, fontWeight:700, color:'white' }}>{locale==='fr'?'Portefeuille':'Pòtfolyo'}</span>
            </div>
            {user ? (
              <>
                <div style={{ fontSize:11, color:'#8b949e', marginBottom:4 }}>{locale==='fr'?'Solde':'Balans'}</div>
                <div style={{ fontSize:28, fontWeight:800, color:'#3fb950', fontFamily:'JetBrains Mono,monospace', marginBottom:14 }}>
                  {Math.floor(user.balance).toLocaleString()}
                  <span style={{ fontSize:12, color:'#8b949e', marginLeft:6 }}>HTG</span>
                </div>
                <Link to={path('portfolio')}
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                    padding:'10px', background:'#1f6feb', border:'none', borderRadius:8,
                    color:'white', fontWeight:600, fontSize:13, textDecoration:'none', width:'100%', boxSizing:'border-box' }}>
                  {locale==='fr'?'Déposer':'Depoze'} →
                </Link>
              </>
            ) : (
              <>
                <p style={{ fontSize:13, color:'#8b949e', margin:'0 0 12px', lineHeight:1.5 }}>
                  {locale==='fr' ? 'Déposez des HTG pour commencer à parier sur les marchés' : 'Depoze HTG pou kòmanse pari sou machè yo'}
                </p>
                <Link to={path('register')} className="btn-yellow w-full" style={{ justifyContent:'center', padding:10 }}>
                  {locale==='fr'?'S\'inscrire gratuit':'Enskri gratis'}
                </Link>
              </>
            )}
          </div>

          {/* Watchlist */}
          <div style={{ background:'#161b22', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:18 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <Star size={16} color="#d29922" fill="#d29922"/>
                <span style={{ fontSize:14, fontWeight:700, color:'white' }}>{locale==='fr'?'Liste de suivi':'Lis Swivi'}</span>
              </div>
            </div>
            <p style={{ fontSize:12, color:'#8b949e', margin:0, lineHeight:1.5 }}>
              {locale==='fr' ? 'Cliquez l\'étoile sur un marché pour le suivre' : 'Klike sou etwal yon machè pou swiv li'}
            </p>
          </div>

          {/* Trending topics */}
          <div style={{ background:'#161b22', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:18 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <span style={{ fontSize:14, fontWeight:700, color:'white' }}>{locale==='fr'?'Sujets Tendance':'Sijè Popilè'}</span>
              <Link to={path('markets')} style={{ fontSize:11, color:'#8b949e', textDecoration:'none' }}>
                {locale==='fr'?'Tout voir':'Wè tout'}
              </Link>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {trending.map(tag => (
                <Link key={tag} to={`${path('markets')}?q=${encodeURIComponent(tag)}`}
                  style={{ padding:'5px 11px', borderRadius:20, fontSize:12,
                    background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
                    color:'#8b949e', textDecoration:'none', transition:'all .15s' }}
                  onMouseEnter={e=>{e.currentTarget.style.background='rgba(31,111,235,0.1)';e.currentTarget.style.color='#388bfd';e.currentTarget.style.borderColor='rgba(31,111,235,0.3)';}}
                  onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.04)';e.currentTarget.style.color='#8b949e';e.currentTarget.style.borderColor='rgba(255,255,255,0.08)';}}>
                  {tag}
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div style={{ background:'#161b22', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:18 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <Activity size={14} color="#3fb950"/>
                <span style={{ fontSize:14, fontWeight:700, color:'white' }}>{locale==='fr'?'Activité':'Aktivite'}</span>
              </div>
            </div>
            {activity.length === 0 ? (
              <p style={{ fontSize:12, color:'#484f58', margin:0 }}>{locale==='fr'?'Pas encore d\'activité':'Poko gen aktivite'}</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {activity.slice(0,4).map(tx => (
                  <div key={tx.id} style={{ fontSize:11, display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom:8, borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <div>
                      <div style={{ color:'#e6edf3', fontWeight:500 }}>
                        {tx.type === 'bet' ? '🎯 Pari' : tx.type === 'deposit' ? '↓ Depozit' : tx.type === 'win' ? '🏆 Gen' : tx.type}
                      </div>
                      <div style={{ color:'#484f58', fontSize:10, marginTop:1 }}>
                        {new Date(tx.created_at).toLocaleDateString(locale==='fr'?'fr-FR':'fr-HT', {day:'2-digit', month:'short'})}
                      </div>
                    </div>
                    <div style={{ color: tx.type==='deposit'||tx.type==='win'?'#3fb950':'#f85149', fontFamily:'JetBrains Mono,monospace', fontWeight:600, fontSize:12 }}>
                      {tx.type==='deposit'||tx.type==='win'?'+':'-'}{tx.amount.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Responsive — hide sidebar on smaller screens */}
      <style>{`
        @media (max-width: 1023px) {
          .hp-grid { grid-template-columns: 1fr !important; }
          .hp-sidebar { display: none !important; }
          .hero-grid { grid-template-columns: 1fr 1fr !important; }
          .hero-grid > a:first-child { grid-column: 1 / -1; }
        }
        @media (max-width: 640px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-grid > a:first-child { grid-column: 1; }
        }
      `}</style>
    </div>
  );
}
