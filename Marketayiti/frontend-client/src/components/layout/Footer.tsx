import { Link } from 'react-router-dom';
import { TrendingUp, X as XIcon, Send, GitBranch, Mail, ArrowRight, BarChart2, Shield, HelpCircle, FileText, User, Wallet } from 'lucide-react';
import { useLocale } from '../../hooks/useLocale';

export default function Footer() {
  const { locale, path } = useLocale();
  const year = new Date().getFullYear();
  const fr = locale === 'fr';

  const cols = [
    {
      title: fr ? 'Plateforme' : 'Platfòm',
      links: [
        { label: fr ? 'Accueil' : 'Akèy', to: path('home'), icon: <TrendingUp size={13} /> },
        { label: fr ? 'Marchés' : 'Mache', to: path('markets'), icon: <BarChart2 size={13} /> },
        { label: fr ? 'Mon Profil' : 'Pwofil', to: path('profile'), icon: <User size={13} /> },
        { label: fr ? 'Portefeuille' : 'Pòtfolyo', to: path('portfolio'), icon: <Wallet size={13} /> },
      ],
    },
    {
      title: fr ? 'Informations' : 'Enfòmasyon',
      links: [
        { label: fr ? 'À propos' : 'Sou nou', to: `/${locale}/about`, icon: <TrendingUp size={13} /> },
        { label: fr ? 'Contact' : 'Kontakte', to: `/${locale}/contact`, icon: <Mail size={13} /> },
        { label: fr ? 'Centre d\'aide' : 'Sant Èd', to: path('help'), icon: <HelpCircle size={13} /> },
      ],
    },
    {
      title: fr ? 'Légal' : 'Legal',
      links: [
        { label: fr ? 'Conditions d\'utilisation' : 'Kondisyon Itilizasyon', to: `/${locale}/cgu`, icon: <FileText size={13} /> },
        { label: fr ? 'Confidentialité' : 'Konfidansyalite', to: `/${locale}/confidentialite`, icon: <Shield size={13} /> },
      ],
    },
  ];

  return (
    <>
      <footer style={{
        background: '#0d1117',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        marginTop: 80,
      }}>
        {/* Top band */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(31,111,235,0.06), rgba(56,139,253,0.03))',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          padding: '28px 24px',
        }}>
          <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'white', marginBottom: 4 }}>
                {fr ? 'Restez informé des marchés' : 'Rete enfòme sou mache yo'}
              </div>
              <div style={{ fontSize: 12, color: '#8b949e' }}>
                {fr ? 'Recevez les tendances et alertes en temps réel.' : 'Resevwa tandans ak alèt an tan reyèl.'}
              </div>
            </div>
            <form
              onSubmit={e => e.preventDefault()}
              style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
            >
              <input
                type="email"
                placeholder={fr ? 'Votre email...' : 'Email ou...'}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, padding: '9px 14px', color: 'white', fontSize: 13,
                  fontFamily: 'inherit', outline: 'none', minWidth: 220,
                }}
              />
              <button type="submit" style={{
                background: 'linear-gradient(135deg,#388bfd,#1f6feb)', color: 'white',
                border: 'none', borderRadius: 8, padding: '9px 18px',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <ArrowRight size={14} />
                {fr ? "S'abonner" : 'Abòne'}
              </button>
            </form>
          </div>
        </div>

        {/* Main content */}
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '56px 24px 40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '40px 60px', marginBottom: 48 }}>

            {/* Brand column */}
            <div style={{ gridColumn: 'span 1' }}>
              <Link to={path('home')} style={{
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 12px rgba(37,99,235,.3)',
                }}>
                  <TrendingUp size={16} color="white" strokeWidth={2.5} />
                </div>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'white' }}>
                  Ayiti<span style={{ color: '#388bfd' }}>Market</span>
                </span>
              </Link>
              <p style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.7, margin: '0 0 20px' }}>
                {fr
                  ? 'La première plateforme haïtienne de marchés prédictifs en temps réel.'
                  : 'Premye platfòm ayisyen pou mache prediksyon an tan reyèl.'}
              </p>
              {/* Social links */}
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { icon: <XIcon size={14} />, href: '#', label: 'Twitter' },
                  { icon: <Send size={14} />, href: '#', label: 'Telegram' },
                  { icon: <GitBranch size={14} />, href: '#', label: 'GitHub' },
                  { icon: <Mail size={14} />, href: 'mailto:contact@ayitimarket.com', label: 'Email' },
                ].map(s => (
                  <a key={s.label} href={s.href} aria-label={s.label} style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#8b949e', textDecoration: 'none', transition: 'all .15s',
                  }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(56,139,253,0.15)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56,139,253,0.3)';
                      (e.currentTarget as HTMLElement).style.color = '#388bfd';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                      (e.currentTarget as HTMLElement).style.color = '#8b949e';
                    }}>
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>

            {/* Navigation columns */}
            {cols.map(col => (
              <div key={col.title}>
                <h4 style={{
                  fontSize: 11, fontWeight: 700, color: '#e6edf3',
                  textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 18px',
                }}>
                  {col.title}
                </h4>
                <nav style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {col.links.map(link => (
                    <Link key={link.to} to={link.to} style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      fontSize: 13, color: '#8b949e', textDecoration: 'none', transition: 'color .15s',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#e6edf3')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#8b949e')}>
                      <span style={{ color: '#484f58', flexShrink: 0 }}>{link.icon}</span>
                      {link.label}
                    </Link>
                  ))}
                </nav>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <p style={{ fontSize: 12, color: '#484f58', margin: 0 }}>
              © {year} AyitiMarket.{' '}
              {fr ? 'Tous droits réservés.' : 'Tout dwa rezève.'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8b949e' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3fb950', animation: 'pulse2 2s infinite' }} />
                {fr ? 'Systèmes opérationnels' : 'Sistèm yo fonksyonèl'}
              </div>
              <span style={{ fontSize: 11, color: '#484f58' }}>v1.0.0</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile bottom nav spacer */}
      <div className="md:hidden" style={{ height: 60 }} aria-hidden="true" />
    </>
  );
}
