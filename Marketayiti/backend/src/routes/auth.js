const router = require('express').Router();
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { getDb } = require('../database');
const {
  hashPassword, verifyPassword,
  createAccessToken, createRefreshToken, verifyRefreshToken,
  sanitize
} = require('../utils/security');
const { detectIdentity, buildIdentityQuery } = require('../utils/identity');
const logger = require('../utils/logger');

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.APP_ENV === 'production',
  sameSite: 'lax'
};
const ACCESS_MS  = 2 * 60 * 60 * 1000;
const REFRESH_MS = 30 * 24 * 60 * 60 * 1000;

const fmtUser = (u) => {
  const { hashed_password, ...rest } = u;
  return rest;
};

// ─── REGISTER ────────────────────────────────────────────────────
// Hybrid: identifier auto-detected, email used for password recovery
router.post('/register', [
  body('identifier').isString().isLength({ min: 3, max: 100 }),
  body('password').isString().isLength({ min: 8, max: 100 }),
  body('email').optional().isEmail(),
  body('phone').optional().isString().isLength({ max: 25 }),
  body('username').optional().isLength({ min: 3, max: 30 }),
  body('full_name').optional().isLength({ max: 100 }),
  validate
], (req, res) => {
  try {
    const { identifier, password, full_name } = req.body;

    const detected = detectIdentity(identifier);
    if (detected.type === 'invalid') {
      return res.status(400).json({ detail: detected.error });
    }

    let email    = (req.body.email    || '').toLowerCase().trim() || null;
    let phone    = (req.body.phone    || '').trim() || null;
    let username = (req.body.username || '').toLowerCase().trim() || null;

    if (detected.type === 'email')    email    = email    || detected.value;
    if (detected.type === 'phone')    phone    = phone    || detected.value;
    if (detected.type === 'username') username = username || detected.value;

    if (!email) return res.status(400).json({ detail: 'Imel obligatwa pou kreye kont' });
    if (!username) {
      const base = email.split('@')[0].replace(/[^a-z0-9_-]/g, '').slice(0, 25);
      username = base + Math.floor(Math.random() * 1000);
    }

    const db = getDb();

    // Check each unique field separately — give precise error per conflict
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
      return res.status(400).json({ detail: 'Imel sa deja itilize. Konekte oswa itilize yon lòt.' });
    }
    if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
      return res.status(400).json({ detail: `Non itilizatè '${username}' deja pris. Chwazi yon lòt.` });
    }
    if (phone && db.prepare('SELECT id FROM users WHERE phone = ?').get(phone)) {
      return res.status(400).json({ detail: 'Nimewo telefòn sa deja asosye ak yon kont.' });
    }

    const id = uuidv4();
    db.prepare(`INSERT INTO users
      (id,email,username,full_name,phone,hashed_password,role,status,balance,last_ip)
      VALUES (?,?,?,?,?,?, 'user','active',0,?)`).run(
      id, email, username,
      full_name ? sanitize(full_name) : null,
      phone || null,
      hashPassword(password),
      req.ip
    );

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    const tokenPayload = { sub: id, role: 'user' };
    const accessToken  = createAccessToken(tokenPayload);
    const refreshToken = createRefreshToken(tokenPayload);

    res.cookie('access_token', accessToken,  { ...COOKIE_OPTS, maxAge: ACCESS_MS });
    res.cookie('refresh_token', refreshToken, { ...COOKIE_OPTS, maxAge: REFRESH_MS });

    logger.info(`Registered: ${username} via ${detected.type}`);
    res.status(201).json({ access_token: accessToken, user: fmtUser(user), via: detected.type });
  } catch (e) {
    logger.error('Register: ' + e.message);
    res.status(500).json({ detail: 'Erè entèn' });
  }
});

// ─── LOGIN ───────────────────────────────────────────────────────
router.post('/login', [
  body('identifier').isString().isLength({ min: 3, max: 100 }),
  body('password').isString().notEmpty(),
  validate
], (req, res) => {
  try {
    const { identifier, password } = req.body;
    const idQuery = buildIdentityQuery(identifier);

    if (!idQuery) {
      return res.status(400).json({ detail: 'Antre imel, telefòn, oswa non itilizatè valid' });
    }

    const db = getDb();
    const user = db.prepare(`SELECT * FROM users WHERE ${idQuery.field} = ?`).get(idQuery.value);

    if (!user || !verifyPassword(password, user.hashed_password)) {
      logger.warn(`Failed login: ${identifier} (${idQuery.type})`);
      return res.status(401).json({ detail: 'Idantifyan oswa modpas pa kòrèk' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ detail: 'Kont dezaktive. Kontakte sipò.' });
    }

    db.prepare('UPDATE users SET last_login=datetime("now"), last_ip=? WHERE id=?')
      .run(req.ip, user.id);

    const tokenPayload = { sub: user.id, role: user.role };
    const accessToken  = createAccessToken(tokenPayload);
    const refreshToken = createRefreshToken(tokenPayload);

    res.cookie('access_token', accessToken,  { ...COOKIE_OPTS, maxAge: ACCESS_MS });
    res.cookie('refresh_token', refreshToken, { ...COOKIE_OPTS, maxAge: REFRESH_MS });

    logger.info(`Login: ${user.username} via ${idQuery.type}`);
    res.json({ access_token: accessToken, user: fmtUser(user), via: idQuery.type });
  } catch (e) {
    logger.error('Login: ' + e.message);
    res.status(500).json({ detail: 'Erè entèn' });
  }
});

// ─── DETECT ──────────────────────────────────────────────────────
// Helper for live UX: tells frontend what the user typed
router.post('/detect', [
  body('identifier').isString().isLength({ min: 1, max: 100 }),
  validate
], (req, res) => res.json(detectIdentity(req.body.identifier)));

// ─── LOGOUT ──────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  res.json({ message: 'Dekonekte' });
});

// ─── ME ──────────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => res.json(fmtUser(req.user)));

// ─── REFRESH ─────────────────────────────────────────────────────
router.post('/refresh', (req, res) => {
  try {
    const refresh = req.cookies?.refresh_token;
    if (!refresh) return res.status(401).json({ detail: 'Pa gen refresh token' });

    const payload = verifyRefreshToken(refresh);
    if (payload.type !== 'refresh') return res.status(401).json({ detail: 'Token envalid' });

    const user = getDb().prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!user || user.status !== 'active') return res.status(401).json({ detail: 'Itilizatè envalid' });

    const accessToken = createAccessToken({ sub: user.id, role: user.role });
    res.cookie('access_token', accessToken, { ...COOKIE_OPTS, maxAge: ACCESS_MS });
    res.json({ message: 'Refresh OK' });
  } catch {
    res.status(401).json({ detail: 'Refresh envalid' });
  }
});

// ─── CHANGE PASSWORD ─────────────────────────────────────────────
router.post('/change-password', authenticate, [
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 8, max: 100 }),
  validate
], (req, res) => {
  if (!verifyPassword(req.body.current_password, req.user.hashed_password)) {
    return res.status(400).json({ detail: 'Modpas aktyèl pa kòrèk' });
  }
  getDb().prepare('UPDATE users SET hashed_password=? WHERE id=?')
    .run(hashPassword(req.body.new_password), req.user.id);
  res.json({ message: 'Modpas chanje' });
});

module.exports = router;

// POST /api/v1/auth/request-reset — generate 6-digit code
router.post('/request-reset', [
  body('identifier').isString().isLength({ min: 2, max: 100 }),
  validate
], (req, res) => {
  try {
    const { identifier } = req.body;
    const db = getDb();
    // Find user by email, phone, or username
    const user = db.prepare(`
      SELECT id, username, email FROM users 
      WHERE email=? OR username=? OR phone=?
    `).get(identifier, identifier, identifier);

    if (!user) {
      // Always return success to prevent enumeration
      return res.json({ message: 'Si kont sa a egziste, ou pral resevwa yon kòd.' });
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 15 * 60000).toISOString(); // 15 min

    // Store code (invalidate old ones)
    db.prepare("DELETE FROM password_reset_codes WHERE user_id=?").run(user.id);
    db.prepare(`INSERT INTO password_reset_codes (id,user_id,code,expires_at) VALUES (?,?,?,?)`)
      .run(require('uuid').v4(), user.id, code, expires);

    // In prod: send via email/SMS. For dev: return in response + log
    const { hashPassword } = require('../utils/security');
    require('../utils/logger').info(`RESET CODE for ${user.username}: ${code} (expires ${expires})`);

    // For MVP: return code directly (in prod, send via MonCash SMS or email)
    res.json({
      message: 'Kòd voye! Tcheke imel oswa SMS ou.',
      // DEV ONLY — remove in prod:
      _dev_code: code,
      _dev_expires: expires,
      username: user.username
    });
  } catch (e) {
    require('../utils/logger').error('Reset request: ' + e.message);
    res.status(500).json({ detail: 'Erè. Eseye ankò.' });
  }
});

// POST /api/v1/auth/verify-reset — verify code + change password
router.post('/verify-reset', [
  body('identifier').isString().isLength({ min: 2, max: 100 }),
  body('code').isString().isLength({ min: 6, max: 6 }),
  body('new_password').isString().isLength({ min: 8, max: 100 }),
  validate
], (req, res) => {
  try {
    const { identifier, code, new_password } = req.body;
    const db = getDb();
    const { hashPassword } = require('../utils/security');

    const user = db.prepare(`
      SELECT id, username FROM users 
      WHERE email=? OR username=? OR phone=?
    `).get(identifier, identifier, identifier);

    if (!user) return res.status(400).json({ detail: 'Idantifyan pa jwenn.' });

    const resetRow = db.prepare(`
      SELECT * FROM password_reset_codes 
      WHERE user_id=? AND code=? AND used=0 AND expires_at > datetime('now')
    `).get(user.id, code);

    if (!resetRow) return res.status(400).json({ detail: 'Kòd envalid oswa ekspire.' });

    const hashed = hashPassword(new_password);
    db.transaction(() => {
      db.prepare("UPDATE users SET hashed_password=?, updated_at=datetime('now') WHERE id=?").run(hashed, user.id);
      db.prepare("UPDATE password_reset_codes SET used=1 WHERE id=?").run(resetRow.id);
    })();

    require('../utils/logger').info(`Password reset for ${user.username}`);
    res.json({ message: 'Modpas chanje avèk siksè! Konekte ak nouvo modpas ou.' });
  } catch (e) {
    require('../utils/logger').error('Reset verify: ' + e.message);
    res.status(500).json({ detail: 'Erè. Eseye ankò.' });
  }
});

// GET /api/v1/auth/profile — get own profile
router.get('/profile', authenticate, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare(`
      SELECT id, email, username, full_name, phone, role, status, balance, 
             is_email_verified, last_login, created_at
      FROM users WHERE id=?
    `).get(req.user.id);
    res.json(user);
  } catch (e) {
    res.status(500).json({ detail: 'Erè' });
  }
});

// PATCH /api/v1/auth/profile — ONLY allow adding phone number (not username/email/fullname)
router.patch('/profile', authenticate, [
  body('phone').optional({ nullable: true }).custom(val => {
    if (val === null || val === '') return true;
    if (typeof val !== 'string' || val.length < 8 || val.length > 20) throw new Error('Nimewo telefòn envalid');
    return true;
  }),
  validate
], (req, res) => {
  try {
    const { phone } = req.body;
    const db = getDb();
    // Check phone uniqueness if provided
    if (phone) {
      const existing = db.prepare("SELECT id FROM users WHERE phone=? AND id!=?").get(phone, req.user.id);
      if (existing) return res.status(400).json({ detail: 'Nimewo sa deja itilize pa yon lòt kont.' });
      db.prepare("UPDATE users SET phone=?, updated_at=datetime('now') WHERE id=?").run(phone, req.user.id);
    } else if (phone === null || phone === '') {
      db.prepare("UPDATE users SET phone=NULL, updated_at=datetime('now') WHERE id=?").run(req.user.id);
    }
    const updated = db.prepare('SELECT id,email,username,full_name,phone,role,status,balance,created_at FROM users WHERE id=?').get(req.user.id);
    res.json(updated);
  } catch (e) {
    require('../utils/logger').error('Profile update: ' + e.message);
    res.status(500).json({ detail: 'Erè aktyalizasyon' });
  }
});

// GET /api/v1/auth/suggest-username?first=Jean&last=Pierre
router.get('/suggest-username', (req, res) => {
  try {
    const { first = '', last = '' } = req.query;
    const db = getDb();
    const f = String(first).toLowerCase().replace(/[^a-z]/g, '').slice(0, 10);
    const l = String(last).toLowerCase().replace(/[^a-z]/g, '').slice(0, 10);

    const base = f && l ? `${f}.${l}` : f || l || 'user';

    // Generate candidates
    const candidates = [
      `${base}${Math.floor(Math.random() * 900 + 100)}`,
      `${f}${l.slice(0,1)}${Math.floor(Math.random() * 90 + 10)}`,
      `${f.slice(0,1)}.${l}_${Math.floor(Math.random() * 99 + 1)}`,
      `${base}${Math.floor(Math.random() * 9000 + 1000)}`,
    ].filter((v, i, a) => a.indexOf(v) === i); // unique

    // Filter out taken ones
    const available = candidates.filter(u =>
      !db.prepare('SELECT id FROM users WHERE username=?').get(u)
    ).slice(0, 3);

    res.json({ suggestions: available });
  } catch (e) {
    res.json({ suggestions: [] });
  }
});
