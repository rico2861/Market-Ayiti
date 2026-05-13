/**
 * Polymarket Sync Service — Production Grade
 *
 * Two sync cycles:
 *   FAST  (30s)  — active market price/volume updates + new market injection
 *   SLOW  (5min) — resolved market detection, AMM recalculation, category counts
 *
 * AMM Algorithm (Automated Market Maker):
 *   Uses a constant-product invariant adapted for prediction markets.
 *   Probabilities are adjusted based on bet pool sizes using the LMSR model:
 *     p_yes = yes_pool / (yes_pool + no_pool)
 *   Plus a drift factor from Polymarket external price feed.
 *
 * New market injection:
 *   Every NEW_MARKET_INTERVAL_MS a new market from the pool is inserted
 *   without requiring a server restart. WebSocket notifies all clients.
 */

const { v4: uuidv4 }  = require('uuid');
const { getDb }        = require('../database');
const logger           = require('../utils/logger');
const CacheService     = require('./cache.service');
const CategoryService  = require('./category.service');
const {
  fetchActiveMarkets,
  fetchResolvedMarkets,
  fetchPricesBatch,
  getBreakerStatus,
  getNextNewMarket,
  mapCategory,
} = require('./polymarket.service');
const { settleMarket } = require('./settlement.service');

// ── Intervals ─────────────────────────────────────────────────────────────────
// PRICE_INTERVAL_MS  : price-only fast poll (uses CLOB batch in real mode)
// FAST_INTERVAL_MS   : full market upsert cycle (metadata, new markets, mock drift)
// RESOLUTION_MS      : dedicated resolution detection + auto-settlement
// SLOW_INTERVAL_MS   : full resolved market fetch + deep re-sync
// NEW_MARKET_INTERVAL_MS: periodic new market injection
const PRICE_INTERVAL_MS      = parseInt(process.env.POLYMARKET_PRICE_INTERVAL_MS || '') || 5_000;
const FAST_INTERVAL_MS       = parseInt(process.env.POLYMARKET_FAST_INTERVAL_MS  || '') || 30_000;
const RESOLUTION_MS          = parseInt(process.env.POLYMARKET_RESOLUTION_MS     || '') || 30_000;
const SLOW_INTERVAL_MS       = parseInt(process.env.POLYMARKET_SLOW_INTERVAL_MS  || '') || 5 * 60_000;
const NEW_MARKET_INTERVAL_MS = parseInt(process.env.NEW_MARKET_INTERVAL_MS || '') || 3 * 60_000;

// Throttle: minimum gap between two broadcasts for the same market (prevents WS flood)
const BROADCAST_THROTTLE_MS = 200;
const lastBroadcast = new Map(); // marketId → timestamp

const AUTO_COLORS = ['#6366F1','#EC4899','#14B8A6','#F97316','#84CC16','#A855F7','#0EA5E9','#EF4444'];
let colorIdx = 0;

// ── AMM Pricing Algorithm (LMSR-inspired) ────────────────────────────────────
// b = liquidity parameter (higher b = less price impact per bet)
const AMM_B = 1000;

/**
 * Compute AMM probability from pool sizes.
 * Uses log-sum-exp to prevent overflow:
 *   p_yes = exp(yes_pool/b) / (exp(yes_pool/b) + exp(no_pool/b))
 */
function ammProb(yesPool, noPool) {
  if (yesPool <= 0 && noPool <= 0) return 0.5;
  const yScaled = yesPool / AMM_B;
  const nScaled = noPool / AMM_B;
  // Numerically stable softmax
  const maxV = Math.max(yScaled, nScaled);
  const expY = Math.exp(yScaled - maxV);
  const expN = Math.exp(nScaled - maxV);
  return expY / (expY + expN);
}

/**
 * Blend AMM internal probability with external price feed.
 * weight = how much to trust the external price (0 = pure AMM, 1 = pure external).
 * We trust external more when volume is low (market not yet active locally).
 */
function blendedProb(yesPool, noPool, externalYesProb, volume) {
  const ammP    = ammProb(yesPool, noPool);
  const localVol = yesPool + noPool;
  // As local volume grows, trust AMM more
  const externalWeight = Math.max(0.05, Math.min(0.9, 1 / (1 + localVol / 500)));
  return ammP * (1 - externalWeight) + externalYesProb * externalWeight;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function ensureCategory(db, slug, rawName) {
  if (!slug) return 'lot';
  try {
    const exists = db.prepare('SELECT id FROM categories WHERE slug=?').get(slug);
    if (exists) return slug;
    const name  = rawName
      ? String(rawName).charAt(0).toUpperCase() + String(rawName).slice(1, 30)
      : slug.charAt(0).toUpperCase() + slug.slice(1);
    const color = AUTO_COLORS[colorIdx % AUTO_COLORS.length]; colorIdx++;
    const maxOrd = db.prepare('SELECT MAX(display_order) m FROM categories').get()?.m ?? -1;
    db.prepare(`INSERT OR IGNORE INTO categories (slug,name,name_fr,icon,color,display_order) VALUES (?,?,?,?,?,?)`)
      .run(slug, name, name, '🔖', color, maxOrd + 1);
    CacheService.invalidate('categories:all');
    logger.info(`Auto-created category: ${slug}`);
  } catch (e) {
    logger.error(`ensureCategory(${slug}): ${e.message}`);
  }
  return slug;
}

function getAdminId(db) {
  return db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get()?.id || 'system';
}

/** Throttled broadcast: skip if the same market was broadcast < BROADCAST_THROTTLE_MS ago */
function throttledBroadcast(broadcastFn, payload) {
  if (!broadcastFn) return;
  const key = payload.market_id || payload.type;
  const now = Date.now();
  if (key && lastBroadcast.has(key) && now - lastBroadcast.get(key) < BROADCAST_THROTTLE_MS) return;
  lastBroadcast.set(key, now);
  broadcastFn(payload);
}

/**
 * Upsert one normalized market into the DB.
 * Returns: 'created' | 'updated' | 'resolved' | 'skipped'
 */
function upsertMarket(db, m, adminId) {
  if (!m.polymarket_id || !m.title) return 'skipped';
  // Reject markets with no valid future end_date (expired or pre-2026)
  if (!m.end_date) return 'skipped';

  let catSlug = m.category_slug || mapCategory(m.raw_category, m.raw_tags);
  if (!catSlug) {
    catSlug = String(m.raw_category || 'lot')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'lot';
  }
  ensureCategory(db, catSlug, m.raw_category);

  const existing  = db.prepare(`
    SELECT id,yes_prob,no_prob,yes_pool,no_pool,total_volume,status,resolution
    FROM markets WHERE polymarket_id=?
  `).get(m.polymarket_id);

  // Build slug from title: lowercase, alphanum + hyphens, max 100 chars
  const titleSlug = m.title
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || `pm-${m.polymarket_id}`;
  // If slug taken by a DIFFERENT market (new insert only), append short id suffix
  const slugConflict = !existing
    && db.prepare('SELECT id FROM markets WHERE slug=? AND polymarket_id!=?').get(titleSlug, m.polymarket_id);
  const localSlug = (slugConflict
    ? `${titleSlug}-${m.polymarket_id.slice(-6)}`
    : titleSlug).slice(0, 200);

  // ── INSERT (new market) — skip closed/resolved markets entirely ──
  if (!existing) {
    if (m.status === 'closed' || m.status === 'resolved') return 'skipped';
    db.prepare(`
      INSERT INTO markets
        (id,slug,title,description,category,status,end_date,
         min_bet,max_bet,yes_prob,no_prob,yes_pool,no_pool,
         total_volume,liquidity,bet_count,resolution,
         image_url,option_a,option_b,
         source,polymarket_id,
         created_by,created_at,updated_at)
      VALUES
        (?,?,?,?,?,?,?,50,500000,?,?,0,0,?,?,0,?,?,?,?,
         'polymarket',?,?,datetime('now'),datetime('now'))
    `).run(
      uuidv4(), localSlug, m.title, m.description || '', catSlug,
      m.status, m.end_date,
      m.yes_prob, m.no_prob, m.total_volume, m.liquidity || 0,
      m.winner || null, m.image_url || null, m.option_a || 'Wi', m.option_b || 'Non',
      m.polymarket_id, adminId
    );
    return 'created';
  }

  // ── AUTO-CLOSE: Polymarket closed the market ──
  const wasClosed = existing.status === 'closed' || existing.status === 'resolved';
  if (!wasClosed && m.status === 'closed' && m.status !== 'resolved') {
    db.prepare(`
      UPDATE markets SET status='closed', updated_at=datetime('now') WHERE polymarket_id=?
    `).run(m.polymarket_id);
    return 'updated';
  }

  // ── DETECT RESOLUTION ──
  const wasResolved = existing.status === 'resolved';
  const nowResolved = m.status === 'resolved';
  const newWinner   = m.winner;

  if (!wasResolved && nowResolved && newWinner) {
    db.prepare(`
      UPDATE markets SET
        status='resolved', resolution=?, yes_prob=?, no_prob=?,
        total_volume=?, resolved_at=datetime('now'), updated_at=datetime('now')
      WHERE polymarket_id=?
    `).run(newWinner, m.yes_prob, m.no_prob, m.total_volume, m.polymarket_id);

    db.prepare(`
      INSERT INTO price_points (id,market_id,yes_price,no_price,volume,timestamp)
      VALUES (?,?,?,?,?,datetime('now'))
    `).run(uuidv4(), existing.id, m.yes_prob, m.no_prob, m.total_volume);

    return 'resolved';
  }

  // ── UPDATE (price/volume changed) ──
  // RULE 0: Never restore a market that was explicitly closed or resolved locally.
  //         The DB status is authoritative — Polymarket cannot reopen it.
  if (wasClosed) return 'skipped';

  // RULE 1: If local users have placed real bets, keep the current yes_prob (AMM state).
  // RULE 2: In mock mode, always preserve existing DB prices (mock drift controls them).
  const localBets = (existing.yes_pool || 0) + (existing.no_pool || 0);
  const yesProb   = (localBets > 0 || MOCK_MODE) ? existing.yes_prob : m.yes_prob;
  const noProb    = 1 - yesProb;

  const probChanged   = Math.abs(existing.yes_prob - yesProb) > 0.002;
  const volumeChanged = Math.abs((existing.total_volume || 0) - m.total_volume) > 10;
  // Never change status to 'active' if current status is closed/resolved
  const safeStatus    = (m.status === 'active' && wasClosed) ? existing.status : m.status;
  const statusChanged = existing.status !== safeStatus;

  if (!probChanged && !volumeChanged && !statusChanged) return 'skipped';

  db.prepare(`
    UPDATE markets SET
      yes_prob=?, no_prob=?, total_volume=?, liquidity=?, status=?,
      end_date=?, description=?, updated_at=datetime('now')
    WHERE polymarket_id=?
  `).run(yesProb, noProb, m.total_volume, m.liquidity || 0, safeStatus,
         m.end_date, m.description || '', m.polymarket_id);

  if (probChanged) {
    db.prepare(`
      INSERT INTO price_points (id,market_id,yes_price,no_price,volume,timestamp)
      VALUES (?,?,?,?,?,datetime('now'))
    `).run(uuidv4(), existing.id, yesProb, noProb, m.total_volume);
  }

  return 'updated';
}

/**
 * Inject one new market from the pool into the DB.
 * Called periodically so new markets appear without restart.
 */
function injectNewMarket(db, adminId, broadcastFn) {
  try {
    const m = getNextNewMarket();
    if (!m) return; // Pool exhausted

    // Skip if title contains a past year
    if (/\b(202[0-5])\b/.test(m.title || '')) {
      logger.info(`[new-market] Skipped stale market: "${m.title.slice(0, 60)}"`);
      return;
    }

    // Skip if already exists
    if (db.prepare('SELECT id FROM markets WHERE polymarket_id=?').get(m.polymarket_id)) return;

    const result = upsertMarket(db, m, adminId);
    if (result === 'created') {
      CategoryService.refreshCounts();
      CacheService.invalidatePattern('markets:');
      CacheService.invalidatePattern('polymarkets:');
      CacheService.invalidate('categories:all');

      logger.info(`[new-market] Injected: "${m.title.slice(0, 60)}"`);

      if (broadcastFn) {
        broadcastFn({ type: 'market:new', data: { polymarket_id: m.polymarket_id, title: m.title, category: m.category_slug } });
      }
    }
  } catch (e) {
    logger.error('[new-market] inject error: ' + e.message);
  }
}

// ── MOCK PRICE DRIFT ──────────────────────────────────────────────────────────
// In mock mode (no real Polymarket access), simulate live price movement.
// Selects up to 20 random active markets per cycle and applies small mean-reverting
// drift. This triggers WebSocket broadcasts so the frontend shows real-time updates.
const MOCK_MODE = process.env.POLYMARKET_MOCK === 'true';

function runMockDrift(db, broadcastFn) {
  if (!MOCK_MODE) return;
  try {
    const actives = db.prepare(
      "SELECT id,yes_prob,no_prob,bet_count FROM markets WHERE status='active' AND source='polymarket' ORDER BY RANDOM() LIMIT 20"
    ).all();

    const changed = [];
    db.transaction(() => {
      for (const m of actives) {
        // Mean-reverting walk: noise ±1.5% + gentle pull toward 50%
        const noise      = (Math.random() - 0.5) * 0.03;
        const meanRevert = (0.5 - m.yes_prob) * 0.015;
        const newYp      = Math.max(0.03, Math.min(0.97, m.yes_prob + noise + meanRevert));

        if (Math.abs(newYp - m.yes_prob) < 0.003) continue; // skip trivial changes

        db.prepare("UPDATE markets SET yes_prob=?,no_prob=?,updated_at=datetime('now') WHERE id=?")
          .run(newYp, 1 - newYp, m.id);
        db.prepare("INSERT INTO price_points (id,market_id,yes_price,no_price,volume,timestamp) VALUES (?,?,?,?,0,datetime('now'))")
          .run(uuidv4(), m.id, newYp, 1 - newYp);

        changed.push({ id: m.id, yes_prob: newYp, no_prob: 1 - newYp, bet_count: m.bet_count });
      }
    })();

    if (broadcastFn && changed.length > 0) {
      for (const u of changed) {
        broadcastFn({
          type:         'market:update',
          market_id:    u.id,
          yes_prob:     u.yes_prob,
          no_prob:      u.no_prob,
          local_volume: 0,
          bet_count:    u.bet_count,
        });
      }
      CacheService.invalidatePattern('markets:');
      CacheService.invalidatePattern('polymarkets:');
      logger.info(`[mock-drift] Price drift: ${changed.length} markets updated`);
    }
  } catch (e) {
    logger.error('[mock-drift] ' + e.message);
  }
}

// ── PRICE-ONLY FAST POLL (5s in real mode) ────────────────────────────────────
// Uses CLOB batch POST endpoint so we only transmit prices, not full market data.
// In mock mode this is skipped — mock drift is the source of price changes.
async function runPricePoll(broadcastFn) {
  if (MOCK_MODE) return; // mock drift handles price changes
  const { isOpen } = getBreakerStatus();
  if (isOpen) return;

  try {
    const db = getDb();
    // Get all active polymarket markets that have a clob_token_id stored
    const markets = db.prepare(`
      SELECT id, polymarket_id, yes_prob, no_prob, bet_count, yes_pool, no_pool
      FROM markets WHERE status='active' AND source='polymarket' AND polymarket_id IS NOT NULL
    `).all();

    if (!markets.length) return;

    // For markets with numeric-looking polymarket_ids (CLOB token format), use CLOB batch
    // Otherwise they are gamma IDs and won't work with CLOB — skip those
    const tokenMarkets = markets.filter(m => /^\d+$/.test(String(m.polymarket_id)));
    if (!tokenMarkets.length) return;

    const tokenIds = tokenMarkets.map(m => m.polymarket_id);
    const prices   = await fetchPricesBatch(tokenIds);

    const changed = [];
    db.transaction(() => {
      for (const m of tokenMarkets) {
        const rawPrice = prices[m.polymarket_id];
        if (rawPrice === undefined || rawPrice === null) continue;

        const newYesProb = Math.max(0.01, Math.min(0.99, parseFloat(rawPrice)));
        const newNoProb  = parseFloat((1 - newYesProb).toFixed(4));

        // Respect AMM: if local bets exist, blend rather than overwrite
        const localVol = (m.yes_pool || 0) + (m.no_pool || 0);
        const weight   = localVol > 0 ? Math.max(0.1, 1 / (1 + localVol / 500)) : 1.0;
        const blended  = parseFloat((m.yes_prob * (1 - weight) + newYesProb * weight).toFixed(4));

        if (Math.abs(blended - m.yes_prob) < 0.002) continue; // skip trivial

        db.prepare("UPDATE markets SET yes_prob=?,no_prob=?,updated_at=datetime('now') WHERE id=?")
          .run(blended, 1 - blended, m.id);
        db.prepare("INSERT INTO price_points (id,market_id,yes_price,no_price,volume,timestamp) VALUES (?,?,?,?,0,datetime('now'))")
          .run(uuidv4(), m.id, blended, 1 - blended);

        changed.push({ id: m.id, yes_prob: blended, no_prob: 1 - blended, bet_count: m.bet_count });
      }
    })();

    if (changed.length > 0 && broadcastFn) {
      for (const u of changed) {
        throttledBroadcast(broadcastFn, {
          type: 'market:update', market_id: u.id,
          yes_prob: u.yes_prob, no_prob: u.no_prob,
          local_volume: 0, bet_count: u.bet_count,
        });
      }
      CacheService.invalidatePattern('markets:');
      CacheService.invalidatePattern('polymarkets:');
      logger.debug(`[price-poll] ${changed.length} markets updated from CLOB`);
    }
  } catch (e) {
    logger.warn(`[price-poll] Failed: ${e.message}`);
  }
}

// ── DEDICATED RESOLUTION DETECTOR (30s) ──────────────────────────────────────
// Checks the DB for markets that were set to 'resolved' by the full sync
// but haven't had their bets settled yet. Runs auto-settlement atomically.
async function runResolutionCheck(broadcastFn) {
  try {
    const db = getDb();

    // Find resolved markets that still have unsettled active bets
    const pending = db.prepare(`
      SELECT DISTINCT m.id, m.resolution FROM markets m
      JOIN bets b ON b.market_id = m.id
      WHERE m.status = 'resolved' AND m.resolution IS NOT NULL
        AND b.status = 'active'
    `).all();

    for (const m of pending) {
      try {
        const stats = settleMarket(m.id, m.resolution, broadcastFn, 'system');
        if (stats.settled > 0) {
          logger.info(`[resolution] Auto-settled market ${m.id}: ${stats.settled} bets, ${stats.credited.toFixed(2)} HTG`);
        }
      } catch (e) {
        logger.error(`[resolution] settleMarket(${m.id}): ${e.message}`);
      }
    }
  } catch (e) {
    logger.error(`[resolution] check failed: ${e.message}`);
  }
}

// ── FAST SYNC ─────────────────────────────────────────────────────────────────
async function runFastSync(broadcastFn) {
  const start = Date.now();
  let created = 0, updated = 0, resolved = 0, skipped = 0;

  try {
    const db      = getDb();
    const adminId = getAdminId(db);
    const markets = await fetchActiveMarkets();

    const doUpserts = db.transaction(() => {
      for (const m of markets) {
        const r = upsertMarket(db, m, adminId);
        if      (r === 'created')  created++;
        else if (r === 'updated')  updated++;
        else if (r === 'resolved') { resolved++; updated++; }
        else                       skipped++;
      }
    });
    doUpserts();

    if (created > 0 || updated > 0) {
      CategoryService.refreshCounts();
      CacheService.invalidatePattern('markets:');
      CacheService.invalidatePattern('polymarkets:');

      if (broadcastFn && (created > 0 || updated > 0)) {
        broadcastFn({ type: 'polymarket:sync', data: { created, updated, resolved } });
      }
    }

    // Simulate live price movement in mock mode
    runMockDrift(getDb(), broadcastFn);

    const ms = Date.now() - start;
    logger.info(`[fast-sync] ${ms}ms — +${created} ~${updated} ✓${resolved} skip:${skipped}`);
    return { created, updated, resolved, skipped, ms };
  } catch (e) {
    logger.error(`[fast-sync] FAILED: ${e.message}`);
    return { error: e.message };
  }
}

// ── SLOW SYNC ─────────────────────────────────────────────────────────────────
async function runSlowSync(broadcastFn) {
  const start = Date.now();
  let resolved = 0;

  try {
    const db      = getDb();
    const adminId = getAdminId(db);
    const markets = await fetchResolvedMarkets();

    const justResolved = [];
    const doResolutions = db.transaction(() => {
      for (const m of markets) {
        const r = upsertMarket(db, m, adminId);
        if (r === 'resolved') {
          resolved++;
          const local = db.prepare('SELECT id,resolution FROM markets WHERE polymarket_id=?').get(m.polymarket_id);
          if (local) justResolved.push({ id: local.id, resolution: local.resolution });
        }
      }
    });
    doResolutions();

    // Auto-settle bets for newly resolved markets (outside upsert transaction)
    for (const rm of justResolved) {
      try {
        const stats = settleMarket(rm.id, rm.resolution, broadcastFn, 'system');
        logger.info(`[slow-sync] Auto-settled ${rm.id}: ${stats.settled} bets, ${stats.credited} HTG`);
      } catch (e) {
        logger.error(`[slow-sync] settleMarket(${rm.id}): ${e.message}`);
      }
    }

    if (resolved > 0) {
      CacheService.invalidatePattern('markets:');
      CacheService.invalidatePattern('polymarkets:');
      CategoryService.refreshCounts();
    }

    const ms = Date.now() - start;
    logger.info(`[slow-sync] ${ms}ms — ✓resolved:${resolved}`);
    return { resolved, ms };
  } catch (e) {
    logger.error(`[slow-sync] FAILED: ${e.message}`);
    return { error: e.message };
  }
}

/**
 * Combined sync (used by manual /admin/sync trigger).
 */
async function runSync(broadcastFn) {
  await runFastSync(broadcastFn);
  await runSlowSync(broadcastFn);
}

/**
 * Start all sync loops + new market injection.
 * Loop schedule (real mode):
 *   5s  — CLOB price-only batch poll (real mode only; skipped in mock)
 *   30s — full fast sync: upsert metadata, detect new/closed markets
 *   30s — resolution detector: auto-settle any resolved-but-unsettled markets
 *   5m  — slow sync: fetch resolved markets from Polymarket, deep re-sync
 *   3m  — new market injection from pool
 */
function startSyncLoop(broadcastFn) {
  // Initial fast sync immediately on startup
  runFastSync(broadcastFn).catch(() => {});

  // Price-only fast poll (5s) — real mode: CLOB batch; mock: no-op
  setInterval(() => runPricePoll(broadcastFn).catch(() => {}), PRICE_INTERVAL_MS);

  // Full fast sync (30s) — upsert all active markets
  setInterval(() => runFastSync(broadcastFn).catch(() => {}), FAST_INTERVAL_MS);

  // Resolution detector (30s) — auto-settle unsettled resolved markets
  setTimeout(() => {
    runResolutionCheck(broadcastFn).catch(() => {});
    setInterval(() => runResolutionCheck(broadcastFn).catch(() => {}), RESOLUTION_MS);
  }, 15_000); // start 15s after boot (after initial fast sync completes)

  // Slow sync (5min) — fetch resolved markets from Polymarket, settle new ones
  setTimeout(() => {
    runSlowSync(broadcastFn).catch(() => {});
    setInterval(() => runSlowSync(broadcastFn).catch(() => {}), SLOW_INTERVAL_MS);
  }, 10_000);

  // New market injection (3min)
  setInterval(() => {
    try {
      const db      = getDb();
      const adminId = getAdminId(db);
      injectNewMarket(db, adminId, broadcastFn);
    } catch (e) {
      logger.warn('[new-market] interval error: ' + e.message);
    }
  }, NEW_MARKET_INTERVAL_MS);

  logger.info(
    `Sync loops started — price:${PRICE_INTERVAL_MS}ms fast:${FAST_INTERVAL_MS}ms` +
    ` resolution:${RESOLUTION_MS}ms slow:${SLOW_INTERVAL_MS}ms new:${NEW_MARKET_INTERVAL_MS}ms` +
    ` mock=${MOCK_MODE}`
  );
}

module.exports = { startSyncLoop, runSync, runFastSync, runSlowSync, runResolutionCheck, runPricePoll };
