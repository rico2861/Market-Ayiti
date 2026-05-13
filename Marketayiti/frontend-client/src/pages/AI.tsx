import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Zap, Brain, Target,
  BarChart2, AlertCircle, Star,
} from 'lucide-react';
import { marketsAPI } from '../api/marketsAPI';
import type { Market } from '../types';

/* ── helpers ──────────────────────────────────────────────────────────────── */

function fmtHTG(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return Math.floor(n).toLocaleString();
}

function fmtPct(p: number) {
  return `${Math.round(p * 100)}%`;
}

type Sentiment = 'Bullish' | 'Bearish' | 'Neutral';
type Risk = 'Low' | 'Medium' | 'High';
type Recommendation = 'BUY YES' | 'BUY NO' | 'WAIT';

interface AIInsight {
  market: Market;
  sentiment: Sentiment;
  sentimentColor: string;
  confidence: number;   // 0-100
  risk: Risk;
  riskColor: string;
  recommendation: Recommendation;
  recColor: string;
  expectedReturn: number; // pct
}

function computeInsight(m: Market): AIInsight {
  const p = m.yes_prob ?? 0.5;
  const vol = (m as any).local_volume ?? 0;

  // Sentiment
  let sentiment: Sentiment;
  let sentimentColor: string;
  if (p > 0.55) { sentiment = 'Bullish'; sentimentColor = '#3fb950'; }
  else if (p < 0.45) { sentiment = 'Bearish'; sentimentColor = '#f85149'; }
  else { sentiment = 'Neutral'; sentimentColor = '#d29922'; }

  // Confidence: how far from 50/50 (0–100)
  const confidence = Math.round(Math.abs(p - 0.5) * 200);

  // Risk: high volume + extreme probability = Low risk (more liquid, clearer signal)
  let risk: Risk;
  let riskColor: string;
  if (confidence >= 40 && vol >= 10_000) { risk = 'Low'; riskColor = '#3fb950'; }
  else if (confidence >= 20 || vol >= 5_000) { risk = 'Medium'; riskColor = '#d29922'; }
  else { risk = 'High'; riskColor = '#f85149'; }

  // Recommendation
  let recommendation: Recommendation;
  let recColor: string;
  if (p >= 0.62) { recommendation = 'BUY YES'; recColor = '#3fb950'; }
  else if (p <= 0.38) { recommendation = 'BUY NO'; recColor = '#f85149'; }
  else { recommendation = 'WAIT'; recColor = '#8b949e'; }

  // Expected return — simple Kelly-adjacent estimate (implied edge)
  const edge = Math.abs(p - 0.5) * 2;           // 0 to 1
  const expectedReturn = Math.round(edge * 60);  // cap at ~60%

  return { market: m, sentiment, sentimentColor, confidence, risk, riskColor, recommendation, recColor, expectedReturn };
}

/* ── sub-components ───────────────────────────────────────────────────────── */

const CAT_COLOR: Record<string, string> = {
  politik: '#a371f7', spo: '#3fb950', ekonomi: '#d29922',
  kilti: '#f97316', sosyal: '#58a6ff', lot: '#8b949e', nouvo: '#f85149',
};

function SentimentGauge({ prob, color }: { prob: number; color: string }) {
  const pct = Math.round(prob * 100);
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: '#8b949e' }}>NON</span>
        <span style={{ fontSize: 10, fontWeight: 700, color }}>OUI {pct}%</span>
      </div>
      <div style={{
        height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 3,
          background: `linear-gradient(90deg, rgba(248,81,73,0.6) 0%, ${color} 100%)`,
          transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  );
}

function ConfidenceArc({ value }: { value: number }) {
  // value 0-100
  const color = value >= 60 ? '#3fb950' : value >= 30 ? '#d29922' : '#8b949e';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        border: `3px solid rgba(255,255,255,0.06)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
        background: `conic-gradient(${color} ${value * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', background: '#161b22',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace',
        }}>
          {value}
        </div>
      </div>
      <span style={{ fontSize: 9, color: '#484f58', letterSpacing: '.04em' }}>CONFIANCE</span>
    </div>
  );
}

function InsightCard({ insight, index }: { insight: AIInsight; index: number }) {
  const m = insight.market;
  const catColor = CAT_COLOR[m.category] ?? '#8b949e';
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#161b22',
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 14,
        padding: 18,
        display: 'flex', flexDirection: 'column', gap: 14,
        transition: 'all 0.25s',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 8px 32px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        animation: `fadeInUp 0.5s ease-out ${index * 0.06}s both`,
      }}
    >
      {/* Category + title */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{
            fontSize: 10, fontWeight: 600, color: catColor,
            background: `${catColor}18`, borderRadius: 4, padding: '2px 7px',
            textTransform: 'uppercase', letterSpacing: '.05em',
          }}>
            {m.category}
          </span>
          <span style={{ fontSize: 10, color: '#484f58', marginLeft: 'auto' }}>
            {m.bet_count} paris
          </span>
        </div>
        <Link
          to={`/ht/market/${m.category}/${m.slug}`}
          style={{ textDecoration: 'none' }}
        >
          <h3 style={{
            margin: 0, fontSize: 13, fontWeight: 600, color: 'white', lineHeight: 1.4,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {m.title}
          </h3>
        </Link>
      </div>

      {/* Sentiment gauge */}
      <SentimentGauge prob={m.yes_prob} color={insight.sentimentColor} />

      {/* Metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
        {/* Left: sentiment + risk */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Sentiment */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {insight.sentiment === 'Bullish'
              ? <TrendingUp size={13} color={insight.sentimentColor} />
              : insight.sentiment === 'Bearish'
              ? <TrendingDown size={13} color={insight.sentimentColor} />
              : <BarChart2 size={13} color={insight.sentimentColor} />}
            <span style={{ fontSize: 12, fontWeight: 600, color: insight.sentimentColor }}>
              {insight.sentiment}
            </span>
          </div>

          {/* Risk */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={13} color={insight.riskColor} />
            <span style={{ fontSize: 11, color: '#8b949e' }}>Risque :</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: insight.riskColor }}>
              {insight.risk === 'Low' ? 'Faible' : insight.risk === 'Medium' ? 'Moyen' : 'Élevé'}
            </span>
          </div>

          {/* Volume */}
          <div style={{ fontSize: 11, color: '#484f58' }}>
            Vol. <span style={{ color: '#8b949e', fontFamily: 'JetBrains Mono, monospace' }}>
              {fmtHTG((m as any).local_volume ?? 0)} HTG
            </span>
          </div>
        </div>

        {/* Right: confidence arc */}
        <ConfidenceArc value={insight.confidence} />
      </div>

      {/* Footer: recommendation + expected return */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: insight.recColor,
          background: `${insight.recColor}18`, borderRadius: 5,
          padding: '3px 8px', letterSpacing: '.04em',
        }}>
          {insight.recommendation}
        </span>
        <span style={{ fontSize: 11, color: '#8b949e' }}>
          Retour estimé :{' '}
          <span style={{
            fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
            color: insight.expectedReturn > 0 ? '#3fb950' : '#8b949e',
          }}>
            +{insight.expectedReturn}%
          </span>
        </span>
      </div>
    </div>
  );
}

/* ── mini market row (for trending / high-confidence sections) ─────────────── */
function MarketRow({ m, rank }: { m: Market; rank?: number }) {
  const p = Math.round((m.yes_prob ?? 0.5) * 100);
  const catColor = CAT_COLOR[m.category] ?? '#8b949e';
  const [hov, setHov] = useState(false);
  return (
    <Link to={`/ht/market/${m.category}/${m.slug}`} style={{ textDecoration: 'none' }}>
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 14px', borderRadius: 10,
          background: hov ? 'rgba(255,255,255,0.04)' : 'transparent',
          transition: 'background 0.2s',
        }}
      >
        {rank !== undefined && (
          <span style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
            background: rank < 3 ? 'rgba(63,185,80,0.15)' : 'rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 800,
            color: rank < 3 ? '#3fb950' : '#484f58',
          }}>
            {rank + 1}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: 500, color: 'white',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {m.title}
          </div>
          <div style={{ fontSize: 10, color: '#484f58', marginTop: 2 }}>
            <span style={{ color: catColor }}>{m.category}</span>
            {' · '}
            {fmtHTG((m as any).local_volume ?? 0)} HTG
          </div>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{
            fontSize: 13, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace',
            color: p >= 55 ? '#3fb950' : p <= 45 ? '#f85149' : '#d29922',
          }}>
            {p}%
          </div>
          <div style={{ fontSize: 9, color: '#484f58' }}>OUI</div>
        </div>
      </div>
    </Link>
  );
}

/* ── skeleton ─────────────────────────────────────────────────────────────── */
function CardSkeleton() {
  return (
    <div style={{
      background: '#161b22', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {[18, 12, 8, 8, 14].map((h, i) => (
        <div key={i} className="skel" style={{ height: h, borderRadius: 4 }} />
      ))}
    </div>
  );
}

/* ── main page ────────────────────────────────────────────────────────────── */
export default function AI() {
  const [markets, setMarkets]   = useState<Market[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);

  useEffect(() => {
    setLoading(true);
    marketsAPI.list({ status: 'active', limit: 50 })
      .then(r => { setMarkets(r.data); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const insights = useMemo<AIInsight[]>(
    () => markets.map(computeInsight),
    [markets],
  );

  const trending = useMemo(
    () => [...markets].sort((a, b) => ((b as any).local_volume ?? 0) - ((a as any).local_volume ?? 0)).slice(0, 8),
    [markets],
  );

  const highConfidence = useMemo(
    () => markets.filter(m => m.yes_prob > 0.70 || m.yes_prob < 0.30)
      .sort((a, b) => Math.abs(b.yes_prob - 0.5) - Math.abs(a.yes_prob - 0.5))
      .slice(0, 8),
    [markets],
  );

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 16px', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div style={{
        marginBottom: 36,
        background: 'linear-gradient(135deg, rgba(63,185,80,0.06) 0%, rgba(88,166,255,0.04) 100%)',
        border: '1px solid rgba(63,185,80,0.12)',
        borderRadius: 18, padding: '28px 32px',
        animation: 'fadeInDown 0.6s ease-out',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, flexShrink: 0,
            background: 'linear-gradient(135deg, #3fb950 0%, #58a6ff 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(63,185,80,0.3)',
          }}>
            <Brain size={26} color="white" strokeWidth={2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: 'white', letterSpacing: '-0.03em' }}>
                AyitiMarket <span style={{ color: '#3fb950' }}>AI</span>
              </h1>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                background: 'rgba(63,185,80,0.15)', color: '#3fb950', border: '1px solid rgba(63,185,80,0.25)',
                letterSpacing: '.06em',
              }}>
                BETA
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#8b949e' }}>
              Analiz entèlijan pou mache predisyon — {markets.length} mache aktif analize
            </p>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.2)',
            borderRadius: 8, padding: '6px 12px',
          }}>
            <AlertCircle size={12} color="#f85149" />
            <span style={{ fontSize: 11, color: '#f85149' }}>
              Analiz otomatik — pa konsèy finansye
            </span>
          </div>
        </div>
      </div>

      {/* ── Error state ─────────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.2)',
          borderRadius: 12, padding: '20px 24px', marginBottom: 32,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <AlertCircle size={18} color="#f85149" />
          <span style={{ fontSize: 13, color: '#f85149' }}>
            Impossible de charger les données de marchés. Vérifie ta connexion.
          </span>
        </div>
      )}

      {/* ── Two-column layout ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 24, alignItems: 'start' }}>

        {/* LEFT: AI insight cards */}
        <div>
          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Zap size={15} color="#3fb950" />
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'white' }}>
              Analiz AI — Tout mache
            </h2>
            {!loading && (
              <span style={{ fontSize: 12, color: '#484f58', marginLeft: 4 }}>
                {insights.length} mache
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {loading
              ? Array.from({ length: 9 }).map((_, i) => <CardSkeleton key={i} />)
              : insights.length === 0
              ? (
                <div style={{
                  gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px',
                  color: '#484f58', fontSize: 14,
                }}>
                  Okenn mache aktif pou kounye-a.
                </div>
              )
              : insights.map((ins, i) => <InsightCard key={ins.market.id} insight={ins} index={i} />)
            }
          </div>
        </div>

        {/* RIGHT: sidebar panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 80 }}>

          {/* Trending markets */}
          <div style={{
            background: '#161b22', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14, overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <TrendingUp size={14} color="#58a6ff" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Trending</span>
              <span style={{ fontSize: 11, color: '#484f58', marginLeft: 'auto' }}>pa volim</span>
            </div>
            <div style={{ padding: '6px 4px' }}>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ padding: '10px 14px' }}>
                    <div className="skel" style={{ height: 12, borderRadius: 4, marginBottom: 4 }} />
                    <div className="skel" style={{ height: 9, width: '60%', borderRadius: 4 }} />
                  </div>
                ))
                : trending.map((m, i) => <MarketRow key={m.id} m={m} rank={i} />)
              }
            </div>
          </div>

          {/* High confidence */}
          <div style={{
            background: '#161b22', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14, overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Star size={14} color="#d29922" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Konfyans Wo</span>
              <span style={{ fontSize: 11, color: '#484f58', marginLeft: 'auto' }}>prob &gt;70% / &lt;30%</span>
            </div>
            <div style={{ padding: '6px 4px' }}>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ padding: '10px 14px' }}>
                    <div className="skel" style={{ height: 12, borderRadius: 4, marginBottom: 4 }} />
                    <div className="skel" style={{ height: 9, width: '55%', borderRadius: 4 }} />
                  </div>
                ))
                : highConfidence.length === 0
                ? <div style={{ padding: '16px 14px', fontSize: 12, color: '#484f58' }}>
                    Pa gen mache avèk gwo konfyans kounye-a.
                  </div>
                : highConfidence.map(m => <MarketRow key={m.id} m={m} />)
              }
            </div>
          </div>

          {/* Methodology card */}
          <div style={{
            background: 'rgba(88,166,255,0.04)', border: '1px solid rgba(88,166,255,0.12)',
            borderRadius: 14, padding: '16px 18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <Target size={13} color="#58a6ff" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#58a6ff' }}>Metodoloji</span>
            </div>
            {[
              ['Santiman', 'Baze sou prob wi/non'],
              ['Konfyans', 'Distans absolì depi 50/50'],
              ['Risk', 'Volim + ekstrèmite'],
              ['Retou', 'Estimasyon edge implicite'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#8b949e' }}>{k}</span>
                <span style={{ fontSize: 11, color: '#484f58', textAlign: 'right', maxWidth: 140 }}>{v}</span>
              </div>
            ))}
            <div style={{
              marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)',
              fontSize: 10, color: '#484f58', lineHeight: 1.5,
            }}>
              Modèl sa a itilize done mache an tan reyèl. Li pa garanti rezilta epi li pa
              konsèy finansye pwofesyonèl.
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .skel {
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 4px;
        }
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (max-width: 900px) {
          .ai-layout { grid-template-columns: 1fr !important; }
          .ai-sidebar { position: static !important; }
        }
      `}</style>
    </div>
  );
}
