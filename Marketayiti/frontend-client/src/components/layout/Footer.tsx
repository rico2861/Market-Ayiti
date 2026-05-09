import { useTranslation } from 'react-i18next';
import { useLocation, Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { useLocale } from '../../hooks/useLocale';
import { useState, useEffect } from 'react';

export default function Footer() {
  const { t } = useTranslation();
  const { locale, path } = useLocale();
  const year = new Date().getFullYear();

  // Hook réactif pour détecter mobile
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const links = [
    { to: `/${locale}/cgu`, label: t('footer.terms') },
    { to: `/${locale}/confidentialite`, label: t('footer.privacy') },
    { to: `/${locale}/contact`, label: t('footer.contact') },
    { to: `/${locale}/about`, label: t('footer.about') },
  ];

  return (
    <>
      {/* Footer desktop */}
      <footer className="desktop-only" style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '18px 0',
        marginTop: 'auto'
      }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          {/* Logo + links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <Link to={path('home')} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 22, height: 22, borderRadius: 5, background: '#1f6feb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={12} color="white" strokeWidth={2.5} />
              </div>
              <span style={{ fontWeight: 700, color: '#484f58', fontSize: 12 }}>AyitiMarket</span>
            </Link>
            {links.map(({ to, label }) => (
              <Link key={to} to={to} style={{ fontSize: 12, color: '#484f58', textDecoration: 'none', transition: 'color .15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#8b949e')}
                onMouseLeave={e => (e.currentTarget.style.color = '#484f58')}>
                {label}
              </Link>
            ))}
          </div>
          {/* Right */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#484f58' }}>{t('footer.responsible')}</span>
            <span style={{ fontSize: 11, color: '#484f58' }}>{t('footer.copyright', { year })}</span>
          </div>
        </div>
      </footer>

      {/* Spacer pour mobile/tablet (hauteur de la navbar fixe + padding) */}
      {isMobile && (
        <div style={{ height: 80 }} aria-hidden="true" />
      )}
    </>
  );
}