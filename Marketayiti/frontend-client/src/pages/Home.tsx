import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Star, Wallet, Bell, Search, ChevronRight, Activity, BarChart3, ArrowUpRight, ArrowDownRight, Clock, Users, Zap } from 'lucide-react';
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

  useWebSocket({
    onMessage: (msg) => {
      if (msg.type === 'market:update') {
        applyMarketUpdate({
          id: msg.market_id,
          yes_prob: msg.yes_prob,
          no_prob: msg.no_prob,
          total_volume: msg.total_volume,
          bet_count: msg.bet_count
        } as any);
      }
    }
  });

  useEffect(() => {
    walletAPI.getTransactions({ limit: 5 })
      .then(r => setActivity(r.data || []))
      .catch(() => { });
  }, [user]);

  const trending = locale === 'fr' ? TRENDING_TOPICS_FR : TRENDING_TOPICS_HT;
  const featured = markets.slice(0, 3);
  const topMarkets = markets.slice(0, 4);
  const restMarkets = markets.slice(4);

  return (
    <div style={{ background: 'linear-gradient(135deg, #0f1419 0%, #151b26 100%)', minHeight: '100vh', paddingTop: 24, paddingBottom: 40 }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 16px' }}>

        {/* HERO SECTION */}
        <section style={{ marginBottom: 40 }}>
          {/* Grid responsive - 1 col mobile, 2 col tablet, 3 col desktop */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
            marginBottom: 32,
          }}>

            {/* Main Featured Banner - Responsive grid span */}
            <Link to={`${path('markets')}?category=politik`}
              style={{
                textDecoration: 'none',
                gridColumn: window.innerWidth < 1024 ? '1 / -1' : 'span 2',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 16,
                background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 50%, #1e1b4b 100%)',
                padding: window.innerWidth < 768 ? 24 : 32,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: window.innerWidth < 768 ? 200 : 240,
                border: '1px solid rgba(31, 111, 235, 0.2)',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = '1px solid rgba(31, 111, 235, 0.4)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = '1px solid rgba(31, 111, 235, 0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ fontSize: 24 }}>🗳️</div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {locale === 'fr' ? 'En vedette' : 'Pwomote'}
                  </span>
                </div>
                <h2 style={{ fontSize: 32, fontWeight: 800, color: 'white', margin: '0 0 8px', lineHeight: 1.1 }}>
                  {locale === 'fr' ? 'Élections 2026' : 'Eleksyon 2026'}
                </h2>
                <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.75)', margin: 0, maxWidth: '90%' }}>
                  {locale === 'fr' ? 'Pariez sur l\'avenir politique d\'Haïti avec des marchés en direct' : 'Pari sou avni politik Ayiti'}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', paddingTop: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={14} color='rgba(255,255,255,0.6)' />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>2.4K</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BarChart3 size={14} color='rgba(255,255,255,0.6)' />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>$482M</span>
                  </div>
                </div>
                <ChevronRight size={20} color='rgba(255,255,255,0.7)' />
              </div>

              <div style={{ position: 'absolute', top: -40, right: -40, width: 300, height: 300, opacity: 0.08, fontSize: 200 }}>📊</div>
            </Link>

            {/* Sports Banner */}
            <Link to={`${path('markets')}?category=spo`}
              style={{
                textDecoration: 'none',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 16,
                background: 'linear-gradient(135deg, #166534 0%, #14532d 100%)',
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: 240,
                border: '1px solid rgba(34, 197, 94, 0.2)',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = '1px solid rgba(34, 197, 94, 0.4)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = '1px solid rgba(34, 197, 94, 0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#86efac', letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>
                  {locale === 'fr' ? 'Nouveau' : 'Nouvo'}
                </div>
                <h3 style={{ fontSize: 24, fontWeight: 800, color: 'white', margin: '0 0 8px', lineHeight: 1.2 }}>
                  {locale === 'fr' ? 'Football' : 'Foutbòl'}
                </h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', margin: 0 }}>
                  {locale === 'fr' ? 'Coupe du Monde, MLS & Champions League' : 'Mondyal, MLS'}
                </p>
              </div>

              <div style={{ fontSize: 12, color: '#86efac', fontWeight: 600, marginTop: 'auto' }}>
                12 {locale === 'fr' ? 'marchés actifs' : 'machè'}
              </div>

              <div style={{ position: 'absolute', bottom: -20, right: -20, fontSize: 120, opacity: 0.12 }}>⚽</div>
            </Link>

            {/* Auth Banner */}
            {!user ? (
              <Link to={path('register')}
                style={{
                  textDecoration: 'none',
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: 240,
                  border: '1px solid rgba(234, 88, 12, 0.2)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.border = '1px solid rgba(234, 88, 12, 0.4)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.border = '1px solid rgba(234, 88, 12, 0.2)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}>

                <div>
                  <div style={{ fontSize: 20, marginBottom: 12 }}>🚀</div>
                  <h3 style={{ fontSize: 22, fontWeight: 800, color: 'white', margin: '0 0 8px', lineHeight: 1.2 }}>
                    {locale === 'fr' ? 'Commencer maintenant' : 'Kòmanse kounye a'}
                  </h3>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: 0 }}>
                    {locale === 'fr' ? 'Compte gratuit en 30 secondes' : 'Kont gratis'}
                  </p>
                </div>

                <button style={{
                  alignSelf: 'flex-start',
                  padding: '10px 20px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.95)',
                  border: 'none',
                  color: '#c2410c',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.95)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}>
                  {locale === 'fr' ? 'S\'inscrire' : 'Enskri'} →
                </button>
              </Link>
            ) : (
              <Link to={path('portfolio')}
                style={{
                  textDecoration: 'none',
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, #047857 0%, #064e3b 100%)',
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: 240,
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.border = '1px solid rgba(16, 185, 129, 0.4)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.border = '1px solid rgba(16, 185, 129, 0.2)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}>

                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 8, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em' }}>
                    {locale === 'fr' ? 'Solde du portefeuille' : 'Balans'}
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 800, color: '#10b981', fontFamily: 'JetBrains Mono, monospace', margin: '0 0 6px' }}>
                    {Math.floor(user.balance).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>HTG</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <Zap size={14} color='#a7f3d0' />
                  <span style={{ fontSize: 12, color: '#a7f3d0', fontWeight: 600 }}>
                    {locale === 'fr' ? '+2.4% cette semaine' : '+2.4% semèn sa a'}
                  </span>
                </div>
              </Link>
            )}
          </div>
        </section>

        {/* MAIN CONTENT */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 24, alignItems: 'start' }}>

          {/* LEFT COLUMN - MARKETS */}
          <div style={{ minWidth: 0 }}>

            {/* Section Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#ff6b6b',
                  boxShadow: '0 0 12px rgba(255, 107, 107, 0.4)'
                }} />
                <h2 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0 }}>
                  {locale === 'fr' ? 'Marchés en vedette' : 'Machè Tendans'}
                </h2>
              </div>
              <Link to={path('markets')}
                style={{
                  fontSize: 13,
                  color: '#64748b',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#94a3b8'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}>
                {locale === 'fr' ? 'Tout voir' : 'Wè tout'} <ChevronRight size={14} />
              </Link>
            </div>

            {/* Markets Grid */}
            {loading ? (
              <MarketGridSkeleton count={8} />
            ) : markets.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '80px 40px',
                color: '#475569',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 16,
                border: '1px dashed rgba(255,255,255,0.05)'
              }}>
                <TrendingUp style={{ width: 48, height: 48, margin: '0 auto 16px', opacity: 0.2, display: 'block' }} />
                <p style={{ fontSize: 15, margin: 0 }}>
                  {locale === 'fr' ? 'Aucun marché disponible' : 'Pa gen machè disponib'}
                </p>
              </div>
            ) : (
              <>
                {/* Top Markets - 4 Column Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: 16,
                  marginBottom: 32
                }} className="stagger">
                  {topMarkets.map((m, i) => (
                    <div key={m.id} style={{
                      animation: `fadeInUp 0.3s ease ${i * 0.05}s backwards`
                    }}>
                      <MarketCard market={m} index={i} />
                    </div>
                  ))}
                </div>

                {/* More Markets Section */}
                {restMarkets.length > 0 && (
                  <>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      margin: '40px 0 20px'
                    }}>
                      <h3 style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#64748b',
                        margin: 0,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em'
                      }}>
                        {locale === 'fr' ? 'Plus de marchés' : 'Plis machè'}
                      </h3>
                      <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)', marginLeft: 16 }} />
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                      gap: 16
                    }} className="stagger">
                      {restMarkets.map((m, i) => (
                        <div key={m.id} style={{
                          animation: `fadeInUp 0.3s ease ${i * 0.05}s backwards`
                        }}>
                          <MarketCard market={m} index={i} />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* RIGHT SIDEBAR */}
          <aside style={{
            position: 'sticky',
            top: 'calc(var(--header-h, 64px) + 16px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            height: 'fit-content'
          }} className="hp-sidebar">

            {/* Portfolio Card */}
            <div style={{
              background: 'rgba(15, 20, 25, 0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Wallet size={16} color='#3b82f6' />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>
                  {locale === 'fr' ? 'Portefeuille' : 'Pòtfolyo'}
                </span>
              </div>

              {user ? (
                <>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {locale === 'fr' ? 'Solde' : 'Balans'}
                  </div>
                  <div style={{
                    fontSize: 32,
                    fontWeight: 800,
                    color: '#10b981',
                    fontFamily: 'JetBrains Mono, monospace',
                    marginBottom: 16
                  }}>
                    {Math.floor(user.balance).toLocaleString()}
                    <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>HTG</span>
                  </div>

                  <Link to={path('portfolio')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '12px',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      border: 'none',
                      borderRadius: 8,
                      color: 'white',
                      fontWeight: 600,
                      fontSize: 13,
                      textDecoration: 'none',
                      width: '100%',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}>
                    {locale === 'fr' ? 'Déposer' : 'Depoze'} <ArrowUpRight size={14} />
                  </Link>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 14px', lineHeight: 1.6 }}>
                    {locale === 'fr'
                      ? 'Déposez des HTG pour commencer à parier'
                      : 'Depoze HTG pou kòmanse pari'}
                  </p>
                  <Link to={path('register')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '12px',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      border: 'none',
                      borderRadius: 8,
                      color: 'white',
                      fontWeight: 600,
                      fontSize: 13,
                      textDecoration: 'none',
                      width: '100%',
                      boxSizing: 'border-box',
                      cursor: 'pointer'
                    }}>
                    {locale === 'fr' ? 'S\'inscrire' : 'Enskri'} →
                  </Link>
                </>
              )}
            </div>

            {/* Watchlist Card */}
            <div style={{
              background: 'rgba(15, 20, 25, 0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Star size={16} color='#fbbf24' fill='#fbbf24' />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>
                  {locale === 'fr' ? 'Liste de suivi' : 'Lis Swivi'}
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.6 }}>
                {locale === 'fr'
                  ? 'Marquez vos marchés préférés avec une étoile'
                  : 'Mak machè ou renmen yo'}
              </p>
            </div>

            {/* Trending Topics Card */}
            <div style={{
              background: 'rgba(15, 20, 25, 0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>
                  {locale === 'fr' ? 'Sujets Tendance' : 'Sijè Popilè'}
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {trending.map(tag => (
                  <Link key={tag}
                    to={`${path('markets')}?q=${encodeURIComponent(tag)}`}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 500,
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#94a3b8',
                      textDecoration: 'none',
                      transition: 'all 0.15s',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                      e.currentTarget.style.color = '#60a5fa';
                      e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                      e.currentTarget.style.color = '#94a3b8';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                    }}>
                    {tag}
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent Activity Card */}
            <div style={{
              background: 'rgba(15, 20, 25, 0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Activity size={14} color='#10b981' />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>
                  {locale === 'fr' ? 'Activité Récente' : 'Aktivite Resan'}
                </span>
              </div>

              {activity.length === 0 ? (
                <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>
                  {locale === 'fr' ? 'Pas encore d\'activité' : 'Poko gen aktivite'}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activity.slice(0, 4).map(tx => (
                    <div key={tx.id}
                      style={{
                        fontSize: 11,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingBottom: 10,
                        borderBottom: '1px solid rgba(255,255,255,0.05)'
                      }}>
                      <div>
                        <div style={{ color: '#e2e8f0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {tx.type === 'bet' && <span>🎯</span>}
                          {tx.type === 'deposit' && <span>↓</span>}
                          {tx.type === 'win' && <span>🏆</span>}
                          <span style={{ fontSize: 12 }}>
                            {tx.type === 'bet' ? 'Pari' : tx.type === 'deposit' ? 'Depot' : tx.type === 'win' ? 'Genyen' : tx.type}
                          </span>
                        </div>
                        <div style={{ color: '#64748b', fontSize: 10, marginTop: 3 }}>
                          {new Date(tx.created_at).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'fr-HT', {
                            day: '2-digit',
                            month: 'short'
                          })}
                        </div>
                      </div>
                      <div style={{
                        color: tx.type === 'deposit' || tx.type === 'win' ? '#10b981' : '#ef4444',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 700,
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3
                      }}>
                        {tx.type === 'deposit' || tx.type === 'win' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {tx.amount.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Global Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        * {
          box-sizing: border-box;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .stagger > div {
          animation: fadeInUp 0.4s ease backwards;
        }

        @media (max-width: 1200px) {
          body {
            font-size: 14px;
          }
        }

        @media (max-width: 768px) {
          .hp-grid {
            grid-template-columns: 1fr !important;
          }

          .hp-sidebar {
            display: none !important;
          }

          .hero-grid {
            grid-template-columns: 1fr !important;
          }

          .hero-grid > a:first-child {
            grid-column: 1 / -1 !important;
          }
        }

        @media (max-width: 640px) {
          h2 {
            font-size: 20px !important;
          }

          .hero-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
        }

        a {
          color: inherit;
        }

        button:hover {
          opacity: 0.9;
        }

        /* Smooth scrolling */
        html {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
}
