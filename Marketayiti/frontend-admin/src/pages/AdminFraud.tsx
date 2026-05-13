import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, AlertTriangle, RefreshCw, ChevronRight, TrendingUp,
  User, DollarSign, Zap, Eye, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { adminAPI } from '../api';
import AdminLayout from '../components/AdminLayout';

// ── Types ────────────────────────────────────────────────────────────────────

interface Tx {
  id: string; user_id: string; username: string;
  type: string; amount: number; status: string; created_at: string;
}

interface FraudAlert {
  id: string;
  level: 'critical' | 'high' | 'medium';
  category: 'high_volume_bet' | 'rapid_deposit_withdrawal' | 'excessive_activity' | 'large_single_bet';
  userId: string;
  username: string;
  title: string;
  detail: string;
  amount: number;
  score: number;  // 0-100 risk score
  detectedAt: string;
}

interface UserActivity {
  userId: string;
  username: string;
  txCount: number;
  totalVolume: number;
  depositTotal: number;
  withdrawalTotal: number;
  betTotal: number;
  maxSingleBet: number;
  hasRapidDW: boolean;  // deposit → withdrawal within 24h
  score: number;
}

function fmt(n: number) { return Math.floor(n).toLocaleString('fr-FR'); }

const THRESHOLDS = {
  HIGH_BET:        50_000,  // HTG — single bet flagged as large
  CRITICAL_BET:   200_000,  // HTG — critical large bet
  HIGH_VOLUME:    500_000,  // HTG — total user volume
  MAX_TX_COUNT:        15,  // too many transactions in the dataset
  RAPID_DW_HOURS:      24,  // deposit → withdrawal within 24h
};

// ── Fraud detection algorithm ────────────────────────────────────────────────

function detectFraud(txs: Tx[]): { alerts: FraudAlert[]; activities: UserActivity[] } {
  const byUser: Record<string, Tx[]> = {};
  txs.forEach(tx => {
    if (!byUser[tx.user_id]) byUser[tx.user_id] = [];
    byUser[tx.user_id].push(tx);
  });

  const alerts: FraudAlert[] = [];
  const activities: UserActivity[] = [];

  Object.entries(byUser).forEach(([userId, userTxs]) => {
    const username = userTxs[0]?.username || userId.slice(0, 10);
    const deposits     = userTxs.filter(t => t.type === 'deposit');
    const withdrawals  = userTxs.filter(t => t.type === 'withdrawal');
    const bets         = userTxs.filter(t => t.type === 'bet');
    const totalVolume  = userTxs.reduce((s, t) => s + t.amount, 0);
    const depositTotal = deposits.reduce((s, t) => s + t.amount, 0);
    const withdrawalTotal = withdrawals.reduce((s, t) => s + t.amount, 0);
    const betTotal     = bets.reduce((s, t) => s + t.amount, 0);
    const maxSingleBet = bets.length ? Math.max(...bets.map(t => t.amount)) : 0;

    let score = 0;

    // Check rapid deposit → withdrawal (within 24h)
    let hasRapidDW = false;
    deposits.forEach(dep => {
      const depTime = new Date(dep.created_at).getTime();
      withdrawals.forEach(wd => {
        const wdTime = new Date(wd.created_at).getTime();
        const diffH = (wdTime - depTime) / 3_600_000;
        if (diffH >= 0 && diffH < THRESHOLDS.RAPID_DW_HOURS) {
          hasRapidDW = true;
          score += 30;
          alerts.push({
            id: `rdw-${dep.id}-${wd.id}`,
            level: 'high',
            category: 'rapid_deposit_withdrawal',
            userId, username,
            title: 'Dépôt → Retrait rapide',
            detail: `Dépôt de ${fmt(dep.amount)} HTG suivi d'un retrait de ${fmt(wd.amount)} HTG en ${Math.round(diffH)}h`,
            amount: dep.amount + wd.amount,
            score: Math.min(score, 100),
            detectedAt: wd.created_at,
          });
        }
      });
    });

    // Check large single bets
    bets.forEach(bet => {
      if (bet.amount >= THRESHOLDS.CRITICAL_BET) {
        score += 40;
        alerts.push({
          id: `lb-${bet.id}`,
          level: 'critical',
          category: 'large_single_bet',
          userId, username,
          title: 'Pari de montant critique',
          detail: `Pari unique de ${fmt(bet.amount)} HTG — bien au-dessus du seuil de ${fmt(THRESHOLDS.CRITICAL_BET)} HTG`,
          amount: bet.amount,
          score: Math.min(score + 40, 100),
          detectedAt: bet.created_at,
        });
      } else if (bet.amount >= THRESHOLDS.HIGH_BET) {
        score += 20;
        alerts.push({
          id: `hb-${bet.id}`,
          level: 'high',
          category: 'high_volume_bet',
          userId, username,
          title: 'Pari à haut volume',
          detail: `Pari de ${fmt(bet.amount)} HTG dépasse le seuil de ${fmt(THRESHOLDS.HIGH_BET)} HTG`,
          amount: bet.amount,
          score: Math.min(score, 100),
          detectedAt: bet.created_at,
        });
      }
    });

    // Check excessive overall activity
    if (userTxs.length >= THRESHOLDS.MAX_TX_COUNT) {
      score += 15;
      alerts.push({
        id: `ea-${userId}`,
        level: 'medium',
        category: 'excessive_activity',
        userId, username,
        title: 'Activité excessive',
        detail: `${userTxs.length} transactions détectées · Volume total ${fmt(totalVolume)} HTG`,
        amount: totalVolume,
        score: Math.min(score, 100),
        detectedAt: userTxs[userTxs.length - 1]?.created_at,
      });
    }

    activities.push({ userId, username, txCount: userTxs.length, totalVolume, depositTotal, withdrawalTotal, betTotal, maxSingleBet, hasRapidDW, score: Math.min(score, 100) });
  });

  // Deduplicate alerts — keep highest-score per user per category
  const seen = new Set<string>();
  const deduped = alerts.filter(a => {
    const key = `${a.userId}-${a.category}`;
    if (a.category === 'high_volume_bet' || a.category === 'large_single_bet') return true; // keep all bet alerts
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    alerts: deduped.sort((a, b) => b.score - a.score),
    activities: activities.sort((a, b) => b.score - a.score).filter(u => u.score > 0),
  };
}

// ── Level badge ──────────────────────────────────────────────────────────────

function LevelBadge({ level }: { level: FraudAlert['level'] }) {
  const cfg = {
    critical: { color: '#f85149', bg: 'rgba(248,81,73,0.12)', label: 'CRITIQUE' },
    high:     { color: '#d29922', bg: 'rgba(210,153,34,0.12)', label: 'ÉLEVÉ'   },
    medium:   { color: '#388bfd', bg: 'rgba(56,139,253,0.12)', label: 'MOYEN'   },
  }[level];
  return (
    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.06em', color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}33`, borderRadius: 6, padding: '2px 7px' }}>
      {cfg.label}
    </span>
  );
}

// ── Risk score bar ───────────────────────────────────────────────────────────

function RiskBar({ score }: { score: number }) {
  const color = score >= 70 ? '#f85149' : score >= 40 ? '#d29922' : '#388bfd';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .6s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace', minWidth: 28, textAlign: 'right' }}>{score}</span>
    </div>
  );
}

// ── Category icon ─────────────────────────────────────────────────────────────

function CategoryIcon({ cat }: { cat: FraudAlert['category'] }) {
  const icons: Record<string, any> = {
    high_volume_bet: { Icon: TrendingUp, color: '#d29922' },
    large_single_bet: { Icon: AlertTriangle, color: '#f85149' },
    rapid_deposit_withdrawal: { Icon: ArrowDownRight, color: '#f85149' },
    excessive_activity: { Icon: Zap, color: '#388bfd' },
  };
  const { Icon, color } = icons[cat] || { Icon: AlertTriangle, color: '#8b949e' };
  return (
    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={15} color={color} />
    </div>
  );
}

// ── Alert row ─────────────────────────────────────────────────────────────────

function AlertRow({ alert }: { alert: FraudAlert }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background .15s' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
      onMouseLeave={e => (e.currentTarget.style.background = '')}
    >
      <CategoryIcon cat={alert.category} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>{alert.title}</span>
          <LevelBadge level={alert.level} />
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{alert.detail}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to={`/users`} style={{ fontSize: 11, color: '#388bfd', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
            <User size={10} /> {alert.username}
          </Link>
          <span style={{ fontSize: 11, color: '#484f58' }}>
            {new Date(alert.detectedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#f0f6fc', marginBottom: 6 }}>
          {fmt(alert.amount)} HTG
        </div>
        <RiskBar score={alert.score} />
      </div>
    </div>
  );
}

// ── User risk row ─────────────────────────────────────────────────────────────

function UserRiskRow({ u, rank }: { u: UserActivity; rank: number }) {
  const color = u.score >= 70 ? '#f85149' : u.score >= 40 ? '#d29922' : '#388bfd';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background .15s' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
      onMouseLeave={e => (e.currentTarget.style.background = '')}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: '#484f58', fontFamily: 'JetBrains Mono, monospace', minWidth: 20, textAlign: 'right' }}>#{rank}</span>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <User size={15} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {u.username}
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span>{u.txCount} tx</span>
          {u.hasRapidDW && <span style={{ color: '#f85149' }}>⚡ dépôt→retrait rapide</span>}
          {u.maxSingleBet >= THRESHOLDS.HIGH_BET && <span style={{ color: '#d29922' }}>pari max {fmt(u.maxSingleBet)} HTG</span>}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 120 }}>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Volume total</div>
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#f0f6fc', marginBottom: 6 }}>
          {fmt(u.totalVolume)} HTG
        </div>
        <RiskBar score={u.score} />
      </div>
      <Link to="/users" style={{ color: '#388bfd', display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0, marginLeft: 8 }}>
        <Eye size={14} />
      </Link>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type FraudTab = 'alerts' | 'users' | 'high_bets';

export default function AdminFraud() {
  const [txs,      setTxs]      = useState<Tx[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<FraudTab>('alerts');
  const [lastAt,   setLastAt]   = useState(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getTransactions({ limit: 500 });
      setTxs(res.data?.rows ?? res.data ?? []);
      setLastAt(new Date());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const { alerts, activities } = detectFraud(txs);
  const highBets = txs.filter(tx => tx.type === 'bet' && tx.amount >= THRESHOLDS.HIGH_BET).sort((a, b) => b.amount - a.amount);

  const criticalCount = alerts.filter(a => a.level === 'critical').length;
  const highCount     = alerts.filter(a => a.level === 'high').length;

  const TABS: { id: FraudTab; label: string; count?: number }[] = [
    { id: 'alerts',    label: 'Alertes',         count: alerts.length },
    { id: 'users',     label: 'Utilisateurs à risque', count: activities.length },
    { id: 'high_bets', label: 'Paris suspects',   count: highBets.length },
  ];

  return (
    <AdminLayout>
      <div style={{ padding: '24px 24px 48px', maxWidth: 1200 }} className="fade-in">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(163,113,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={18} color="#a371f7" />
              </div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#f0f6fc', letterSpacing: '-0.02em' }}>
                Détecteur IA de Fraude
              </h1>
              <span style={{ fontSize: 10, background: 'rgba(163,113,247,0.2)', color: '#a371f7', border: '1px solid rgba(163,113,247,0.3)', borderRadius: 20, padding: '2px 10px', fontWeight: 700 }}>
                <Zap size={9} style={{ display: 'inline', marginRight: 3 }} />IA
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Analyse de {txs.length} transactions · Mis à jour {lastAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <button onClick={load} className="btn btn-ghost" style={{ fontSize: 12, gap: 6 }}>
            <RefreshCw size={13} /> Actualiser
          </button>
        </div>

        {/* KPI summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Alertes critiques', val: criticalCount, color: '#f85149', icon: AlertTriangle },
            { label: 'Alertes élevées',   val: highCount,     color: '#d29922', icon: AlertTriangle },
            { label: 'Utilisateurs suspects', val: activities.length, color: '#a371f7', icon: User },
            { label: 'Paris suspects',    val: highBets.length, color: '#388bfd', icon: TrendingUp },
            { label: 'Transactions analysées', val: txs.length, color: '#3fb950', icon: DollarSign },
          ].map(({ label, val, color, icon: Icon }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.07)`, borderLeft: `3px solid ${color}`, borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
                <Icon size={13} color={color} />
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: val > 0 ? color : '#484f58', fontFamily: 'JetBrains Mono, monospace' }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Info box */}
        <div style={{ background: 'rgba(163,113,247,0.06)', border: '1px solid rgba(163,113,247,0.2)', borderRadius: 12, padding: '12px 18px', marginBottom: 24, fontSize: 12, color: '#8b949e', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <Shield size={14} color="#a371f7" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong style={{ color: '#a371f7' }}>Comment ça fonctionne · </strong>
            L'algorithme analyse les patterns suspects : paris uniques &gt; {fmt(THRESHOLDS.HIGH_BET)} HTG,
            dépôts suivis de retraits en moins de {THRESHOLDS.RAPID_DW_HOURS}h,
            activité anormalement élevée ({THRESHOLDS.MAX_TX_COUNT}+ transactions),
            et paris critiques &gt; {fmt(THRESHOLDS.CRITICAL_BET)} HTG.
            Chaque alerte reçoit un score de risque de 0 à 100.
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 4, width: 'fit-content', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: tab === t.id ? 'rgba(255,255,255,0.08)' : 'transparent',
              border: tab === t.id ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
              borderRadius: 9, padding: '7px 16px', fontSize: 12, fontWeight: tab === t.id ? 700 : 400,
              color: tab === t.id ? '#f0f6fc' : '#6b7280', cursor: 'pointer', transition: 'all .15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span style={{ background: tab === t.id ? 'rgba(163,113,247,0.25)' : 'rgba(255,255,255,0.06)', color: tab === t.id ? '#a371f7' : '#6b7280', borderRadius: 20, padding: '0 7px', fontSize: 10, fontWeight: 700 }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>

          {loading && (
            <div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div className="skel" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skel" style={{ height: 13, width: '50%', marginBottom: 8, borderRadius: 4 }} />
                    <div className="skel" style={{ height: 11, width: '70%', borderRadius: 4 }} />
                  </div>
                  <div className="skel" style={{ height: 13, width: 100, borderRadius: 4 }} />
                </div>
              ))}
            </div>
          )}

          {!loading && tab === 'alerts' && (
            alerts.length === 0
              ? <div style={{ padding: 48, textAlign: 'center' }}>
                  <Shield size={36} color="#3fb950" style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#3fb950', marginBottom: 6 }}>Aucune alerte détectée</div>
                  <div style={{ fontSize: 13, color: '#484f58' }}>Toutes les transactions semblent normales.</div>
                </div>
              : alerts.map(a => <AlertRow key={a.id} alert={a} />)
          )}

          {!loading && tab === 'users' && (
            activities.length === 0
              ? <div style={{ padding: 48, textAlign: 'center', color: '#484f58', fontSize: 13 }}>Aucun utilisateur suspect détecté.</div>
              : activities.map((u, i) => <UserRiskRow key={u.userId} u={u} rank={i + 1} />)
          )}

          {!loading && tab === 'high_bets' && (
            highBets.length === 0
              ? <div style={{ padding: 48, textAlign: 'center', color: '#484f58', fontSize: 13 }}>
                  Aucun pari au-dessus de {fmt(THRESHOLDS.HIGH_BET)} HTG.
                </div>
              : highBets.map(tx => (
                <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: tx.amount >= THRESHOLDS.CRITICAL_BET ? 'rgba(248,81,73,0.12)' : 'rgba(210,153,34,0.12)', border: `1px solid ${tx.amount >= THRESHOLDS.CRITICAL_BET ? 'rgba(248,81,73,0.3)' : 'rgba(210,153,34,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <TrendingUp size={15} color={tx.amount >= THRESHOLDS.CRITICAL_BET ? '#f85149' : '#d29922'} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.username || tx.user_id?.slice(0, 12)}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                      {new Date(tx.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: tx.amount >= THRESHOLDS.CRITICAL_BET ? '#f85149' : '#d29922' }}>
                      {fmt(tx.amount)} HTG
                    </div>
                    <div style={{ marginTop: 4 }}>
                      {tx.amount >= THRESHOLDS.CRITICAL_BET
                        ? <LevelBadge level="critical" />
                        : <LevelBadge level="high" />}
                    </div>
                  </div>
                  <Link to="/users" style={{ color: '#388bfd', display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0, marginLeft: 8 }}>
                    <ChevronRight size={14} />
                  </Link>
                </div>
              ))
          )}
        </div>

        {/* Footer note */}
        {!loading && (
          <div style={{ marginTop: 20, fontSize: 11, color: '#484f58', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <ArrowUpRight size={11} />
            Analyse basée sur les {txs.length} dernières transactions · Les seuils sont configurables dans le code
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
