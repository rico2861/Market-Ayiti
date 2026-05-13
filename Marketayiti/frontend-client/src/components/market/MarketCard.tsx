import { memo, useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Star, Share2, TrendingUp, TrendingDown,
  Vote, Trophy, BarChart2, Music, Users, Bookmark, Zap, Grid3X3, CheckCircle,
} from 'lucide-react';
import type { Market } from '../../types';
import { marketDeepLink } from '../../api';
import { useLocale } from '../../hooks/useLocale';

interface Props {
  market: Market;
  index?: number;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
}

const CAT_COLOR: Record<string, string> = {
  politik: '#a371f7', spo: '#3fb950', ekonomi: '#d29922',
  kilti: '#f97316', sosyal: '#58a6ff', lot: '#8b949e', nouvo: '#f85149',
};

function catIcon(cat: string, size = 17): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    politik: <Vote size={size} />,
    spo:     <Trophy size={size} />,
    ekonomi: <BarChart2 size={size} />,
    kilti:   <Music size={size} />,
    sosyal:  <Users size={size} />,
    lot:     <Grid3X3 size={size} />,
    nouvo:   <Zap size={size} />,
  };
  return icons[cat] ?? <Bookmark size={size} />;
}

function useVW() {
  const [w, setW] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1280);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener('resize', fn, { passive: true });
    return () => window.removeEventListener('resize', fn);
  }, []);
  return w < 480;
}

/* ── Circular gauge ──────────────────────────────────────────────────────── */
function Gauge({ pct, color }: { pct: number; color: string }) {
  const SIZE = 52, SW = 5;
  const R    = (SIZE - SW) / 2;
  const CIRC = 2 * Math.PI * R;
  const offset = CIRC - (Math.min(100, Math.max(0, pct)) / 100) * CIRC;
  const cx = SIZE / 2;
  return (
    <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={cx} cy={cx} r={R} stroke="rgba(255,255,255,0.07)" strokeWidth={SW} fill="none" />
        <circle cx={cx} cy={cx} r={R} stroke={color} strokeWidth={SW} fill="none"
          strokeLinecap="round"
          strokeDasharray={`${CIRC} ${CIRC}`}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset .5s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'white', lineHeight: 1, fontFamily: 'JetBrains Mono, monospace' }}>
          {pct}%
        </span>
        <span style={{ fontSize: 7, color: '#5a6475', letterSpacing: '.06em', marginTop: 2, textTransform: 'uppercase' }}>
          chans
        </span>
      </div>
    </div>
  );
}

/* ── Bet button ───────────────────────────────────────────────────────────── */
function BetBtn({ label, odds, isYes, onClick }: {
  label: string; odds: number; isYes: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const [hov, setHov] = useState(false);
  const rgb = isYes ? '63,185,80' : '248,81,73';
  const col = isYes ? '#3fb950'   : '#f85149';
  const Icon = isYes ? TrendingUp : TrendingDown;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onTouchStart={() => setHov(true)} onTouchEnd={() => setHov(false)}
      style={{
        flex: 1, minWidth: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        padding: '9px 6px', borderRadius: 9,
        background: hov ? `rgba(${rgb},.18)` : `rgba(${rgb},.09)`,
        border: `1px solid ${hov ? `rgba(${rgb},.5)` : `rgba(${rgb},.22)`}`,
        color: col, fontSize: 12, fontWeight: 700,
        cursor: 'pointer', fontFamily: 'inherit',
        transition: 'all .15s', minHeight: 38,
        WebkitTapHighlightColor: 'transparent', overflow: 'hidden',
      }}
    >
      <Icon size={10} style={{ flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, opacity: .8, flexShrink: 0 }}>
        {odds.toFixed(2)}×
      </span>
    </button>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
export default memo(function MarketCard({ market, index = 0, isFavorited = false, onToggleFavorite }: Props) {
  const { locale } = useLocale();
  const isMobile = useVW();
  const [localFav, setLocalFav] = useState(isFavorited);
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prevYp = useRef(market.yes_prob);

  useEffect(() => { setLocalFav(isFavorited); }, [isFavorited]);

  // Flash green/red when price changes (real-time WebSocket update)
  useEffect(() => {
    if (Math.abs(market.yes_prob - prevYp.current) < 0.002) return;
    const dir = market.yes_prob > prevYp.current ? 'up' : 'down';
    prevYp.current = market.yes_prob;
    setFlash(dir);
    const t = setTimeout(() => setFlash(null), 900);
    return () => clearTimeout(t);
  }, [market.yes_prob]);

  const link      = marketDeepLink(locale, market);
  const yp        = Math.round(market.yes_prob * 100);
  const np        = 100 - yp;
  const color     = CAT_COLOR[market.category] || '#8b949e';
  const yesOdds   = parseFloat((1 / Math.max(0.01, market.yes_prob)).toFixed(2));
  const noOdds    = parseFloat((1 / Math.max(0.01, market.no_prob)).toFixed(2));
  const isClosed  = market.status !== 'active';
  const gaugeColor = yp >= 60 ? '#3fb950' : yp >= 40 ? '#d29922' : '#f85149';

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    const txt = encodeURIComponent(`${market.title} — Wi: ${yp}% | Non: ${np}% — AyitiMarket`);
    window.open(`https://wa.me/?text=${txt}`, '_blank');
  };

  const handleFav = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onToggleFavorite) {
      setLocalFav(f => !f);
      onToggleFavorite();
    } else {
      setLocalFav(f => !f);
    }
  };

  return (
    <Link
      to={link}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', gap: 11,
        background: flash === 'up' ? 'rgba(63,185,80,0.06)' : flash === 'down' ? 'rgba(248,81,73,0.06)' : hovered ? '#161d28' : '#111820',
        border: `1px solid ${flash === 'up' ? 'rgba(63,185,80,0.4)' : flash === 'down' ? 'rgba(248,81,73,0.4)' : hovered ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.06)'}`,
        borderRadius: 14, padding: isMobile ? 13 : 15,
        textDecoration: 'none', color: 'inherit',
        cursor: 'pointer', width: '100%', boxSizing: 'border-box',
        transition: 'background .15s, border .15s, box-shadow .15s',
        boxShadow: hovered ? '0 4px 24px rgba(0,0,0,.35)' : 'none',
        WebkitTapHighlightColor: 'transparent',
        animationDelay: `${Math.min(index * 40, 300)}ms`,
      }}
      className="am-up"
    >
      {/* Row 1: icon + title + gauge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {market.image_url && !imgError ? (
          <img src={market.image_url} alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            style={{ width: 40, height: 40, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div style={{
            width: 40, height: 40, borderRadius: 9, flexShrink: 0,
            background: `${color}14`, border: `1px solid ${color}28`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color,
          }}>
            {catIcon(market.category)}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            fontSize: isMobile ? 12.5 : 13, fontWeight: 600,
            color: 'white', margin: 0, lineHeight: 1.4,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as any, overflow: 'hidden',
          }}>
            {market.title}
          </h3>
        </div>

        <Gauge pct={yp} color={gaugeColor} />
      </div>

      {/* Live indicator — flashes when price updates via WebSocket */}
      {flash && !isClosed && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
          color: flash === 'up' ? '#3fb950' : '#f85149',
          padding: '2px 7px', borderRadius: 5,
          background: flash === 'up' ? 'rgba(63,185,80,0.12)' : 'rgba(248,81,73,0.12)',
          border: `1px solid ${flash === 'up' ? 'rgba(63,185,80,0.3)' : 'rgba(248,81,73,0.3)'}`,
          width: 'fit-content',
          animation: 'fadeIn .15s ease',
        }}>
          {flash === 'up' ? '▲' : '▼'} LIVE
        </div>
      )}

      {/* Row 2: bet buttons or status */}
      {!isClosed ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <BetBtn
            label={market.option_a || (locale === 'fr' ? 'Oui' : 'Wi')}
            odds={yesOdds} isYes
            onClick={e => { e.preventDefault(); window.location.href = link + '?option=yes'; }}
          />
          <BetBtn
            label={market.option_b || 'Non'}
            odds={noOdds} isYes={false}
            onClick={e => { e.preventDefault(); window.location.href = link + '?option=no'; }}
          />
        </div>
      ) : (
        <div style={{
          padding: '8px', borderRadius: 8, textAlign: 'center',
          background: 'rgba(139,148,158,.07)', border: '1px solid rgba(139,148,158,.13)',
          fontSize: 11, fontWeight: 600, color: '#8b949e',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          {market.status === 'resolved' ? (
            <>
              <CheckCircle size={12} style={{ color: '#3fb950' }} />
              <span>{locale === 'fr' ? 'Résolu' : 'Rezoud'}: {market.resolution?.toUpperCase() || ''}</span>
            </>
          ) : (
            locale === 'fr' ? 'Marché fermé' : 'Machè fèmen'
          )}
        </div>
      )}

      {/* Row 3: actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            onClick={handleShare}
            title="Pataje sou WhatsApp"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#3a4150', padding: '4px 6px',
              display: 'flex', alignItems: 'center',
              borderRadius: 6, transition: 'color .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#25D366')}
            onMouseLeave={e => (e.currentTarget.style.color = '#3a4150')}
          >
            <Share2 size={13} />
          </button>

          <button
            onClick={handleFav}
            title={localFav ? 'Retire nan favori' : 'Ajoute nan favori'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: localFav ? '#f59e0b' : '#3a4150', padding: '4px 6px',
              display: 'flex', alignItems: 'center',
              borderRadius: 6, transition: 'color .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = localFav ? '#fbbf24' : '#6b7280')}
            onMouseLeave={e => (e.currentTarget.style.color = localFav ? '#f59e0b' : '#3a4150')}
          >
            <Star size={13} fill={localFav ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
    </Link>
  );
});
