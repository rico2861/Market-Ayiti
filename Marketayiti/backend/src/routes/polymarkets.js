/**
 * Polymarket public read-only API.
 * All endpoints serve data from the local DB (already synced from Polymarket).
 *
 * GET /api/v1/polymarkets              — paginated market list
 * GET /api/v1/polymarkets/stats        — aggregate stats
 * GET /api/v1/polymarkets/:id          — single market + price history
 * GET /api/v1/polymarkets/:id/history  — price history
 */

const router = require('express').Router();
const { query } = require('express-validator');
const { validate } = require('../middleware/validate');
const { getDb } = require('../database');
const logger = require('../utils/logger');
const CacheService = require('../services/cache.service');

const VALID_STATUSES  = ['active','closed','resolved','all'];
const VALID_SORTS     = ['volume','new','ending','competitive','prob_asc','prob_desc'];

// ── GET /api/v1/polymarkets ───────────────────────────────────────────────────
router.get('/', [
  query('status').optional().isIn(VALID_STATUSES),
  query('category').optional().isString().isLength({ max: 50 }),
  query('search').optional().isString().isLength({ max: 100 }),
  query('sort').optional().isIn(VALID_SORTS),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('skip').optional().isInt({ min: 0 }),
  query('winner').optional().isIn(['yes','no']),
  validate,
], (req, res) => {
  try {
    const { status = 'active', category, search, sort = 'volume', winner } = req.query;
    const limit = Math.min(parseInt(req.query.limit || '50'), 100);
    const skip  = Math.max(0, parseInt(req.query.skip  || '0'));

    // Cache only simple, unfiltered requests
    const cacheable = !search && !winner && skip === 0;
    const cacheKey  = cacheable ? `polymarkets:${status}:${category || 'all'}:${sort}:${limit}` : null;
    if (cacheKey) {
      const hit = CacheService.get(cacheKey);
      if (hit) return res.json(hit);
    }

    const db = getDb();
    // polymarket_url intentionally excluded — no external branding exposed to client
    let sql    = `SELECT id,slug,title,description,category,status,end_date,
                         yes_prob,no_prob,total_volume,liquidity,bet_count,resolution,
                         image_url,option_a,option_b,
                         created_at,updated_at
                  FROM markets WHERE source='polymarket'`;
    const params = [];

    if (status !== 'all')  { sql += ' AND status=?';   params.push(status); }
    if (category)          { sql += ' AND category=?'; params.push(category); }
    if (winner)            { sql += ' AND resolution=?'; params.push(winner); }
    if (search?.trim().length >= 2) {
      sql += ' AND (title LIKE ? OR description LIKE ?)';
      const q = `%${search.trim().slice(0,80)}%`;
      params.push(q, q);
    }

    const sortMap = {
      volume:      'total_volume DESC',
      new:         'created_at DESC',
      ending:      'end_date ASC',
      competitive: 'ABS(yes_prob-0.5) ASC',
      prob_asc:    'yes_prob ASC',
      prob_desc:   'yes_prob DESC',
    };
    sql += ` ORDER BY ${sortMap[sort] || sortMap.volume} LIMIT ? OFFSET ?`;
    params.push(limit, skip);

    const markets = db.prepare(sql).all(...params);
    const result  = { data: markets, limit, skip, count: markets.length };

    if (cacheKey) CacheService.set(cacheKey, result, 15); // 15s TTL
    res.json(result);

  } catch (e) {
    logger.error('GET /polymarkets: ' + e.message);
    res.status(500).json({ detail: 'Erè chajman' });
  }
});

// ── GET /api/v1/polymarkets/stats ─────────────────────────────────────────────
router.get('/stats', (req, res) => {
  try {
    const cached = CacheService.get('polymarkets:stats');
    if (cached) return res.json(cached);

    const db = getDb();
    const row = db.prepare(`
      SELECT
        COUNT(*)                                              AS total,
        SUM(status='active')                                  AS active,
        SUM(status='closed')                                  AS closed,
        SUM(status='resolved')                                AS resolved,
        SUM(yes_pool+no_pool)                                 AS total_volume,
        SUM(status='resolved' AND resolution='yes')           AS resolved_yes,
        SUM(status='resolved' AND resolution='no')            AS resolved_no,
        MAX(updated_at)                                       AS last_updated
      FROM markets WHERE source='polymarket'
    `).get();

    // Top categories
    const cats = db.prepare(`
      SELECT category, COUNT(*) AS cnt, SUM(yes_pool+no_pool) AS vol
      FROM markets WHERE source='polymarket' AND status='active'
      GROUP BY category ORDER BY cnt DESC LIMIT 8
    `).all();

    const stats = {
      total:         row.total         || 0,
      active:        row.active        || 0,
      closed:        row.closed        || 0,
      resolved:      row.resolved      || 0,
      total_volume:  row.total_volume  || 0,
      resolved_yes:  row.resolved_yes  || 0,
      resolved_no:   row.resolved_no   || 0,
      last_updated:  row.last_updated,
      categories:    cats,
    };

    CacheService.set('polymarkets:stats', stats, 30);
    res.json(stats);

  } catch (e) {
    logger.error('GET /polymarkets/stats: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// ── GET /api/v1/polymarkets/:id ───────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const market = db.prepare(`
      SELECT id,slug,title,description,category,status,end_date,
             yes_prob,no_prob,yes_pool,no_pool,total_volume,liquidity,
             bet_count,resolution,image_url,option_a,option_b,created_at,updated_at
      FROM markets
      WHERE source='polymarket' AND (id=? OR polymarket_id=? OR slug=?)
      LIMIT 1
    `).get(req.params.id, req.params.id, req.params.id);

    if (!market) return res.status(404).json({ detail: 'Mache pa jwenn' });

    // Include recent price history
    const history = db.prepare(`
      SELECT yes_price, no_price, volume, timestamp
      FROM price_points
      WHERE market_id=?
      ORDER BY timestamp DESC LIMIT 200
    `).all(market.id).reverse();

    res.json({ ...market, price_history: history });

  } catch (e) {
    logger.error('GET /polymarkets/:id: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// ── GET /api/v1/polymarkets/:id/history ──────────────────────────────────────
router.get('/:id/history', [
  query('hours').optional().isInt({ min: 1, max: 720 }),
  validate,
], (req, res) => {
  try {
    const hours = Math.min(parseInt(req.query.hours || '168'), 720);
    const db    = getDb();
    const market = db.prepare(`
      SELECT id FROM markets WHERE source='polymarket' AND (id=? OR polymarket_id=?) LIMIT 1
    `).get(req.params.id, req.params.id);

    if (!market) return res.status(404).json({ detail: 'Mache pa jwenn' });

    const rows = db.prepare(`
      SELECT yes_price, no_price, volume, timestamp
      FROM price_points
      WHERE market_id=? AND timestamp >= datetime('now','-${hours} hours')
      ORDER BY timestamp ASC LIMIT 1000
    `).all(market.id);

    res.json(rows);

  } catch (e) {
    logger.error('GET /polymarkets/:id/history: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

module.exports = router;
