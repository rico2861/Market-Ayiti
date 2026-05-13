import { Link, useLocation } from 'react-router-dom';
import { Home, BarChart2, ArrowLeft } from 'lucide-react';
import { useLocale } from '../hooks/useLocale';

export default function NotFound() {
  const { path, locale } = useLocale();
  const location = useLocation();
  const fr = locale === 'fr';

  return (
    <div style={{
      minHeight: '80vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 16px', textAlign: 'center',
    }}>
      {/* Big 404 */}
      <div style={{
        fontSize: 'clamp(80px, 20vw, 140px)', fontWeight: 900, lineHeight: 1,
        background: 'linear-gradient(135deg, #1f6feb 0%, #388bfd 50%, rgba(56,139,253,0.3) 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        backgroundClip: 'text', marginBottom: 16, letterSpacing: '-4px',
        userSelect: 'none',
      }}>
        404
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: '0 0 10px' }}>
        {fr ? 'Page introuvable' : 'Paj pa jwenn'}
      </h1>
      <p style={{ fontSize: 14, color: '#8b949e', margin: '0 0 8px', maxWidth: 360, lineHeight: 1.6 }}>
        {fr
          ? `La page "${location.pathname}" n'existe pas ou a été déplacée.`
          : `Paj "${location.pathname}" pa egziste oswa li te deplase.`}
      </p>
      <p style={{ fontSize: 12, color: '#484f58', margin: '0 0 32px' }}>
        {fr ? 'Vérifiez l\'URL ou retournez à l\'accueil.' : 'Tcheke URL a oswa retounen lakay.'}
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={() => window.history.back()}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#e6edf3', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s',
          }}>
          <ArrowLeft size={14} /> {fr ? 'Retour' : 'Tounen'}
        </button>
        <Link to={path('home')} style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: 'linear-gradient(135deg, #1f6feb, #388bfd)', color: 'white',
          textDecoration: 'none', transition: 'opacity .2s',
        }}>
          <Home size={14} /> {fr ? 'Accueil' : 'Akèy'}
        </Link>
        <Link to={path('markets')} style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: 'rgba(31,111,235,0.12)', border: '1px solid rgba(31,111,235,0.25)',
          color: '#388bfd', textDecoration: 'none', transition: 'all .2s',
        }}>
          <BarChart2 size={14} /> {fr ? 'Marchés' : 'Mache yo'}
        </Link>
      </div>
    </div>
  );
}
