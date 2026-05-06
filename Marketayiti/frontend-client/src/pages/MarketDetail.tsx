import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useParams, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Clock, Users, TrendingUp, AlertCircle, Share2,
  Twitter, CheckCircle, X, Heart, MessageSquare, Send
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useMarket } from '../hooks/useMarkets';
import { useMarketRealtime } from '../hooks/useRealtime';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { marketsAPI } from '../api';
import PriceChart from '../components/charts/PriceChart';

// ─── Constantes ────────────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  politik: '#a371f7', spo: '#3fb950', ekonomi: '#d29922',
  kilti: '#f97316', sosyal: '#58a6ff', lot: '#8b949e', nouvo: '#f85149'
};

// ─── Types locaux ───────────────────────────────────────────────────────────────

interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: Date;
}

interface RecentBet {
  id: string;
  author: string;
  amount: number;
  option: 'yes' | 'no';
  odds: number;
  createdAt: Date;
}

// ─── Utilitaires ────────────────────────────────────────────────────────────────

/** Calcule le temps restant de façon lisible */
function computeTimeLeft(endDate: string): string {
  const ms = new Date(endDate).getTime() - Date.now();
  if (ms <= 0) return 'Fini';
  const days = Math.floor(ms / 86400000);
  const hrs = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  if (days > 0) return `${days}j ${hrs}h ${mins}min`;
  if (hrs > 0) return `${hrs}h ${mins}min ${secs}s`;
  return `${mins}min ${secs}s`;
}

/** Formate une date relative (ex : "il y a 3 min") */
function relativeTime(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  return `${Math.floor(diff / 3600)}h`;
}

// ─── Données mock pour les paris récents ────────────────────────────────────────
// (À remplacer par un vrai appel API : marketsAPI.getRecentBets(marketId))

const MOCK_RECENT_BETS: RecentBet[] = [
  { id: '1', author: 'Jean P.', amount: 500, option: 'yes', odds: 1.82, createdAt: new Date(Date.now() - 120000) },
  { id: '2', author: 'Marie C.', amount: 1000, option: 'no', odds: 2.10, createdAt: new Date(Date.now() - 300000) },
  { id: '3', author: 'Pierre L.', amount: 250, option: 'yes', odds: 1.82, createdAt: new Date(Date.now() - 600000) },
  { id: '4', author: 'Sophie M.', amount: 2000, option: 'no', odds: 2.10, createdAt: new Date(Date.now() - 900000) },
  { id: '5', author: 'Alex R.', amount: 750, option: 'yes', odds: 1.82, createdAt: new Date(Date.now() - 1200000) },
  { id: '6', author: 'Clara D.', amount: 300, option: 'yes', odds: 1.82, createdAt: new Date(Date.now() - 1500000) },
  { id: '7', author: 'Marc B.', amount: 1500, option: 'no', odds: 2.10, createdAt: new Date(Date.now() - 1800000) },
  { id: '8', author: 'Nina F.', amount: 500, option: 'no', odds: 2.10, createdAt: new Date(Date.now() - 2100000) },
  { id: '9', author: 'Léo K.', amount: 400, option: 'yes', odds: 1.82, createdAt: new Date(Date.now() - 2400000) },
  { id: '10', author: 'Ines T.', amount: 800, option: 'no', odds: 2.10, createdAt: new Date(Date.now() - 2700000) },
];

// ─── Composant : Modal de Confirmation ─────────────────────────────────────────

interface BetConfirmModalProps {
  option: 'yes' | 'no';
  amount: number;
  odds: number;
  potential: number;
  marketTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}

const BetConfirmModal = memo(function BetConfirmModal({
  option, amount, odds, potential,
  marketTitle, onConfirm, onCancel, busy
}: BetConfirmModalProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        background: '#161b22',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 20,
        width: '100%', maxWidth: 420, padding: 28,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        animation: 'fadeInScale 0.2s ease'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'white', letterSpacing: '-0.3px' }}>Konfime Pari</span>
          <button onClick={onCancel} style={{
            background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer',
            color: '#8b949e', borderRadius: 8, padding: 6, display: 'flex', alignItems: 'center'
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Titre du marché */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', borderRadius: 10,
          padding: '10px 14px', marginBottom: 18, fontSize: 13, color: '#8b949e',
          lineHeight: 1.5
        }}>
          {marketTitle.slice(0, 90)}{marketTitle.length > 90 ? '…' : ''}
        </div>

        {/* Badge option */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
          <div style={{
            padding: '10px 28px', borderRadius: 30, fontSize: 16, fontWeight: 700,
            background: option === 'yes' ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.15)',
            border: `2px solid ${option === 'yes' ? '#3fb950' : '#f85149'}`,
            color: option === 'yes' ? '#3fb950' : '#f85149',
            letterSpacing: '-0.3px'
          }}>
            {option === 'yes' ? '✓ Wi' : '✗ Non'} — {odds.toFixed(2)}×
          </div>
        </div>

        {/* Résumé financier */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', borderRadius: 12,
          padding: '14px 16px', marginBottom: 22
        }}>
          {[
            { label: 'Mise:', value: `${amount.toLocaleString()} HTG`, color: 'white' },
            { label: 'Gain potansyèl:', value: `${potential.toLocaleString()} HTG`, color: '#3fb950', bold: true },
          ].map(({ label, value, color, bold }) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between',
              marginBottom: 10, fontSize: 14, alignItems: 'center'
            }}>
              <span style={{ color: '#8b949e' }}>{label}</span>
              <span style={{ color, fontWeight: bold ? 700 : 500, fontFamily: 'JetBrains Mono, monospace' }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Boutons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '13px', borderRadius: 10,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#8b949e', cursor: 'pointer', fontSize: 14, fontWeight: 600
          }}>
            Anile
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="btn-primary"
            style={{ flex: 2, padding: '13px', fontSize: 15, borderRadius: 10 }}
          >
            {busy ? 'Ap trete…' : `✓ Konfime — ${amount.toLocaleString()} HTG`}
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Composant : Countdown Live ─────────────────────────────────────────────────

function CountdownDisplay({ endDate }: { endDate: string }) {
  const [timeLeft, setTimeLeft] = useState(() => computeTimeLeft(endDate));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(computeTimeLeft(endDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  const isUrgent = useMemo(() => {
    const ms = new Date(endDate).getTime() - Date.now();
    return ms > 0 && ms < 3600000; // moins d'1h
  }, [endDate, timeLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: isUrgent ? 'rgba(248,81,73,0.12)' : 'rgba(255,255,255,0.05)',
      border: `1px solid ${isUrgent ? 'rgba(248,81,73,0.3)' : 'rgba(255,255,255,0.1)'}`,
      borderRadius: 10, padding: '6px 12px'
    }}>
      {/* Indicateur pulsant */}
      <span style={{
        display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
        background: isUrgent ? '#f85149' : '#3fb950',
        animation: 'pulse 1.5s infinite'
      }} />
      <Clock size={14} style={{ color: isUrgent ? '#f85149' : '#8b949e' }} />
      <span style={{
        fontSize: 13, fontWeight: 600,
        fontFamily: 'JetBrains Mono, monospace',
        color: isUrgent ? '#f85149' : 'white'
      }}>
        {timeLeft}
      </span>
    </div>
  );
}

// ─── Composant : Volume & Order Book ───────────────────────────────────────────

function OrderBookSummary({
  totalVolume, yesVolume, noVolume, yesOdds, noOdds
}: {
  totalVolume: number; yesVolume: number; noVolume: number;
  yesOdds: number; noOdds: number;
}) {
  const yp = totalVolume > 0 ? Math.round((yesVolume / totalVolume) * 100) : 50;
  const np = 100 - yp;

  return (
    <div style={{
      background: '#161b22', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16, padding: '20px 22px'
    }}>
      <h3 style={{ color: 'white', fontSize: 14, fontWeight: 700, marginBottom: 16, letterSpacing: '-0.2px' }}>
        📊 Volume & Order Book
      </h3>

      {/* Volume total */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 14, paddingBottom: 14,
        borderBottom: '1px solid rgba(255,255,255,0.07)'
      }}>
        <span style={{ fontSize: 13, color: '#8b949e' }}>Volume total</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'white', fontFamily: 'JetBrains Mono, monospace' }}>
          {totalVolume.toLocaleString()} HTG
        </span>
      </div>

      {/* Barres Wi / Non */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
          <span style={{ color: '#3fb950', fontWeight: 600 }}>Wi {yp}% · {yesVolume.toLocaleString()} HTG</span>
          <span style={{ color: '#f85149', fontWeight: 600 }}>Non {np}% · {noVolume.toLocaleString()} HTG</span>
        </div>
        <div style={{ display: 'flex', height: 8, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
          <div style={{ flex: yp, background: '#3fb950', borderRadius: '6px 0 0 6px', minWidth: 4 }} />
          <div style={{ flex: np, background: '#f85149', borderRadius: '0 6px 6px 0', minWidth: 4 }} />
        </div>
      </div>

      {/* Cotes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
        {[
          { label: 'Cote Wi', value: `${yesOdds.toFixed(2)}×`, color: '#3fb950' },
          { label: 'Cote Non', value: `${noOdds.toFixed(2)}×`, color: '#f85149' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'rgba(255,255,255,0.03)', borderRadius: 10,
            padding: '10px 12px', textAlign: 'center'
          }}>
            <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace' }}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Composant : Derniers Paris ─────────────────────────────────────────────────

function RecentBetsSection({ bets }: { bets: RecentBet[] }) {
  const topYes = useMemo(() =>
    bets.filter(b => b.option === 'yes').slice(0, 5),
    [bets]
  );
  const topNo = useMemo(() =>
    bets.filter(b => b.option === 'no').slice(0, 5),
    [bets]
  );

  const BetList = ({ items, color, label }: { items: RecentBet[]; color: string; label: string }) => (
    <div style={{ flex: 1 }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase',
        letterSpacing: '0.8px', marginBottom: 10
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.length === 0 && (
          <p style={{ fontSize: 12, color: '#8b949e', textAlign: 'center', padding: '12px 0' }}>
            Poko gen pari
          </p>
        )}
        {items.map((bet) => (
          <div key={bet.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'rgba(255,255,255,0.03)', borderRadius: 9, padding: '8px 12px',
            fontSize: 12
          }}>
            <span style={{ color: '#c9d1d9', fontWeight: 500 }}>{bet.author}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                {bet.amount.toLocaleString()}
              </span>
              <span style={{ color: '#484f58', fontSize: 11 }}>{relativeTime(bet.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{
      background: '#161b22', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16, padding: '20px 22px'
    }}>
      <h3 style={{ color: 'white', fontSize: 14, fontWeight: 700, marginBottom: 16, letterSpacing: '-0.2px' }}>
        🎯 Dènye Paris (HTG)
      </h3>
      <div style={{ display: 'flex', gap: 16 }}>
        <BetList items={topYes} color="#3fb950" label="Top Wi" />
        <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
        <BetList items={topNo} color="#f85149" label="Top Non" />
      </div>
    </div>
  );
}

// ─── Composant : Section Commentaires ──────────────────────────────────────────

function CommentsSection({ marketId, user }: { marketId: string; user: any }) {
  const [comments, setComments] = useState<Comment[]>([
    { id: '1', author: 'Jean P.', text: 'Mwen panse Wi ap genyen sa a fasilman!', createdAt: new Date(Date.now() - 3600000) },
    { id: '2', author: 'Marie C.', text: 'Pa twò sèten... Sitiyasyon an konplike toujou.', createdAt: new Date(Date.now() - 7200000) },
  ]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!newComment.trim() || !user) return;
    setSubmitting(true);
    // Simulation d'envoi (remplacer par marketsAPI.postComment(marketId, newComment))
    await new Promise(r => setTimeout(r, 400));
    const comment: Comment = {
      id: Date.now().toString(),
      author: user.username || 'Ou',
      text: newComment.trim(),
      createdAt: new Date()
    };
    setComments(prev => [comment, ...prev]);
    setNewComment('');
    setSubmitting(false);
    toast.success('Kòmantè ajoute!');
  }, [newComment, user, marketId]);

  return (
    <div style={{
      background: '#161b22', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16, padding: '20px 22px'
    }}>
      <h3 style={{
        color: 'white', fontSize: 14, fontWeight: 700,
        marginBottom: 16, letterSpacing: '-0.2px',
        display: 'flex', alignItems: 'center', gap: 8
      }}>
        <MessageSquare size={16} style={{ color: '#58a6ff' }} />
        Kòmantè ({comments.length})
      </h3>

      {/* Formulaire d'ajout */}
      {user ? (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Ekri kòmantè ou…"
              rows={2}
              style={{
                flex: 1, background: '#0d1117',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '10px 14px',
                color: 'white', fontSize: 13, resize: 'none',
                outline: 'none', fontFamily: 'inherit',
                lineHeight: 1.5
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={!newComment.trim() || submitting}
              style={{
                padding: '10px 14px', borderRadius: 10,
                background: newComment.trim() ? '#3fb950' : 'rgba(255,255,255,0.06)',
                border: 'none', cursor: newComment.trim() ? 'pointer' : 'not-allowed',
                color: newComment.trim() ? 'white' : '#484f58',
                transition: 'all 0.2s', display: 'flex', alignItems: 'center'
              }}
            >
              {submitting ? '…' : <Send size={15} />}
            </button>
          </div>
          <p style={{ fontSize: 11, color: '#484f58', marginTop: 6, marginLeft: 2 }}>
            Ctrl+Enter pou voye
          </p>
        </div>
      ) : (
        <div style={{
          background: 'rgba(255,255,255,0.03)', borderRadius: 10,
          padding: '12px 14px', marginBottom: 16, fontSize: 13,
          color: '#8b949e', textAlign: 'center'
        }}>
          <Link to="/login" style={{ color: '#58a6ff', textDecoration: 'none' }}>Konekte</Link> pou ajoute kòmantè
        </div>
      )}

      {/* Liste des commentaires */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {comments.map(comment => (
          <div key={comment.id} style={{
            background: 'rgba(255,255,255,0.03)', borderRadius: 10,
            padding: '12px 14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
              <span style={{ color: '#58a6ff', fontWeight: 600 }}>{comment.author}</span>
              <span style={{ color: '#484f58' }}>{relativeTime(comment.createdAt)}</span>
            </div>
            <p style={{ fontSize: 13, color: '#c9d1d9', margin: 0, lineHeight: 1.5 }}>
              {comment.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Composant Principal : MarketDetail ────────────────────────────────────────

export default function MarketDetail() {
  const { category, slug } = useParams<{ category: string; slug: string }>();
  const [searchParams] = useSearchParams();
  const { path } = useLocale();
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // ── Hooks de données ────────────────────────────────────────────────────────
  const { market, loading, error, setMarket } = useMarket(slug || '');

  // ── État local ──────────────────────────────────────────────────────────────
  const [option, setOption] = useState<'yes' | 'no'>(
    () => (searchParams.get('option') === 'no' ? 'no' : 'yes')
  );
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  // ── Mise à jour temps réel ──────────────────────────────────────────────────
  useMarketRealtime(market?.id || '', (data) => {
    if (market) setMarket({ ...market, ...data });
  });

  // ── Calculs mémoïsés ────────────────────────────────────────────────────────
  const amtNum = useMemo(() => parseFloat(amount) || 0, [amount]);

  const yesOdds = useMemo(
    () => market ? parseFloat((1 / Math.max(0.01, market.yes_prob)).toFixed(2)) : 2.0,
    [market]
  );
  const noOdds = useMemo(
    () => market ? parseFloat((1 / Math.max(0.01, market.no_prob)).toFixed(2)) : 2.0,
    [market]
  );
  const curOdds = option === 'yes' ? yesOdds : noOdds;

  const potential = useMemo(
    () => parseFloat((amtNum * curOdds).toFixed(2)),
    [amtNum, curOdds]
  );

  const catColor = useMemo(
    () => market ? (CAT_COLOR[market.category] || '#8b949e') : '#8b949e',
    [market]
  );

  const yp = useMemo(() => market ? Math.round(market.yes_prob * 100) : 50, [market]);
  const np = 100 - yp;
  const isClosed = useMemo(() => market ? market.status !== 'active' : true, [market]);

  // Volumes simulés (Wi/Non) — remplacer par de vraies données API
  const yesVolume = useMemo(
    () => market ? Math.round(market.total_volume * market.yes_prob) : 0,
    [market]
  );
  const noVolume = useMemo(
    () => market ? market.total_volume - yesVolume : 0,
    [market, yesVolume]
  );

  // ── Actions ─────────────────────────────────────────────────────────────────

  const doPlaceBet = useCallback(async () => {
    if (!market || !user) return;
    setBusy(true);
    try {
      const res = await marketsAPI.placeBet(market.id, option, amtNum);
      const { new_balance, market: updated } = res.data;
      updateBalance(new_balance ?? (user.balance - amtNum));
      if (updated) setMarket(updated);
      setAmount('');
      setShowConfirm(false);
      toast.success(`✓ Pari ${option === 'yes' ? 'Wi' : 'Non'} — ${amtNum.toLocaleString()} HTG`, { duration: 4000 });
    } catch (e: any) {
      setShowConfirm(false);
      toast.error(e.response?.data?.detail || 'Erè pari. Eseye ankò.');
    } finally {
      setBusy(false);
    }
  }, [market, user, option, amtNum, updateBalance, setMarket]);

  const handleBetClick = useCallback(() => {
    if (!user) { navigate(path('login'), { state: { from: location.pathname } }); return; }
    if (!market) return;
    if (!amtNum || amtNum < (market.min_bet || 50)) { toast.error(`Min: ${market.min_bet || 50} HTG`); return; }
    if (amtNum > (market.max_bet || 100000)) { toast.error(`Max: ${market.max_bet} HTG`); return; }
    if (amtNum > user.balance) { toast.error('Balans ensifizan'); return; }
    setShowConfirm(true);
  }, [user, market, amtNum, navigate, path, location.pathname]);

  const toggleFavorite = useCallback(() => {
    setIsFavorite(prev => !prev);
    toast.success(isFavorite ? 'Retire nan favori' : 'Ajoute nan favori ❤️');
  }, [isFavorite]);

  // ── Partage ─────────────────────────────────────────────────────────────────

  const shareUrl = window.location.href;
  const shareText = market ? `${market.title} — Wi: ${yp}% | Non: ${np}% | AyitiMarket` : '';

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Lyen kopye!');
    });
  }, [shareUrl]);

  const handleTwitter = useCallback(() =>
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank'),
    [shareText, shareUrl]
  );

  const handleWhatsApp = useCallback(() =>
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText + '\n' + shareUrl)}`, '_blank'),
    [shareText, shareUrl]
  );

  // ── Animations CSS injectées une fois ───────────────────────────────────────

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInScale {
        from { opacity: 0; transform: scale(0.95) translateY(8px); }
        to   { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50%       { opacity: 0.5; transform: scale(0.8); }
      }
      @keyframes heartPop {
        0%   { transform: scale(1); }
        50%  { transform: scale(1.4); }
        100% { transform: scale(1); }
      }
      .heart-btn:active { animation: heartPop 0.25s ease; }
      .bet-btn { transition: box-shadow 0.2s, transform 0.1s; }
      .bet-btn:hover:not(:disabled) { box-shadow: 0 8px 32px rgba(63,185,80,0.45) !important; transform: translateY(-1px); }
      .bet-btn:active:not(:disabled) { transform: scale(0.97); }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // ─── États loading / error ──────────────────────────────────────────────────

  if (loading) {
    return (
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
  }

  if (error || !market) {
    return (
      <div className="container py-5 px-4 fade-in" style={{ maxWidth: 600 }}>
        <div style={{
          background: '#161b22', border: '1px solid rgba(248,81,73,0.2)',
          borderRadius: 14, padding: 40, textAlign: 'center'
        }}>
          <AlertCircle style={{ width: 48, height: 48, color: '#f85149', margin: '0 auto 16px', display: 'block' }} />
          <h2 style={{ color: 'white', marginBottom: 8 }}>Machè pa jwenn</h2>
          <p style={{ color: '#8b949e', marginBottom: 24, fontSize: 14 }}>
            Slug: <code style={{ color: '#d29922' }}>{slug}</code>
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => navigate(-1)} className="btn-ghost">← Retounen</button>
            <Link to={path('markets')} className="btn-primary">Wè tout machè</Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Rendu principal ────────────────────────────────────────────────────────

  return (
    <div className="container py-6 md:py-10 fade-in px-4 md:px-0">

      {/* Modal de confirmation */}
      {showConfirm && (
        <BetConfirmModal
          option={option}
          amount={amtNum}
          odds={curOdds}
          potential={potential}
          marketTitle={market.title}
          onConfirm={doPlaceBet}
          onCancel={() => setShowConfirm(false)}
          busy={busy}
        />
      )}

      {/* ── Navigation & Partage ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-10 pt-3 flex-wrap gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
        >
          <ArrowLeft size={18} /> Retounen
        </button>

        <div className="flex gap-2 flex-wrap">
          {/* Bouton Favori */}
          <button
            onClick={toggleFavorite}
            className="heart-btn"
            style={{
              padding: '10px 12px', borderRadius: 12, cursor: 'pointer', border: 'none',
              background: isFavorite ? 'rgba(248,81,73,0.15)' : 'rgba(255,255,255,0.05)',
              color: isFavorite ? '#f85149' : '#8b949e',
              display: 'flex', alignItems: 'center', transition: 'all 0.2s'
            }}
            title={isFavorite ? 'Retire nan favori' : 'Ajoute nan favori'}
          >
            <Heart size={18} fill={isFavorite ? '#f85149' : 'none'} />
          </button>

          <button
            onClick={handleWhatsApp}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] flex items-center gap-1.5 hover:bg-[#25D366]/20"
          >
            💬 WhatsApp
          </button>
          <button
            onClick={handleTwitter}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#1DA1F2]/10 border border-[#1DA1F2]/30 text-[#1DA1F2] flex items-center gap-1 hover:bg-[#1DA1F2]/20"
          >
            <Twitter size={15} /> 𝕏
          </button>
          <button
            onClick={handleCopyLink}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 flex items-center gap-1.5"
          >
            {copied ? <CheckCircle size={16} /> : <Share2 size={16} />}
          </button>
        </div>
      </div>

      {/* ── Image de couverture ──────────────────────────────────────────── */}
      {market.image_url ? (
        <div className="rounded-2xl overflow-hidden mb-6 aspect-[16/5] md:aspect-[16/4.5]">
          <img src={market.image_url} alt={market.title} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div
          className="rounded-2xl mb-6 h-24 md:h-32 flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg,${catColor}12,${catColor}06)`,
            border: `1px solid ${catColor}20`
          }}
        >
          <TrendingUp size={42} style={{ color: catColor, opacity: 0.4 }} />
        </div>
      )}

      {/* ── Bannière "Marché fermé" ──────────────────────────────────────── */}
      {isClosed && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center gap-3 text-sm">
          <span className="bg-red-500 text-white px-3 py-0.5 rounded-full text-xs font-bold">FÈMEN</span>
          <span className="text-gray-400">
            {market.status === 'resolved'
              ? `Rezoud: ${market.resolution?.toUpperCase() || ''}`
              : 'Machè sa a fèmen pou pari'}
          </span>
        </div>
      )}

      {/* ── Grille principale ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

        {/* ════ COLONNE GAUCHE ══════════════════════════════════════════════ */}
        <div className="lg:col-span-8 space-y-6">

          {/* Titre & méta */}
          <div>
            <span style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: `${catColor}15`, color: catColor, textTransform: 'uppercase'
            }}>
              {market.category}
            </span>
            <h1 className="text-2xl md:text-3xl font-bold leading-tight mt-4 text-white">
              {market.title}
            </h1>
          </div>

          {/* Stats + Countdown live */}
          <div className="flex flex-wrap gap-x-4 gap-y-3 text-sm text-gray-400 items-center">
            {/* Countdown live (remplace l'affichage statique) */}
            <CountdownDisplay endDate={market.end_date} />

            <div className="flex items-center gap-2">
              <Users size={15} />
              {market.bet_count} parisyen
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp size={15} />
              {market.total_volume.toLocaleString()} HTG
            </div>
          </div>

          {/* Description */}
          {market.description && (
            <p className="text-[15px] text-gray-400 leading-relaxed">{market.description}</p>
          )}

          {/* Barre de probabilités */}
          <div className="bg-[#161b22] border border-white/10 rounded-2xl p-5 md:p-6">
            <div className="flex justify-between mb-3 text-base font-bold">
              <span className="text-green-500">Wi {yp}%</span>
              <span className="text-red-500">Non {np}%</span>
            </div>
            <div className="h-3 bg-red-500/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${yp}%` }}
              />
            </div>
            <div className="flex justify-between mt-4 text-sm text-gray-400">
              <span>Cote: <strong className="text-white font-mono">{yesOdds.toFixed(2)}×</strong></span>
              <span>Cote: <strong className="text-white font-mono">{noOdds.toFixed(2)}×</strong></span>
            </div>
          </div>

          {/* Graphique de prix */}
          <PriceChart marketId={market.id} />

          {/* Order Book */}
          <OrderBookSummary
            totalVolume={market.total_volume}
            yesVolume={yesVolume}
            noVolume={noVolume}
            yesOdds={yesOdds}
            noOdds={noOdds}
          />

          {/* Derniers paris */}
          <RecentBetsSection bets={MOCK_RECENT_BETS} />

          {/* Commentaires */}
          <CommentsSection marketId={market.id} user={user} />

        </div>

        {/* ════ COLONNE DROITE (sticky) ═════════════════════════════════════ */}
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-20 bg-[#161b22] border border-white/10 rounded-3xl p-6 md:p-8">

            <div className="font-bold text-xl mb-6 text-white">
              {isClosed ? 'Machè Fèmen' : 'Fè Pari'}
            </div>

            {!isClosed ? (
              <>
                {/* Sélection Wi / Non */}
                <div className="grid grid-cols-2 gap-3 mb-7">
                  {(['yes', 'no'] as const).map(opt => (
                    <button
                      key={opt}
                      onClick={() => setOption(opt)}
                      style={{
                        padding: '14px 8px', borderRadius: 12, cursor: 'pointer',
                        fontWeight: 700, fontSize: 14,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        background: option === opt
                          ? (opt === 'yes' ? 'rgba(63,185,80,0.2)' : 'rgba(248,81,73,0.2)')
                          : 'rgba(255,255,255,0.04)',
                        border: `2px solid ${option === opt
                          ? (opt === 'yes' ? '#3fb950' : '#f85149')
                          : 'rgba(255,255,255,0.08)'}`,
                        color: option === opt
                          ? (opt === 'yes' ? '#3fb950' : '#f85149')
                          : '#8b949e',
                        transition: 'all 0.15s'
                      }}
                    >
                      <span style={{ fontSize: 20 }}>{opt === 'yes' ? '✓' : '✗'}</span>
                      <span>{opt === 'yes' ? 'Wi' : 'Non'}</span>
                      <span style={{ fontSize: 12, opacity: 0.8 }}>
                        {opt === 'yes' ? yesOdds.toFixed(2) : noOdds.toFixed(2)}×
                      </span>
                    </button>
                  ))}
                </div>

                {/* Saisie du montant */}
                <div className="mb-7">
                  <label className="block text-xs font-semibold tracking-widest text-gray-400 mb-3">
                    MONTAN (HTG)
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder={`Min ${market.min_bet} HTG`}
                    min={market.min_bet}
                    step={50}
                    className="w-full bg-[#0d1117] border border-white/12 rounded-2xl px-5 py-5 text-xl font-mono text-white outline-none focus:border-green-500/40 transition-colors"
                  />

                  {/* Raccourcis de montant */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    {[100, 250, 500, 1000, 2500]
                      .filter(a => a >= (market.min_bet || 50))
                      .map(a => (
                        <button
                          key={a}
                          onClick={() => setAmount(String(a))}
                          className={`px-4 py-2 text-sm rounded-xl transition-all border ${amount === String(a)
                              ? 'bg-green-600 text-white border-green-600'
                              : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-400'
                            }`}
                        >
                          {a}
                        </button>
                      ))}
                    {user && (
                      <button
                        onClick={() => setAmount(String(Math.floor(user.balance)))}
                        className="px-4 py-2 text-sm rounded-xl bg-green-500/10 border border-green-500/30 text-green-400"
                      >
                        Tout
                      </button>
                    )}
                  </div>
                </div>

                {/* Résumé de la mise */}
                {amtNum > 0 && (
                  <div className="bg-[#1a2330] border border-white/10 rounded-2xl p-5 mb-7 text-sm">
                    {[
                      { l: 'Mise:', v: `${amtNum.toLocaleString()} HTG`, c: 'white' },
                      { l: 'Gain potansyèl:', v: `${potential.toLocaleString()} HTG`, c: '#3fb950', bold: true },
                    ].map(({ l, v, c, bold }) => (
                      <div key={l} className="flex justify-between py-1.5">
                        <span className="text-gray-400">{l}</span>
                        <span style={{ color: c, fontWeight: bold ? 700 : 400 }} className="font-mono">
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bouton principal Parier */}
                {user ? (
                  <button
                    onClick={handleBetClick}
                    disabled={!amtNum || amtNum < (market.min_bet || 50) || amtNum > user.balance}
                    className="w-full py-5 rounded-2xl font-bold text-lg disabled:opacity-50 bet-btn"
                    style={{
                      background: '#3fb950', color: 'white',
                      border: 'none', cursor: 'pointer',
                      boxShadow: '0 4px 20px rgba(63,185,80,0.3)'
                    }}
                  >
                    Pari {option === 'yes' ? 'Wi' : 'Non'} →
                  </button>
                ) : (
                  <Link
                    to={path('login')}
                    state={{ from: location.pathname }}
                    className="block w-full py-5 text-center rounded-2xl font-bold text-lg bet-btn"
                    style={{
                      background: '#3fb950', color: 'white',
                      boxShadow: '0 4px 20px rgba(63,185,80,0.3)'
                    }}
                  >
                    Konekte pou pari
                  </Link>
                )}

                {/* Solde utilisateur */}
                {user && (
                  <p style={{ textAlign: 'center', fontSize: 12, color: '#484f58', marginTop: 12 }}>
                    Balans: <span style={{ color: '#8b949e', fontFamily: 'monospace' }}>
                      {user.balance.toLocaleString()} HTG
                    </span>
                  </p>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-400">
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
