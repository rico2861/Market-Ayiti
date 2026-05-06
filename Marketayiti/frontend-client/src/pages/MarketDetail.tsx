import { useState, useEffect, useMemo, useCallback, memo, ReactNode } from 'react';
import { useParams, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Clock, TrendingUp, AlertCircle, Share2,
  Twitter, CheckCircle, X, Heart, MessageSquare, Send, Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useMarket } from '../hooks/useMarkets';
import { useMarketRealtime } from '../hooks/useRealtime';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { marketsAPI } from '../api';
import PriceChart from '../components/charts/PriceChart';

/* ──────────────────────────────────────────────────────────────────────────── */
/* Constantes                                                                   */
/* ──────────────────────────────────────────────────────────────────────────── */

const CAT_COLOR: Record<string, string> = {
  politik: '#a371f7',
  spo: '#3fb950',
  ekonomi: '#d29922',
  kilti: '#f97316',
  sosyal: '#58a6ff',
  lot: '#8b949e',
  nouvo: '#f85149',
};

const QUICK_AMOUNTS = [100, 250, 500, 1000, 2500] as const;

/* ──────────────────────────────────────────────────────────────────────────── */
/* Types locaux                                                                 */
/* ──────────────────────────────────────────────────────────────────────────── */

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

/* ──────────────────────────────────────────────────────────────────────────── */
/* Utilitaires                                                                  */
/* ──────────────────────────────────────────────────────────────────────────── */

/** Calcule le temps restant de façon lisible */
function computeTimeLeft(endDate: string): string {
  const ms = new Date(endDate).getTime() - Date.now();
  if (ms <= 0) return 'Fini';
  const days = Math.floor(ms / 86_400_000);
  const hrs = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  if (days > 0) return `${days}j ${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

/** Formate une date relative (ex : "3m") */
function relativeTime(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86_400)}j`;
}

/* ──────────────────────────────────────────────────────────────────────────── */
/* Styles globaux (keyframes + utilitaires)                                     */
/* ──────────────────────────────────────────────────────────────────────────── */

const GLOBAL_STYLES = `
  @keyframes fadeInScale {
    from { opacity: 0; transform: scale(0.97) translateY(6px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes pulseDot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.55; transform: scale(0.82); }
  }
  @keyframes heartPop {
    0%   { transform: scale(1); }
    50%  { transform: scale(1.35); }
    100% { transform: scale(1); }
  }
  @keyframes slideInBet {
    from { opacity: 0; transform: translateX(-8px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideInComment {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes modalFadeIn {
    from { opacity: 0; transform: scale(0.96) translateY(-8px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
  .md-heart-btn:active { animation: heartPop 0.25s ease; }
  .md-bet-btn { transition: box-shadow .2s, transform .1s, background .2s; }
  .md-bet-btn:hover:not(:disabled) {
    box-shadow: 0 10px 34px rgba(63,185,80,0.5) !important;
    transform: translateY(-1px);
  }
  .md-bet-btn:active:not(:disabled) { transform: scale(0.98); }

  .md-pulse-dot {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%;
    animation: pulseDot 1.5s infinite;
  }

  /* Glass bar container */
  .md-glass {
    background: rgba(22,27,34,0.72);
    backdrop-filter: blur(14px) saturate(140%);
    -webkit-backdrop-filter: blur(14px) saturate(140%);
    border: 1px solid rgba(255,255,255,0.08);
  }

  /* Custom scrollbar for comment / bet lists */
  .md-scroll::-webkit-scrollbar { width: 6px; }
  .md-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 8px; }
`;

function useInjectGlobalStyles() {
  useEffect(() => {
    const id = 'market-detail-global-styles';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = GLOBAL_STYLES;
    document.head.appendChild(style);
    return () => {
      // Do NOT remove on unmount: styles may be reused across navigations.
    };
  }, []);
}

/* ──────────────────────────────────────────────────────────────────────────── */
/* Composant : Modal de Confirmation                                            */
/* ──────────────────────────────────────────────────────────────────────────── */

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
  option, amount, odds, potential, marketTitle, onConfirm, onCancel, busy,
}: BetConfirmModalProps) {
  // Empêcher le scroll du body pendant que le modal est ouvert
  useEffect(() => {
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPosition = body.style.position;
    const prevWidth = body.style.width;
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.width = '100%';
    return () => {
      body.style.overflow = prevOverflow;
      body.style.position = prevPosition;
      body.style.width = prevWidth;
    };
  }, []);

  const isYes = option === 'yes';
  const accent = isYes ? '#3fb950' : '#f85149';
  const accentBg = isYes ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.15)';

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-auto px-4 py-6 sm:px-6"
      style={{
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl p-5 sm:p-7 mx-auto"
        style={{
          background: '#161b22',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          animation: 'modalFadeIn 0.28s ease both',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <span className="text-[16px] sm:text-[17px] font-bold text-white tracking-tight">
            Konfime Pari
          </span>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fèmen"
            className="rounded-lg p-1.5 transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#8b949e', border: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Titre du marché */}
        <div
          className="rounded-xl px-3.5 py-2.5 mb-4 text-[13px] leading-snug"
          style={{ background: 'rgba(255,255,255,0.04)', color: '#8b949e' }}
        >
          {marketTitle.slice(0, 90)}{marketTitle.length > 90 ? '…' : ''}
        </div>

        {/* Badge option */}
        <div className="flex items-center justify-center mb-5">
          <div
            className="rounded-full px-6 py-2.5 text-[15px] sm:text-base font-bold tracking-tight"
            style={{
              background: accentBg,
              border: `2px solid ${accent}`,
              color: accent,
            }}
          >
            {isYes ? '✓ Wi' : '✗ Non'} — {odds.toFixed(2)}×
          </div>
        </div>

        {/* Résumé financier */}
        <div
          className="rounded-xl px-4 py-3 mb-5"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        >
          {[
            { label: 'Mise:', value: `${amount.toLocaleString()} HTG`, color: 'white' as const },
            { label: 'Gain potansyèl:', value: `${potential.toLocaleString()} HTG`, color: '#3fb950', bold: true },
          ].map(({ label, value, color, bold }) => (
            <div key={label} className="flex items-center justify-between text-[14px] py-1">
              <span style={{ color: '#8b949e' }}>{label}</span>
              <span
                style={{ color, fontWeight: bold ? 700 : 500, fontFamily: 'JetBrains Mono, monospace' }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Boutons */}
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl py-3 text-sm font-semibold transition-colors"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#8b949e',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          >
            Anile
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="md-bet-btn flex-[2] rounded-xl py-3 text-[15px] font-bold text-white"
            style={{
              background: busy ? 'rgba(63,185,80,0.55)' : '#3fb950',
              border: 'none',
              cursor: busy ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 16px rgba(63,185,80,0.3)',
            }}
          >
            {busy ? 'Ap trete…' : `✓ Konfime — ${amount.toLocaleString()} HTG`}
          </button>
        </div>
      </div>
    </div>
  );
});

/* ──────────────────────────────────────────────────────────────────────────── */
/* Composant : Countdown Live                                                   */
/* ──────────────────────────────────────────────────────────────────────────── */

function CountdownDisplay({ endDate }: { endDate: string }) {
  const [timeLeft, setTimeLeft] = useState(() => computeTimeLeft(endDate));

  useEffect(() => {
    const interval = setInterval(() => setTimeLeft(computeTimeLeft(endDate)), 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  const isUrgent = useMemo(() => {
    const ms = new Date(endDate).getTime() - Date.now();
    return ms > 0 && ms < 3_600_000;
  }, [endDate, timeLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  const color = isUrgent ? '#f85149' : '#3fb950';
  const textColor = isUrgent ? '#f85149' : 'white';

  return (
    <div
      className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5"
      style={{
        background: isUrgent ? 'rgba(248,81,73,0.12)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${isUrgent ? 'rgba(248,81,73,0.3)' : 'rgba(255,255,255,0.1)'}`,
      }}
    >
      <span className="md-pulse-dot" style={{ background: color }} />
      <Clock size={14} style={{ color: isUrgent ? '#f85149' : '#8b949e' }} />
      <span
        className="text-[13px] font-semibold"
        style={{ fontFamily: 'JetBrains Mono, monospace', color: textColor }}
      >
        {timeLeft}
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */
/* Composant : Dernieres Paris                                                  */
/* ──────────────────────────────────────────────────────────────────────────── */

interface RecentBetsSectionProps {
  bets: RecentBet[];
  loading: boolean;
}

function BetColumn({
  items, color, label, loading,
}: { items: RecentBet[]; color: string; label: string; loading: boolean }) {
  return (
    <div className="flex-1 min-w-0">
      <div
        className="text-[11px] sm:text-[12px] font-bold uppercase mb-2.5"
        style={{ color, letterSpacing: '0.8px' }}
      >
        {label}
      </div>
      <div className="flex flex-col gap-1.5">
        {loading ? (
          <div className="text-[12px] text-center py-3" style={{ color: '#8b949e' }}>
            Chajman…
          </div>
        ) : items.length === 0 ? (
          <p className="text-[12px] text-center py-3" style={{ color: '#8b949e' }}>
            Poko gen pari
          </p>
        ) : (
          items.map((bet, idx) => (
            <div
              key={bet.id}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-[12px]"
              style={{
                background: 'rgba(255,255,255,0.03)',
                animation: 'slideInBet 0.3s ease forwards',
                animationDelay: `${idx * 50}ms`,
                opacity: 0,
              }}
            >
              <span className="truncate" style={{ color: '#c9d1d9', fontWeight: 500 }}>
                {bet.author}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  style={{ color, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}
                >
                  {bet.amount.toLocaleString()}
                </span>
                <span style={{ color: '#484f58', fontSize: 11 }}>{relativeTime(bet.createdAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RecentBetsSection({ bets, loading }: RecentBetsSectionProps) {
  const topYes = useMemo(() => bets.filter((b) => b.option === 'yes').slice(0, 5), [bets]);
  const topNo = useMemo(() => bets.filter((b) => b.option === 'no').slice(0, 5), [bets]);

  return (
    <div
      className="rounded-2xl p-4 sm:p-5"
      style={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <h3 className="text-white text-[13px] sm:text-[14px] font-bold mb-3 sm:mb-4 flex items-center gap-1.5 tracking-tight">
        <Zap size={15} style={{ color: '#f97316' }} />
        Dènye Paris (HTG)
      </h3>
      <div className="flex gap-3 sm:gap-4">
        <BetColumn items={topYes} color="#3fb950" label="Top Wi" loading={loading} />
        <div className="w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <BetColumn items={topNo} color="#f85149" label="Top Non" loading={loading} />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */
/* Composant : Commentaires                                                     */
/* ──────────────────────────────────────────────────────────────────────────── */

interface CommentsSectionProps {
  marketId: string;
  user: any;
}

function CommentsSection({ marketId, user }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingComments, setLoadingComments] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchComments = async () => {
      try {
        setLoadingComments(true);
        const mock: Comment[] = [
          { id: '1', author: 'Jean P.', text: 'Mwen panse Wi ap genyen sa a fasilman!', createdAt: new Date(Date.now() - 3_600_000) },
          { id: '2', author: 'Marie C.', text: 'Pa twò sèten... Sitiyasyon an konplike toujou.', createdAt: new Date(Date.now() - 7_200_000) },
        ];
        if (!cancelled) setComments(mock);
      } catch (err) {
        console.error('Erè chajman kòmantè:', err);
      } finally {
        if (!cancelled) setLoadingComments(false);
      }
    };
    fetchComments();
    return () => { cancelled = true; };
  }, [marketId]);

  const handleSubmit = useCallback(async () => {
    if (!newComment.trim() || !user) return;
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 400));
      const comment: Comment = {
        id: Date.now().toString(),
        author: user.username || 'Ou',
        text: newComment.trim(),
        createdAt: new Date(),
      };
      setComments((prev) => [comment, ...prev]);
      setNewComment('');
      toast.success('Kòmantè ajoute!');
    } catch (err) {
      toast.error('Erè tè ap ajoute kòmantè');
    } finally {
      setSubmitting(false);
    }
  }, [newComment, user]);

  const hasDraft = newComment.trim().length > 0;

  return (
    <div
      className="rounded-2xl p-4 sm:p-5"
      style={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <h3 className="text-white text-[13px] sm:text-[14px] font-bold mb-3 sm:mb-4 flex items-center gap-2 tracking-tight">
        <MessageSquare size={16} style={{ color: '#58a6ff' }} />
        Kòmantè ({comments.length})
      </h3>

      {user ? (
        <div className="mb-5">
          <div className="flex gap-2.5 items-end">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Ekri kòmantè ou…"
              rows={2}
              className="flex-1 rounded-xl px-3.5 py-2.5 text-[13px] text-white outline-none resize-none leading-snug"
              style={{
                background: '#0d1117',
                border: '1px solid rgba(255,255,255,0.1)',
                fontFamily: 'inherit',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(88,166,255,0.45)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
              }}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!hasDraft || submitting}
              className="rounded-xl px-3.5 py-2.5 flex items-center transition-all"
              style={{
                background: hasDraft ? '#3fb950' : 'rgba(255,255,255,0.06)',
                border: 'none',
                cursor: hasDraft ? 'pointer' : 'not-allowed',
                color: hasDraft ? 'white' : '#484f58',
              }}
              aria-label="Voye kòmantè"
            >
              {submitting ? '…' : <Send size={15} />}
            </button>
          </div>
          <p className="text-[11px] mt-1.5 ml-0.5" style={{ color: '#484f58' }}>
            Ctrl+Enter pou voye
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl px-3.5 py-3 mb-4 text-[13px] text-center"
          style={{ background: 'rgba(255,255,255,0.03)', color: '#8b949e' }}
        >
          <Link to="/login" style={{ color: '#58a6ff', textDecoration: 'none' }}>Konekte</Link>
          {' '}pou ajoute kòmantè
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {loadingComments ? (
          <div className="text-[12px] text-center py-5" style={{ color: '#8b949e' }}>
            Chajman kòmantè…
          </div>
        ) : comments.length === 0 ? (
          <div className="text-[12px] text-center py-5" style={{ color: '#8b949e' }}>
            Poko gen kòmantè
          </div>
        ) : (
          comments.map((comment, idx) => (
            <div
              key={comment.id}
              className="rounded-xl px-3.5 py-3"
              style={{
                background: 'rgba(255,255,255,0.03)',
                animation: 'slideInComment 0.3s ease forwards',
                animationDelay: `${idx * 50}ms`,
                opacity: 0,
              }}
            >
              <div className="flex justify-between items-center mb-1.5 text-[12px]">
                <span style={{ color: '#58a6ff', fontWeight: 600 }}>{comment.author}</span>
                <span style={{ color: '#484f58' }}>{relativeTime(comment.createdAt)}</span>
              </div>
              <p className="text-[13px] m-0 leading-snug" style={{ color: '#c9d1d9' }}>
                {comment.text}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */
/* Composant : BetPanel (unifié mobile + desktop)                               */
/* ──────────────────────────────────────────────────────────────────────────── */

interface BetPanelProps {
  market: any;
  user: any;
  option: 'yes' | 'no';
  setOption: (o: 'yes' | 'no') => void;
  amount: string;
  setAmount: (v: string) => void;
  amtNum: number;
  yesOdds: number;
  noOdds: number;
  potential: number;
  isClosed: boolean;
  onBet: () => void;
  loginPath: string;
  fromPath: string;
  sticky?: boolean;
}

function BetPanel({
  market, user, option, setOption, amount, setAmount,
  amtNum, yesOdds, noOdds, potential, isClosed,
  onBet, loginPath, fromPath, sticky,
}: BetPanelProps) {
  const minBet = market.min_bet || 50;

  const panelClasses = [
    'rounded-3xl',
    'p-5 sm:p-6 lg:p-7',
    sticky ? 'lg:sticky lg:top-20' : '',
  ].join(' ');

  return (
    <div
      className={panelClasses}
      style={{
        background: 'linear-gradient(180deg, rgba(22,27,34,0.96), rgba(22,27,34,0.88))',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}
    >
      <div className="font-bold text-lg sm:text-xl mb-5 sm:mb-6 text-white tracking-tight">
        {isClosed ? 'Machè Fèmen' : 'Fè Pari'}
      </div>

      {isClosed ? (
        <div className="text-center py-10 sm:py-12" style={{ color: '#8b949e' }}>
          {market.status === 'resolved'
            ? `✓ Rezoud: ${market.resolution === 'yes' ? 'Wi' : 'Non'}`
            : 'Machè sa a fèmen pou pari nouvo'}
        </div>
      ) : (
        <>
          {/* Yes / No */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mb-6">
            {(['yes', 'no'] as const).map((opt) => {
              const active = option === opt;
              const isYes = opt === 'yes';
              const odds = isYes ? yesOdds : noOdds;
              const accent = isYes ? '#3fb950' : '#f85149';
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setOption(opt)}
                  className="rounded-xl flex flex-col items-center gap-1 py-3 sm:py-3.5 font-bold text-sm transition-all"
                  style={{
                    background: active
                      ? (isYes ? 'rgba(63,185,80,0.20)' : 'rgba(248,81,73,0.20)')
                      : 'rgba(255,255,255,0.04)',
                    border: `2px solid ${active ? accent : 'rgba(255,255,255,0.08)'}`,
                    color: active ? accent : '#8b949e',
                    cursor: 'pointer',
                  }}
                >
                  <span className="text-xl leading-none">{isYes ? '✓' : '✗'}</span>
                  <span>{isYes ? 'Wi' : 'Non'}</span>
                  <span className="text-[12px]" style={{ opacity: 0.85 }}>
                    {odds.toFixed(2)}×
                  </span>
                </button>
              );
            })}
          </div>

          {/* Montant */}
          <div className="mb-6">
            <label className="block text-[11px] sm:text-xs font-semibold mb-2.5" style={{ color: '#8b949e', letterSpacing: '0.18em' }}>
              MONTAN (HTG)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Min ${minBet} HTG`}
              min={minBet}
              step={50}
              className="w-full rounded-2xl px-4 sm:px-5 py-4 sm:py-5 text-lg sm:text-xl text-white outline-none transition-colors"
              style={{
                background: '#0d1117',
                border: '1px solid rgba(255,255,255,0.12)',
                fontFamily: 'JetBrains Mono, monospace',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(63,185,80,0.45)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
            />

            <div className="flex flex-wrap gap-2 mt-3.5">
              {QUICK_AMOUNTS.filter((a) => a >= minBet).map((a) => {
                const active = amount === String(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAmount(String(a))}
                    className="px-3.5 sm:px-4 py-1.5 sm:py-2 text-[13px] sm:text-sm rounded-xl transition-all border"
                    style={{
                      background: active ? '#3fb950' : 'rgba(255,255,255,0.05)',
                      borderColor: active ? '#3fb950' : 'rgba(255,255,255,0.1)',
                      color: active ? 'white' : '#8b949e',
                      cursor: 'pointer',
                    }}
                  >
                    {a.toLocaleString()}
                  </button>
                );
              })}
              {user && (
                <button
                  type="button"
                  onClick={() => setAmount(String(Math.floor(user.balance)))}
                  className="px-3.5 sm:px-4 py-1.5 sm:py-2 text-[13px] sm:text-sm rounded-xl transition-colors"
                  style={{
                    background: 'rgba(63,185,80,0.1)',
                    border: '1px solid rgba(63,185,80,0.3)',
                    color: '#3fb950',
                    cursor: 'pointer',
                  }}
                >
                  Tout
                </button>
              )}
            </div>
          </div>

          {/* Résumé */}
          {amtNum > 0 && (
            <div
              className="rounded-2xl p-4 sm:p-5 mb-6 text-sm"
              style={{ background: '#1a2330', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {[
                { l: 'Mise:', v: `${amtNum.toLocaleString()} HTG`, c: 'white' as const, bold: false },
                { l: 'Gain potansyèl:', v: `${potential.toLocaleString()} HTG`, c: '#3fb950', bold: true },
              ].map(({ l, v, c, bold }) => (
                <div key={l} className="flex justify-between py-1.5">
                  <span style={{ color: '#8b949e' }}>{l}</span>
                  <span
                    style={{ color: c, fontWeight: bold ? 700 : 400, fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    {v}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* CTA */}
          {user ? (
            <button
              type="button"
              onClick={onBet}
              disabled={!amtNum || amtNum < minBet || amtNum > user.balance}
              className="md-bet-btn w-full rounded-2xl py-4 sm:py-5 font-bold text-base sm:text-lg disabled:opacity-50"
              style={{
                background: '#3fb950',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(63,185,80,0.3)',
              }}
            >
              Pari {option === 'yes' ? 'Wi' : 'Non'} →
            </button>
          ) : (
            <Link
              to={loginPath}
              state={{ from: fromPath }}
              className="md-bet-btn block w-full text-center rounded-2xl py-4 sm:py-5 font-bold text-base sm:text-lg"
              style={{
                background: '#3fb950',
                color: 'white',
                boxShadow: '0 4px 20px rgba(63,185,80,0.3)',
              }}
            >
              Konekte pou pari
            </Link>
          )}

          {user && (
            <p className="text-center text-[12px] mt-3" style={{ color: '#484f58' }}>
              Balans:{' '}
              <span style={{ color: '#8b949e', fontFamily: 'JetBrains Mono, monospace' }}>
                {user.balance.toLocaleString()} HTG
              </span>
            </p>
          )}
        </>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */
/* Composant : Barre d'actions (partage/favori) responsive                      */
/* ──────────────────────────────────────────────────────────────────────────── */

interface ActionBarProps {
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onWhatsApp: () => void;
  onTwitter: () => void;
  onCopyLink: () => void;
  copied: boolean;
  onBack: () => void;
}

function IconActionButton({
  onClick, title, bg, color, border, children, label, labelClass,
}: {
  onClick: () => void;
  title: string;
  bg: string;
  color: string;
  border: string;
  children: ReactNode;
  label?: string;
  labelClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 sm:px-4 sm:py-2 text-[13px] sm:text-sm font-semibold transition-colors"
      style={{ background: bg, color, border }}
    >
      {children}
      {label && <span className={labelClass}>{label}</span>}
    </button>
  );
}

function ActionBar({
  isFavorite, onToggleFavorite, onWhatsApp, onTwitter, onCopyLink, copied, onBack,
}: ActionBarProps) {
  return (
    <div className="md-glass sticky top-2 z-30 rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 mb-6 sm:mb-8 flex items-center justify-between gap-3 flex-wrap">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[13px] sm:text-sm font-medium transition-colors"
        style={{ color: '#8b949e', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'white')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#8b949e')}
      >
        <ArrowLeft size={17} /> <span>Retounen</span>
      </button>

      <div className="flex gap-1.5 sm:gap-2 flex-wrap items-center">
        <button
          type="button"
          onClick={onToggleFavorite}
          className="md-heart-btn inline-flex items-center rounded-xl p-2 sm:p-2.5 transition-all"
          style={{
            background: isFavorite ? 'rgba(248,81,73,0.15)' : 'rgba(255,255,255,0.05)',
            color: isFavorite ? '#f85149' : '#8b949e',
            border: `1px solid ${isFavorite ? 'rgba(248,81,73,0.3)' : 'rgba(255,255,255,0.1)'}`,
            cursor: 'pointer',
          }}
          title={isFavorite ? 'Retire nan favori' : 'Ajoute nan favori'}
          aria-label={isFavorite ? 'Retire nan favori' : 'Ajoute nan favori'}
        >
          <Heart size={17} fill={isFavorite ? '#f85149' : 'none'} />
        </button>

        <IconActionButton
          onClick={onWhatsApp}
          title="Pataje sou WhatsApp"
          bg="rgba(37,211,102,0.1)"
          border="1px solid rgba(37,211,102,0.3)"
          color="#25D366"
          label="WhatsApp"
          labelClass="hidden sm:inline"
        >
          <span aria-hidden className="text-[15px] leading-none">💬</span>
        </IconActionButton>

        <IconActionButton
          onClick={onTwitter}
          title="Pataje sou X"
          bg="rgba(29,161,242,0.1)"
          border="1px solid rgba(29,161,242,0.3)"
          color="#1DA1F2"
          label="𝕏"
          labelClass="hidden sm:inline"
        >
          <Twitter size={15} />
        </IconActionButton>

        <IconActionButton
          onClick={onCopyLink}
          title={copied ? 'Lyen kopye' : 'Kopye lyen'}
          bg="rgba(255,255,255,0.05)"
          border="1px solid rgba(255,255,255,0.1)"
          color={copied ? '#3fb950' : '#8b949e'}
          label={copied ? 'Kopye' : 'Kopye'}
          labelClass="hidden md:inline"
        >
          {copied ? <CheckCircle size={16} /> : <Share2 size={16} />}
        </IconActionButton>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */
/* Composant principal : MarketDetail                                           */
/* ──────────────────────────────────────────────────────────────────────────── */

export default function MarketDetail() {
  useInjectGlobalStyles();

  const { slug } = useParams<{ category: string; slug: string }>();
  const [searchParams] = useSearchParams();
  const { path } = useLocale();
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { market, loading, error, setMarket } = useMarket(slug || '');
  const [recentBets, setRecentBets] = useState<RecentBet[]>([]);
  const [betsLoading, setBetsLoading] = useState(true);

  const [option, setOption] = useState<'yes' | 'no'>(
    () => (searchParams.get('option') === 'no' ? 'no' : 'yes'),
  );
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  /* Mock dernières paris (même comportement que l’original) */
  useEffect(() => {
    let cancelled = false;
    const fetchRecentBets = async () => {
      if (!market?.id) return;
      try {
        setBetsLoading(true);
        const mock: RecentBet[] = [
          { id: '1', author: 'Jean P.', amount: 500, option: 'yes', odds: 1.82, createdAt: new Date(Date.now() - 120_000) },
          { id: '2', author: 'Marie C.', amount: 1000, option: 'no', odds: 2.10, createdAt: new Date(Date.now() - 300_000) },
          { id: '3', author: 'Pierre L.', amount: 250, option: 'yes', odds: 1.82, createdAt: new Date(Date.now() - 600_000) },
          { id: '4', author: 'Sophie M.', amount: 2000, option: 'no', odds: 2.10, createdAt: new Date(Date.now() - 900_000) },
          { id: '5', author: 'Alex R.', amount: 750, option: 'yes', odds: 1.82, createdAt: new Date(Date.now() - 1_200_000) },
        ];
        if (!cancelled) setRecentBets(mock);
      } catch (err) {
        console.error('Erè chajman dènye paris:', err);
      } finally {
        if (!cancelled) setBetsLoading(false);
      }
    };
    fetchRecentBets();
    return () => { cancelled = true; };
  }, [market?.id]);

  useMarketRealtime(market?.id || '', (data) => {
    if (market) setMarket({ ...market, ...data });
  });

  const amtNum = useMemo(() => parseFloat(amount) || 0, [amount]);

  const yesOdds = useMemo(
    () => (market ? parseFloat((1 / Math.max(0.01, market.yes_prob)).toFixed(2)) : 2.0),
    [market],
  );
  const noOdds = useMemo(
    () => (market ? parseFloat((1 / Math.max(0.01, market.no_prob)).toFixed(2)) : 2.0),
    [market],
  );
  const curOdds = option === 'yes' ? yesOdds : noOdds;

  const potential = useMemo(
    () => parseFloat((amtNum * curOdds).toFixed(2)),
    [amtNum, curOdds],
  );

  const catColor = useMemo(
    () => (market ? (CAT_COLOR[market.category] || '#8b949e') : '#8b949e'),
    [market],
  );

  const yp = useMemo(() => (market ? Math.round(market.yes_prob * 100) : 50), [market]);
  const np = 100 - yp;
  const isClosed = useMemo(() => (market ? market.status !== 'active' : true), [market]);

  const doPlaceBet = useCallback(async () => {
    if (!market || !user) return;
    setBusy(true);
    try {
      const res = await marketsAPI.placeBet(market.id, option, amtNum);
      const { new_balance, market: updated } = res.data;

      updateBalance(new_balance ?? (user.balance - amtNum));
      if (updated) setMarket(updated);

      const newBet: RecentBet = {
        id: Date.now().toString(),
        author: user.username || 'Ou',
        amount: amtNum,
        option,
        odds: curOdds,
        createdAt: new Date(),
      };
      setRecentBets((prev) => [newBet, ...prev].slice(0, 10));

      setAmount('');
      setShowConfirm(false);
      toast.success(
        `✓ Pari ${option === 'yes' ? 'Wi' : 'Non'} — ${amtNum.toLocaleString()} HTG`,
        { duration: 4000 },
      );
    } catch (e: any) {
      setShowConfirm(false);
      toast.error(e.response?.data?.detail || 'Erè pari. Eseye ankò.');
    } finally {
      setBusy(false);
    }
  }, [market, user, option, amtNum, updateBalance, setMarket, curOdds]);

  const handleBetClick = useCallback(() => {
    if (!user) {
      navigate(path('login'), { state: { from: location.pathname } });
      return;
    }
    if (!market) return;
    if (!amtNum || amtNum < (market.min_bet || 50)) {
      toast.error(`Min: ${market.min_bet || 50} HTG`);
      return;
    }
    if (amtNum > (market.max_bet || 100_000)) {
      toast.error(`Max: ${market.max_bet} HTG`);
      return;
    }
    if (amtNum > user.balance) {
      toast.error('Balans ensifizan');
      return;
    }
    setShowConfirm(true);
  }, [user, market, amtNum, navigate, path, location.pathname]);

  const toggleFavorite = useCallback(() => {
    setIsFavorite((prev) => !prev);
    toast.success(isFavorite ? 'Retire nan favori' : 'Ajoute nan favori ❤️');
  }, [isFavorite]);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = market
    ? `${market.title} — Wi: ${yp}% | Non: ${np}% | AyitiMarket`
    : '';

  const handleCopyLink = useCallback(() => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Lyen kopye!');
    });
  }, [shareUrl]);

  const handleTwitter = useCallback(
    () =>
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
        '_blank',
      ),
    [shareText, shareUrl],
  );

  const handleWhatsApp = useCallback(
    () =>
      window.open(
        `https://wa.me/?text=${encodeURIComponent(shareText + '\n' + shareUrl)}`,
        '_blank',
      ),
    [shareText, shareUrl],
  );

  /* ─── États de chargement / erreur ─────────────────────────────────────── */

  if (loading) {
    return (
      <div className="container py-5 px-4">
        <div className="flex flex-col gap-3">
          <div className="skel" style={{ height: 32, width: '60%', borderRadius: 8 }} />
          <div className="skel" style={{ height: 180, borderRadius: 12 }} />
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
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
        <div
          className="rounded-2xl text-center p-8 sm:p-10"
          style={{ background: '#161b22', border: '1px solid rgba(248,81,73,0.2)' }}
        >
          <AlertCircle
            style={{ width: 48, height: 48, color: '#f85149', margin: '0 auto 16px', display: 'block' }}
          />
          <h2 className="text-white mb-2 text-lg sm:text-xl font-bold">Machè pa jwenn</h2>
          <p className="text-sm mb-6" style={{ color: '#8b949e' }}>
            Slug: <code style={{ color: '#d29922' }}>{slug}</code>
          </p>
          <div className="flex gap-2.5 justify-center flex-wrap">
            <button type="button" onClick={() => navigate(-1)} className="btn-ghost">
              ← Retounen
            </button>
            <Link to={path('markets')} className="btn-primary">
              Wè tout machè
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Rendu principal ──────────────────────────────────────────────────── */

  return (
    <div className="container fade-in py-4 sm:py-6 md:py-10 px-3 sm:px-4 md:px-6">
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

      {/* Action bar glass */}
      <ActionBar
        isFavorite={isFavorite}
        onToggleFavorite={toggleFavorite}
        onWhatsApp={handleWhatsApp}
        onTwitter={handleTwitter}
        onCopyLink={handleCopyLink}
        copied={copied}
        onBack={() => navigate(-1)}
      />

      {/* Hero / Image */}
      {market.image_url ? (
        <div className="rounded-2xl overflow-hidden mb-5 sm:mb-6 aspect-[16/7] sm:aspect-[16/5] md:aspect-[16/4.5]">
          <img
            src={market.image_url}
            alt={market.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div
          className="rounded-2xl mb-5 sm:mb-6 h-24 sm:h-28 md:h-32 flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg,${catColor}15,${catColor}08)`,
            border: `1px solid ${catColor}25`,
          }}
        >
          <TrendingUp size={42} style={{ color: catColor, opacity: 0.45 }} />
        </div>
      )}

      {/* Badge fermé */}
      {isClosed && (
        <div
          className="rounded-xl p-3 sm:p-4 mb-5 sm:mb-6 flex items-center gap-3 text-sm"
          style={{
            background: 'rgba(248,81,73,0.1)',
            border: '1px solid rgba(248,81,73,0.3)',
          }}
        >
          <span className="bg-red-500 text-white px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide">
            FÈMEN
          </span>
          <span style={{ color: '#8b949e' }}>
            {market.status === 'resolved'
              ? `Rezoud: ${market.resolution?.toUpperCase?.() || ''}`
              : 'Machè sa a fèmen pou pari'}
          </span>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 lg:gap-8">
        {/* Colonne principale */}
        <div className="lg:col-span-8 space-y-5 sm:space-y-6">
          {/* Catégorie + titre */}
          <div>
            <span
              className="inline-block rounded-full uppercase font-bold"
              style={{
                padding: '3px 10px',
                fontSize: 11,
                background: `${catColor}18`,
                color: catColor,
                border: `1px solid ${catColor}30`,
                letterSpacing: '0.08em',
              }}
            >
              {market.category}
            </span>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight mt-3 sm:mt-4 text-white tracking-tight">
              {market.title}
            </h1>
          </div>

          {/* Meta: countdown + volume */}
          <div className="flex flex-wrap gap-x-3 gap-y-2.5 text-sm items-center" style={{ color: '#8b949e' }}>
            <CountdownDisplay endDate={market.end_date} />
            <div className="flex items-center gap-1.5">
              <TrendingUp size={15} />
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                {market.total_volume.toLocaleString()} HTG
              </span>
            </div>
          </div>

          {market.description && (
            <p className="text-[14px] sm:text-[15px] leading-relaxed" style={{ color: '#8b949e' }}>
              {market.description}
            </p>
          )}

          {/* Carte probabilités */}
          <div
            className="rounded-2xl p-5 sm:p-6"
            style={{
              background: 'linear-gradient(180deg, rgba(22,27,34,0.96), rgba(22,27,34,0.88))',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }}
          >
            <div className="flex justify-between mb-3 text-[15px] sm:text-base font-bold">
              <span style={{ color: '#3fb950' }}>Wi {yp}%</span>
              <span style={{ color: '#f85149' }}>Non {np}%</span>
            </div>
            <div
              className="h-3 rounded-full overflow-hidden"
              style={{ background: 'rgba(248,81,73,0.22)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${yp}%`,
                  background: 'linear-gradient(90deg,#2ea043 0%,#3fb950 50%,#56d364 100%)',
                  boxShadow: '0 0 12px rgba(63,185,80,0.35)',
                }}
              />
            </div>
            <div className="flex justify-between mt-4 text-[13px] sm:text-sm" style={{ color: '#8b949e' }}>
              <span>
                Cote:{' '}
                <strong className="text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {yesOdds.toFixed(2)}×
                </strong>
              </span>
              <span>
                Cote:{' '}
                <strong className="text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {noOdds.toFixed(2)}×
                </strong>
              </span>
            </div>
          </div>

          <PriceChart marketId={market.id} />

          {/* BetPanel mobile (caché sur lg+) */}
          <div className="lg:hidden">
            <BetPanel
              market={market}
              user={user}
              option={option}
              setOption={setOption}
              amount={amount}
              setAmount={setAmount}
              amtNum={amtNum}
              yesOdds={yesOdds}
              noOdds={noOdds}
              potential={potential}
              isClosed={isClosed}
              onBet={handleBetClick}
              loginPath={path('login')}
              fromPath={location.pathname}
            />
          </div>

          <RecentBetsSection bets={recentBets} loading={betsLoading} />
          <CommentsSection marketId={market.id} user={user} />
        </div>

        {/* Colonne latérale — sticky desktop */}
        <aside className="lg:col-span-4 hidden lg:block">
          <BetPanel
            market={market}
            user={user}
            option={option}
            setOption={setOption}
            amount={amount}
            setAmount={setAmount}
            amtNum={amtNum}
            yesOdds={yesOdds}
            noOdds={noOdds}
            potential={potential}
            isClosed={isClosed}
            onBet={handleBetClick}
            loginPath={path('login')}
            fromPath={location.pathname}
            sticky
          />
        </aside>
      </div>
    </div>
  );
}