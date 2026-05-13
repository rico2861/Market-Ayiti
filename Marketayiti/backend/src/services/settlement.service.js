/**
 * Settlement Service — Automatic Payout Engine
 *
 * Settles bets and bet slips when a market resolves.
 * Called automatically by sync.service when Polymarket reports a resolution,
 * and also reused by the admin manual-resolution route.
 *
 * ACID guarantee: all balance mutations are inside a single sql.js transaction.
 * Idempotent: markets already resolved are skipped silently.
 */

const { v4: uuidv4 }  = require('uuid');
const { getDb }        = require('../database');
const logger           = require('../utils/logger');
const CacheService     = require('./cache.service');
const CategoryService  = require('./category.service');
const { pushNotification } = require('../routes/notifications');

/**
 * Settle all bets and bet-slips for a resolved market.
 *
 * @param {string} marketId   — internal DB market UUID
 * @param {string} resolution — 'yes' | 'no'
 * @param {Function|null} broadcastFn — optional WS broadcast function
 * @param {string} resolvedBy — user id that triggered resolution ('system' for auto)
 * @returns {{ settled, credited, slip_won, slip_lost }} stats
 */
function settleMarket(marketId, resolution, broadcastFn = null, resolvedBy = 'system') {
  const db = getDb();

  // Guard: only settle once
  const market = db.prepare('SELECT * FROM markets WHERE id=?').get(marketId);
  if (!market) throw new Error(`Market not found: ${marketId}`);
  if (market.status !== 'resolved') {
    logger.warn(`[settlement] market ${marketId} not resolved — skip`);
    return { settled: 0, credited: 0, slip_won: 0, slip_lost: 0 };
  }

  // Check already settled
  const hasPending = db.prepare("SELECT COUNT(*) c FROM bets WHERE market_id=? AND status='active'").get(marketId).c;
  if (hasPending === 0) {
    logger.debug(`[settlement] market ${marketId} already settled`);
    return { settled: 0, credited: 0, slip_won: 0, slip_lost: 0 };
  }

  let credited = 0, settled = 0, slip_won = 0, slip_lost = 0;
  const notifyWinners = [];

  db.transaction(() => {
    // ── 1. Settle individual bets ────────────────────────────────────────────
    const bets = db.prepare("SELECT * FROM bets WHERE market_id=? AND status='active'").all(marketId);

    for (const bet of bets) {
      const won        = bet.option === resolution;
      const isBonusBet = bet.is_bonus_bet === 1;

      db.prepare("UPDATE bets SET status=?,actual_payout=?,settled_at=datetime('now') WHERE id=?")
        .run(won ? 'won' : 'lost', won ? bet.potential_payout : 0, bet.id);

      if (won) {
        const usr    = db.prepare('SELECT balance,bonus_balance FROM users WHERE id=?').get(bet.user_id);
        const oddsStr = parseFloat(bet.odds_at_bet).toFixed(2);
        const payStr  = Math.floor(bet.potential_payout).toLocaleString();

        if (isBonusBet) {
          const before = parseFloat(usr.bonus_balance || 0);
          const after  = parseFloat((before + bet.potential_payout).toFixed(2));
          db.prepare("UPDATE users SET bonus_balance=?,updated_at=datetime('now') WHERE id=?").run(after, bet.user_id);
          db.prepare(`INSERT INTO transactions (id,user_id,type,amount,balance_before,balance_after,status,description,reference_id,created_at)
            VALUES (?,?,'win_bonus',?,?,?,'completed',?,?,datetime('now'))`)
            .run(uuidv4(), bet.user_id, bet.potential_payout, before, after,
              `Genyen BONUS ${bet.option.toUpperCase()} @ ${oddsStr}× — ${market.title.slice(0, 40)} = ${payStr} HTG`,
              market.id);
        } else {
          const before = parseFloat(usr.balance);
          const after  = parseFloat((before + bet.potential_payout).toFixed(2));
          db.prepare("UPDATE users SET balance=?,updated_at=datetime('now') WHERE id=?").run(after, bet.user_id);
          db.prepare(`INSERT INTO transactions (id,user_id,type,amount,balance_before,balance_after,status,description,reference_id,created_at)
            VALUES (?,?,'win',?,?,?,'completed',?,?,datetime('now'))`)
            .run(uuidv4(), bet.user_id, bet.potential_payout, before, after,
              `Genyen ${bet.option.toUpperCase()} @ ${oddsStr}× — ${market.title.slice(0, 40)} = ${payStr} HTG`,
              market.id);
        }
        credited += bet.potential_payout;
        notifyWinners.push({ user_id: bet.user_id, amount: bet.potential_payout, lost: false, slip: false });
      } else {
        notifyWinners.push({ user_id: bet.user_id, amount: bet.amount, lost: true, slip: false });
      }
      settled++;
    }

    // ── 2. Update bet-slip selections & settle complete slips ────────────────
    db.prepare('UPDATE bet_slip_selections SET result=? WHERE market_id=?').run(resolution, marketId);

    const activeSlips = db.prepare(`
      SELECT DISTINCT bs.id FROM bet_slips bs
      JOIN bet_slip_selections bss ON bss.bet_slip_id=bs.id
      WHERE bss.market_id=? AND bs.status='active'
    `).all(marketId);

    for (const slipRef of activeSlips) {
      const slip        = db.prepare('SELECT * FROM bet_slips WHERE id=?').get(slipRef.id);
      const selections  = db.prepare('SELECT * FROM bet_slip_selections WHERE bet_slip_id=?').all(slip.id);
      const hasLoss     = selections.some(s => s.result !== null && s.result !== s.option_chosen);
      const allWon      = selections.every(s => s.result !== null && s.result === s.option_chosen);
      const allResolved = selections.every(s => s.result !== null);

      if (hasLoss) {
        db.prepare("UPDATE bet_slips SET status='lost',settled_at=datetime('now') WHERE id=?").run(slip.id);
        slip_lost++;
      } else if (allWon && allResolved) {
        const gain   = parseFloat((slip.amount * slip.total_odds).toFixed(2));
        const usr    = db.prepare('SELECT balance FROM users WHERE id=?').get(slip.user_id);
        const before = parseFloat(usr.balance);
        const after  = parseFloat((before + gain).toFixed(2));
        db.prepare("UPDATE users SET balance=?,updated_at=datetime('now') WHERE id=?").run(after, slip.user_id);
        db.prepare("UPDATE bet_slips SET status='won',settled_at=datetime('now') WHERE id=?").run(slip.id);
        db.prepare(`INSERT INTO transactions (id,user_id,type,amount,balance_before,balance_after,status,description,created_at)
          VALUES (?,?,'win',?,?,?,'completed',?,datetime('now'))`)
          .run(uuidv4(), slip.user_id, gain, before, after, `Fich Kombi Genyen × ${slip.total_odds.toFixed(2)}`);
        credited += gain;
        slip_won++;
        notifyWinners.push({ user_id: slip.user_id, amount: gain, lost: false, slip: true });
      }
    }

    // ── 3. Audit log ─────────────────────────────────────────────────────────
    db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,details,created_at) VALUES (?,?,?,?,?,?,datetime('now'))`)
      .run(uuidv4(), 'AUTO_SETTLE', 'market', marketId, resolvedBy,
        JSON.stringify({ resolution, settled, credited, slip_won, slip_lost, source: 'polymarket_auto' }));
  })();

  // ── 4. Cache invalidation ────────────────────────────────────────────────────
  CacheService.invalidatePattern('markets:');
  CategoryService.refreshCounts();
  CacheService.invalidate('categories:all');

  // ── 5. WS broadcast ──────────────────────────────────────────────────────────
  if (broadcastFn) {
    broadcastFn({ type: 'market:resolved', market_id: marketId, resolution });
  }

  // ── 6. Push WS balance updates + in-app notifications ───────────────────────
  for (const n of notifyWinners) {
    if (broadcastFn && !n.lost) {
      // Push real-time balance update to winner's client
      try {
        const updated = db.prepare('SELECT balance,bonus_balance FROM users WHERE id=?').get(n.user_id);
        if (updated) {
          broadcastFn({
            type: 'user:balance_update',
            user_id: n.user_id,
            balance: parseFloat(updated.balance),
            bonus_balance: parseFloat(updated.bonus_balance || 0),
          });
        }
      } catch {}
    }

    pushNotification(
      n.user_id,
      n.lost
        ? {
            type: 'bet_lost',
            title: 'Pari Pèdi',
            message: `Mache "${market.title.slice(0, 40)}" rezoud. Pari ou a pèdi.`,
            ref_type: 'market',
            ref_id: marketId,
          }
        : {
            type: 'bet_won',
            title: n.slip ? 'Fich Kombi Genyen!' : 'Pari Genyen!',
            message: `Ou genyen ${Math.floor(n.amount).toLocaleString()} HTG sou "${market.title.slice(0, 40)}"!`,
            ref_type: 'market',
            ref_id: marketId,
          },
      broadcastFn,
    );
  }

  logger.info(`[settlement] ${market.slug} → ${resolution}: ${settled} bets settled, ${credited.toFixed(2)} HTG credited, slips won=${slip_won} lost=${slip_lost}`);
  return { settled, credited, slip_won, slip_lost };
}

module.exports = { settleMarket };
