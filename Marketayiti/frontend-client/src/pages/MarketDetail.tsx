import { useState, useEffect, useMemo, useCallback, memo, ReactNode } from 'react';
import { useParams, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Clock, TrendingUp, AlertCircle, Share2,
  Twitter, CheckCircle, X, Heart, MessageSquare, Send, Zap,
} from 'lucide-react';
import { showToast } from '../utils/toast';
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

const QUICK_AMOUNTS = [25, 100, 250, 500, 1000] as const;

/* ──────────────────────────────────────────────────────────────────────────── */
/* Types locaux                                                                 */
/* ──────────────────────────────────────────────────────────────────────────── */

interface Comment {
  id: string;
  author: string;
  user_id: string;
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
  optionLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}

const BetConfirmModal = memo(function BetConfirmModal({
  option, amount, odds, potential, marketTitle, optionLabel, onConfirm, onCancel, busy,
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
            {isYes ? '✓' : '✗'} {optionLabel} — {odds.toFixed(2)}×
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
  market?: any;
}

function RecentBetsSection({ bets, loading, market }: RecentBetsSectionProps) {
  const labelYes = market?.option_a || 'Wi';
  const labelNo  = market?.option_b || 'Non';
  const allSorted = useMemo(() => [...bets].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 10), [bets]);
  const totalYes = useMemo(() => bets.filter(b => b.option === 'yes').reduce((s, b) => s + b.amount, 0), [bets]);
  const totalNo  = useMemo(() => bets.filter(b => b.option === 'no').reduce((s, b) => s + b.amount, 0), [bets]);

  return (
    <div
      className="rounded-2xl p-4 sm:p-5"
      style={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white text-[13px] sm:text-[14px] font-bold flex items-center gap-1.5 tracking-tight">
          <Zap size={15} style={{ color: '#f97316' }} />
          Dènye Paris
        </h3>
        <span className="text-[11px] font-semibold" style={{ color: '#484f58' }}>
          {bets.length} total
        </span>
      </div>

      {/* Proportion bar (no amounts shown) */}
      {(totalYes > 0 || totalNo > 0) && (
        <div className="mb-4">
          <div className="flex justify-between text-[11px] mb-1.5" style={{ color: '#8b949e' }}>
            <span style={{ color: '#3fb950', fontWeight: 600 }}>{labelYes} · {Math.round((totalYes / (totalYes + totalNo)) * 100)}%</span>
            <span style={{ color: '#f85149', fontWeight: 600 }}>{Math.round((totalNo / (totalYes + totalNo)) * 100)}% · {labelNo}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(248,81,73,0.25)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${totalYes + totalNo > 0 ? Math.round((totalYes / (totalYes + totalNo)) * 100) : 50}%`,
                background: 'linear-gradient(90deg,#2ea043,#3fb950)',
              }}
            />
          </div>
        </div>
      )}

      {/* Bet list */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-9 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      ) : allSorted.length === 0 ? (
        <div className="text-center py-6" style={{ color: '#484f58', fontSize: 13 }}>
          Poko gen pari sou mache sa a
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {allSorted.map((bet, idx) => {
            const isYes = bet.option === 'yes';
            const color = isYes ? '#3fb950' : '#f85149';
            const label = isYes ? labelYes : labelNo;
            return (
              <div
                key={bet.id}
                className="flex items-center justify-between rounded-xl px-3 py-2.5"
                style={{
                  background: isYes ? 'rgba(63,185,80,0.04)' : 'rgba(248,81,73,0.04)',
                  border: `1px solid ${isYes ? 'rgba(63,185,80,0.10)' : 'rgba(248,81,73,0.10)'}`,
                  animation: 'slideInBet 0.3s ease forwards',
                  animationDelay: `${idx * 40}ms`,
                  opacity: 0,
                }}
              >
                {/* Left: avatar + username */}
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ width: 24, height: 24, background: `${color}20`, color, border: `1px solid ${color}30` }}
                  >
                    {bet.author[0]?.toUpperCase()}
                  </div>
                  <span className="text-[12px] font-medium truncate" style={{ color: '#c9d1d9' }}>
                    {bet.author}
                  </span>
                </div>

                {/* Right: option badge + amount + time */}
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: `${color}18`, color, border: `1px solid ${color}28` }}
                  >
                    {label}
                  </span>
                  <span
                    className="text-[12px] font-bold"
                    style={{ color, fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    {bet.amount >= 1000
                      ? `${(bet.amount / 1000).toFixed(bet.amount % 1000 === 0 ? 0 : 1)}K`
                      : bet.amount.toLocaleString()}
                  </span>
                  <span className="text-[10px]" style={{ color: '#484f58', minWidth: 28, textAlign: 'right' }}>
                    {relativeTime(bet.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
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
  const { path } = useLocale();

  const loadComments = useCallback(async () => {
    try {
      setLoadingComments(true);
      const res = await marketsAPI.getComments(marketId);
      setComments(res.data.map((c) => ({
        id: c.id,
        author: c.username,
        user_id: c.user_id,
        text: c.text,
        createdAt: new Date(c.created_at),
      })));
    } catch {
      // keep empty
    } finally {
      setLoadingComments(false);
    }
  }, [marketId]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const handleSubmit = useCallback(async () => {
    if (!newComment.trim() || !user) return;
    setSubmitting(true);
    try {
      const res = await marketsAPI.addComment(marketId, newComment.trim());
      const c = res.data;
      setComments((prev) => [{
        id: c.id, author: c.username, user_id: c.user_id,
        text: c.text, createdAt: new Date(c.created_at),
      }, ...prev]);
      setNewComment('');
      showToast.success('Kòmantè ajoute!');
    } catch {
      showToast.error('Erè — eseye ankò');
    } finally {
      setSubmitting(false);
    }
  }, [newComment, user, marketId]);

  const handleDelete = useCallback(async (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    try {
      await marketsAPI.deleteComment(marketId, commentId);
    } catch {
      showToast.error('Erè sipriman');
      loadComments();
    }
  }, [marketId, loadComments]);

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
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(); }}
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
            >
              {submitting ? '…' : <Send size={15} />}
            </button>
          </div>
          <p className="text-[11px] mt-1.5" style={{ color: '#484f58' }}>Ctrl+Enter pou voye</p>
        </div>
      ) : (
        <div
          className="rounded-xl px-3.5 py-3 mb-4 text-[13px] text-center"
          style={{ background: 'rgba(255,255,255,0.03)', color: '#8b949e' }}
        >
          <Link to={path('login')} style={{ color: '#58a6ff', textDecoration: 'none' }}>Konekte</Link>
          {' '}pou ajoute kòmantè
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {loadingComments ? (
          <div className="text-[12px] text-center py-5" style={{ color: '#8b949e' }}>Chajman…</div>
        ) : comments.length === 0 ? (
          <div className="text-[12px] text-center py-5" style={{ color: '#8b949e' }}>Poko gen kòmantè</div>
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
                <div className="flex items-center gap-2">
                  <span style={{ color: '#484f58' }}>{relativeTime(comment.createdAt)}</span>
                  {user && comment.user_id === user.id && (
                    <button
                      type="button"
                      onClick={() => handleDelete(comment.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#484f58', padding: '0 2px', lineHeight: 1 }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#f85149')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#484f58')}
                      title="Efase kòmantè"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[13px] m-0 leading-snug" style={{ color: '#c9d1d9' }}>{comment.text}</p>
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

const BONUS_MAX_ODDS = 3.0;

function BetPanel({
  market, user, option, setOption, amount, setAmount,
  amtNum, yesOdds, noOdds, potential, isClosed,
  onBet, loginPath, fromPath, sticky,
}: BetPanelProps) {
  const minBet = market.min_bet || 25;

  const realBalance  = user?.balance ?? 0;
  const bonusBalance = user?.bonus_balance ?? 0;
  // Bonus mode: real balance insufficient but bonus covers the amount
  // Also activate when user has 0 real balance at all (even before typing amount)
  const onlyHasBonus = user != null && realBalance < minBet && bonusBalance >= minBet;
  const useBonus     = user != null && amtNum > 0 && realBalance < amtNum && bonusBalance >= amtNum;
  const hasAnyFunds  = amtNum === 0 || realBalance >= amtNum || bonusBalance >= amtNum;
  const curOdds      = option === 'yes' ? yesOdds : noOdds;
  const bonusOddsViolation = useBonus && curOdds > BONUS_MAX_ODDS;

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <span className="font-bold text-lg sm:text-xl text-white tracking-tight">
          {isClosed ? 'Machè Fèmen' : 'Fè Pari'}
        </span>
        {user && !isClosed && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <span style={{ fontSize: 11, color: '#3fb950', fontFamily: 'JetBrains Mono,monospace', fontWeight: 600 }}>
              {Math.floor(realBalance).toLocaleString()} HTG
            </span>
            {bonusBalance > 0 && (
              <span style={{ fontSize: 10, color: '#c084fc', fontFamily: 'JetBrains Mono,monospace', fontWeight: 600 }}>
                +{Math.floor(bonusBalance)} Bonus
              </span>
            )}
          </div>
        )}
      </div>

      {isClosed ? (
        <div className="text-center py-10 sm:py-12" style={{ color: '#8b949e' }}>
          {market.status === 'resolved'
            ? `✓ Rezoud: ${market.resolution === 'yes' ? (market.option_a || 'Wi') : (market.option_b || 'Non')}`
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
                  <span>{isYes ? (market.option_a || 'Wi') : (market.option_b || 'Non')}</span>
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
                  onClick={() => setAmount(String(realBalance > 0 ? realBalance : bonusBalance))}
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

          {/* Bonus available hint (when user has only bonus funds) */}
          {user && onlyHasBonus && !useBonus && (
            <div style={{
              marginBottom: 12, padding: '10px 14px', borderRadius: 12,
              background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)',
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#c084fc',
            }}>
              <span style={{ fontSize: 14 }}>💜</span>
              <span>
                Ou gen <strong style={{ fontFamily: 'JetBrains Mono,monospace' }}>{Math.floor(bonusBalance).toLocaleString()} HTG</strong> bonus.
                Antre yon montan pou pari — sèlman sou koòf ≤ {BONUS_MAX_ODDS}×
              </span>
            </div>
          )}

          {/* Active bonus mode banner */}
          {user && useBonus && !bonusOddsViolation && (
            <div style={{
              marginBottom: 12, padding: '10px 14px', borderRadius: 12,
              background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)',
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#c084fc',
            }}>
              <span>Pari Bonus — {amtNum.toLocaleString()} HTG sou bonus ou. Koòf aktyèl: <strong>{curOdds.toFixed(2)}×</strong> ✓</span>
            </div>
          )}

          {/* Bonus odds violation warning */}
          {bonusOddsViolation && (
            <div style={{
              marginBottom: 12, padding: '12px 14px', borderRadius: 12,
              background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)',
              fontSize: 12, color: '#f85149', lineHeight: 1.5,
            }}>
              <strong>Koòf twò wo pou bonus.</strong> Koòf aktyèl: <strong>{curOdds.toFixed(2)}×</strong> — maksimòm {BONUS_MAX_ODDS}×.<br/>
              Chwazi lòt opsyon (Wi/Non) oswa yon mache avèk plis chans.
            </div>
          )}

          {/* CTA */}
          {user ? (
            <button
              type="button"
              onClick={onBet}
              disabled={!amtNum || amtNum < minBet || !hasAnyFunds || bonusOddsViolation}
              className="md-bet-btn w-full rounded-2xl py-4 sm:py-5 font-bold text-base sm:text-lg disabled:opacity-50"
              style={{
                background: useBonus ? '#a855f7' : '#3fb950',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                boxShadow: useBonus ? '0 4px 20px rgba(168,85,247,0.3)' : '0 4px 20px rgba(63,185,80,0.3)',
                transition: 'background 0.2s',
              }}
            >
              Pari {option === 'yes' ? (market.option_a || 'Wi') : (market.option_b || 'Non')} →
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { path } = useLocale();
  const { user, updateBalance, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { market, loading, error, setMarket } = useMarket(slug || '');
  const [recentBets, setRecentBets] = useState<RecentBet[]>([]);
  const [betsLoading, setBetsLoading] = useState(true);

  // Tab system — URL-driven: ?tab=grafik | paris | komente
  type TabId = 'grafik' | 'paris' | 'komente';
  const TABS: { id: TabId; label: string; count?: number }[] = [
    { id: 'grafik',  label: 'Grafik pri' },
    { id: 'paris',   label: 'Pari resan' },
    { id: 'komente', label: 'Kòmantè' },
  ];
  const rawTab = searchParams.get('tab') as TabId | null;
  const activeTab: TabId = TABS.some(t => t.id === rawTab) ? rawTab! : 'grafik';

  function goTab(id: TabId) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', id);
      return next;
    }, { replace: true });
  }

  const [option, setOption] = useState<'yes' | 'no'>(
    () => (searchParams.get('option') === 'no' ? 'no' : 'yes'),
  );
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [imgError, setImgError] = useState(false);
  useEffect(() => { setImgError(false); }, [market?.image_url]);

  // Load favorite status from backend when market loads
  useEffect(() => {
    if (!market?.id || !user) return;
    marketsAPI.getFavoriteStatus(market.id)
      .then((r) => setIsFavorite(r.data.favorited))
      .catch(() => {});
  }, [market?.id, user]);

  /* Vrais paris depuis la DB */
  useEffect(() => {
    let cancelled = false;
    const fetchRecentBets = async () => {
      if (!market?.id) return;
      try {
        setBetsLoading(true);
        const res = await marketsAPI.getMarketBets(market.id, 20);
        if (!cancelled) {
          setRecentBets(res.data.map((b) => ({
            id: b.id,
            author: b.username,
            amount: b.amount,
            option: b.option as "yes" | "no",
            odds: b.odds_at_bet,
            createdAt: new Date(b.created_at),
          })));
        }
      } catch {
        if (!cancelled) setRecentBets([]);
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
      const { new_balance, new_bonus_balance, market: updated } = res.data;

      updateUser({
        balance:       new_balance       ?? user.balance,
        bonus_balance: new_bonus_balance ?? user.bonus_balance,
      });
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
      showToast.bet(amtNum, option === 'yes' ? 'YES' : 'NO', potential);
    } catch (e: any) {
      showToast.error('Pari echwe', e.response?.data?.detail || 'Erè pari. Eseye ankò.');
    } finally {
      setBusy(false);
    }
  }, [market, user, option, amtNum, updateUser, setMarket, curOdds]);

  const handleBetClick = useCallback(() => {
    if (!user) {
      navigate(path('login'), { state: { from: location.pathname } });
      return;
    }
    if (!market) return;
    if (!amtNum || amtNum < (market.min_bet || 25)) {
      showToast.warning('Montan twò piti', `Minimòm: ${market.min_bet || 25} HTG`);
      return;
    }
    if (amtNum > (market.max_bet || 100_000)) {
      showToast.warning('Montan twò gran', `Maksimòm: ${(market.max_bet || 100_000).toLocaleString()} HTG`);
      return;
    }
    const realBal  = user.balance ?? 0;
    const bonusBal = user.bonus_balance ?? 0;
    const willUseBonus = realBal < amtNum && bonusBal >= amtNum;
    if (realBal < amtNum && bonusBal < amtNum) {
      showToast.error('Balans ensifizan', 'Balans reyèl ak bonus ou pa ase pou pari sa a');
      return;
    }
    if (willUseBonus) {
      const curOdds = option === 'yes'
        ? parseFloat((1 / Math.max(0.01, market.yes_prob)).toFixed(2))
        : parseFloat((1 / Math.max(0.01, market.no_prob)).toFixed(2));
      if (curOdds > BONUS_MAX_ODDS) {
        showToast.warning('Koòf twò wo pou bonus', `Maks ${BONUS_MAX_ODDS}× ak bonus (aktyèl: ${curOdds.toFixed(2)}×)`);
        return;
      }
    }
    doPlaceBet();
  }, [user, market, amtNum, option, navigate, path, location.pathname, doPlaceBet]);

  const toggleFavorite = useCallback(async () => {
    if (!market?.id || !user) {
      showToast.info('Konekte dabò', 'Ou dwe konekte pou sove favori');
      return;
    }
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      await marketsAPI.toggleFavorite(market.id);
      showToast.success(next ? 'Ajoute nan favori' : 'Retire nan favori');
    } catch {
      setIsFavorite(!next);
      showToast.error('Erè — eseye ankò');
    }
  }, [isFavorite, market?.id, user]);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = market
    ? `${market.title} — Wi: ${yp}% | Non: ${np}% | AyitiMarket`
    : '';

  const handleCopyLink = useCallback(() => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast.success('Lyen kopye!');
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
      {market.image_url && !imgError ? (
        <div className="rounded-2xl overflow-hidden mb-5 sm:mb-6 aspect-[16/7] sm:aspect-[16/5] md:aspect-[16/4.5]">
          <img
            src={market.image_url}
            alt={market.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
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
              ? `Rezoud: ${market.resolution === 'yes' ? (market.option_a || 'Wi') : (market.option_b || 'Non')}`
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

          {/* Meta: countdown only */}
          <div className="flex flex-wrap gap-x-3 gap-y-2.5 text-sm items-center" style={{ color: '#8b949e' }}>
            <CountdownDisplay endDate={market.end_date} />
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
              <span style={{ color: '#3fb950' }}>{market.option_a || 'Wi'} {yp}%</span>
              <span style={{ color: '#f85149' }}>{market.option_b || 'Non'} {np}%</span>
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

          {/* ── Tabs navigation ─────────────────────────────────────── */}
          <div style={{
            display: 'flex', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.08)',
            paddingBottom: 0, marginBottom: -1,
          }}>
            {TABS.map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => goTab(tab.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '10px 16px', fontSize: 13, fontWeight: active ? 600 : 400,
                    color: active ? '#e6edf3' : '#8b949e',
                    borderBottom: active ? '2px solid #1f6feb' : '2px solid transparent',
                    marginBottom: -1, borderRadius: 0, transition: 'color .15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.id === 'paris' && (
                    <span style={{ marginRight: 6, opacity: 0.7 }}>⚡</span>
                  )}
                  {tab.id === 'grafik' && (
                    <span style={{ marginRight: 6, opacity: 0.7 }}>📈</span>
                  )}
                  {tab.id === 'komente' && (
                    <span style={{ marginRight: 6, opacity: 0.7 }}>💬</span>
                  )}
                  {tab.label}
                  {tab.id === 'paris' && recentBets.length > 0 && (
                    <span style={{
                      marginLeft: 6, background: 'rgba(56,139,253,0.15)', color: '#58a6ff',
                      borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 600,
                    }}>
                      {recentBets.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Tab panels ──────────────────────────────────────────── */}
          {activeTab === 'grafik' && <PriceChart marketId={market.id} />}

          {activeTab === 'paris' && (
            <RecentBetsSection bets={recentBets} loading={betsLoading} market={market} />
          )}

          {activeTab === 'komente' && (
            <CommentsSection marketId={market.id} user={user} />
          )}

          {/* BetPanel mobile (caché sur lg+) — toujours visible peu importe le tab */}
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