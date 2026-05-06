const router = require('express').Router();
const { query, body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { getDb } = require('../database');
const logger = require('../utils/logger');

// Auto-close expired markets helper
function autoClose(db) {
  try { db.prepare("UPDATE markets SET status='closed',updated_at=datetime('now') WHERE status='active' AND end_date < datetime('now')").run(); } catch {}
}

// GET /api/v1/markets
router.get('/', [
  query('status').optional().isIn(['active','closed','resolved','draft','cancelled','all']),
  query('category').optional().isLength({ max: 30 }),
  query('skip').optional().isInt({ min: 0 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isLength({ max: 100 }),
  query('sort').optional().isIn(['volume','new','ending','competitive']),
  query('month').optional().isInt({ min: 1, max: 12 }),
  query('year').optional().isInt({ min: 2020, max: 2050 }),
  validate
], (req, res) => {
  try {
    const db = getDb();
    autoClose(db);
    const { status='active', category, skip=0, limit=50, search, sort='volume', month, year } = req.query;

    let sql = 'SELECT * FROM markets WHERE 1=1';
    const params = [];

    if (status && status !== 'all') { sql += ' AND status=?'; params.push(status); }
    if (category) { sql += ' AND category=?'; params.push(category); }
    if (search && search.trim().length >= 2) {
      sql += ' AND (title LIKE ? OR description LIKE ?)';
      const q = `%${search.trim().slice(0,50)}%`;
      params.push(q, q);
    }
    if (month && year) {
      sql += " AND strftime('%m',created_at)=? AND strftime('%Y',created_at)=?";
      params.push(String(month).padStart(2,'0'), String(year));
    } else if (year) {
      sql += " AND strftime('%Y',created_at)=?";
      params.push(String(year));
    }

    const sortMap = { volume:'total_volume DESC', new:'created_at DESC', ending:'end_date ASC', competitive:'ABS(yes_prob-0.5) ASC' };
    sql += ` ORDER BY ${sortMap[sort]||sortMap.volume} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(skip));

    res.json(db.prepare(sql).all(...params));
  } catch (e) {
    logger.error('Markets list: '+e.message);
    res.status(500).json({ detail: 'Erè chajman' });
  }
});

// GET /api/v1/markets/my-bets (must be before :idOrSlug)
router.get('/my-bets', authenticate, (req, res) => {
  try {
    const { skip=0, limit=100, status, month, year } = req.query;
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
      params.push(String(month).padStart(2,'0'), String(year));
    } else if (year) {
      sql += " AND strftime('%Y',b.created_at)=?";
      params.push(String(year));
    }
    sql += ' ORDER BY b.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(skip));
    res.json(getDb().prepare(sql).all(...params));
  } catch (e) { res.status(500).json({ detail: 'Erè' }); }
});

// GET /api/v1/markets/my-slips — combi-bet slips
router.get('/my-slips', authenticate, (req, res) => {
  try {
    const db = getDb();
    const slips = db.prepare(
      "SELECT * FROM bet_slips WHERE user_id=? ORDER BY created_at DESC LIMIT 50"
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
  } catch (e) { res.status(500).json({ detail: 'Erè' }); }
});

// POST /api/v1/markets/slip — create combi-bet slip
router.post('/slip', authenticate, [
  body('selections').isArray({ min: 2, max: 10 }),
  body('selections.*.market_id').isString(),
  body('selections.*.option').isIn(['yes','no']),
  body('amount').isFloat({ min: 100 }),
  validate
], (req, res) => {
  try {
    const { selections, amount } = req.body;
    const db = getDb();

    if (parseFloat(req.user.balance) < amount)
      return res.status(400).json({ detail: 'Balans ensifizan' });

    // Validate all markets and calculate total odds
    let totalOdds = 1.0;
    const resolvedSelections = [];
    for (const sel of selections) {
      const m = db.prepare("SELECT * FROM markets WHERE id=? AND status='active'").get(sel.market_id);
      if (!m) return res.status(400).json({ detail: `Mache ${sel.market_id} pa disponib` });
      const odds = sel.option === 'yes' ? (1/m.yes_prob) : (1/m.no_prob);
      totalOdds *= parseFloat(odds.toFixed(4));
      resolvedSelections.push({ market_id: sel.market_id, option_chosen: sel.option, odds_at_time: odds });
    }

    const potential_gain = parseFloat((amount * totalOdds).toFixed(2));
    const slipId = uuidv4();
    const before = parseFloat(req.user.balance);
    const after  = parseFloat((before - amount).toFixed(2));

    db.transaction(() => {
      db.prepare('UPDATE users SET balance=?,updated_at=datetime("now") WHERE id=?').run(after, req.user.id);
      db.prepare(`INSERT INTO bet_slips (id,user_id,total_odds,amount,potential_gain,status) VALUES (?,?,?,?,?,'active')`)
        .run(slipId, req.user.id, totalOdds, amount, potential_gain);
      for (const sel of resolvedSelections) {
        db.prepare(`INSERT INTO bet_slip_selections (id,bet_slip_id,market_id,option_chosen,odds_at_time) VALUES (?,?,?,?,?)`)
          .run(uuidv4(), slipId, sel.market_id, sel.option_chosen, sel.odds_at_time);
      }
      db.prepare(`INSERT INTO transactions (id,user_id,type,amount,balance_before,balance_after,status,description,created_at)
        VALUES (?,?,'bet_slip',?,?,?,'completed',?,datetime('now'))`)
        .run(uuidv4(), req.user.id, amount, before, after, `Fich Kombi — ${selections.length} seksyon × ${totalOdds.toFixed(2)}`);
      db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,details,created_at) VALUES (?,?,?,?,?,?,datetime('now'))`)
        .run(uuidv4(), 'CREATE_BET_SLIP', 'bet_slip', slipId, req.user.id, JSON.stringify({ amount, totalOdds, potential_gain, count: selections.length }));
    })();

    logger.info(`BetSlip ${slipId}: ${amount} HTG × ${totalOdds.toFixed(2)} = ${potential_gain} HTG by ${req.user.username}`);
    res.status(201).json({ id: slipId, total_odds: totalOdds, amount, potential_gain, new_balance: after });
  } catch (e) {
    logger.error('Slip: '+e.message);
    res.status(500).json({ detail: 'Erè fich kombi' });
  }
});

// GET /api/v1/markets/:idOrSlug
router.get('/:idOrSlug', (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const market = getDb().prepare(isUuid ? 'SELECT * FROM markets WHERE id=?' : 'SELECT * FROM markets WHERE slug=?').get(idOrSlug);
    if (!market) return res.status(404).json({ detail: 'Pa jwenn' });
    res.json(market);
  } catch { res.status(500).json({ detail: 'Erè' }); }
});

// GET /api/v1/markets/:id/price-history
router.get('/:id/price-history', (req, res) => {
  try {
    const hours = Math.min(parseInt(req.query.hours||'168'), 720);
    const rows = getDb().prepare(
      "SELECT * FROM price_points WHERE market_id=? AND timestamp >= datetime('now',?) ORDER BY timestamp ASC"
    ).all(req.params.id, `-${hours} hours`);
    res.json(rows);
  } catch { res.status(500).json({ detail: 'Erè' }); }
});

// POST /api/v1/markets/:id/bet — single bet
router.post('/:id/bet', authenticate, [
  body('option').isIn(['yes','no']),
  body('amount').isFloat({ min: 50 }),
  validate
], (req, res) => {
  try {
    const db = getDb();
    autoClose(db);
    const market = db.prepare("SELECT * FROM markets WHERE id=? AND status='active'").get(req.params.id);
    if (!market) return res.status(404).json({ detail: 'Mache pa disponib' });
    if (req.body.amount < market.min_bet) return res.status(400).json({ detail: `Min: ${market.min_bet} HTG` });
    if (req.body.amount > market.max_bet) return res.status(400).json({ detail: `Max: ${market.max_bet} HTG` });

    const { option, amount } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
    if (parseFloat(user.balance) < amount) return res.status(400).json({ detail: 'Balans ensifizan' });

    const odds = option === 'yes' ? (1/market.yes_prob) : (1/market.no_prob);
    const potential = parseFloat((amount * odds).toFixed(2));
    const betId = uuidv4();

    const yPool = parseFloat(market.yes_pool) + (option==='yes'?amount:0);
    const nPool = parseFloat(market.no_pool)  + (option==='no'?amount:0);
    const total  = yPool + nPool;
    const newYp  = total > 0 ? yPool/total : 0.5;
    const before = parseFloat(user.balance);
    const after  = parseFloat((before - amount).toFixed(2));

    db.transaction(() => {
      db.prepare('UPDATE users SET balance=?,updated_at=datetime("now") WHERE id=?').run(after, user.id);
      db.prepare(`INSERT INTO bets (id,user_id,market_id,option,amount,potential_payout,odds_at_bet,status) VALUES (?,?,?,?,?,?,?,'active')`)
        .run(betId, user.id, market.id, option, amount, potential, odds);
      db.prepare(`UPDATE markets SET yes_pool=?,no_pool=?,yes_prob=?,no_prob=?,total_volume=total_volume+?,bet_count=bet_count+1,updated_at=datetime('now') WHERE id=?`)
        .run(yPool, nPool, newYp, 1-newYp, amount, market.id);
      db.prepare(`INSERT INTO transactions (id,user_id,type,amount,balance_before,balance_after,status,description,reference_id,created_at)
        VALUES (?,?,'bet',?,?,?,'completed',?,?,datetime('now'))`)
        .run(uuidv4(), user.id, amount, before, after, `Pari ${option.toUpperCase()} — ${market.title.slice(0,40)}`, market.id);
      db.prepare(`INSERT INTO price_points (id,market_id,yes_price,no_price,volume,timestamp) VALUES (?,?,?,?,?,datetime('now'))`)
        .run(uuidv4(), market.id, newYp, 1-newYp, amount);
      db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,details,created_at) VALUES (?,?,?,?,?,?,datetime('now'))`)
        .run(uuidv4(),'PLACE_BET','bet',betId,user.id,JSON.stringify({option,amount,odds,market_id:market.id}));
    })();

    const updatedMarket = db.prepare('SELECT * FROM markets WHERE id=?').get(market.id);
    logger.info(`Bet ${betId}: ${user.username} → ${option} ${amount} HTG @ ${odds.toFixed(4)}`);
    res.status(201).json({ id: betId, option, amount, potential_payout: potential, odds, new_balance: after, market: updatedMarket });
  } catch (e) {
    logger.error('Bet: '+e.message);
    res.status(500).json({ detail: 'Erè pari' });
  }
});

module.exports = router;
