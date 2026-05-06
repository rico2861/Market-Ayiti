import { useState } from 'react';
import { useParams, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Clock, Users, TrendingUp, AlertCircle, Share2, Twitter, CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMarket } from '../hooks/useMarkets';
import { useMarketRealtime } from '../hooks/useRealtime';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { marketsAPI } from '../api';
import PriceChart from '../components/charts/PriceChart';

const CAT_COLOR: Record<string, string> = {
  politik: '#a371f7', spo: '#3fb950', ekonomi: '#d29922',
  kilti: '#f97316', sosyal: '#58a6ff', lot: '#8b949e', nouvo: '#f85149'
};

function timeLeft(d: string) {
  const ms = new Date(d).getTime() - Date.now();
  if (ms <= 0) return 'Fini';
  const days = Math.floor(ms / 86400000), hrs = Math.floor((ms % 86400000) / 3600000);
  return days > 0 ? `${days}j ${hrs}h` : `${hrs}h ${Math.floor((ms % 3600000) / 60000)}min`;
}

// Bet Confirmation Modal - Complet
function BetConfirmModal({
  option, amount, odds, potential, fee,
  marketTitle, onConfirm, onCancel, busy
}: {
  option: 'yes' | 'no'; amount: number; odds: number; potential: number; fee: number;
  marketTitle: string; onConfirm: () => void; onCancel: () => void; busy: boolean;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        background: '#161b22', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16,
        width: '100%', maxWidth: 400, padding: 24, animation: 'slideUp .25s ease both'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>Konfime Pari</span>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b949e' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#8b949e', lineHeight: 1.4 }}>
          {marketTitle.slice(0, 80)}{marketTitle.length > 80 ? '...' : ''}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{
            padding: '8px 24px', borderRadius: 30, fontSize: 16, fontWeight: 700,
            background: option === 'yes' ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.15)',
            border: `2px solid ${option === 'yes' ? '#3fb950' : '#f85149'}`,
            color: option === 'yes' ? '#3fb950' : '#f85149'
          }}>
            {option === 'yes' ? '✓ Wi' : '✗ Non'} — {(odds).toFixed(2)}×
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
          {[
            { label: 'Mise brut:', value: `${amount.toLocaleString()} HTG`, color: 'white' },
            { label: 'Frè platfòm (1.5%):', value: `-${fee.toFixed(2)} HTG`, color: '#f85149' },
            { label: 'Net misé:', value: `${(amount - fee).toFixed(2)} HTG`, color: '#8b949e' },
            { label: 'Gain potansyèl:', value: `${potential.toLocaleString()} HTG`, color: '#3fb950', bold: true },
          ].map(({ label, value, color, bold }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
              <span style={{ color: '#8b949e' }}>{label}</span>
              <span style={{ color, fontWeight: bold ? 700 : 500, fontFamily: 'JetBrains Mono,monospace' }}>{value}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '11px', borderRadius: 8,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#8b949e', cursor: 'pointer', fontSize: 13, fontWeight: 600
          }}>
            Anile
          </button>
          <button onClick={onConfirm} disabled={busy}
            className="btn-primary" style={{ flex: 2, padding: '11px', fontSize: 14 }}>
            {busy ? 'Ap trete...' : `✓ Konfime — ${amount.toLocaleString()} HTG`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MarketDetail() {
  const { category, slug } = useParams<{ category: string; slug: string }>();
  const [searchParams] = useSearchParams();
  const { path } = useLocale();
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { market, loading, error, setMarket } = useMarket(slug || '');
  const [option, setOption] = useState<'yes' | 'no'>(() => (searchParams.get('option') === 'no' ? 'no' : 'yes'));
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  useMarketRealtime(market?.id || '', (data) => {
    if (market) setMarket({ ...market, ...data });
  });

  const amtNum = parseFloat(amount) || 0;
  const yesOdds = market ? parseFloat((1 / Math.max(0.01, market.yes_prob)).toFixed(2)) : 2.0;
  const noOdds = market ? parseFloat((1 / Math.max(0.01, market.no_prob)).toFixed(2)) : 2.0;
  const curOdds = option === 'yes' ? yesOdds : noOdds;
  const fee = parseFloat((amtNum * 0.015).toFixed(2));
  const netMise = parseFloat((amtNum - fee).toFixed(2));
  const potential = parseFloat((amtNum * curOdds).toFixed(2));

  const catColor = market ? (CAT_COLOR[market.category] || '#8b949e') : '#8b949e';
  const yp = market ? Math.round(market.yes_prob * 100) : 50;
  const np = 100 - yp;
  const isClosed = market ? market.status !== 'active' : true;

  const doPlaceBet = async () => {
    if (!market || !user) return;
    setBusy(true);
    try {
      const res = await marketsAPI.placeBet(market.id, option, amtNum);
      const { new_balance, market: updated } = res.data;
      updateBalance(new_balance ?? (user.balance - amtNum));
      if (updated) setMarket(updated);
      setAmount('');
      setShowConfirm(false);
      toast.success(
        `✓ Pari ${option === 'yes' ? 'Wi' : 'Non'} — ${amtNum.toLocaleString()} HTG\nGain potansyèl: ${potential.toLocaleString()} HTG`,
        { duration: 4000, icon: '🎯' }
      );
    } catch (e: any) {
      setShowConfirm(false);
      toast.error(e.response?.data?.detail || 'Erè pari. Eseye ankò.');
    } finally { setBusy(false); }
  };

  const handleBetClick = () => {
    if (!user) { navigate(path('login'), { state: { from: location.pathname } }); return; }
    if (!market) return;
    if (!amtNum || amtNum < (market.min_bet || 50)) { toast.error(`Min: ${market.min_bet || 50} HTG`); return; }
    if (amtNum > market.max_bet) { toast.error(`Max: ${market.max_bet} HTG`); return; }
    if (amtNum > user.balance) { toast.error('Balans ensifizan'); return; }
    setShowConfirm(true);
  };

  const shareUrl = window.location.href;
  const shareText = market ? `${market.title} — Wi: ${yp}% | Non: ${np}% | AyitiMarket` : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
      toast.success('Lyen kopye!');
    });
  };
  const handleTwitter = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
  const handleWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(shareText + '\n' + shareUrl)}`, '_blank');

  if (loading) return (
    <div className="container py-5 px-4">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="skel" style={{ height: 32, width: '60%', borderRadius: 8 }} />
        <div className="skel" style={{ height: 180, borderRadius: 12 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <div className="skel" style={{ height: 280, borderRadius: 12 }} />
          <div className="skel" style={{ height: 280, borderRadius: 12 }} />
        </div>
      </div>
    </div>
  );

  if (error || !market) return (
    <div className="container py-5 px-4 fade-in" style={{ maxWidth: 600 }}>
      <div style={{ background: '#161b22', border: '1px solid rgba(248,81,73,0.2)', borderRadius: 14, padding: 40, textAlign: 'center' }}>
        <AlertCircle style={{ width: 48, height: 48, color: '#f85149', margin: '0 auto 16px', display: 'block' }} />
        <h2 style={{ color: 'white', marginBottom: 8 }}>Machè pa jwenn</h2>
        <p style={{ color: '#8b949e', marginBottom: 24, fontSize: 14 }}>Slug: <code style={{ color: '#d29922' }}>{slug}</code></p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={() => navigate(-1)} className="btn-ghost">← Retounen</button>
          <Link to={path('markets')} className="btn-primary">Wè tout machè</Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container py-4 md:py-6 fade-in px-4 md:px-0">
      {showConfirm && (
        <BetConfirmModal
          option={option} amount={amtNum} odds={curOdds}
          potential={potential} fee={fee}
          marketTitle={market.title}
          onConfirm={doPlaceBet} onCancel={() => setShowConfirm(false)}
          busy={busy}
        />
      )}

      {/* Back + Share */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={18} /> Retounen
        </button>

        <div className="flex gap-2">
          <button onClick={handleWhatsApp}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366]">
            💬 WhatsApp
          </button>
          <button onClick={handleTwitter}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#1DA1F2]/10 border border-[#1DA1F2]/30 text-[#1DA1F2] flex items-center gap-1">
            <Twitter size={14} /> 𝕏
          </button>
          <button onClick={handleCopyLink}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white">
            {copied ? <CheckCircle size={16} /> : <Share2 size={16} />}
          </button>
        </div>
      </div>

      {/* Image */}
      {market.image_url ? (
        <div className="rounded-2xl overflow-hidden mb-6 aspect-[16/5] md:aspect-[16/4.5]">
          <img src={market.image_url} alt={market.title} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="rounded-2xl mb-6 h-24 md:h-32 flex items-center justify-center"
          style={{ background: `linear-gradient(135deg,${catColor}12,${catColor}06)`, border: `1px solid ${catColor}20` }}>
          <TrendingUp size={42} style={{ color: catColor, opacity: 0.4 }} />
        </div>
      )}

      {/* Closed badge */}
      {isClosed && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center gap-3 text-sm">
          <span className="bg-red-500 text-white px-3 py-0.5 rounded-full text-xs font-bold">FÈMEN</span>
          <span className="text-gray-400">
            {market.status === 'resolved' ? `Rezoud: ${market.resolution?.toUpperCase() || ''}` : 'Machè sa a fèmen pou pari'}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-8 space-y-6">
          <div>
            <span style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: `${catColor}15`, color: catColor, textTransform: 'uppercase', letterSpacing: '0.05em'
            }}>
              {market.category}
            </span>
            <h1 className="text-2xl md:text-3xl font-bold leading-tight mt-4 text-white">
              {market.title}
            </h1>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-gray-400">
            {[
              { icon: <Clock size={16} />, v: `${timeLeft(market.end_date)} rete` },
              { icon: <Users size={16} />, v: `${market.bet_count} parisyen` },
              { icon: <TrendingUp size={16} />, v: `${market.total_volume.toLocaleString()} HTG` },
            ].map(({ icon, v }, i) => (
              <div key={i} className="flex items-center gap-2">{icon}{v}</div>
            ))}
          </div>

          {market.description && (
            <p className="text-[15px] text-gray-400 leading-relaxed">{market.description}</p>
          )}

          {/* Probability bar */}
          <div className="bg-[#161b22] border border-white/10 rounded-2xl p-5 md:p-6">
            <div className="flex justify-between mb-3 text-base font-bold">
              <span className="text-green-500">Wi {yp}%</span>
              <span className="text-red-500">Non {np}%</span>
            </div>
            <div className="h-3 bg-red-500/20 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${yp}%` }} />
            </div>
            <div className="flex justify-between mt-4 text-sm text-gray-400">
              <span>Cote: <strong className="text-white font-mono">{yesOdds.toFixed(2)}×</strong></span>
              <span>Cote: <strong className="text-white font-mono">{noOdds.toFixed(2)}×</strong></span>
            </div>
          </div>

          <PriceChart marketId={market.id} />
        </div>

        {/* RIGHT COLUMN - Bet Panel */}
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-20 bg-[#161b22] border border-white/10 rounded-2xl p-5 md:p-6">
            <div className="font-bold text-lg mb-5 text-white">
              {isClosed ? 'Machè Fèmen' : 'Fè Pari'}
            </div>

            {!isClosed ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {(['yes', 'no'] as const).map(opt => (
                    <button key={opt} onClick={() => setOption(opt)} style={{
                      padding: '14px 8px', borderRadius: 12, cursor: 'pointer', transition: 'all .15s',
                      fontWeight: 700, fontSize: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      background: option === opt ? (opt === 'yes' ? 'rgba(63,185,80,0.2)' : 'rgba(248,81,73,0.2)') : 'rgba(255,255,255,0.04)',
                      border: `2px solid ${option === opt ? (opt === 'yes' ? '#3fb950' : '#f85149') : 'rgba(255,255,255,0.08)'}`,
                      color: option === opt ? (opt === 'yes' ? '#3fb950' : '#f85149') : '#8b949e'
                    }}>
                      <span style={{ fontSize: 20 }}>{opt === 'yes' ? '✓' : '✗'}</span>
                      <span>{opt === 'yes' ? 'Wi' : 'Non'}</span>
                      <span style={{ fontSize: 12, opacity: .8 }}>{opt === 'yes' ? yesOdds.toFixed(2) : noOdds.toFixed(2)}×</span>
                    </button>
                  ))}
                </div>

                <div className="mb-6">
                  <label className="block text-xs font-semibold tracking-widest text-gray-500 mb-2">MONTAN (HTG)</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder={`Min ${market.min_bet} HTG`} min={market.min_bet} step={50}
                    className="w-full bg-[#0d1117] border border-white/12 rounded-xl px-4 py-4 text-lg font-mono text-white outline-none" />

                  <div className="flex flex-wrap gap-2 mt-3">
                    {[100, 250, 500, 1000, 2500].filter(a => a >= (market.min_bet || 50)).map(a => (
                      <button key={a} onClick={() => setAmount(String(a))} className={`px-4 py-2 text-sm rounded-2xl transition-all border ${amount === String(a) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}>
                        {a.toLocaleString()}
                      </button>
                    ))}
                    {user && (
                      <button onClick={() => setAmount(String(Math.floor(user.balance)))}
                        className="px-4 py-2 text-sm rounded-2xl bg-green-500/10 border border-green-500/30 text-green-500">
                        Tout
                      </button>
                    )}
                  </div>
                </div>

                {amtNum > 0 && (
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 mb-6 text-sm">
                    {[
                      { l: 'Mise brut:', v: `${amtNum.toLocaleString()} HTG`, c: 'white' },
                      { l: 'Frè (1.5%):', v: `-${fee.toFixed(2)} HTG`, c: '#f85149' },
                      { l: 'Net misé:', v: `${netMise.toFixed(2)} HTG`, c: '#8b949e' },
                      { l: 'Cote:', v: `${curOdds.toFixed(2)}×`, c: '#8b949e' },
                      { l: 'Gain potansyèl:', v: `${potential.toLocaleString()} HTG`, c: '#3fb950', bold: true },
                    ].map(({ l, v, c, bold }) => (
                      <div key={l} className="flex justify-between py-1">
                        <span className="text-gray-400">{l}</span>
                        <span style={{ color: c, fontWeight: bold ? 700 : 400, fontFamily: 'JetBrains Mono,monospace' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}

                {user ? (
                  <button onClick={handleBetClick}
                    disabled={!amtNum || amtNum < (market.min_bet || 50) || amtNum > user.balance}
                    className="w-full py-4 rounded-2xl bg-primary hover:bg-primary/90 disabled:opacity-50 font-semibold text-base">
                    Pari {option === 'yes' ? 'Wi' : 'Non'} →
                  </button>
                ) : (
                  <Link to={path('login')} state={{ from: location.pathname }}
                    className="block w-full py-4 text-center rounded-2xl bg-primary font-semibold text-base">
                    Konekte pou pari
                  </Link>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-400 text-base">
                {market.status === 'resolved'
                  ? `✓ Rezoud: ${market.resolution === 'yes' ? 'Wi' : 'Non'}`
                  : 'Machè sa a fèmen pou pari nouvo'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}