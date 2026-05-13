/**
 * Weekly Cashback Service
 *
 * Every Monday at 00:00 UTC, credits each user 5% of their total
 * real-money bets placed during the previous calendar week (Mon–Sun).
 * Cashback is credited to bonus_balance only — not real balance.
 * Users can only use bonus to bet on markets with odds ≤ 3.0.
 */

const { v4: uuidv4 } = require('uuid');
const { getDb }      = require('../database');
const logger         = require('../utils/logger');

const CASHBACK_RATE = 0.05; // 5%

/**
 * Returns the ISO date string (YYYY-MM-DD) for last Monday (start of previous week).
 */
function lastWeekStart() {
  const now  = new Date();
  const day  = now.getUTCDay(); // 0=Sun, 1=Mon...
  // Days since last Monday (if today is Monday, go back 7 days to get LAST week's Monday)
  const daysBack = day === 1 ? 7 : (day === 0 ? 6 : day - 1) + 7;
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - daysBack);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function lastWeekEnd(weekStart) {
  const d = new Date(weekStart + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Current week start (for checking if user already got cashback this week).
 */
function currentWeekStart() {
  const now = new Date();
  const day = now.getUTCDay();
  const daysBack = day === 0 ? 6 : day - 1;
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - daysBack);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/**
 * Run the weekly cashback for all eligible users.
 * Called once per week (on Monday) by the scheduler.
 * Safe to call multiple times — idempotent per week_start.
 */
async function runWeeklyCashback(broadcastFn) {
  const db        = getDb();
  const weekStart = lastWeekStart();
  const weekEnd   = lastWeekEnd(weekStart);

  logger.info(`[cashback] Running weekly cashback for week ${weekStart} → ${weekEnd}`);

  // Get all users who placed real bets last week (exclude bonus bets)
  const rows = db.prepare(`
    SELECT b.user_id, SUM(b.amount) AS total_wagered
    FROM bets b
    WHERE b.created_at >= ? AND b.created_at < ?
      AND (b.is_bonus_bet = 0 OR b.is_bonus_bet IS NULL)
      AND b.status IN ('active', 'won', 'lost')
    GROUP BY b.user_id
    HAVING total_wagered > 0
  `).all(weekStart + ' 00:00:00', weekEnd + ' 00:00:00');

  let credited = 0, users = 0;

  db.transaction(() => {
    for (const row of rows) {
      // Skip if already processed this week
      const already = db.prepare(
        'SELECT id FROM weekly_cashback_log WHERE user_id=? AND week_start=?'
      ).get(row.user_id, weekStart);
      if (already) continue;

      const cashback = parseFloat((row.total_wagered * CASHBACK_RATE).toFixed(2));
      if (cashback < 1) continue; // skip trivial amounts

      const usr         = db.prepare('SELECT bonus_balance FROM users WHERE id=?').get(row.user_id);
      if (!usr) continue;
      const bonusBefore = parseFloat(usr.bonus_balance || 0);
      const bonusAfter  = parseFloat((bonusBefore + cashback).toFixed(2));

      db.prepare("UPDATE users SET bonus_balance=?,updated_at=datetime('now') WHERE id=?")
        .run(bonusAfter, row.user_id);

      db.prepare(`INSERT INTO transactions (id,user_id,type,amount,balance_before,balance_after,status,description,payment_method,created_at)
        VALUES (?,?,'bonus',?,?,?,'completed',?,'system',datetime('now'))`)
        .run(uuidv4(), row.user_id, cashback, bonusBefore, bonusAfter,
             `Cashback 5% semèn ${weekStart} — ${Math.floor(row.total_wagered).toLocaleString()} HTG parye`);

      db.prepare(`INSERT INTO weekly_cashback_log (id,user_id,week_start,total_wagered,cashback_amount,created_at)
        VALUES (?,?,?,?,?,datetime('now'))`)
        .run(uuidv4(), row.user_id, weekStart, row.total_wagered, cashback);

      // Push WS balance update + in-app notification
      if (broadcastFn) {
        try {
          broadcastFn({ type: 'user:balance_update', user_id: row.user_id, bonus_balance: bonusAfter });
          const { pushNotification } = require('../routes/notifications');
          pushNotification(row.user_id, {
            type:    'cashback',
            title:   'Cashback Semèn Nan',
            message: `Ou resevwa ${cashback.toLocaleString()} HTG bonus cashback (5% de ${Math.floor(row.total_wagered).toLocaleString()} HTG parye semèn pase). Jwe sou koòf ≤ 3×!`,
            ref_type: 'cashback',
            ref_id:   weekStart,
          }, broadcastFn);
        } catch {}
      }

      credited += cashback;
      users++;
    }
  })();

  logger.info(`[cashback] Done: ${users} users credited, ${credited.toFixed(2)} HTG total bonus`);
  return { users, credited, weekStart };
}

/**
 * Start the weekly cashback scheduler.
 * Checks every hour if it's Monday and cashback hasn't run yet this week.
 */
function startCashbackScheduler(broadcastFn) {
  const CHECK_INTERVAL = 60 * 60 * 1000; // every hour

  const check = async () => {
    try {
      const now     = new Date();
      const isMonday = now.getUTCDay() === 1;
      if (!isMonday) return;

      const weekStart = currentWeekStart();
      const db        = getDb();

      // Check if we already ran cashback this week (any entry with this week_start)
      const ran = db.prepare(
        'SELECT id FROM weekly_cashback_log WHERE week_start=? LIMIT 1'
      ).get(weekStart);
      if (ran) return; // already ran this week

      await runWeeklyCashback(broadcastFn);
    } catch (e) {
      logger.error('[cashback] Scheduler error: ' + e.message);
    }
  };

  // Run immediately on startup in case server restarted after Monday midnight
  check();
  setInterval(check, CHECK_INTERVAL);
  logger.info('[cashback] Weekly cashback scheduler started (checks every hour on Mondays)');
}

module.exports = { startCashbackScheduler, runWeeklyCashback };
