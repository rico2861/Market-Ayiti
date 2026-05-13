const router = require('express').Router();
const { body, query } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { validate } = require('../middleware/validate');
const { requireAdmin } = require('../middleware/auth');
const { getDb } = require('../database');
const { sanitize, hashPassword } = require('../utils/security');
const { slugify } = require('../utils/slug');
const logger = require('../utils/logger');
const CacheService = require('../services/cache.service');
const CategoryService = require('../services/category.service');
const { pushNotification } = require('./notifications');
const { settleMarket }     = require('../services/settlement.service');

const VALID_CATEGORIES = ['politik', 'spo', 'ekonomi', 'kilti', 'sosyal', 'lot', 'nouvo'];
const VALID_STATUSES   = ['active', 'closed', 'resolved', 'draft', 'cancelled'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// All admin routes require admin authentication
router.use(requireAdmin);

// Rate limit all mutating admin operations (applied per route below)
function adminOpLimiter(req, res, next) {
  const limiter = req.app.locals.adminOpLimiter;
  if (limiter) return limiter(req, res, next);
  next();
}

// Validate UUID params on all /:id routes
router.param('id', (req, res, next, id) => {
  if (!UUID_RE.test(id)) return res.status(400).json({ detail: 'Identifyan envalid' });
  next();
});

// ── Dashboard stats ───────────────────────────────────────────────
router.get('/stats', (req, res) => {
  try {
    const db   = getDb();
    const wkAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
    const pending_withdrawals = db.prepare("SELECT COUNT(*) c FROM transactions WHERE type='withdrawal' AND status='pending'").get().c;
    const pending_amount      = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM transactions WHERE type='withdrawal' AND status='pending'").get().s;
    res.json({
      users: {
        total:         db.prepare('SELECT COUNT(*) c FROM users').get().c,
        active:        db.prepare("SELECT COUNT(*) c FROM users WHERE status='active'").get().c,
        suspended:     db.prepare("SELECT COUNT(*) c FROM users WHERE status='suspended'").get().c,
        banned:        db.prepare("SELECT COUNT(*) c FROM users WHERE status='banned'").get().c,
        new_this_week: db.prepare('SELECT COUNT(*) c FROM users WHERE created_at>=?').get(wkAgo).c
      },
      markets: {
        total:    db.prepare('SELECT COUNT(*) c FROM markets').get().c,
        active:   db.prepare("SELECT COUNT(*) c FROM markets WHERE status='active'").get().c,
        resolved: db.prepare("SELECT COUNT(*) c FROM markets WHERE status='resolved'").get().c,
        closed:   db.prepare("SELECT COUNT(*) c FROM markets WHERE status='closed'").get().c
      },
      finance: {
        total_volume:      Math.round(db.prepare('SELECT COALESCE(SUM(yes_pool+no_pool),0) s FROM markets').get().s * 100) / 100,
        total_deposits:    Math.round(db.prepare("SELECT COALESCE(SUM(amount),0) s FROM transactions WHERE type='deposit' AND status='completed'").get().s * 100) / 100,
        total_bonuses:     Math.round(db.prepare("SELECT COALESCE(SUM(amount),0) s FROM transactions WHERE type='bonus' AND status='completed'").get().s * 100) / 100,
        total_withdrawals: Math.round(db.prepare("SELECT COALESCE(SUM(amount),0) s FROM transactions WHERE type='withdrawal' AND status='completed'").get().s * 100) / 100,
        total_bets:        db.prepare('SELECT COUNT(*) c FROM bets').get().c,
        active_bets:       db.prepare("SELECT COUNT(*) c FROM bets WHERE status='active'").get().c,
        volume_this_week:  Math.round(db.prepare('SELECT COALESCE(SUM(amount),0) s FROM bets WHERE created_at>=?').get(wkAgo).s * 100) / 100,
        pending_withdrawals,
        pending_amount:    Math.round(pending_amount * 100) / 100
      },
      bet_slips: {
        total:  db.prepare('SELECT COUNT(*) c FROM bet_slips').get().c,
        active: db.prepare("SELECT COUNT(*) c FROM bet_slips WHERE status='active'").get().c,
        won:    db.prepare("SELECT COUNT(*) c FROM bet_slips WHERE status='won'").get().c
      }
    });
  } catch (e) {
    logger.error('Stats: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// ── Users ─────────────────────────────────────────────────────────

// POST /admin/users — create user
router.post('/users', adminOpLimiter, [
  body('identifier').isString().isLength({ min: 3, max: 100 }).trim(),
  body('password').isString().isLength({ min: 8, max: 100 }),
  body('full_name').optional().isString().isLength({ max: 100 }),
  body('role').optional().isIn(['user', 'admin']),
  validate
], (req, res) => {
  try {
    const db = getDb();
    const { identifier, password, full_name, role = 'user' } = req.body;

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const isPhone = /^(\+?509)?[0-9]{8,}$/.test(identifier.replace(/\s/g, ''));
    const id       = uuidv4();
    const email    = isEmail ? identifier.toLowerCase() : null;
    const phone    = isPhone && !isEmail ? identifier : null;
    const username = (!isEmail && !isPhone)
      ? identifier.toLowerCase().replace(/[^a-z0-9_-]/gi, '')
      : identifier.split('@')[0].slice(0, 30).replace(/[^a-z0-9_]/gi, '') + '_' + id.slice(0, 4);

    const existing = isEmail
      ? db.prepare('SELECT id FROM users WHERE email=?').get(email)
      : db.prepare('SELECT id FROM users WHERE username=?').get(username);
    if (existing) return res.status(409).json({ detail: 'Utilisateur existe déjà' });

    // Use parameterized role — never interpolate into SQL
    db.prepare(`INSERT INTO users (id,email,phone,username,hashed_password,full_name,role,status,balance,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,  'active',0,datetime('now'),datetime('now'))`)
      .run(id, email, phone, username, hashPassword(password), sanitize(full_name || ''), role);

    db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,details,ip,created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))`)
      .run(uuidv4(), 'CREATE_USER', 'user', id, req.user.id, JSON.stringify({ identifier, role }), req.ip || '');

    logger.info(`User created: ${username} role=${role} by ${req.user.username}`);
    res.status(201).json({ id, username, email, role, status: 'active', balance: 0 });
  } catch (e) {
    logger.error('Create user: ' + e.message);
    res.status(500).json({ detail: 'Erreur création utilisateur' });
  }
});

// GET /admin/users
router.get('/users', [
  query('skip').optional().isInt({ min: 0 }),
  query('limit').optional().isInt({ min: 1, max: 500 }),
  query('status').optional().isIn(['active', 'suspended', 'banned', 'all']),
  validate
], (req, res) => {
  try {
    const skip  = parseInt(req.query.skip  || '0');
    const limit = Math.min(parseInt(req.query.limit || '200'), 500);
    const { search, status } = req.query;

    let sql = 'SELECT id,email,username,full_name,phone,role,status,balance,COALESCE(bonus_balance,0) as bonus_balance,last_login,created_at FROM users WHERE 1=1';
    const params = [];
    if (search && search.trim()) {
      const q = `%${search.trim().slice(0, 50)}%`;
      sql += ' AND (username LIKE ? OR email LIKE ? OR phone LIKE ?)';
      params.push(q, q, q);
    }
    if (status && status !== 'all') { sql += ' AND status=?'; params.push(status); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, skip);

    res.json(getDb().prepare(sql).all(...params));
  } catch (e) {
    logger.error('Users list: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// GET /admin/users/locked-count — lightweight badge count (no heavy data)
router.get('/users/locked-count', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT COUNT(*) as count FROM users
      WHERE locked_until IS NOT NULL AND locked_until > datetime('now')
    `).get();
    res.json({ count: row.count });
  } catch (e) {
    res.json({ count: 0 });
  }
});

// GET /admin/users/locked — list all accounts currently locked or with failed attempts
// NOTE: must be defined before /users/:id to avoid 'locked' being captured as UUID param
router.get('/users/locked', (req, res) => {
  try {
    const db = getDb();
    const locked = db.prepare(`
      SELECT id, email, username, full_name, status,
             failed_attempts, locked_until, last_ip, last_login, created_at
      FROM users
      WHERE locked_until IS NOT NULL AND locked_until > datetime('now')
      ORDER BY locked_until DESC
    `).all();
    res.json(locked);
  } catch (e) {
    logger.error('Locked users: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// GET /admin/users/:id
router.get('/users/:id', (req, res) => {
  try {
    const db   = getDb();
    const user = db.prepare(`
      SELECT id,email,username,full_name,phone,role,status,
             balance,COALESCE(bonus_balance,0) as bonus_balance,
             COALESCE(ban_reason,'') as ban_reason,
             failed_attempts, locked_until,
             last_login,last_ip,created_at,updated_at
      FROM users WHERE id=?
    `).get(req.params.id);
    if (!user) return res.status(404).json({ detail: 'Pa jwenn' });

    const bets = db.prepare(`
      SELECT b.id,b.option,b.amount,b.potential_payout,b.actual_payout,
             b.odds_at_bet,b.status,b.created_at,
             m.title as market_title, m.category
      FROM bets b LEFT JOIN markets m ON b.market_id=m.id
      WHERE b.user_id=? ORDER BY b.created_at DESC LIMIT 20
    `).all(req.params.id);

    const transactions = db.prepare(`
      SELECT id,type,amount,balance_before,balance_after,
             status,description,payment_method,created_at
      FROM transactions WHERE user_id=?
      ORDER BY created_at DESC LIMIT 20
    `).all(req.params.id);

    const stats = db.prepare(`
      SELECT COUNT(*) as total_bets,
        SUM(CASE WHEN status='won' THEN 1 ELSE 0 END) as won_bets,
        COALESCE(SUM(amount),0) as total_wagered,
        COALESCE(SUM(CASE WHEN status='won' THEN actual_payout ELSE 0 END),0) as total_won
      FROM bets WHERE user_id=?
    `).get(req.params.id);

    res.json({ ...user, bets, transactions, stats });
  } catch (e) {
    logger.error('User detail: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// PATCH /admin/users/:id
router.patch('/users/:id', adminOpLimiter, [
  body('role').optional().isIn(['user', 'admin']),
  body('status').optional().isIn(['active', 'suspended', 'banned']),
  body('balance').optional().isFloat({ min: 0, max: 100000000 }),
  body('ban_reason').optional({ nullable: true }).isString().isLength({ max: 500 }),
  validate
], (req, res) => {
  try {
    const db     = getDb();
    const target = db.prepare('SELECT id,username,status FROM users WHERE id=?').get(req.params.id);
    if (!target) return res.status(404).json({ detail: 'Pa jwenn' });

    const { role, status, balance, ban_reason } = req.body;

    if (role !== undefined)    db.prepare("UPDATE users SET role=?,updated_at=datetime('now') WHERE id=?").run(role, req.params.id);
    if (balance !== undefined) db.prepare("UPDATE users SET balance=?,updated_at=datetime('now') WHERE id=?").run(parseFloat(balance), req.params.id);

    if (status !== undefined) {
      const isBan = status === 'banned';
      // When banning: require a reason; when unbanning: clear reason
      const reason = isBan ? sanitize(ban_reason || 'Aucune raison fournie') : null;
      db.prepare("UPDATE users SET status=?,ban_reason=?,updated_at=datetime('now') WHERE id=?")
        .run(status, reason, req.params.id);

      const action = isBan ? 'BAN_USER' : status === 'suspended' ? 'SUSPEND_USER' : 'UNBAN_USER';
      db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,details,ip,created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))`)
        .run(uuidv4(), action, 'user', req.params.id, req.user.id,
             JSON.stringify({
               admin:        req.user.username,
               target:       target.username,
               ancien_statut: target.status,
               nouveau_statut: status,
               ...(isBan ? { raison_bannissement: reason } : {}),
             }), req.ip || '');
    } else {
      db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,details,ip,created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))`)
        .run(uuidv4(), 'UPDATE_USER', 'user', req.params.id, req.user.id,
             JSON.stringify({ admin: req.user.username, target: target.username, changes: req.body }), req.ip || '');
    }

    res.json(db.prepare('SELECT id,email,username,role,status,balance,COALESCE(ban_reason,\'\') as ban_reason FROM users WHERE id=?').get(req.params.id));
  } catch (e) {
    logger.error('Update user: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// POST /admin/users/:id/force-unlock — admin manually unlocks a locked account
router.post('/users/:id/force-unlock', adminOpLimiter, [
  body('reason').isString().isLength({ min: 3, max: 500 }).trim(),
  validate
], (req, res) => {
  try {
    const db     = getDb();
    const target = db.prepare('SELECT id, username, email, failed_attempts, locked_until FROM users WHERE id=?').get(req.params.id);
    if (!target) return res.status(404).json({ detail: 'Pa jwenn' });

    const reason = req.body.reason;

    db.transaction(() => {
      // Clear lockout state
      db.prepare("UPDATE users SET failed_attempts=0, locked_until=NULL, updated_at=datetime('now') WHERE id=?")
        .run(req.params.id);

      // Revoke all refresh tokens for safety
      db.prepare("UPDATE refresh_tokens SET revoked=1 WHERE user_id=?")
        .run(req.params.id);

      // Invalidate any pending unlock codes
      db.prepare("UPDATE password_reset_codes SET used=1 WHERE user_id=?")
        .run(req.params.id);

      // Audit log
      db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,details,ip,created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))`)
        .run(uuidv4(), 'FORCE_UNLOCK', 'user', req.params.id, req.user.id,
             JSON.stringify({
               admin:           req.user.username,
               target:          target.username,
               reason,
               failed_attempts: target.failed_attempts,
               was_locked_until: target.locked_until,
             }), req.ip || '');
    })();

    logger.warn(`FORCE_UNLOCK: ${target.username} by admin ${req.user.username} — ${reason}`);
    res.json({ success: true, message: `Kont ${target.username} debloke avèk siksè` });
  } catch (e) {
    logger.error('Force unlock: ' + e.message);
    res.status(500).json({ detail: 'Erè deblokaj' });
  }
});

// POST /admin/users/:id/deposit
router.post('/users/:id/deposit', [
  body('amount').isFloat({ min: 1, max: 10000000 }),
  body('description').optional().isString().isLength({ max: 200 }),
  validate
], (req, res) => {
  try {
    const db   = getDb();
    const user = db.prepare('SELECT id,username,balance,COALESCE(bonus_balance,0) as bonus_balance FROM users WHERE id=?').get(req.params.id);
    if (!user) return res.status(404).json({ detail: 'Pa jwenn' });

    const amount        = parseFloat(req.body.amount);
    const desc          = sanitize(req.body.description || 'Bonus administrateur');
    const bonusBefore   = parseFloat(user.bonus_balance);
    const bonusAfter    = parseFloat((bonusBefore + amount).toFixed(2));
    const txId          = uuidv4();

    db.transaction(() => {
      // Bonus credits bonus_balance ONLY — real balance is untouched
      db.prepare("UPDATE users SET bonus_balance=?,updated_at=datetime('now') WHERE id=?")
        .run(bonusAfter, req.params.id);
      db.prepare(`INSERT INTO transactions
        (id,user_id,type,amount,balance_before,balance_after,status,description,payment_method,created_at)
        VALUES (?,?,'bonus',?,?,?,'completed',?,'admin',datetime('now'))`)
        .run(txId, req.params.id, amount, bonusBefore, bonusAfter, desc);
      db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,details,ip,created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))`)
        .run(uuidv4(), 'BONUS_CREDIT', 'user', req.params.id, req.user.id, JSON.stringify({ amount, description: desc }), req.ip || '');
    })();

    logger.info(`Bonus: ${amount} HTG → ${user.username} (bonus_balance) by ${req.user.username}`);

    // Push WS balance update so frontend refreshes instantly (no page reload needed)
    const broadcast = req.app.locals.broadcast;
    if (broadcast) {
      broadcast({ type: 'user:balance_update', user_id: req.params.id, bonus_balance: bonusAfter });
    }

    // Push in-app notification to the user
    pushNotification(req.params.id, {
      type: 'bonus',
      title: 'Bonus Kreye!',
      message: `${amount.toLocaleString()} HTG bonus ajoute nan kont ou.`,
    });

    res.json({ message: 'Bonus crédité avec succès', transaction_id: txId, new_bonus_balance: bonusAfter });
  } catch (e) {
    logger.error('Manual deposit: ' + e.message);
    res.status(500).json({ detail: 'Erè dépôt' });
  }
});

// POST /admin/users/:id/remove-bonus  { amount: number | 'all', description?: string }
router.post('/users/:id/remove-bonus', [
  body('amount').custom(v => {
    if (v === 'all') return true;
    const n = parseFloat(v);
    if (!isNaN(n) && n > 0) return true;
    throw new Error('Montant invalide');
  }),
  body('description').optional().isString().isLength({ max: 200 }),
  validate
], (req, res) => {
  try {
    const db   = getDb();
    const user = db.prepare('SELECT id,username,COALESCE(bonus_balance,0) as bonus_balance FROM users WHERE id=?').get(req.params.id);
    if (!user) return res.status(404).json({ detail: 'Pa jwenn' });

    const currentBonus = parseFloat(user.bonus_balance);
    if (currentBonus <= 0) return res.status(400).json({ detail: 'Itilizatè pa gen bonus' });

    const removeAll = req.body.amount === 'all';
    const amount    = removeAll ? currentBonus : Math.min(parseFloat(req.body.amount), currentBonus);
    if (amount <= 0) return res.status(400).json({ detail: 'Montant invalide' });

    const bonusAfter = parseFloat((currentBonus - amount).toFixed(2));
    const reason     = sanitize(req.body.description || '');
    const desc       = removeAll
      ? `Retrait TOTAL bonus: ${currentBonus.toFixed(2)} HTG retiré (bonus_avant=${currentBonus}, bonus_après=0)${reason ? ' — ' + reason : ''}`
      : `Retrait PARTIEL bonus: ${amount.toFixed(2)} HTG retiré sur ${currentBonus.toFixed(2)} HTG (bonus_après=${bonusAfter.toFixed(2)})${reason ? ' — ' + reason : ''}`;
    const txId       = uuidv4();

    db.transaction(() => {
      db.prepare("UPDATE users SET bonus_balance=?,updated_at=datetime('now') WHERE id=?")
        .run(bonusAfter, req.params.id);
      db.prepare(`INSERT INTO transactions
        (id,user_id,type,amount,balance_before,balance_after,status,description,payment_method,created_at)
        VALUES (?,?,'bonus_debit',?,?,?,'completed',?,'admin',datetime('now'))`)
        .run(txId, req.params.id, amount, currentBonus, bonusAfter, desc);
      db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,details,ip,created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))`)
        .run(uuidv4(), 'BONUS_REMOVE', 'user', req.params.id, req.user.id,
             JSON.stringify({
               admin: req.user.username,
               target: user.username,
               mode: removeAll ? 'total' : 'partiel',
               amount_removed: amount,
               bonus_avant: currentBonus,
               bonus_apres: bonusAfter,
               raison: reason || null,
             }), req.ip || '');
    })();

    logger.info(`Bonus remove: -${amount} HTG from ${user.username} (${removeAll ? 'TOTAL' : 'partiel'} | avant=${currentBonus} après=${bonusAfter}) by ${req.user.username}`);

    const broadcast = req.app.locals.broadcast;
    if (broadcast) {
      broadcast({ type: 'user:balance_update', user_id: req.params.id, bonus_balance: bonusAfter });
    }

    res.json({ message: 'Bonus retiré avec succès', transaction_id: txId, removed: amount, new_bonus_balance: bonusAfter });
  } catch (e) {
    logger.error('Remove bonus: ' + e.message);
    res.status(500).json({ detail: 'Erè retrait bonus' });
  }
});

// POST /admin/users/:id/reset-password
router.post('/users/:id/reset-password', [
  body('new_password').isString().isLength({ min: 8, max: 100 }),
  validate
], (req, res) => {
  try {
    const db   = getDb();
    const user = db.prepare('SELECT id,username,hashed_password FROM users WHERE id=?').get(req.params.id);
    if (!user) return res.status(404).json({ detail: 'Pa jwenn' });

    const { verifyPassword } = require('../utils/security');
    if (verifyPassword(req.body.new_password, user.hashed_password))
      return res.status(400).json({ detail: 'Le nouveau mot de passe ne peut pas être identique à l\'ancien.' });

    db.prepare("UPDATE users SET hashed_password=?,updated_at=datetime('now') WHERE id=?")
      .run(hashPassword(req.body.new_password), req.params.id);
    db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,details,ip,created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))`)
      .run(uuidv4(), 'ADMIN_RESET_PASSWORD', 'user', req.params.id, req.user.id, JSON.stringify({ target: user.username }), req.ip || '');

    logger.info(`Password reset for ${user.username} by ${req.user.username}`);
    res.json({ message: 'Mot de passe réinitialisé' });
  } catch (e) {
    logger.error('Reset password: ' + e.message);
    res.status(500).json({ detail: 'Erè reset' });
  }
});

// ── Markets ───────────────────────────────────────────────────────

// GET /admin/markets
router.get('/markets', [
  query('skip').optional().isInt({ min: 0 }),
  query('limit').optional().isInt({ min: 1, max: 500 }),
  query('status').optional().isIn([...VALID_STATUSES, 'all']),
  query('category').optional().isIn([...VALID_CATEGORIES, '']),
  validate
], (req, res) => {
  try {
    const skip  = parseInt(req.query.skip  || '0');
    const limit = Math.min(parseInt(req.query.limit || '200'), 500);
    const { status, category } = req.query;

    let sql = 'SELECT *, (yes_pool+no_pool) AS local_volume FROM markets WHERE 1=1';
    const params = [];
    if (status && status !== 'all') { sql += ' AND status=?'; params.push(status); }
    if (category)                   { sql += ' AND category=?'; params.push(category); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, skip);

    res.json(getDb().prepare(sql).all(...params));
  } catch (e) {
    logger.error('Markets list: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// POST /admin/markets
router.post('/markets', adminOpLimiter, [
  body('title').isString().isLength({ min: 3, max: 200 }).trim(),
  body('description').optional().isString().isLength({ max: 2000 }),
  body('category').isIn(VALID_CATEGORIES),
  body('end_date').isString().custom(v => {
    if (isNaN(new Date(v).getTime())) throw new Error('Date invalide');
    return true;
  }),
  body('min_bet').optional().isFloat({ min: 1, max: 1000000 }),
  body('max_bet').optional().isFloat({ min: 1, max: 10000000 }),
  body('option_a').optional().isString().isLength({ max: 80 }),
  body('option_b').optional().isString().isLength({ max: 80 }),
  body('odds_a').optional().isFloat({ min: 1.01, max: 100 }),
  body('odds_b').optional().isFloat({ min: 1.01, max: 100 }),
  validate
], (req, res) => {
  try {
    const db = getDb();
    const {
      title, description, category, end_date,
      min_bet = 50, max_bet = 100000,
      option_a = 'Oui', option_b = 'Non',
      odds_a, odds_b, image_url
    } = req.body;

    if (new Date(end_date) <= new Date())
      return res.status(400).json({ detail: 'Dat fèmti dwe nan lavni' });

    let yes_prob = 0.5, no_prob = 0.5;
    if (odds_a) yes_prob = parseFloat(Math.min(0.99, Math.max(0.01, 1 / parseFloat(odds_a))).toFixed(4));
    if (odds_b) no_prob  = parseFloat(Math.min(0.99, Math.max(0.01, 1 / parseFloat(odds_b))).toFixed(4));

    const id       = uuidv4();
    const baseSlug = slugify(title);
    const slug     = `${baseSlug}-${id.replace(/-/g, '').slice(0, 8)}`;

    // Validate image_url is an actual URL or data URI, not a script
    const sanitizedImage = image_url ? (
      (typeof image_url === 'string' && (image_url.startsWith('http') || image_url.startsWith('data:image/')))
        ? image_url
        : null
    ) : null;

    db.prepare(`INSERT INTO markets
      (id,slug,title,description,category,status,end_date,min_bet,max_bet,yes_prob,no_prob,created_by,image_url,option_a,option_b,created_at,updated_at)
      VALUES (?,?,?,?,?,'active',?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`)
      .run(id, slug, sanitize(title), sanitize(description || ''), category,
           end_date, parseFloat(min_bet), parseFloat(max_bet),
           yes_prob, no_prob, req.user.id, sanitizedImage,
           sanitize(option_a), sanitize(option_b));

    db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,created_at) VALUES (?,?,?,?,?,datetime('now'))`)
      .run(uuidv4(), 'CREATE_MARKET', 'market', id, req.user.id);

    CacheService.invalidatePattern('markets:');
    CategoryService.refreshCounts();
    CacheService.invalidate('categories:all');

    logger.info(`Market created: ${slug} by ${req.user.username}`);
    res.status(201).json(db.prepare('SELECT * FROM markets WHERE id=?').get(id));
  } catch (e) {
    logger.error('Create market: ' + e.message);
    res.status(500).json({ detail: 'Erreur création marché' });
  }
});

// PATCH /admin/markets/:id
router.patch('/markets/:id', adminOpLimiter, [
  body('title').optional().isString().isLength({ min: 3, max: 200 }).trim(),
  body('description').optional().isString().isLength({ max: 2000 }),
  body('status').optional().isIn(VALID_STATUSES),
  body('category').optional().isIn(VALID_CATEGORIES),
  body('end_date').optional().isString(),
  body('min_bet').optional().isFloat({ min: 1, max: 1000000 }),
  body('max_bet').optional().isFloat({ min: 1, max: 10000000 }),
  body('option_a').optional().isString().isLength({ max: 80 }),
  body('option_b').optional().isString().isLength({ max: 80 }),
  body('odds_a').optional().isFloat({ min: 1.01, max: 100 }),
  body('odds_b').optional().isFloat({ min: 1.01, max: 100 }),
  validate
], (req, res) => {
  try {
    const db = getDb();
    const market = db.prepare('SELECT id FROM markets WHERE id=?').get(req.params.id);
    if (!market) return res.status(404).json({ detail: 'Pa jwenn' });

    const { title, description, status, end_date, image_url, min_bet, max_bet, category, option_a, option_b, odds_a, odds_b } = req.body;

    // Validate image_url
    const sanitizedImage = image_url !== undefined ? (
      !image_url ? null :
      (typeof image_url === 'string' && (image_url.startsWith('http') || image_url.startsWith('data:image/')))
        ? image_url : null
    ) : undefined;

    const sets = [];
    const vals = [];
    if (title !== undefined)         { sets.push('title=?');       vals.push(sanitize(title)); }
    if (description !== undefined)   { sets.push('description=?'); vals.push(sanitize(description)); }
    if (status !== undefined)        { sets.push('status=?');      vals.push(status); }
    if (end_date !== undefined)      { sets.push('end_date=?');    vals.push(end_date); }
    if (sanitizedImage !== undefined){ sets.push('image_url=?');   vals.push(sanitizedImage); }
    if (min_bet !== undefined)       { sets.push('min_bet=?');     vals.push(parseFloat(min_bet)); }
    if (max_bet !== undefined)       { sets.push('max_bet=?');     vals.push(parseFloat(max_bet)); }
    if (category !== undefined)      { sets.push('category=?');    vals.push(category); }
    if (option_a !== undefined)      { sets.push('option_a=?');    vals.push(sanitize(option_a)); }
    if (option_b !== undefined)      { sets.push('option_b=?');    vals.push(sanitize(option_b)); }
    if (odds_a !== undefined) {
      const yp = parseFloat(Math.min(0.99, Math.max(0.01, 1 / parseFloat(odds_a))).toFixed(4));
      sets.push('yes_prob=?'); vals.push(yp);
    }
    if (odds_b !== undefined) {
      const np = parseFloat(Math.min(0.99, Math.max(0.01, 1 / parseFloat(odds_b))).toFixed(4));
      sets.push('no_prob=?'); vals.push(np);
    }

    if (sets.length > 0) {
      sets.push("updated_at=datetime('now')");
      db.prepare(`UPDATE markets SET ${sets.join(',')} WHERE id=?`).run(...vals, req.params.id);
    }

    db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,details,created_at) VALUES (?,?,?,?,?,?,datetime('now'))`)
      .run(uuidv4(), 'UPDATE_MARKET', 'market', req.params.id, req.user.id, JSON.stringify(req.body));

    res.json(db.prepare('SELECT * FROM markets WHERE id=?').get(req.params.id));
  } catch (e) {
    logger.error('Update market: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// GET /admin/markets/:id/stats
router.get('/markets/:id/stats', (req, res) => {
  try {
    const db     = getDb();
    const market = db.prepare('SELECT * FROM markets WHERE id=?').get(req.params.id);
    if (!market) return res.status(404).json({ detail: 'Pa jwenn' });

    const totals = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN option='yes' THEN amount ELSE 0 END),0) as yes_total,
        COALESCE(SUM(CASE WHEN option='no'  THEN amount ELSE 0 END),0) as no_total,
        COUNT(*)                                                         as bet_count,
        SUM(CASE WHEN option='yes' THEN 1 ELSE 0 END)                   as yes_count,
        SUM(CASE WHEN option='no'  THEN 1 ELSE 0 END)                   as no_count,
        COALESCE(SUM(amount),0)                                          as total_wagered
      FROM bets WHERE market_id=?
    `).get(req.params.id);

    const bets = db.prepare(`
      SELECT b.id, b.option, b.amount, b.odds_at_bet, b.potential_payout,
             b.actual_payout, b.status, b.created_at, u.username
      FROM bets b JOIN users u ON b.user_id=u.id
      WHERE b.market_id=? ORDER BY b.created_at DESC LIMIT 100
    `).all(req.params.id);

    res.json({ market, totals, bets });
  } catch (e) {
    logger.error('Market stats: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// POST /admin/markets/:id/resolve
router.post('/markets/:id/resolve', adminOpLimiter, [
  body('resolution').isIn(['yes', 'no']),
  body('resolution_source').optional().isString().isLength({ max: 200 }),
  validate
], (req, res) => {
  try {
    const db     = getDb();
    const market = db.prepare('SELECT id,slug,status FROM markets WHERE id=?').get(req.params.id);
    if (!market)                      return res.status(404).json({ detail: 'Pa jwenn' });
    if (market.status === 'resolved') return res.status(400).json({ detail: 'Mache deja rezoud' });

    const { resolution, resolution_source } = req.body;

    // 1. Mark market resolved (with audit trail + optional resolution source)
    db.prepare(`UPDATE markets SET status='resolved',resolution=?,resolution_source=?,resolved_by=?,resolved_at=datetime('now'),updated_at=datetime('now') WHERE id=?`)
      .run(resolution, resolution_source || null, req.user.id, market.id);

    db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,details,created_at) VALUES (?,?,?,?,?,?,datetime('now'))`)
      .run(uuidv4(), 'RESOLVE_MARKET', 'market', market.id, req.user.id, JSON.stringify({ resolution, resolution_source }));

    // 2. Settle all bets via shared service (idempotent, atomic)
    const broadcastFn = req.app.locals.broadcast;
    const stats = settleMarket(market.id, resolution, broadcastFn, req.user.id);

    logger.info(`Market ${market.slug} resolved → ${resolution}: ${stats.settled} bets settled, ${stats.credited} HTG credited`);
    res.json({
      message: 'Mache rezoud',
      resolution,
      bets_settled: stats.settled,
      htg_credited: stats.credited,
      slips_won:    stats.slip_won,
      slips_lost:   stats.slip_lost,
    });
  } catch (e) {
    logger.error('Resolve: ' + e.message);
    res.status(500).json({ detail: 'Erè rezolisyon.' });
  }
});

// DELETE /admin/markets/:id
router.delete('/markets/:id', (req, res) => {
  try {
    const db = getDb();
    const market = db.prepare('SELECT id FROM markets WHERE id=?').get(req.params.id);
    if (!market) return res.status(404).json({ detail: 'Pa jwenn' });

    db.transaction(() => {
      const bets = db.prepare("SELECT * FROM bets WHERE market_id=? AND status='active'").all(req.params.id);
      for (const bet of bets) {
        db.prepare("UPDATE users SET balance=balance+?,updated_at=datetime('now') WHERE id=?").run(bet.amount, bet.user_id);
        db.prepare("UPDATE bets SET status='refunded' WHERE id=?").run(bet.id);
      }
      const slips = db.prepare(`
        SELECT DISTINCT bs.* FROM bet_slips bs
        JOIN bet_slip_selections bss ON bss.bet_slip_id=bs.id
        WHERE bss.market_id=? AND bs.status='active'
      `).all(req.params.id);
      for (const slip of slips) {
        db.prepare("UPDATE users SET balance=balance+?,updated_at=datetime('now') WHERE id=?").run(slip.amount, slip.user_id);
        db.prepare("UPDATE bet_slips SET status='refunded' WHERE id=?").run(slip.id);
      }
      db.prepare('DELETE FROM markets WHERE id=?').run(req.params.id);
      db.prepare('DELETE FROM price_points WHERE market_id=?').run(req.params.id);
      db.prepare('DELETE FROM market_comments WHERE market_id=?').run(req.params.id);
      db.prepare('DELETE FROM market_favorites WHERE market_id=?').run(req.params.id);
      db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,ip,created_at) VALUES (?,?,?,?,?,?,datetime('now'))`)
        .run(uuidv4(), 'DELETE_MARKET', 'market', req.params.id, req.user.id, req.ip || '');
    })();

    res.json({ message: 'Mache efase, pari ak fich yo remboure' });
  } catch (e) {
    logger.error('Delete market: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// ── Bets (admin view) ─────────────────────────────────────────────
router.get('/bets', [
  query('skip').optional().isInt({ min: 0 }),
  query('limit').optional().isInt({ min: 1, max: 200 }),
  query('status').optional().isIn(['active', 'won', 'lost', 'refunded', 'cancelled', '']),
  validate
], (req, res) => {
  try {
    const db    = getDb();
    const skip  = parseInt(req.query.skip  || '0');
    const limit = Math.min(parseInt(req.query.limit || '50'), 200);
    const { status, search, date_from, date_to } = req.query;

    const parts  = ['1=1'];
    const params = [];
    if (status) { parts.push('b.status=?'); params.push(status); }
    if (search && search.trim()) {
      const s = search.trim().slice(0, 50);
      if (UUID_RE.test(s)) {
        parts.push('b.id=?');
        params.push(s);
      } else {
        const q = `%${s}%`;
        parts.push('(u.username LIKE ? OR u.email LIKE ? OR m.title LIKE ?)');
        params.push(q, q, q);
      }
    }
    if (date_from) { parts.push('b.created_at >= ?'); params.push(date_from); }
    if (date_to)   { parts.push('b.created_at <= ?'); params.push(date_to + 'T23:59:59'); }

    const where = parts.join(' AND ');
    const base  = `FROM bets b JOIN users u ON b.user_id=u.id JOIN markets m ON b.market_id=m.id WHERE ${where}`;
    const total = db.prepare(`SELECT COUNT(*) c ${base}`).get(...params).c;
    const rows  = db.prepare(`SELECT b.*,u.username,u.email,m.title as market_title,m.slug as market_slug ${base} ORDER BY b.created_at DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, skip);

    res.json({ rows, total });
  } catch (e) {
    logger.error('Admin bets: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// ── Transactions ──────────────────────────────────────────────────
router.get('/transactions', [
  query('skip').optional().isInt({ min: 0 }),
  query('limit').optional().isInt({ min: 1, max: 200 }),
  query('type').optional().isIn(['deposit','withdrawal','bet','win','refund','bonus','bet_slip','']),
  query('status').optional().isIn(['completed','pending','failed','cancelled','']),
  validate
], (req, res) => {
  try {
    const db    = getDb();
    const skip  = parseInt(req.query.skip  || '0');
    const limit = Math.min(parseInt(req.query.limit || '50'), 200);
    const { type, status, search, date_from, date_to } = req.query;

    const parts  = ['1=1'];
    const params = [];
    if (type)      { parts.push('t.type=?');                              params.push(type); }
    if (status)    { parts.push('t.status=?');                            params.push(status); }
    if (search && search.trim()) {
      const s = search.trim().slice(0, 50);
      // Allow exact UUID search (transaction ID) or partial username/email search
      if (UUID_RE.test(s)) {
        parts.push('t.id=?');
        params.push(s);
      } else {
        const q = `%${s}%`;
        parts.push('(u.username LIKE ? OR u.email LIKE ? OR t.description LIKE ?)');
        params.push(q, q, q);
      }
    }
    if (date_from) { parts.push('t.created_at >= ?'); params.push(date_from); }
    if (date_to)   { parts.push('t.created_at <= ?'); params.push(date_to + 'T23:59:59'); }

    const where = parts.join(' AND ');
    const base  = `FROM transactions t JOIN users u ON t.user_id=u.id WHERE ${where}`;
    const total = db.prepare(`SELECT COUNT(*) c ${base}`).get(...params).c;
    const rows  = db.prepare(`SELECT t.*,u.username,u.email ${base} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, skip);

    res.json({ rows, total });
  } catch (e) {
    logger.error('Transactions: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// ── Deposits ──────────────────────────────────────────────────────
// Deposits are pending until admin confirms real MonCash payment received.

router.get('/deposits', (req, res) => {
  try {
    const rows = getDb().prepare(`
      SELECT t.*,u.username,u.email,u.phone as user_phone
      FROM transactions t JOIN users u ON t.user_id=u.id
      WHERE t.type='deposit' ORDER BY t.created_at DESC LIMIT 200
    `).all();
    res.json(rows);
  } catch (e) {
    logger.error('Deposits list: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

router.post('/deposits/:id/approve', adminOpLimiter, (req, res) => {
  try {
    const db = getDb();
    const tx = db.prepare("SELECT * FROM transactions WHERE id=? AND type='deposit' AND status='pending'").get(req.params.id);
    if (!tx) return res.status(404).json({ detail: 'Pa jwenn oswa deja trete' });

    const net = parseFloat(tx.amount);
    if (net <= 0) return res.status(400).json({ detail: 'Montant invalide' });

    db.transaction(() => {
      // Credit user balance
      db.prepare("UPDATE users SET balance=ROUND(balance+?,2),updated_at=datetime('now') WHERE id=?").run(net, tx.user_id);
      // Mark original deposit record as completed (admin accounting)
      db.prepare("UPDATE transactions SET status='completed',completed_at=datetime('now') WHERE id=?").run(tx.id);
      // Insert a 'bonus' transaction so user sees "Bonus" in their history (not an internal deposit)
      const newBal = db.prepare('SELECT balance FROM users WHERE id=?').get(tx.user_id)?.balance ?? net;
      db.prepare(`INSERT INTO transactions
        (id,user_id,type,amount,balance_before,balance_after,status,description,payment_method,created_at)
        VALUES (?,?,'bonus',?,?,?,'completed',?,null,datetime('now'))`)
        .run(uuidv4(), tx.user_id, net, parseFloat((newBal - net).toFixed(2)), parseFloat(newBal.toFixed(2)),
             `Kredi konfime — ${net.toLocaleString()} HTG (MonCash)`);
      db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,details,ip,created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))`)
        .run(uuidv4(), 'APPROVE_DEPOSIT', 'transaction', tx.id, req.user.id, JSON.stringify({ amount: net, user_id: tx.user_id }), req.ip || '');
    })();

    pushNotification(tx.user_id, {
      type: 'deposit_approved',
      title: 'Depozit Konfime',
      message: `Depozit ou a nan ${net.toLocaleString()} HTG te konfime. Balans ou ajou.`,
      ref_type: 'transaction',
      ref_id: tx.id,
    }, req.app.locals.broadcast);

    logger.info(`Deposit ${tx.id} approved: +${net} HTG to user ${tx.user_id} by admin ${req.user.username}`);
    res.json({ message: 'Depozit konfime, balans kreye', net_credited: net });
  } catch (e) {
    logger.error('Approve deposit: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

router.post('/deposits/:id/reject', adminOpLimiter, (req, res) => {
  try {
    const db = getDb();
    const tx = db.prepare("SELECT * FROM transactions WHERE id=? AND type='deposit' AND status='pending'").get(req.params.id);
    if (!tx) return res.status(404).json({ detail: 'Pa jwenn oswa deja trete' });

    db.transaction(() => {
      // No balance change — user was never credited
      db.prepare("UPDATE transactions SET status='rejected',completed_at=datetime('now') WHERE id=?").run(tx.id);
      db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,ip,created_at) VALUES (?,?,?,?,?,?,datetime('now'))`)
        .run(uuidv4(), 'REJECT_DEPOSIT', 'transaction', tx.id, req.user.id, req.ip || '');
    })();

    pushNotification(tx.user_id, {
      type: 'deposit_rejected',
      title: 'Depozit Rejte',
      message: `Depozit ou a nan ${parseFloat(tx.amount).toLocaleString()} HTG pa t konfime. Kontakte sipò pou plis enfòmasyon.`,
      ref_type: 'transaction',
      ref_id: tx.id,
    }, req.app.locals.broadcast);

    logger.info(`Deposit ${tx.id} rejected by admin ${req.user.username}`);
    res.json({ message: 'Depozit rejte' });
  } catch (e) {
    logger.error('Reject deposit: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// ── Withdrawals ───────────────────────────────────────────────────
router.get('/withdrawals', (req, res) => {
  try {
    const rows = getDb().prepare(`
      SELECT t.*,u.username,u.email,u.phone as user_phone
      FROM transactions t JOIN users u ON t.user_id=u.id
      WHERE t.type='withdrawal' ORDER BY t.created_at DESC LIMIT 200
    `).all();
    res.json(rows);
  } catch (e) {
    logger.error('Withdrawals: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

router.post('/withdrawals/:id/approve', adminOpLimiter, (req, res) => {
  try {
    const db = getDb();
    const tx = db.prepare("SELECT * FROM transactions WHERE id=? AND type='withdrawal' AND status='pending'").get(req.params.id);
    if (!tx) return res.status(404).json({ detail: 'Pa jwenn oswa deja trete' });
    db.prepare("UPDATE transactions SET status='completed',completed_at=datetime('now') WHERE id=?").run(req.params.id);
    db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,ip,created_at) VALUES (?,?,?,?,?,?,datetime('now'))`)
      .run(uuidv4(), 'APPROVE_WITHDRAWAL', 'transaction', req.params.id, req.user.id, req.ip || '');
    pushNotification(tx.user_id, {
      type: 'withdrawal_approved',
      title: 'Retrè Konfime',
      message: `Retrè ou a nan ${parseFloat(tx.amount).toLocaleString()} HTG konfime. Ou pral resevwa lajan an sou MonCash ou.`,
      ref_type: 'transaction',
      ref_id: req.params.id,
    }, req.app.locals.broadcast);
    res.json({ message: 'Retrè konfime' });
  } catch (e) {
    logger.error('Approve withdrawal: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

router.post('/withdrawals/:id/reject', adminOpLimiter, (req, res) => {
  try {
    const db = getDb();
    const tx = db.prepare("SELECT * FROM transactions WHERE id=? AND type='withdrawal' AND status='pending'").get(req.params.id);
    if (!tx) return res.status(404).json({ detail: 'Pa jwenn oswa deja trete' });

    const refundAmount = parseFloat((tx.balance_before - tx.balance_after).toFixed(2));
    if (refundAmount <= 0) return res.status(400).json({ detail: 'Montant remboursement invalide' });

    db.transaction(() => {
      db.prepare("UPDATE users SET balance=balance+?,updated_at=datetime('now') WHERE id=?").run(refundAmount, tx.user_id);
      db.prepare("UPDATE transactions SET status='rejected',completed_at=datetime('now') WHERE id=?").run(req.params.id);
      db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,details,ip,created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))`)
        .run(uuidv4(), 'REJECT_WITHDRAWAL', 'transaction', req.params.id, req.user.id, JSON.stringify({ refund: refundAmount }), req.ip || '');
    })();

    pushNotification(tx.user_id, {
      type: 'withdrawal_rejected',
      title: 'Retrè Rejte',
      message: `Retrè ou a nan ${refundAmount.toLocaleString()} HTG pa t konfime. Balans ou remèt.`,
      ref_type: 'transaction',
      ref_id: req.params.id,
    }, req.app.locals.broadcast);

    res.json({ message: 'Retrè rejte, balans remèt' });
  } catch (e) {
    logger.error('Reject withdrawal: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// ── Logs ──────────────────────────────────────────────────────────
router.get('/logs', [
  query('skip').optional().isInt({ min: 0 }),
  query('limit').optional().isInt({ min: 1, max: 200 }),
  validate
], (req, res) => {
  try {
    const db    = getDb();
    const skip  = parseInt(req.query.skip  || '0');
    const limit = Math.min(parseInt(req.query.limit || '100'), 200);
    const { action, entity_type, search, date_from, date_to } = req.query;

    const parts  = ['1=1'];
    const params = [];
    if (action)      { parts.push('l.action=?');      params.push(action); }
    if (entity_type) { parts.push('l.entity_type=?'); params.push(entity_type); }
    if (search && search.trim()) {
      const q = `%${search.trim().slice(0, 50)}%`;
      parts.push('(u.username LIKE ? OR l.action LIKE ?)');
      params.push(q, q);
    }
    if (date_from) { parts.push('l.created_at >= ?'); params.push(date_from); }
    if (date_to)   { parts.push('l.created_at <= ?'); params.push(date_to + 'T23:59:59'); }

    const where = parts.join(' AND ');
    const total = db.prepare(`SELECT COUNT(*) c FROM audit_log l LEFT JOIN users u ON l.user_id=u.id WHERE ${where}`).get(...params).c;
    const rows  = db.prepare(`
      SELECT l.*,u.username FROM audit_log l
      LEFT JOIN users u ON l.user_id=u.id
      WHERE ${where} ORDER BY l.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, limit, skip);

    res.json({ rows, total });
  } catch (e) {
    logger.error('Logs: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// ── Categories ────────────────────────────────────────────────────
router.get('/categories', (req, res) => {
  try {
    const db   = getDb();
    const rows = db.prepare(`
      SELECT category as id, COUNT(*) as market_count,
        SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active_count,
        COALESCE(SUM(total_volume),0) as total_volume
      FROM markets GROUP BY category ORDER BY market_count DESC
    `).all();

    const used  = new Set(rows.map(r => r.id));
    const empty = VALID_CATEGORIES
      .filter(c => !used.has(c))
      .map(c => ({ id: c, market_count: 0, active_count: 0, total_volume: 0 }));

    res.json([...rows, ...empty]);
  } catch (e) {
    logger.error('Categories: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// ── Comments ──────────────────────────────────────────────────────
router.get('/comments', [
  query('skip').optional().isInt({ min: 0 }),
  query('limit').optional().isInt({ min: 1, max: 500 }),
  validate
], (req, res) => {
  try {
    const skip  = parseInt(req.query.skip  || '0');
    const limit = Math.min(parseInt(req.query.limit || '200'), 500);
    const { market_id } = req.query;

    let sql = `
      SELECT c.id, c.text, c.created_at, c.user_id,
             u.username, m.title as market_title, m.id as market_id, m.slug as market_slug
      FROM market_comments c
      JOIN users u ON c.user_id=u.id
      JOIN markets m ON c.market_id=m.id
      WHERE 1=1
    `;
    const params = [];
    if (market_id) { sql += ' AND c.market_id=?'; params.push(market_id); }
    sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, skip);

    res.json(getDb().prepare(sql).all(...params));
  } catch (e) {
    logger.error('Comments: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

router.delete('/comments/:id', (req, res) => {
  try {
    const db = getDb();
    const c  = db.prepare('SELECT id FROM market_comments WHERE id=?').get(req.params.id);
    if (!c) return res.status(404).json({ detail: 'Pa jwenn' });
    db.prepare('DELETE FROM market_comments WHERE id=?').run(req.params.id);
    db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,created_at) VALUES (?,?,?,?,?,datetime('now'))`)
      .run(uuidv4(), 'DELETE_COMMENT', 'market_comment', req.params.id, req.user.id);
    res.json({ ok: true });
  } catch (e) {
    logger.error('Delete comment: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

module.exports = router;
