import { memo, useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Star, Gift, TrendingUp, TrendingDown } from 'lucide-react';
import type { Market } from '../../types';
import { marketDeepLink } from '../../api';
import { useLocale } from '../../hooks/useLocale';

// ─── Responsive hook ──────────────────────────────────────────────────────────
function useBreakpoint() {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler, { passive: true });
    return () => window.removeEventListener('resize', handler);
  }, []);
  return { isMobile: width < 480, isTablet: width >= 480 && width < 768 };
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props { market: Market; index?: number; }

// ─── Constants ────────────────────────────────────────────────────────────────
const CAT_COLOR: Record<string, string> = {
  politik: '#a371f7', spo: '#3fb950', ekonomi: '#d29922',
  kilti: '#f97316', sosyal: '#58a6ff', lot: '#8b949e', nouvo: '#f85149',
};
const CAT_EMOJI: Record<string, string> = {
  politik: '🗳️', spo: '⚽', ekonomi: '💰', kilti: '🎭', sosyal: '🏘️', lot: '📌', nouvo: '🔥',
};

// ─── Circular gauge ───────────────────────────────────────────────────────────
function CircularGauge({
  percent,
  color = '#3fb950',
  size = 54,
}: {
  percent: number;
  color?: string;
  size?: number;
}) {
  const r = size * 0.407;          // ≈22 at size=54
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  const fontSize = size < 44 ? 10 : 13;
  const labelSize = size < 44 ? 6 : 8;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg
        width={size} height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="rgba(255,255,255,0.08)" strokeWidth="4" fill="none"
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth="4" fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .6s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      }}>
        <div style={{
          fontSize, fontWeight: 800, color: 'white', lineHeight: 1,
          fontFamily: 'JetBrains Mono,monospace',
        }}>
          {percent}%
        </div>
        <div style={{
          fontSize: labelSize, color: '#8b949e',
          textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 1,
        }}>
          chans
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default memo(function MarketCard({ market, index = 0 }: Props) {
  const { locale } = useLocale();
  const { isMobile, isTablet } = useBreakpoint();
  const [bookmarked, setBookmarked] = useState(false);
  const [hovered, setHovered] = useState(false);

  const link = marketDeepLink(locale, market);
  const yp = Math.round(market.yes_prob * 100);
  const np = 100 - yp;
  const color = CAT_COLOR[market.category] || '#8b949e';
  const yesOdds = parseFloat((1 / Math.max(0.01, market.yes_prob)).toFixed(2));
  const noOdds  = parseFloat((1 / Math.max(0.01, market.no_prob)).toFixed(2));
  const isClosed = market.status !== 'active';

  // Responsive sizing
  const gaugeSize    = isMobile ? 46 : 54;
  const iconSize     = isMobile ? 38 : 44;
  const iconFontSize = isMobile ? 18 : 22;
  const titleSize    = isMobile ? 12.5 : 13.5;
  const btnPadding   = isMobile ? '7px 8px' : '8px 10px';
  const btnFontSize  = isMobile ? 11 : 12;
  const cardPadding  = isMobile ? 12 : 14;
  const cardGap      = isMobile ? 10 : 12;

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    const txt = encodeURIComponent(
      `${market.title} — Wi: ${yp}% | Non: ${np}% — AyitiMarket`
    );
    window.open(`https://wa.me/?text=${txt}`, '_blank');
  };

  return (
    <Link
      to={link}
      style={{
        background: hovered ? '#1a2030' : '#161b22',
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: isMobile ? 10 : 12,
        padding: cardPadding,
        display: 'flex',
        flexDirection: 'column',
        gap: cardGap,
        cursor: 'pointer',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'all .15s',
        animationDelay: `${Math.min(index * 30, 360)}ms`,
        position: 'relative',
        // Fill available width on all screen sizes
        width: '100%',
        boxSizing: 'border-box',
        // Tap highlight for mobile
        WebkitTapHighlightColor: 'transparent',
      }}
      className="slide-up"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Top row: icon + title + gauge ── */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: isMobile ? 10 : 12,
      }}>
        {/* Image or category icon */}
        {market.image_url ? (
          <img
            src={market.image_url} alt=""
            style={{
              width: iconSize, height: iconSize,
              borderRadius: isMobile ? 8 : 10,
              objectFit: 'cover', flexShrink: 0,
            }}
          />
        ) : (
          <div style={{
            width: iconSize, height: iconSize,
            borderRadius: isMobile ? 8 : 10,
            background: `${color}15`,
            border: `1px solid ${color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: iconFontSize, flexShrink: 0,
          }}>
            {CAT_EMOJI[market.category] || '📊'}
          </div>
        )}

        {/* Title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            fontSize: titleSize,
            fontWeight: 600,
            color: 'white',
            margin: 0,
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: isMobile ? 3 : 2,
            WebkitBoxOrient: 'vertical' as any,
            overflow: 'hidden',
          }}>
            {market.title}
          </h3>
        </div>

        {/* Gauge */}
        <CircularGauge
          percent={yp}
          color={yp >= 50 ? '#3fb950' : '#f85149'}
          size={gaugeSize}
        />
      </div>

      {/* ── Yes / No buttons ── */}
      {!isClosed ? (
        <div style={{
          display: 'grid',
          // On very small screens (<360px) stack vertically
          gridTemplateColumns: '1fr 1fr',
          gap: isMobile ? 5 : 6,
        }}>
          <BetButton
            label={locale === 'fr' ? 'Acheter Oui' : 'Achte Wi'}
            odds={yesOdds}
            intent="yes"
            padding={btnPadding}
            fontSize={btnFontSize}
            onClick={(e) => {
              e.preventDefault();
              window.location.href = link + '?option=yes';
            }}
          />
          <BetButton
            label={locale === 'fr' ? 'Acheter Non' : 'Achte Non'}
            odds={noOdds}
            intent="no"
            padding={btnPadding}
            fontSize={btnFontSize}
            onClick={(e) => {
              e.preventDefault();
              window.location.href = link + '?option=no';
            }}
          />
        </div>
      ) : (
        <div style={{
          padding: isMobile ? '7px' : '8px',
          borderRadius: 8,
          background: 'rgba(139,148,158,0.08)',
          border: '1px solid rgba(139,148,158,0.15)',
          textAlign: 'center',
          fontSize: isMobile ? 11 : 12,
          fontWeight: 600,
          color: '#8b949e',
        }}>
          {market.status === 'resolved'
            ? `✓ ${locale === 'fr' ? 'Résolu' : 'Rezoud'}: ${market.resolution?.toUpperCase() || ''}`
            : (locale === 'fr' ? 'Marché fermé' : 'Machè fèmen')}
        </div>
      )}

      {/* ── Footer: volume + actions ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 7 : 10,
        fontSize: isMobile ? 10 : 11,
        color: '#484f58',
        flexWrap: 'nowrap',
        minWidth: 0,
      }}>
        <div style={{ flex: 1 }} />

        {/* Share (WhatsApp) */}
        <IconBtn
          title="WhatsApp"
          hoverColor="#25D366"
          size={isMobile ? 14 : 12}
          onClick={handleShare}
        >
          <Gift size={isMobile ? 14 : 12} />
        </IconBtn>

        {/* Bookmark */}
        <button
          onClick={(e) => { e.preventDefault(); setBookmarked(b => !b); }}
          title="Bookmark"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: bookmarked ? '#d29922' : '#484f58',
            padding: isMobile ? 4 : 2,
            display: 'flex', alignItems: 'center',
            transition: 'color .15s',
            // Larger tap target on mobile
            minWidth: isMobile ? 28 : 'auto',
            minHeight: isMobile ? 28 : 'auto',
            justifyContent: 'center',
          }}
        >
          <Star
            size={isMobile ? 14 : 12}
            fill={bookmarked ? 'currentColor' : 'none'}
          />
        </button>
      </div>
    </Link>
  );
});

// ─── Sub-components ───────────────────────────────────────────────────────────

interface BetButtonProps {
  label: string;
  odds: number;
  intent: 'yes' | 'no';
  padding: string;
  fontSize: number;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

function BetButton({ label, odds, intent, padding, fontSize, onClick }: BetButtonProps) {
  const [hov, setHov] = useState(false);
  const isYes = intent === 'yes';
  const base   = isYes ? '63,185,80'  : '248,81,73';
  const Icon   = isYes ? TrendingUp   : TrendingDown;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onTouchStart={() => setHov(true)}
      onTouchEnd={() => setHov(false)}
      style={{
        padding,
        borderRadius: 8,
        background: hov ? `rgba(${base},0.18)` : `rgba(${base},0.1)`,
        border: `1px solid ${hov ? `rgba(${base},0.5)` : `rgba(${base},0.25)`}`,
        color: isYes ? '#3fb950' : '#f85149',
        fontSize,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        transition: 'all .15s',
        whiteSpace: 'nowrap',
        // Minimum tap target height
        minHeight: 36,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <Icon size={11} />
      {label}
      <span style={{
        fontFamily: 'JetBrains Mono,monospace',
        fontSize: fontSize - 1,
        opacity: 0.85,
      }}>
        {odds.toFixed(2)}×
      </span>
    </button>
  );
}

interface IconBtnProps {
  title: string;
  hoverColor: string;
  size: number;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}

function IconBtn({ title, hoverColor, size, onClick, children }: IconBtnProps) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onTouchStart={() => setHov(true)}
      onTouchEnd={() => setHov(false)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: hov ? hoverColor : '#484f58',
        padding: size >= 14 ? 4 : 2,
        transition: 'color .15s',
        display: 'flex', alignItems: 'center',
        minWidth: size >= 14 ? 28 : 'auto',
        minHeight: size >= 14 ? 28 : 'auto',
        justifyContent: 'center',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {children}
    </button>
  );
}