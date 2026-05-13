const router = require('express').Router();
const { query, body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { validate, validateUUID } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { getDb } = require('../database');
const logger = require('../utils/logger');
const rateLimit = require('express-rate-limit');
const CacheService = require('../services/cache.service');
const CategoryService = require('../services/category.service');
const { pushNotification } = require('./notifications');
const { sanitize } = require('../utils/security');

const BASE_CATEGORIES = ['politik', 'spo', 'ekonomi', 'kilti', 'sosyal', 'lot', 'nouvo'];

// Returns the full list of valid category slugs, including auto-created ones from Polymarket
function getValidCategories() {
  try {
    const db   = getDb();
    const rows = db.prepare('SELECT slug FROM categories WHERE active = 1').all();
    const extra = rows.map(r => r.slug);
    return [...new Set([...BASE_CATEGORIES, ...extra])];
  } catch {
    return BASE_CATEGORIES;
  }
}

// Keep for backward-compat in validator (uses a snapshot at request time)
const VALID_CATEGORIES = BASE_CATEGORIES;

// Per-user bet rate limiter — max 30 bets/min
const betLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyGenerator: (req) => (req.user?.id || req.ip),
  message: { detail: 'Twòp pari. Eseye nan yon minit.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => false,
});

// Comment rate limiter — max 10 comments/min
const commentLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyGenerator: (req) => (req.user?.id || req.ip),
  message: { detail: 'Twòp kòmantè. Eseye nan yon minit.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auto-close expired markets — runs at most once per request set
let lastAutoClose = 0;
function maybeAutoClose(db) {
  const now = Date.now();
  if (now - lastAutoClose < 30_000) return; // max every 30 s
  lastAutoClose = now;
  try {
    db.prepare(
      "UPDATE markets SET status='closed',updated_at=datetime('now') WHERE status='active' AND end_date < datetime('now')"
    ).run();
  } catch {}
}

// GET /api/v1/markets
router.get('/', [
  query('status').optional().isIn(['active', 'closed', 'resolved', 'draft', 'cancelled', 'all']),
  query('category').optional().custom(v => !v || getValidCategories().includes(v) || v === '').withMessage('Katégori invalide'),
  query('skip').optional().isInt({ min: 0 }),
  query('limit').optional().isInt({ min: 1, max: 500 }),
  query('search').optional().isLength({ max: 100 }),
  query('sort').optional().isIn(['volume', 'new', 'ending', 'competitive']),
  query('month').optional().isInt({ min: 1, max: 12 }),
  query('year').optional().isInt({ min: 2020, max: 2050 }),
  validate
], (req, res) => {
  try {
    const db = getDb();
    maybeAutoClose(db);

    const {
      status = 'active', category, search, sort = 'volume',
      month, year
    } = req.query;
    const skip  = Math.max(0, parseInt(req.query.skip  || '0'));
    const limit = Math.min(parseInt(req.query.limit || '200'), 500);

    // Only cache simple, non-search queries (page 0, no date filter)
    const cacheable = !search && !month && !year && skip === 0;
    const cacheKey  = cacheable
      ? `markets:${status}:${category || 'all'}:${sort}:${limit}`
      : null;

    if (cacheKey) {
      const cached = CacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }

    // local_volume = yes_pool + no_pool = real money wagered on this platform
    // total_volume from Polymarket is NOT exposed to users
    let sql = `SELECT id,slug,title,description,category,status,end_date,
                      min_bet,max_bet,yes_prob,no_prob,
                      yes_pool,no_pool,(yes_pool+no_pool) AS local_volume,
                      bet_count,resolution,image_url,option_a,option_b,
                      source,created_at,updated_at
               FROM markets WHERE 1=1`;
    const params = [];

    if (status && status !== 'all') { sql += ' AND status=?';    params.push(status); }
    if (category)                   { sql += ' AND category=?';  params.push(category); }
    if (search && search.trim().length >= 2) {
      sql += ' AND (title LIKE ? OR description LIKE ?)';
      const q = `%${search.trim().slice(0, 50)}%`;
      params.push(q, q);
    }
    if (month && year) {
      sql += " AND strftime('%m',created_at)=? AND strftime('%Y',created_at)=?";
      params.push(String(month).padStart(2, '0'), String(year));
    } else if (year) {
      sql += " AND strftime('%Y',created_at)=?";
      params.push(String(year));
    }

    const sortMap = {
      volume:      '(yes_pool+no_pool) DESC, bet_count DESC',
      new:         'created_at DESC',
      ending:      'end_date ASC',
      competitive: 'ABS(yes_prob-0.5) ASC',
    };
    sql += ` ORDER BY ${sortMap[sort] || sortMap.volume} LIMIT ? OFFSET ?`;
    params.push(limit, skip);

    const markets = db.prepare(sql).all(...params);

    if (cacheKey) CacheService.set(cacheKey, markets, 10); // 10s TTL

    res.json(markets);
  } catch (e) {
    logger.error('Markets list: ' + e.message);
    res.status(500).json({ detail: 'Erè chajman' });
  }
});

// GET /api/v1/markets/my-bets  — must be before /:idOrSlug
router.get('/my-bets', authenticate, [
  query('skip').optional().isInt({ min: 0 }),
  query('limit').optional().isInt({ min: 1, max: 200 }),
  query('status').optional().isIn(['active', 'won', 'lost', 'refunded', 'all']),
  validate
], (req, res) => {
  try {
    const skip  = Math.max(0, parseInt(req.query.skip  || '0'));
    const limit = Math.min(parseInt(req.query.limit || '100'), 200);
    const { status, month, year } = req.query;

    let sql = `
      SELECT b.*, m.title as market_title, m.slug as market_slug,
             m.category as market_category, m.status as market_status,
             m.resolution as market_resolution, m.image_url as market_image_url
      FROM bets b JOIN markets m ON b.market_id=m.id
      WHERE b.user_id=?
    `;
    const params = [req.user.id];

    if (status && status !== 'all') { sql += ' AND b.status=?'; params.push(status); }
    if (month && year) {
      sql += " AND strftime('%m',b.created_at)=? AND strftime('%Y',b.created_at)=?";
      params.push(String(month).padStart(2, '0'), String(year));
    } else if (year) {
      sql += " AND strftime('%Y',b.created_at)=?";
      params.push(String(year));
    }

    sql += ' ORDER BY b.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, skip);

    res.json(getDb().prepare(sql).all(...params));
  } catch (e) {
    logger.error('My bets: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// GET /api/v1/markets/my-slips
router.get('/my-slips', authenticate, (req, res) => {
  try {
    const db    = getDb();
    const slips = db.prepare(
      'SELECT * FROM bet_slips WHERE user_id=? ORDER BY created_at DESC LIMIT 50'
    ).all(req.user.id);

    const result = slips.map(slip => {
      const selections = db.prepare(`
        SELECT s.*, m.title as market_title, m.slug as market_slug, m.status as market_status
        FROM bet_slip_selections s JOIN markets m ON s.market_id=m.id
        WHERE s.bet_slip_id=?
      `).all(slip.id);
      return { ...slip, selections };
    });

    res.json(result);
  } catch (e) {
    logger.error('My slips: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// POST /api/v1/markets/slip — combi-bet
router.post('/slip', authenticate, [
  body('selections').isArray({ min: 2, max: 10 }),
  body('selections.*.market_id').isUUID(4),
  body('selections.*.option').isIn(['yes', 'no']),
  body('amount').isFloat({ min: 100, max: 1000000 }),
  validate
], (req, res) => {
  try {
    const { selections, amount } = req.body;
    const db = getDb();

    // Pre-check balance before building selections
    const userSnap = db.prepare('SELECT balance FROM users WHERE id=?').get(req.user.id);
    if (!userSnap || parseFloat(userSnap.balance) < amount)
      return res.status(400).json({ detail: 'Balans ensifizan' });

    let totalOdds = 1.0;
    const resolvedSelections = [];
    const seen = new Set();

    for (const sel of selections) {
      if (seen.has(sel.market_id))
        return res.status(400).json({ detail: 'Mache duplika nan fich la' });
      seen.add(sel.market_id);

      const m = db.prepare("SELECT * FROM markets WHERE id=? AND status='active'").get(sel.market_id);
      if (!m) return res.status(400).json({ detail: `Mache pa disponib` });

      const SLIP_RAKE = 0.03;
      const rawOdds = sel.option === 'yes' ? (1 / m.yes_prob) : (1 / m.no_prob);
      const odds = rawOdds * (1 - SLIP_RAKE);
      totalOdds *= parseFloat(odds.toFixed(4));
      resolvedSelections.push({ market_id: sel.market_id, option_chosen: sel.option, odds_at_time: odds });
    }

    const potential_gain = parseFloat((amount * totalOdds).toFixed(2));
    const slipId = uuidv4();
    let before, after;

    db.transaction(() => {
      // Atomic deduct — prevents double-spend race condition
      const result = db.prepare(
        "UPDATE users SET balance=ROUND(balance-?,2),updated_at=datetime('now') WHERE id=? AND balance>=?"
      ).run(amount, req.user.id, amount);

      if (result.changes === 0) throw new Error('INSUFFICIENT_BALANCE');

      before = parseFloat(userSnap.balance);
      after  = parseFloat((before - amount).toFixed(2));
      db.prepare("INSERT INTO bet_slips (id,user_id,total_odds,amount,potential_gain,status) VALUES (?,?,?,?,?,'active')")
        .run(slipId, req.user.id, totalOdds, amount, potential_gain);
      for (const sel of resolvedSelections) {
        db.prepare('INSERT INTO bet_slip_selections (id,bet_slip_id,market_id,option_chosen,odds_at_time) VALUES (?,?,?,?,?)')
          .run(uuidv4(), slipId, sel.market_id, sel.option_chosen, sel.odds_at_time);
      }
      db.prepare(`INSERT INTO transactions (id,user_id,type,amount,balance_before,balance_after,status,description,created_at)
        VALUES (?,?,'bet_slip',?,?,?,'completed',?,datetime('now'))`)
        .run(uuidv4(), req.user.id, amount, before, after,
             `Fich Kombi — ${selections.length} seksyon × ${totalOdds.toFixed(2)}`);
      db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,details,created_at) VALUES (?,?,?,?,?,?,datetime('now'))`)
        .run(uuidv4(), 'CREATE_BET_SLIP', 'bet_slip', slipId, req.user.id,
             JSON.stringify({ amount, totalOdds, potential_gain, count: selections.length }));
    })();

    logger.info(`BetSlip ${slipId}: ${amount} HTG × ${totalOdds.toFixed(2)} = ${potential_gain} HTG by ${req.user.username}`);
    res.status(201).json({ id: slipId, total_odds: totalOdds, amount, potential_gain, new_balance: after });
  } catch (e) {
    if (e.message === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ detail: 'Balans ensifizan pou fich sa a.' });
    }
    logger.error('Slip: ' + e.message);
    res.status(500).json({ detail: 'Erè fich kombi' });
  }
});

// GET /api/v1/markets/favorites  — MUST remain before /:idOrSlug
router.get('/favorites', authenticate, (req, res) => {
  try {
    const rows = getDb().prepare(`
      SELECT m.* FROM market_favorites f JOIN markets m ON f.market_id=m.id
      WHERE f.user_id=? ORDER BY f.created_at DESC LIMIT 200
    `).all(req.user.id);
    res.json(rows);
  } catch (e) {
    logger.error('Favorites: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// Validate UUID for all /:id sub-routes (bets, favorites, comments, etc.)
// The /:idOrSlug GET route is exempt — it accepts slugs too.
router.param('id', (req, res, next, id) => {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) return res.status(400).json({ detail: 'Identifyan envalid' });
  next();
});

// GET /api/v1/markets/:idOrSlug
router.get('/:idOrSlug', (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const col    = isUuid ? 'id' : 'slug';
    // local_volume only — no Polymarket total_volume exposed
    const market = getDb().prepare(`
      SELECT id,slug,title,description,category,status,end_date,
             min_bet,max_bet,yes_prob,no_prob,
             yes_pool,no_pool,(yes_pool+no_pool) AS local_volume,
             bet_count,resolution,resolution_source,image_url,option_a,option_b,
             source,created_by,created_at,updated_at
      FROM markets WHERE ${col}=?
    `).get(idOrSlug);
    if (!market) return res.status(404).json({ detail: 'Pa jwenn' });
    res.json(market);
  } catch (e) {
    logger.error('Market get: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// GET /api/v1/markets/:id/bets — recent public bets
router.get('/:id/bets', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20'), 50);
    const rows  = getDb().prepare(`
      SELECT b.id, b.option, b.amount, b.odds_at_bet, b.created_at, u.username
      FROM bets b JOIN users u ON b.user_id=u.id
      WHERE b.market_id=? ORDER BY b.created_at DESC LIMIT ?
    `).all(req.params.id, limit);
    res.json(rows);
  } catch (e) {
    logger.error('Market bets: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// GET /api/v1/markets/:id/favorite-status
router.get('/:id/favorite-status', authenticate, (req, res) => {
  try {
    const row = getDb().prepare(
      'SELECT id FROM market_favorites WHERE market_id=? AND user_id=?'
    ).get(req.params.id, req.user.id);
    res.json({ favorited: !!row });
  } catch (e) {
    logger.error('Favorite status: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// POST /api/v1/markets/:id/favorite — toggle
router.post('/:id/favorite', authenticate, (req, res) => {
  try {
    const db       = getDb();
    const existing = db.prepare(
      'SELECT id FROM market_favorites WHERE market_id=? AND user_id=?'
    ).get(req.params.id, req.user.id);

    if (existing) {
      db.prepare('DELETE FROM market_favorites WHERE market_id=? AND user_id=?').run(req.params.id, req.user.id);
      res.json({ favorited: false });
    } else {
      // Verify market exists before adding
      const mkt = db.prepare('SELECT id FROM markets WHERE id=?').get(req.params.id);
      if (!mkt) return res.status(404).json({ detail: 'Mache pa jwenn' });
      db.prepare('INSERT INTO market_favorites (id,market_id,user_id) VALUES (?,?,?)').run(uuidv4(), req.params.id, req.user.id);
      res.json({ favorited: true });
    }
  } catch (e) {
    logger.error('Toggle favorite: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// GET /api/v1/markets/:id/comments
router.get('/:id/comments', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100'), 200);
    const rows  = getDb().prepare(`
      SELECT c.id, c.text, c.created_at, c.user_id, u.username
      FROM market_comments c JOIN users u ON c.user_id=u.id
      WHERE c.market_id=? ORDER BY c.created_at DESC LIMIT ?
    `).all(req.params.id, limit);
    res.json(rows);
  } catch (e) {
    logger.error('Comments get: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// POST /api/v1/markets/:id/comments
router.post('/:id/comments', authenticate, commentLimiter, [
  body('text').isString().isLength({ min: 1, max: 500 }).trim(),
  validate
], (req, res) => {
  try {
    const db  = getDb();
    const mkt = db.prepare('SELECT id FROM markets WHERE id=?').get(req.params.id);
    if (!mkt) return res.status(404).json({ detail: 'Mache pa jwenn' });

    const id   = uuidv4();
    const text = sanitize(req.body.text.trim());
    db.prepare('INSERT INTO market_comments (id,market_id,user_id,text) VALUES (?,?,?,?)').run(id, req.params.id, req.user.id, text);

    const comment = db.prepare(`
      SELECT c.id, c.text, c.created_at, c.user_id, u.username
      FROM market_comments c JOIN users u ON c.user_id=u.id WHERE c.id=?
    `).get(id);
    res.status(201).json(comment);
  } catch (e) {
    logger.error('Comment post: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// DELETE /api/v1/markets/:id/comments/:commentId
router.delete('/:id/comments/:commentId', authenticate, (req, res) => {
  try {
    const db = getDb();
    const c  = db.prepare('SELECT * FROM market_comments WHERE id=?').get(req.params.commentId);
    if (!c) return res.status(404).json({ detail: 'Kòmantè pa jwenn' });
    if (c.user_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ detail: 'Aksyon entèdi' });
    db.prepare('DELETE FROM market_comments WHERE id=?').run(req.params.commentId);
    res.json({ ok: true });
  } catch (e) {
    logger.error('Comment delete: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// GET /api/v1/markets/:id/price-history
router.get('/:id/price-history', (req, res) => {
  try {
    const hours = Math.min(parseInt(req.query.hours || '168'), 720);
    const rows  = getDb().prepare(
      "SELECT id,market_id,yes_price,no_price,volume,timestamp FROM price_points WHERE market_id=? AND timestamp >= datetime('now',?) ORDER BY timestamp ASC LIMIT 1000"
    ).all(req.params.id, `-${hours} hours`);
    res.json(rows);
  } catch (e) {
    logger.error('Price history: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// POST /api/v1/markets/:id/bet
const BONUS_MAX_ODDS = 3.0; // Bonus bets restricted to odds ≤ 3.0

router.post('/:id/bet', authenticate, betLimiter, [
  body('option').isIn(['yes', 'no']),
  body('amount').isFloat({ min: 25, max: 10000000 }),
  validate
], (req, res) => {
  try {
    const db = getDb();
    maybeAutoClose(db);

    const market = db.prepare("SELECT * FROM markets WHERE id=? AND status='active'").get(req.params.id);
    if (!market) return res.status(404).json({ detail: 'Mache pa disponib' });

    const { option, amount } = req.body;
    const effectiveMin = Math.min(market.min_bet, 25);
    if (amount < effectiveMin) return res.status(400).json({ detail: `Min: ${effectiveMin} HTG` });
    if (amount > market.max_bet) return res.status(400).json({ detail: `Max: ${market.max_bet} HTG` });

    const userPreCheck = db.prepare('SELECT id,username,balance,bonus_balance FROM users WHERE id=?').get(req.user.id);
    if (!userPreCheck) return res.status(401).json({ detail: 'Itilizatè pa jwenn' });

    const realBalance  = parseFloat(userPreCheck.balance);
    const bonusBalance = parseFloat(userPreCheck.bonus_balance || 0);

    // Determine which wallet to use
    let useBonus = false;
    if (realBalance >= amount) {
      useBonus = false; // prefer real balance
    } else if (bonusBalance >= amount) {
      useBonus = true;
    } else {
      return res.status(400).json({ detail: 'Balans ensifizan (reyèl ak bonus)' });
    }

    // House rake: 3% deducted from winnings
    const HOUSE_RAKE = 0.03;
    const fairOdds = option === 'yes' ? (1 / market.yes_prob) : (1 / market.no_prob);
    const odds      = parseFloat((fairOdds * (1 - HOUSE_RAKE)).toFixed(4));

    // Bonus restriction: odds must be ≤ 3.0
    if (useBonus && odds > BONUS_MAX_ODDS) {
      return res.status(400).json({
        detail: `Pari Bonus: koòf maksimòm ${BONUS_MAX_ODDS}× (koòf aktyèl ${odds.toFixed(2)}×). Chwazi yon mache avèk mwens risk.`,
        bonus_odds_limit: BONUS_MAX_ODDS,
      });
    }

    const potential = parseFloat((amount * odds).toFixed(2));
    const betId     = uuidv4();

    const yPool = parseFloat(market.yes_pool) + (option === 'yes' ? amount : 0);
    const nPool = parseFloat(market.no_pool)  + (option === 'no'  ? amount : 0);

    const isPolymarket = market.source === 'polymarket';
    let newYp, newNp;
    if (isPolymarket) {
      newYp = market.yes_prob;
      newNp = market.no_prob;
    } else {
      const VIRTUAL_L = 2000;
      const yFull = (market.yes_prob * VIRTUAL_L) + yPool;
      const nFull = ((1 - market.yes_prob) * VIRTUAL_L) + nPool;
      const sum   = yFull + nFull;
      newYp = Math.max(0.01, Math.min(0.99, sum > 0 ? yFull / sum : 0.5));
      newNp = 1 - newYp;
    }

    let before, after;

    db.transaction(() => {
      if (useBonus) {
        // Deduct from bonus_balance atomically
        const result = db.prepare(
          "UPDATE users SET bonus_balance=ROUND(bonus_balance-?,2),updated_at=datetime('now') WHERE id=? AND bonus_balance>=?"
        ).run(amount, req.user.id, amount);
        if (result.changes === 0) throw new Error('INSUFFICIENT_BALANCE');
        before = bonusBalance;
        after  = parseFloat((bonusBalance - amount).toFixed(2));
      } else {
        const result = db.prepare(
          "UPDATE users SET balance=ROUND(balance-?,2),updated_at=datetime('now') WHERE id=? AND balance>=?"
        ).run(amount, req.user.id, amount);
        if (result.changes === 0) throw new Error('INSUFFICIENT_BALANCE');
        before = realBalance;
        after  = parseFloat((realBalance - amount).toFixed(2));
      }

      db.prepare("INSERT INTO bets (id,user_id,market_id,option,amount,potential_payout,odds_at_bet,status,is_bonus_bet) VALUES (?,?,?,?,?,?,?,'active',?)")
        .run(betId, req.user.id, market.id, option, amount, potential, odds, useBonus ? 1 : 0);
      db.prepare("UPDATE markets SET yes_pool=?,no_pool=?,yes_prob=?,no_prob=?,bet_count=bet_count+1,updated_at=datetime('now') WHERE id=?")
        .run(yPool, nPool, newYp, newNp, market.id);
      db.prepare(`INSERT INTO transactions (id,user_id,type,amount,balance_before,balance_after,status,description,reference_id,created_at)
        VALUES (?,?,?,?,?,?,'completed',?,?,datetime('now'))`)
        .run(uuidv4(), req.user.id, useBonus ? 'bet_bonus' : 'bet',
             amount, before, after,
             `Pari${useBonus ? ' BONUS' : ''} ${option.toUpperCase()} @ ${odds.toFixed(2)}× — ${market.title.slice(0, 40)}`,
             market.id);
      db.prepare("INSERT INTO price_points (id,market_id,yes_price,no_price,volume,timestamp) VALUES (?,?,?,?,?,datetime('now'))")
        .run(uuidv4(), market.id, newYp, newNp, amount);
      db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,details,created_at) VALUES (?,?,?,?,?,?,datetime('now'))`)
        .run(uuidv4(), 'PLACE_BET', 'bet', betId, req.user.id,
             JSON.stringify({ option, amount, odds, market_id: market.id, use_bonus: useBonus }));
    })();

    // Re-fetch with local_volume computed
    const updatedMarket = db.prepare(`
      SELECT id,slug,title,description,category,status,end_date,
             min_bet,max_bet,yes_prob,no_prob,
             yes_pool,no_pool,(yes_pool+no_pool) AS local_volume,
             bet_count,resolution,image_url,option_a,option_b,
             source,created_at,updated_at
      FROM markets WHERE id=?
    `).get(market.id);

    // New balance to return (real balance unchanged if bonus was used)
    const newUser = db.prepare('SELECT balance,bonus_balance FROM users WHERE id=?').get(req.user.id);

    logger.info(`Bet ${betId}: ${req.user.username} → ${option} ${amount} HTG @ ${odds.toFixed(4)}${useBonus ? ' [BONUS]' : ''}`);
    CacheService.invalidatePattern('markets:');

    const broadcastFn = req.app?.locals?.broadcast;
    if (broadcastFn) {
      broadcastFn({
        type:         'market:update',
        market_id:    updatedMarket.id,
        slug:         updatedMarket.slug,
        yes_prob:     updatedMarket.yes_prob,
        no_prob:      updatedMarket.no_prob,
        local_volume: updatedMarket.local_volume,
        bet_count:    updatedMarket.bet_count,
      });
    }

    res.status(201).json({
      id: betId, option, amount,
      potential_payout: potential, odds,
      use_bonus: useBonus,
      new_balance:       newUser.balance,
      new_bonus_balance: newUser.bonus_balance,
      market: updatedMarket,
    });
  } catch (e) {
    if (e.message === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ detail: 'Balans ensifizan pou pari sa a.' });
    }
    logger.error('Bet: ' + e.message);
    res.status(500).json({ detail: 'Erè pari' });
  }
});

module.exports = router;
