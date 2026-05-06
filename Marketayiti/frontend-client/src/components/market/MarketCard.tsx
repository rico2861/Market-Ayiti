import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, MessageCircle, Gift, TrendingUp, TrendingDown } from 'lucide-react';
import type { Market } from '../../types';
import { marketDeepLink } from '../../api';
import { useLocale } from '../../hooks/useLocale';

interface Props { market: Market; index?: number; }

const CAT_COLOR: Record<string, string> = {
  politik:'#a371f7', spo:'#3fb950', ekonomi:'#d29922',
  kilti:'#f97316', sosyal:'#58a6ff', lot:'#8b949e', nouvo:'#f85149'
};
const CAT_EMOJI: Record<string, string> = {
  politik:'🗳️', spo:'⚽', ekonomi:'💰', kilti:'🎭', sosyal:'🏘️', lot:'📌', nouvo:'🔥'
};

function fmtVol(v: number): string {
  if (v >= 1_000_000) return `${(v/1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v/1_000).toFixed(1)}K`;
  return Math.floor(v).toLocaleString();
}

// Circular gauge (Polymarket style)
function CircularGauge({ percent, color = '#3fb950' }: { percent: number; color?: string }) {
  const r = 22, c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <div style={{ position:'relative', width:54, height:54, flexShrink:0 }}>
      <svg width="54" height="54" viewBox="0 0 54 54" style={{ transform:'rotate(-90deg)' }}>
        <circle cx="27" cy="27" r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="4" fill="none"/>
        <circle cx="27" cy="27" r={r} stroke={color} strokeWidth="4" fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition:'stroke-dashoffset .6s ease' }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', textAlign:'center' }}>
        <div style={{ fontSize:13, fontWeight:800, color:'white', lineHeight:1, fontFamily:'JetBrains Mono,monospace' }}>
          {percent}%
        </div>
        <div style={{ fontSize:8, color:'#8b949e', textTransform:'uppercase', letterSpacing:'0.05em', marginTop:1 }}>
          chans
        </div>
      </div>
    </div>
  );
}

export default memo(function MarketCard({ market, index = 0 }: Props) {
  const { locale } = useLocale();
  const [bookmarked, setBookmarked] = useState(false);
  const link = marketDeepLink(locale, market);
  const yp = Math.round(market.yes_prob * 100);
  const np = 100 - yp;
  const color = CAT_COLOR[market.category] || '#8b949e';
  const yesOdds = parseFloat((1 / Math.max(0.01, market.yes_prob)).toFixed(2));
  const noOdds  = parseFloat((1 / Math.max(0.01, market.no_prob)).toFixed(2));
  const isClosed = market.status !== 'active';

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    const txt = encodeURIComponent(`${market.title} — Wi: ${yp}% | Non: ${np}% — AyitiMarket`);
    window.open(`https://wa.me/?text=${txt}`, '_blank');
  };

  return (
    <Link to={link} style={{
      background:'#161b22', border:'1px solid rgba(255,255,255,0.07)',
      borderRadius:12, padding:14, display:'flex', flexDirection:'column', gap:12,
      cursor:'pointer', textDecoration:'none', color:'inherit',
      transition:'all .15s', animationDelay:`${Math.min(index*30,360)}ms`,
      position:'relative'
    }} className="slide-up"
       onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.18)'; e.currentTarget.style.background='#1a2030'; }}
       onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'; e.currentTarget.style.background='#161b22'; }}>

      {/* Top: image/icon + title + gauge */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
        {/* Image or category icon */}
        {market.image_url ? (
          <img src={market.image_url} alt=""
            style={{ width:44, height:44, borderRadius:10, objectFit:'cover', flexShrink:0 }}/>
        ) : (
          <div style={{ width:44, height:44, borderRadius:10, background:`${color}15`,
            border:`1px solid ${color}30`, display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:22, flexShrink:0 }}>
            {CAT_EMOJI[market.category] || '📊'}
          </div>
        )}

        {/* Title + meta */}
        <div style={{ flex:1, minWidth:0 }}>
          <h3 style={{ fontSize:13.5, fontWeight:600, color:'white', margin:0, lineHeight:1.35,
            display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any, overflow:'hidden' }}>
            {market.title}
          </h3>
        </div>

        {/* Circular gauge (Polymarket style) */}
        <CircularGauge percent={yp} color={yp >= 50 ? '#3fb950' : '#f85149'}/>
      </div>

      {/* Yes/No buttons (Buy Yes / Buy No) — Polymarket style */}
      {!isClosed ? (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <button onClick={(e) => { e.preventDefault(); window.location.href = link + '?option=yes'; }}
            style={{ padding:'8px 10px', borderRadius:8,
              background:'rgba(63,185,80,0.1)', border:'1px solid rgba(63,185,80,0.25)',
              color:'#3fb950', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
              display:'flex', alignItems:'center', justifyContent:'center', gap:5,
              transition:'all .15s' }}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(63,185,80,0.18)';e.currentTarget.style.borderColor='rgba(63,185,80,0.5)';}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(63,185,80,0.1)';e.currentTarget.style.borderColor='rgba(63,185,80,0.25)';}}>
            <TrendingUp size={11}/> {locale==='fr'?'Acheter Oui':'Achte Wi'}
            <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, opacity:.85 }}>{yesOdds.toFixed(2)}×</span>
          </button>
          <button onClick={(e) => { e.preventDefault(); window.location.href = link + '?option=no'; }}
            style={{ padding:'8px 10px', borderRadius:8,
              background:'rgba(248,81,73,0.1)', border:'1px solid rgba(248,81,73,0.25)',
              color:'#f85149', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
              display:'flex', alignItems:'center', justifyContent:'center', gap:5,
              transition:'all .15s' }}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(248,81,73,0.18)';e.currentTarget.style.borderColor='rgba(248,81,73,0.5)';}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(248,81,73,0.1)';e.currentTarget.style.borderColor='rgba(248,81,73,0.25)';}}>
            <TrendingDown size={11}/> {locale==='fr'?'Acheter Non':'Achte Non'}
            <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, opacity:.85 }}>{noOdds.toFixed(2)}×</span>
          </button>
        </div>
      ) : (
        <div style={{ padding:'8px', borderRadius:8, background:'rgba(139,148,158,0.08)',
          border:'1px solid rgba(139,148,158,0.15)', textAlign:'center', fontSize:12, fontWeight:600, color:'#8b949e' }}>
          {market.status === 'resolved'
            ? `✓ ${locale==='fr'?'Résolu':'Rezoud'}: ${market.resolution?.toUpperCase() || ''}`
            : (locale==='fr'?'Marché fermé':'Machè fèmen')}
        </div>
      )}

      {/* Footer: volume + actions */}
      <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:11, color:'#484f58' }}>
        <span style={{ fontFamily:'JetBrains Mono,monospace' }}>{fmtVol(market.total_volume)} HTG vol.</span>
        <span>·</span>
        <span style={{ display:'flex', alignItems:'center', gap:3 }}>
          <MessageCircle size={11}/>{market.bet_count}
        </span>
        <div style={{ flex:1 }}/>
        <button onClick={handleShare} title="WhatsApp"
          style={{ background:'none', border:'none', cursor:'pointer', color:'#484f58', padding:2,
            transition:'color .15s', display:'flex', alignItems:'center' }}
          onMouseEnter={e=>(e.currentTarget.style.color='#25D366')}
          onMouseLeave={e=>(e.currentTarget.style.color='#484f58')}>
          <Gift size={12}/>
        </button>
        <button onClick={(e) => { e.preventDefault(); setBookmarked(b => !b); }} title="Bookmark"
          style={{ background:'none', border:'none', cursor:'pointer',
            color: bookmarked ? '#d29922' : '#484f58', padding:2,
            display:'flex', alignItems:'center', transition:'color .15s' }}>
          <Star size={12} fill={bookmarked ? 'currentColor' : 'none'}/>
        </button>
      </div>
    </Link>
  );
});
