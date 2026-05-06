const router = require('express').Router();
const { body, query } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { validate } = require('../middleware/validate');
const { requireAdmin } = require('../middleware/auth');
const { getDb } = require('../database');
const { sanitize } = require('../utils/security');
const { slugify, ensureUniqueSlug } = require('../utils/slug');
const logger = require('../utils/logger');

router.use(requireAdmin);

// GET /api/v1/admin/stats
router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    const wkAgo = new Date(Date.now() - 7*86400*1000).toISOString();
    const pending_withdrawals = db.prepare("SELECT COUNT(*) c FROM transactions WHERE type='withdrawal' AND status='pending'").get().c;
    res.json({
      users: {
        total:         db.prepare('SELECT COUNT(*) c FROM users').get().c,
        active:        db.prepare("SELECT COUNT(*) c FROM users WHERE status='active'").get().c,
        new_this_week: db.prepare('SELECT COUNT(*) c FROM users WHERE created_at>=?').get(wkAgo).c
      },
      markets: {
        total:    db.prepare('SELECT COUNT(*) c FROM markets').get().c,
        active:   db.prepare("SELECT COUNT(*) c FROM markets WHERE status='active'").get().c,
        resolved: db.prepare("SELECT COUNT(*) c FROM markets WHERE status='resolved'").get().c
      },
      finance: {
        total_volume:     Math.round(db.prepare('SELECT COALESCE(SUM(total_volume),0) s FROM markets').get().s*100)/100,
        total_deposits:   Math.round(db.prepare("SELECT COALESCE(SUM(amount),0) s FROM transactions WHERE type='deposit' AND status='completed'").get().s*100)/100,
        total_bets:       db.prepare('SELECT COUNT(*) c FROM bets').get().c,
        volume_this_week: Math.round(db.prepare('SELECT COALESCE(SUM(amount),0) s FROM bets WHERE created_at>=?').get(wkAgo).s*100)/100,
        pending_withdrawals
      },
      bet_slips: {
        total:  db.prepare('SELECT COUNT(*) c FROM bet_slips').get().c,
        active: db.prepare("SELECT COUNT(*) c FROM bet_slips WHERE status='active'").get().c,
        won:    db.prepare("SELECT COUNT(*) c FROM bet_slips WHERE status='won'").get().c
      }
    });
  } catch (e) { logger.error('Stats: '+e.message); res.status(500).json({ detail: 'Erè' }); }
});

// GET /api/v1/admin/users
router.get('/users', [
  query('skip').optional().isInt({ min: 0 }),
  query('limit').optional().isInt({ min: 1, max: 200 }),
  validate
], (req, res) => {
  const { skip=0, limit=100, search, status } = req.query;
  let sql = 'SELECT id,email,username,full_name,phone,role,status,balance,last_login,created_at FROM users WHERE 1=1';
  const params = [];
  if (search) { sql += ' AND (username LIKE ? OR email LIKE ? OR phone LIKE ?)'; const q=`%${search}%`; params.push(q,q,q); }
  if (status) { sql += ' AND status=?'; params.push(status); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(skip));
  try { res.json(getDb().prepare(sql).all(...params)); }
  catch (e) { res.status(500).json({ detail: 'Erè' }); }
});

// PATCH /api/v1/admin/users/:id
router.patch('/users/:id', [
  body('role').optional().isIn(['user','admin']),
  body('status').optional().isIn(['active','suspended','banned']),
  body('balance').optional().isFloat({ min: 0 }),
  validate
], (req, res) => {
  try {
    const db = getDb();
    const { role, status, balance } = req.body;
    if (role !== undefined)    db.prepare("UPDATE users SET role=?,updated_at=datetime('now') WHERE id=?").run(role, req.params.id);
    if (status !== undefined)  db.prepare("UPDATE users SET status=?,updated_at=datetime('now') WHERE id=?").run(status, req.params.id);
    if (balance !== undefined) db.prepare("UPDATE users SET balance=?,updated_at=datetime('now') WHERE id=?").run(parseFloat(balance), req.params.id);
    res.json(db.prepare('SELECT id,email,username,role,status,balance FROM users WHERE id=?').get(req.params.id));
  } catch (e) { res.status(500).json({ detail: 'Erè' }); }
});

// GET /api/v1/admin/markets
router.get('/markets', (req, res) => {
  try {
    const { skip=0, limit=100, status } = req.query;
    let sql = 'SELECT * FROM markets WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND status=?'; params.push(status); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(skip));
    res.json(getDb().prepare(sql).all(...params));
  } catch (e) { res.status(500).json({ detail: 'Erè' }); }
});

// POST /api/v1/admin/markets
router.post('/markets', [
  body('title').isString().isLength({ min: 5, max: 200 }),
  body('description').optional().isString().isLength({ max: 2000 }),
  body('category').isIn(['politik','spo','ekonomi','kilti','sosyal','lot']),
  body('end_date').isISO8601(),
  body('min_bet').optional().isFloat({ min: 10 }),
  body('max_bet').optional().isFloat({ min: 100 }),
  validate
], (req, res) => {
  try {
    const db = getDb();
    const { title, description, category, end_date, min_bet=50, max_bet=100000, image_url } = req.body;
    if (new Date(end_date) <= new Date()) return res.status(400).json({ detail: 'Dat fèmti dwe nan lavni' });

    const baseSlug = slugify(title);
    const slug = ensureUniqueSlug(db, baseSlug);
    const id = uuidv4();

    db.prepare(`INSERT INTO markets (id,slug,title,description,category,status,end_date,min_bet,max_bet,yes_prob,no_prob,created_by,image_url,created_at,updated_at)
      VALUES (?,?,?,?,?,'active',?,?,?,0.5,0.5,?,?,datetime('now'),datetime('now'))`)
      .run(id, slug, sanitize(title), sanitize(description||''), category, end_date, min_bet, max_bet, req.user.id, image_url||null);

    db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,created_at) VALUES (?,?,?,?,?,datetime('now'))`)
      .run(uuidv4(), 'CREATE_MARKET', 'market', id, req.user.id);

    logger.info(`Market created: ${slug} by ${req.user.username}`);
    res.status(201).json(db.prepare('SELECT * FROM markets WHERE id=?').get(id));
  } catch (e) { logger.error('Create market: '+e.message); res.status(500).json({ detail: 'Erè kreye mache' }); }
});

// PATCH /api/v1/admin/markets/:id
router.patch('/markets/:id', (req, res) => {
  try {
    const db = getDb();
    const { title, description, status, end_date, image_url, min_bet, max_bet } = req.body;
    if (title)       db.prepare("UPDATE markets SET title=?,updated_at=datetime('now') WHERE id=?").run(sanitize(title), req.params.id);
    if (description) db.prepare("UPDATE markets SET description=?,updated_at=datetime('now') WHERE id=?").run(sanitize(description), req.params.id);
    if (status)      db.prepare("UPDATE markets SET status=?,updated_at=datetime('now') WHERE id=?").run(status, req.params.id);
    if (end_date)    db.prepare("UPDATE markets SET end_date=?,updated_at=datetime('now') WHERE id=?").run(end_date, req.params.id);
    if (image_url !== undefined) db.prepare("UPDATE markets SET image_url=?,updated_at=datetime('now') WHERE id=?").run(image_url, req.params.id);
    if (min_bet)     db.prepare("UPDATE markets SET min_bet=?,updated_at=datetime('now') WHERE id=?").run(parseFloat(min_bet), req.params.id);
    if (max_bet)     db.prepare("UPDATE markets SET max_bet=?,updated_at=datetime('now') WHERE id=?").run(parseFloat(max_bet), req.params.id);
    res.json(db.prepare('SELECT * FROM markets WHERE id=?').get(req.params.id));
  } catch (e) { res.status(500).json({ detail: 'Erè' }); }
});

// POST /api/v1/admin/markets/:id/resolve — ATOMIC resolution with combi-bet
router.post('/markets/:id/resolve', [
  body('resolution').isIn(['yes','no']),
  body('resolution_source').optional().isString().isLength({ max: 200 }),
  validate
], (req, res) => {
  try {
    const db = getDb();
    const market = db.prepare('SELECT * FROM markets WHERE id=?').get(req.params.id);
    if (!market) return res.status(404).json({ detail: 'Pa jwenn' });
    if (market.status === 'resolved') return res.status(400).json({ detail: 'Mache deja rezoud' });

    const { resolution, resolution_source } = req.body;
    let credited = 0, settled = 0, slip_won = 0, slip_lost = 0;

    db.transaction(() => {
      // 1. Mark market resolved
      db.prepare(`UPDATE markets SET status='resolved',resolution=?,resolution_source=?,resolved_by=?,resolved_at=datetime('now'),updated_at=datetime('now') WHERE id=?`)
        .run(resolution, resolution_source||null, req.user.id, market.id);

      // 2. Settle single bets
      const bets = db.prepare("SELECT * FROM bets WHERE market_id=? AND status='active'").all(market.id);
      for (const bet of bets) {
        const won = bet.option === resolution;
        db.prepare("UPDATE bets SET status=?,actual_payout=?,settled_at=datetime('now') WHERE id=?")
          .run(won?'won':'lost', won?bet.potential_payout:0, bet.id);
        if (won) {
          const user = db.prepare('SELECT balance FROM users WHERE id=?').get(bet.user_id);
          const before = parseFloat(user.balance);
          const after  = parseFloat((before + bet.potential_payout).toFixed(2));
          db.prepare("UPDATE users SET balance=?,updated_at=datetime('now') WHERE id=?").run(after, bet.user_id);
          db.prepare(`INSERT INTO transactions (id,user_id,type,amount,balance_before,balance_after,status,description,reference_id,created_at)
            VALUES (?,?,'win',?,?,?,'completed',?,?,datetime('now'))`)
            .run(uuidv4(), bet.user_id, bet.potential_payout, before, after, `Genyen: ${market.title.slice(0,40)}`, market.id);
          credited += bet.potential_payout;
        }
        settled++;
      }

      // 3. Update combi-bet selections for this market
      db.prepare("UPDATE bet_slip_selections SET result=? WHERE market_id=?")
        .run(resolution, market.id);

      // 4. Check if any combi-bet slip is now fully resolved
      const activeSlips = db.prepare(`
        SELECT DISTINCT bs.id FROM bet_slips bs
        JOIN bet_slip_selections bss ON bss.bet_slip_id=bs.id
        WHERE bss.market_id=? AND bs.status='active'
      `).all(market.id);

      for (const slipRef of activeSlips) {
        const slip = db.prepare('SELECT * FROM bet_slips WHERE id=?').get(slipRef.id);
        const allSelections = db.prepare('SELECT * FROM bet_slip_selections WHERE bet_slip_id=?').all(slip.id);

        // Check if any selection is a loser
        const hasLoss = allSelections.some(s => s.result !== null && s.result !== s.option_chosen);
        // Check if all resolved correctly
        const allWon  = allSelections.every(s => s.result !== null && s.result === s.option_chosen);
        const allResolved = allSelections.every(s => s.result !== null);

        if (hasLoss) {
          db.prepare("UPDATE bet_slips SET status='lost',settled_at=datetime('now') WHERE id=?").run(slip.id);
          slip_lost++;
        } else if (allWon && allResolved) {
          const gain = parseFloat((slip.amount * slip.total_odds).toFixed(2));
          const user = db.prepare('SELECT balance FROM users WHERE id=?').get(slip.user_id);
          const before = parseFloat(user.balance);
          const after  = parseFloat((before + gain).toFixed(2));
          db.prepare("UPDATE users SET balance=?,updated_at=datetime('now') WHERE id=?").run(after, slip.user_id);
          db.prepare("UPDATE bet_slips SET status='won',settled_at=datetime('now') WHERE id=?").run(slip.id);
          db.prepare(`INSERT INTO transactions (id,user_id,type,amount,balance_before,balance_after,status,description,created_at)
            VALUES (?,?,'win',?,?,?,'completed',?,datetime('now'))`)
            .run(uuidv4(), slip.user_id, gain, before, after, `Fich Kombi Genyen × ${slip.total_odds.toFixed(2)}`);
          credited += gain;
          slip_won++;
        }
      }

      // 5. Audit
      db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,details,created_at) VALUES (?,?,?,?,?,?,datetime('now'))`)
        .run(uuidv4(), 'RESOLVE_MARKET', 'market', market.id, req.user.id,
          JSON.stringify({ resolution, settled, credited, slip_won, slip_lost }));
    })();

    logger.info(`Market ${market.slug} resolved → ${resolution}: ${settled} bets, ${credited} HTG credited`);
    res.json({ message: 'Mache rezoud', resolution, bets_settled: settled, htg_credited: credited, slips_won: slip_won, slips_lost: slip_lost });
  } catch (e) {
    logger.error('Resolve: '+e.message);
    res.status(500).json({ detail: 'Erè rezolisyon. Okenn peman pa fèt.' });
  }
});

// DELETE /api/v1/admin/markets/:id — refund all bets
router.delete('/markets/:id', (req, res) => {
  try {
    const db = getDb();
    db.transaction(() => {
      const bets = db.prepare("SELECT * FROM bets WHERE market_id=? AND status='active'").all(req.params.id);
      for (const bet of bets) {
        db.prepare('UPDATE users SET balance=balance+? WHERE id=?').run(bet.amount, bet.user_id);
        db.prepare("UPDATE bets SET status='refunded' WHERE id=?").run(bet.id);
      }
      const slips = db.prepare(`
        SELECT DISTINCT bs.* FROM bet_slips bs
        JOIN bet_slip_selections bss ON bss.bet_slip_id=bs.id
        WHERE bss.market_id=? AND bs.status='active'
      `).all(req.params.id);
      for (const slip of slips) {
        db.prepare('UPDATE users SET balance=balance+? WHERE id=?').run(slip.amount, slip.user_id);
        db.prepare("UPDATE bet_slips SET status='refunded' WHERE id=?").run(slip.id);
      }
      db.prepare('DELETE FROM markets WHERE id=?').run(req.params.id);
      db.prepare('DELETE FROM price_points WHERE market_id=?').run(req.params.id);
    })();
    res.json({ message: 'Mache efase, pari ak fich yo remboure' });
  } catch (e) { res.status(500).json({ detail: 'Erè' }); }
});

// GET /api/v1/admin/transactions
router.get('/transactions', (req, res) => {
  try {
    const { skip=0, limit=100, type, status } = req.query;
    let sql = `SELECT t.*,u.username,u.email FROM transactions t JOIN users u ON t.user_id=u.id WHERE 1=1`;
    const params = [];
    if (type)   { sql += ' AND t.type=?';   params.push(type); }
    if (status) { sql += ' AND t.status=?'; params.push(status); }
    sql += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(skip));
    res.json(getDb().prepare(sql).all(...params));
  } catch (e) { res.status(500).json({ detail: 'Erè' }); }
});

// GET /api/v1/admin/withdrawals
router.get('/withdrawals', (req, res) => {
  try {
    const rows = getDb().prepare(`
      SELECT t.*,u.username,u.email,u.phone as user_phone
      FROM transactions t JOIN users u ON t.user_id=u.id
      WHERE t.type='withdrawal' ORDER BY t.created_at DESC LIMIT 200
    `).all();
    res.json(rows);
  } catch (e) { res.status(500).json({ detail: 'Erè' }); }
});

// POST /api/v1/admin/withdrawals/:id/approve
router.post('/withdrawals/:id/approve', (req, res) => {
  try {
    const db = getDb();
    const tx = db.prepare("SELECT * FROM transactions WHERE id=? AND type='withdrawal'").get(req.params.id);
    if (!tx) return res.status(404).json({ detail: 'Pa jwenn' });
    db.prepare("UPDATE transactions SET status='completed',completed_at=datetime('now') WHERE id=?").run(req.params.id);
    db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,created_at) VALUES (?,?,?,?,?,datetime('now'))`)
      .run(uuidv4(), 'APPROVE_WITHDRAWAL', 'transaction', req.params.id, req.user.id);
    res.json({ message: 'Retrè konfime' });
  } catch (e) { res.status(500).json({ detail: 'Erè' }); }
});

// POST /api/v1/admin/withdrawals/:id/reject
router.post('/withdrawals/:id/reject', (req, res) => {
  try {
    const db = getDb();
    const tx = db.prepare("SELECT * FROM transactions WHERE id=? AND type='withdrawal' AND status='pending'").get(req.params.id);
    if (!tx) return res.status(404).json({ detail: 'Pa jwenn oswa deja trete' });
    db.transaction(() => {
      db.prepare('UPDATE users SET balance=balance+?,updated_at=datetime("now") WHERE id=?').run(tx.balance_before - tx.balance_after, tx.user_id);
      db.prepare("UPDATE transactions SET status='rejected',completed_at=datetime('now') WHERE id=?").run(req.params.id);
    })();
    res.json({ message: 'Retrè rejte, balans remèt' });
  } catch (e) { res.status(500).json({ detail: 'Erè' }); }
});

// GET /api/v1/admin/audit
router.get('/audit', (req, res) => {
  try {
    const { skip=0, limit=100, action } = req.query;
    let sql = `SELECT l.*,u.username FROM audit_log l LEFT JOIN users u ON l.user_id=u.id WHERE 1=1`;
    const params = [];
    if (action) { sql += ' AND l.action=?'; params.push(action); }
    sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(skip));
    res.json(getDb().prepare(sql).all(...params));
  } catch (e) { res.status(500).json({ detail: 'Erè' }); }
});

module.exports = router;

// ── Categories management ─────────────────────────────────
// GET /api/v1/admin/categories — list all with market counts
router.get('/categories', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT category as id, COUNT(*) as market_count,
        SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active_count,
        SUM(total_volume) as total_volume
      FROM markets GROUP BY category ORDER BY market_count DESC
    `).all();
    // Add built-in categories not yet used
    const built = ['politik','spo','ekonomi','kilti','sosyal','lot'];
    const used  = rows.map((r) => r.id);
    const empty = built.filter(c => !used.includes(c)).map(c => ({
      id:c, market_count:0, active_count:0, total_volume:0
    }));
    res.json([...rows, ...empty]);
  } catch (e) { res.status(500).json({ detail: 'Erè' }); }
});
