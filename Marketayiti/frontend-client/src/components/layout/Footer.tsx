import { Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { useLocale } from '../../hooks/useLocale';
import { useState, useEffect } from 'react';

export default function Footer() {
  const { locale, path } = useLocale();
  const year = new Date().getFullYear();

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <footer style={{
        background: '#0d1117',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        marginTop: 120,
        padding: isMobile ? '48px 16px 80px' : '64px 16px'
      }}>
        {/* Container */}
        <div style={{
          maxWidth: 1400,
          margin: '0 auto'
        }}>
          {/* Main Content */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: isMobile ? 40 : 60,
            marginBottom: 48
          }}>

            {/* Column 1: Brand */}
            <div>
              <Link to={path('home')} style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 24
              }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #388bfd, #1f6feb)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <TrendingUp size={18} color="white" strokeWidth={2.5} />
                </div>
                <span style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: 'white'
                }}>
                  Ayiti<span style={{ color: '#388bfd' }}>Market</span>
                </span>
              </Link>
              <p style={{
                fontSize: 13,
                color: '#8b949e',
                lineHeight: 1.6,
                margin: 0
              }}>
                Prediction market platform. Trade insights, earn rewards.
              </p>
            </div>

            {/* Column 2: Legal Links */}
            <div>
              <h4 style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#c9d1d9',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 20,
                margin: '0 0 20px'
              }}>
                Legal
              </h4>
              <nav style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}>
                {[
                  { to: `/${locale}/cgu`, label: 'Terms of Service' },
                  { to: `/${locale}/confidentialite`, label: 'Privacy Policy' },
                  { to: `/${locale}/contact`, label: 'Contact' },
                  { to: `/${locale}/about`, label: 'About' },
                ].map(({ to, label }) => (
                  <Link key={to} to={to} style={{
                    fontSize: 13,
                    color: '#8b949e',
                    textDecoration: 'none',
                    transition: 'all 0.3s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#388bfd';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#8b949e';
                  }}>
                    {label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Column 3: Resources */}
            <div>
              <h4 style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#c9d1d9',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 20,
                margin: '0 0 20px'
              }}>
                Resources
              </h4>
              <nav style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}>
                {[
                  { to: path('home'), label: 'Home' },
                  { to: path('markets'), label: 'Markets' },
                ].map(({ to, label }) => (
                  <Link key={to} to={to} style={{
                    fontSize: 13,
                    color: '#8b949e',
                    textDecoration: 'none',
                    transition: 'all 0.3s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#388bfd';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#8b949e';
                  }}>
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>

          {/* Divider */}
          <div style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            paddingTop: 32
          }}>
            {/* Bottom Section */}
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'flex-start' : 'center',
              gap: isMobile ? 16 : 0
            }}>
              {/* Copyright */}
              <p style={{
                fontSize: 12,
                color: '#484f58',
                margin: 0
              }}>
                © {year} AyitiMarket. All rights reserved.
              </p>

              {/* Status */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: '#8b949e'
              }}>
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#22c55e'
                }} />
                All systems operational
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Spacer */}
      {isMobile && (
        <div style={{ height: 80 }} aria-hidden="true" />
      )}
    </>
  );
}