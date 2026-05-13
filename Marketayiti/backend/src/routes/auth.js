/**
 * Auth routes — register, login, logout, refresh, profile, password reset, 2FA.
 *
 * Security model:
 *  - Passwords hashed with bcrypt (12 rounds)
 *  - Tokens stored in HttpOnly cookies
 *  - Refresh tokens: JWT with jti stored in DB — rotation on every use, reuse = full revoke
 *  - Brute-force: 3 failed attempts → account locked → unlock via email code
 *  - 2FA: TOTP (RFC 6238) via otplib — setup, enable, disable, verify-login
 *  - All DB queries use parameterized statements
 */

const router = require('express').Router();
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { getDb, saveDb } = require('../database');
const {
  hashPassword, verifyPassword,
  createAccessToken, createRefreshToken, verifyRefreshToken,
  createTempToken, verifyTempToken,
  generateTotpSecret, verifyTotpToken, generateTotpQr,
  sanitize
} = require('../utils/security');
const { detectIdentity, buildIdentityQuery } = require('../utils/identity');
const logger = require('../utils/logger');
const { sendMail, resetCodeEmail, welcomeEmail, lockoutEmail } = require('../utils/mailer');

// ── Cookie options ────────────────────────────────────────────────────────────
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.APP_ENV === 'production',
  sameSite: 'lax',
  path: '/'
};
const ACCESS_MS  = 2  * 60 * 60 * 1000;   // 2 h
const REFRESH_MS = 30 * 24 * 60 * 60 * 1000; // 30 d
const TEMP_MS    = 5  * 60 * 1000;         // 5 min (2FA pending)

const MAX_ATTEMPTS        = 3;
const LOCK_MINUTES        = 30;  // how long the account stays locked
const CODE_EXPIRY_MINUTES = 15;  // unlock/reset codes expire after 15 min

// ── Helpers ───────────────────────────────────────────────────────────────────
function safeUser(u) {
  const { hashed_password, last_ip, failed_attempts, locked_until, totp_secret, ...rest } = u;
  return rest;
}

function isLocked(user) {
  return user.locked_until && new Date(user.locked_until) > new Date();
}

function recordFailedAttempt(db, user) {
  const attempts = (user.failed_attempts || 0) + 1;
  if (attempts >= MAX_ATTEMPTS) {
    const lockUntil = new Date(Date.now() + LOCK_MINUTES * 60000).toISOString();
    db.prepare("UPDATE users SET failed_attempts=?, locked_until=?, updated_at=datetime('now') WHERE id=?")
      .run(attempts, lockUntil, user.id);

    // Auto-generate a 6-digit unlock code and store it (valid LOCK_MINUTES)
    const unlockCode = String(Math.floor(100000 + Math.random() * 900000));
    const codeExpires = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60000).toISOString();
    db.prepare('DELETE FROM password_reset_codes WHERE user_id=?').run(user.id);
    db.prepare('INSERT INTO password_reset_codes (id,user_id,code,expires_at) VALUES (?,?,?,?)')
      .run(uuidv4(), user.id, unlockCode, codeExpires);

    if (user.email) {
      sendMail({
        to: user.email,
        ...lockoutEmail({ username: user.username, minutes: CODE_EXPIRY_MINUTES, code: unlockCode }),
      }).catch(() => {});
    }

    // Audit log — lockout event
    try {
      db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,details,ip,created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))`)
        .run(uuidv4(), 'ACCOUNT_LOCKED', 'user', user.id, user.id,
             JSON.stringify({ username: user.username, failed_attempts: attempts, locked_until: lockUntil, reason: `${attempts} tentativ echwe konsekutif` }),
             '');
    } catch {}

    logger.warn(`Account locked: ${user.username} (${attempts} attempts) — unlock code sent`);
    return { locked: true, lockUntil, emailSent: !!user.email };
  }
  db.prepare("UPDATE users SET failed_attempts=?, updated_at=datetime('now') WHERE id=?")
    .run(attempts, user.id);
  return { locked: false, remaining: MAX_ATTEMPTS - attempts };
}

function clearFailedAttempts(db, userId) {
  db.prepare("UPDATE users SET failed_attempts=0, locked_until=NULL, updated_at=datetime('now') WHERE id=?")
    .run(userId);
}

// Store a refresh token jti in DB (expires in 30 days)
function storeRefreshToken(db, userId, jti) {
  db.prepare(`INSERT INTO refresh_tokens (id,user_id,jti,expires_at) VALUES (?,?,?,datetime('now','+30 days'))`)
    .run(uuidv4(), userId, jti);
}

// Revoke all refresh tokens for a user (reuse attack or manual logout-all)
function revokeAllTokens(db, userId) {
  db.prepare("UPDATE refresh_tokens SET revoked=1 WHERE user_id=?").run(userId);
}

// Issue token pair, set cookies, store jti
function issueTokens(res, db, userId, role) {
  const accessToken = createAccessToken({ sub: userId, role });
  const { token: refreshToken, jti } = createRefreshToken({ sub: userId, role });
  storeRefreshToken(db, userId, jti);
  res.cookie('access_token',  accessToken,  { ...COOKIE_OPTS, maxAge: ACCESS_MS });
  res.cookie('refresh_token', refreshToken, { ...COOKIE_OPTS, maxAge: REFRESH_MS });
  return accessToken;
}

function issueAdminTokens(res, db, userId, role) {
  const accessToken = createAccessToken({ sub: userId, role });
  const { token: refreshToken, jti } = createRefreshToken({ sub: userId, role });
  storeRefreshToken(db, userId, jti);
  res.cookie('admin_access_token',  accessToken,  { ...COOKIE_OPTS, maxAge: ACCESS_MS });
  res.cookie('admin_refresh_token', refreshToken, { ...COOKIE_OPTS, maxAge: REFRESH_MS });
  return accessToken;
}

// ─── REGISTER ────────────────────────────────────────────────────────────────
router.post('/register', [
  body('identifier').isString().isLength({ min: 3, max: 100 }).trim(),
  body('password').isString().isLength({ min: 8, max: 100 })
    .matches(/[A-Za-z]/).withMessage('Modpas dwe genyen omwen yon lèt')
    .matches(/[0-9]/).withMessage('Modpas dwe genyen omwen yon chif'),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isString().isLength({ max: 25 }),
  body('username').optional().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_-]+$/),
  body('full_name').optional().isLength({ max: 100 }),
  validate
], async (req, res) => {
  try {
    const { identifier, password, full_name } = req.body;
    const detected = detectIdentity(identifier);
    if (detected.type === 'invalid') return res.status(400).json({ detail: detected.error });

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
    if (db.prepare('SELECT id FROM users WHERE email=?').get(email))
      return res.status(400).json({ detail: 'Imel sa deja itilize.' });
    if (db.prepare('SELECT id FROM users WHERE username=?').get(username))
      return res.status(400).json({ detail: `Non itilizatè '${username}' deja pris.` });
    if (phone && db.prepare('SELECT id FROM users WHERE phone=?').get(phone))
      return res.status(400).json({ detail: 'Nimewo telefòn sa deja asosye ak yon kont.' });

    const id = uuidv4();
    db.prepare(`INSERT INTO users (id,email,username,full_name,phone,hashed_password,role,status,balance,last_ip)
      VALUES (?,?,?,?,?,?,'user','active',0,?)`)
      .run(id, email, username, full_name ? sanitize(full_name) : null, phone || null, hashPassword(password), req.ip);

    const user = db.prepare('SELECT * FROM users WHERE id=?').get(id);
    const accessToken = issueTokens(res, db, id, 'user');

    logger.info(`Registered: ${username}`);
    if (email) sendMail({ to: email, ...welcomeEmail({ username, email }) }).catch(() => {});

    res.status(201).json({ access_token: accessToken, user: safeUser(user), via: detected.type });
  } catch (e) {
    logger.error('Register: ' + e.message);
    res.status(500).json({ detail: 'Erè entèn' });
  }
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────
router.post('/login', [
  body('identifier').isString().isLength({ min: 3, max: 100 }).trim(),
  body('password').isString().notEmpty(),
  validate
], (req, res) => {
  try {
    const { identifier, password } = req.body;
    const idQuery = buildIdentityQuery(identifier);
    if (!idQuery) return res.status(400).json({ detail: 'Antre imel, telefòn, oswa non itilizatè valid' });

    const db   = getDb();
    const user = db.prepare(`SELECT * FROM users WHERE ${idQuery.field}=?`).get(idQuery.value);
    if (!user) return res.status(401).json({ detail: 'Idantifyan oswa modpas pa kòrèk' });

    // Mask email for client: j***@gmail.com
    function maskEmail(email) {
      if (!email) return null;
      const [local, domain] = email.split('@');
      return local.slice(0, 1) + '***@' + domain;
    }

    if (isLocked(user)) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(423).json({
        detail: `Kont ou bloke. Eseye ankò nan ${minutesLeft} minit oswa itilize kòd deblokaj nan imel ou.`,
        locked: true,
        locked_until: user.locked_until,
        email_masked: maskEmail(user.email),
        minutes_left: minutesLeft,
      });
    }

    if (!verifyPassword(password, user.hashed_password)) {
      const result = recordFailedAttempt(db, user);
      if (result.locked) {
        return res.status(423).json({
          detail: `Kont ou bloke apre ${MAX_ATTEMPTS} tantativ echèk. ${result.emailSent ? 'Yon kòd deblokaj voye nan imel ou.' : 'Kontakte sipò.'}`,
          locked: true,
          locked_until: result.lockUntil,
          email_masked: maskEmail(user.email),
          email_sent: result.emailSent,
          minutes_left: LOCK_MINUTES,
        });
      }
      return res.status(401).json({
        detail: `Modpas pa kòrèk. ${result.remaining} tantativ rete.`,
        remaining_attempts: result.remaining,
      });
    }

    if (user.status !== 'active') return res.status(403).json({ detail: 'Kont dezaktive.' });

    clearFailedAttempts(db, user.id);
    db.prepare("UPDATE users SET last_login=datetime('now'), last_ip=? WHERE id=?").run(req.ip, user.id);

    // If 2FA is enabled, issue a short-lived pending token instead of real tokens
    if (user.totp_enabled) {
      const tempToken = createTempToken(user.id);
      res.cookie('_2fa_pending', tempToken, { ...COOKIE_OPTS, maxAge: TEMP_MS });
      logger.info(`Login 2FA pending: ${user.username}`);
      return res.json({ requires_2fa: true });
    }

    const accessToken = issueTokens(res, db, user.id, user.role);
    logger.info(`Login: ${user.username} via ${idQuery.type}`);
    res.json({ access_token: accessToken, user: safeUser(user), via: idQuery.type });
  } catch (e) {
    logger.error('Login: ' + e.message);
    res.status(500).json({ detail: 'Erè entèn' });
  }
});

// ─── DETECT ──────────────────────────────────────────────────────────────────
router.post('/detect', [
  body('identifier').isString().isLength({ min: 1, max: 100 }),
  validate
], (req, res) => res.json(detectIdentity(req.body.identifier)));

// ─── LOGOUT ──────────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  const refresh = req.cookies?.refresh_token;
  if (refresh) {
    try {
      const payload = verifyRefreshToken(refresh);
      if (payload.jti) getDb().prepare("UPDATE refresh_tokens SET revoked=1 WHERE jti=?").run(payload.jti);
    } catch {}
  }
  res.clearCookie('access_token',  COOKIE_OPTS);
  res.clearCookie('refresh_token', COOKIE_OPTS);
  res.json({ message: 'Dekonekte' });
});

// ─── LOGOUT ALL DEVICES ──────────────────────────────────────────────────────
router.post('/logout-all', authenticate, (req, res) => {
  try {
    getDb().prepare("UPDATE refresh_tokens SET revoked=1 WHERE user_id=?").run(req.user.id);
    res.clearCookie('access_token',  COOKIE_OPTS);
    res.clearCookie('refresh_token', COOKIE_OPTS);
    res.json({ message: 'Dekonekte sou tout aparèy' });
  } catch (e) {
    logger.error('Logout-all: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// ─── ME ──────────────────────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => res.json(safeUser(req.user)));

// ─── REFRESH (with token rotation) ───────────────────────────────────────────
router.post('/refresh', (req, res) => {
  try {
    const refresh = req.cookies?.refresh_token;
    if (!refresh) return res.status(401).json({ detail: 'Pa gen refresh token' });

    let payload;
    try { payload = verifyRefreshToken(refresh); }
    catch { return res.status(401).json({ detail: 'Refresh envalid' }); }

    if (payload.type !== 'refresh') return res.status(401).json({ detail: 'Token envalid' });

    const db = getDb();

    // Check jti in DB — if not found or revoked, treat as reuse attack
    const stored = db.prepare('SELECT * FROM refresh_tokens WHERE jti=?').get(payload.jti);
    if (!stored || stored.revoked) {
      // Reuse detected → revoke all tokens for this user (stolen token mitigation)
      if (payload.sub) revokeAllTokens(db, payload.sub);
      res.clearCookie('access_token',  COOKIE_OPTS);
      res.clearCookie('refresh_token', COOKIE_OPTS);
      logger.warn(`Refresh token reuse detected: user=${payload.sub}`);
      return res.status(401).json({ detail: 'Session invalide. Konekte ankò.' });
    }

    // Check DB-level expiry
    if (new Date(stored.expires_at) < new Date()) {
      db.prepare("UPDATE refresh_tokens SET revoked=1 WHERE jti=?").run(payload.jti);
      return res.status(401).json({ detail: 'Sesyon ekspire' });
    }

    const user = db.prepare('SELECT id,role,status FROM users WHERE id=?').get(payload.sub);
    if (!user || user.status !== 'active') return res.status(401).json({ detail: 'Itilizatè envalid' });

    // Rotate: revoke old jti, issue new pair
    db.prepare("UPDATE refresh_tokens SET revoked=1 WHERE jti=?").run(payload.jti);
    const accessToken = issueTokens(res, db, user.id, user.role);

    res.json({ access_token: accessToken, message: 'Refresh OK' });
  } catch (e) {
    logger.error('Refresh: ' + e.message);
    res.status(401).json({ detail: 'Refresh envalid' });
  }
});

// ─── CHANGE PASSWORD ─────────────────────────────────────────────────────────
router.post('/change-password', authenticate, [
  body('current_password').notEmpty(),
  body('new_password').isString().isLength({ min: 8, max: 100 }),
  validate
], (req, res) => {
  try {
    const db   = getDb();
    const full = db.prepare('SELECT hashed_password FROM users WHERE id=?').get(req.user.id);
    if (!full) return res.status(401).json({ detail: 'Itilizatè pa jwenn' });
    if (!verifyPassword(req.body.current_password, full.hashed_password))
      return res.status(400).json({ detail: 'Modpas aktyèl pa kòrèk' });
    if (verifyPassword(req.body.new_password, full.hashed_password))
      return res.status(400).json({ detail: 'Nouvo modpas pa ka menm ak ansyen modpas la.' });

    db.prepare("UPDATE users SET hashed_password=?,failed_attempts=0,locked_until=NULL,updated_at=datetime('now') WHERE id=?")
      .run(hashPassword(req.body.new_password), req.user.id);
    // Revoke all refresh tokens — force re-login everywhere after password change
    revokeAllTokens(db, req.user.id);
    res.json({ message: 'Modpas chanje. Konekte ankò.' });
  } catch (e) {
    logger.error('Change password: ' + e.message);
    res.status(500).json({ detail: 'Erè chanjman modpas' });
  }
});

// ─── 2FA: SETUP (generate secret + QR) ───────────────────────────────────────
router.post('/2fa/setup', authenticate, async (req, res) => {
  try {
    const user = getDb().prepare('SELECT email,totp_enabled FROM users WHERE id=?').get(req.user.id);
    if (user.totp_enabled) return res.status(400).json({ detail: '2FA deja aktive' });

    const secret = generateTotpSecret();
    // Store secret temporarily (not enabled yet — user must verify with enable endpoint)
    getDb().prepare("UPDATE users SET totp_secret=? WHERE id=?").run(secret, req.user.id);

    const { qrImage, otpauth } = await generateTotpQr(user.email, secret);
    res.json({ secret, qr_image: qrImage, otpauth });
  } catch (e) {
    logger.error('2FA setup: ' + e.message);
    res.status(500).json({ detail: 'Erè konfigirasyon 2FA' });
  }
});

// ─── 2FA: ENABLE (verify code, activate 2FA) ─────────────────────────────────
router.post('/2fa/enable', authenticate, [
  body('totp_code').isString().isLength({ min: 6, max: 6 }).isNumeric(),
  validate
], (req, res) => {
  try {
    const user = getDb().prepare('SELECT totp_secret,totp_enabled FROM users WHERE id=?').get(req.user.id);
    if (user.totp_enabled) return res.status(400).json({ detail: '2FA deja aktive' });
    if (!user.totp_secret) return res.status(400).json({ detail: 'Kòmanse konfigirasyon 2FA anvan' });

    if (!verifyTotpToken(req.body.totp_code, user.totp_secret))
      return res.status(400).json({ detail: 'Kòd TOTP envalid. Verifye lè aparèy ou.' });

    getDb().prepare("UPDATE users SET totp_enabled=1,updated_at=datetime('now') WHERE id=?")
      .run(req.user.id);
    logger.info(`2FA enabled: user=${req.user.id}`);
    res.json({ message: '2FA aktive avèk siksè' });
  } catch (e) {
    logger.error('2FA enable: ' + e.message);
    res.status(500).json({ detail: 'Erè aktivasyon 2FA' });
  }
});

// ─── 2FA: DISABLE ─────────────────────────────────────────────────────────────
router.post('/2fa/disable', authenticate, [
  body('totp_code').isString().isLength({ min: 6, max: 6 }).isNumeric(),
  body('password').isString().notEmpty(),
  validate
], (req, res) => {
  try {
    const db   = getDb();
    const user = db.prepare('SELECT hashed_password,totp_secret,totp_enabled FROM users WHERE id=?').get(req.user.id);
    if (!user.totp_enabled) return res.status(400).json({ detail: '2FA pa aktive' });

    if (!verifyPassword(req.body.password, user.hashed_password))
      return res.status(400).json({ detail: 'Modpas pa kòrèk' });
    if (!verifyTotpToken(req.body.totp_code, user.totp_secret))
      return res.status(400).json({ detail: 'Kòd TOTP envalid' });

    db.prepare("UPDATE users SET totp_enabled=0,totp_secret=NULL,updated_at=datetime('now') WHERE id=?")
      .run(req.user.id);
    logger.info(`2FA disabled: user=${req.user.id}`);
    res.json({ message: '2FA dezaktive' });
  } catch (e) {
    logger.error('2FA disable: ' + e.message);
    res.status(500).json({ detail: 'Erè dezaktivasyon 2FA' });
  }
});

// ─── 2FA: STATUS ──────────────────────────────────────────────────────────────
router.get('/2fa/status', authenticate, (req, res) => {
  const user = getDb().prepare('SELECT totp_enabled FROM users WHERE id=?').get(req.user.id);
  res.json({ enabled: !!user?.totp_enabled });
});

// ─── 2FA: VERIFY LOGIN (complete login after password step) ───────────────────
router.post('/2fa/verify-login', [
  body('totp_code').isString().isLength({ min: 6, max: 6 }).isNumeric(),
  validate
], (req, res) => {
  try {
    const tempToken = req.cookies?._2fa_pending;
    if (!tempToken) return res.status(401).json({ detail: 'Pa gen sesyon 2FA annatant' });

    let pending;
    try { pending = verifyTempToken(tempToken); }
    catch { return res.status(401).json({ detail: 'Sesyon 2FA ekspire. Konekte ankò.' }); }

    const db   = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(pending.sub);
    if (!user || user.status !== 'active') return res.status(401).json({ detail: 'Itilizatè envalid' });
    if (!user.totp_enabled || !user.totp_secret)
      return res.status(400).json({ detail: '2FA pa konfigire' });

    if (!verifyTotpToken(req.body.totp_code, user.totp_secret))
      return res.status(400).json({ detail: 'Kòd TOTP envalid' });

    // Clear pending cookie and issue real tokens
    res.clearCookie('_2fa_pending', COOKIE_OPTS);
    const accessToken = issueTokens(res, db, user.id, user.role);

    logger.info(`2FA login verified: ${user.username}`);
    res.json({ access_token: accessToken, user: safeUser(user) });
  } catch (e) {
    logger.error('2FA verify-login: ' + e.message);
    res.status(500).json({ detail: 'Erè verifikasyon 2FA' });
  }
});

// ─── ADMIN LOGIN ──────────────────────────────────────────────────────────────
router.post('/admin/login', [
  body('identifier').isString().isLength({ min: 3, max: 100 }).trim(),
  body('password').isString().notEmpty(),
  validate
], (req, res) => {
  try {
    const { identifier, password } = req.body;
    const idQuery = buildIdentityQuery(identifier);
    if (!idQuery) return res.status(400).json({ detail: 'Identifyan envalid' });

    const db   = getDb();
    const user = db.prepare(`SELECT * FROM users WHERE ${idQuery.field}=?`).get(idQuery.value);
    if (!user) return res.status(401).json({ detail: 'Idantifyan oswa modpas pa kòrèk' });

    if (isLocked(user)) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(423).json({ detail: `Kont admin bloke. Eseye nan ${minutesLeft} minit.`, locked: true });
    }

    if (!verifyPassword(password, user.hashed_password)) {
      recordFailedAttempt(db, user);
      return res.status(401).json({ detail: 'Idantifyan oswa modpas pa kòrèk' });
    }
    if (user.role !== 'admin')   return res.status(403).json({ detail: 'Kont sa a pa gen aksè admin' });
    if (user.status !== 'active') return res.status(403).json({ detail: 'Kont dezaktive' });

    clearFailedAttempts(db, user.id);
    db.prepare("UPDATE users SET last_login=datetime('now'), last_ip=? WHERE id=?").run(req.ip, user.id);

    // Admin 2FA check
    if (user.totp_enabled) {
      const tempToken = createTempToken(user.id);
      res.cookie('_2fa_admin_pending', tempToken, { ...COOKIE_OPTS, maxAge: TEMP_MS });
      return res.json({ requires_2fa: true });
    }

    const accessToken = issueAdminTokens(res, db, user.id, user.role);
    logger.info(`Admin login: ${user.username} from ${req.ip}`);
    res.json({ access_token: accessToken, user: safeUser(user) });
  } catch (e) {
    logger.error('Admin login: ' + e.message);
    res.status(500).json({ detail: 'Erè entèn' });
  }
});

// ─── ADMIN 2FA VERIFY LOGIN ───────────────────────────────────────────────────
router.post('/admin/2fa/verify-login', [
  body('totp_code').isString().isLength({ min: 6, max: 6 }).isNumeric(),
  validate
], (req, res) => {
  try {
    const tempToken = req.cookies?._2fa_admin_pending;
    if (!tempToken) return res.status(401).json({ detail: 'Pa gen sesyon 2FA annatant' });

    let pending;
    try { pending = verifyTempToken(tempToken); } catch {
      return res.status(401).json({ detail: 'Sesyon 2FA ekspire. Konekte ankò.' });
    }

    const db   = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(pending.sub);
    if (!user || user.role !== 'admin' || user.status !== 'active')
      return res.status(401).json({ detail: 'Itilizatè envalid' });
    if (!verifyTotpToken(req.body.totp_code, user.totp_secret))
      return res.status(400).json({ detail: 'Kòd TOTP envalid' });

    res.clearCookie('_2fa_admin_pending', COOKIE_OPTS);
    const accessToken = issueAdminTokens(res, db, user.id, user.role);
    logger.info(`Admin 2FA login: ${user.username}`);
    res.json({ access_token: accessToken, user: safeUser(user) });
  } catch (e) {
    logger.error('Admin 2FA verify: ' + e.message);
    res.status(500).json({ detail: 'Erè verifikasyon 2FA' });
  }
});

// ─── ADMIN LOGOUT ─────────────────────────────────────────────────────────────
router.post('/admin/logout', (req, res) => {
  const refresh = req.cookies?.admin_refresh_token;
  if (refresh) {
    try {
      const payload = verifyRefreshToken(refresh);
      if (payload.jti) getDb().prepare("UPDATE refresh_tokens SET revoked=1 WHERE jti=?").run(payload.jti);
    } catch {}
  }
  res.clearCookie('admin_access_token',  COOKIE_OPTS);
  res.clearCookie('admin_refresh_token', COOKIE_OPTS);
  res.json({ message: 'Dekonekte (admin)' });
});

// ─── ADMIN ME ─────────────────────────────────────────────────────────────────
router.get('/admin/me', (req, res) => {
  try {
    const token = req.cookies?.admin_access_token;
    if (!token) return res.status(401).json({ detail: 'Konekte anvan' });
    const { verifyAccessToken } = require('../utils/security');
    const payload = verifyAccessToken(token);
    if (payload.type !== 'access') return res.status(401).json({ detail: 'Token envalid' });
    const user = getDb().prepare('SELECT * FROM users WHERE id=?').get(payload.sub);
    if (!user || user.role !== 'admin') return res.status(403).json({ detail: 'Admin sèlman' });
    res.json(safeUser(user));
  } catch { res.status(401).json({ detail: 'Token envalid' }); }
});

// ─── ADMIN REFRESH (with rotation) ────────────────────────────────────────────
router.post('/admin/refresh', (req, res) => {
  try {
    const refresh = req.cookies?.admin_refresh_token;
    if (!refresh) return res.status(401).json({ detail: 'Pa gen refresh token' });

    let payload;
    try { payload = verifyRefreshToken(refresh); }
    catch { return res.status(401).json({ detail: 'Refresh envalid' }); }

    if (payload.type !== 'refresh') return res.status(401).json({ detail: 'Token envalid' });

    const db     = getDb();
    const stored = db.prepare('SELECT * FROM refresh_tokens WHERE jti=?').get(payload.jti);
    if (!stored || stored.revoked) {
      if (payload.sub) revokeAllTokens(db, payload.sub);
      res.clearCookie('admin_access_token',  COOKIE_OPTS);
      res.clearCookie('admin_refresh_token', COOKIE_OPTS);
      return res.status(401).json({ detail: 'Session invalide. Konekte ankò.' });
    }

    const user = db.prepare('SELECT id,role,status FROM users WHERE id=?').get(payload.sub);
    if (!user || user.role !== 'admin' || user.status !== 'active')
      return res.status(401).json({ detail: 'Itilizatè envalid' });

    db.prepare("UPDATE refresh_tokens SET revoked=1 WHERE jti=?").run(payload.jti);
    const accessToken = issueAdminTokens(res, db, user.id, user.role);
    res.json({ access_token: accessToken, message: 'Refresh OK' });
  } catch { res.status(401).json({ detail: 'Refresh envalid' }); }
});

// ─── REQUEST PASSWORD RESET ───────────────────────────────────────────────────
router.post('/request-reset', [
  body('identifier').isString().isLength({ min: 2, max: 100 }).trim(),
  validate
], async (req, res) => {
  try {
    const { identifier } = req.body;
    const db   = getDb();
    const user = db.prepare('SELECT id,username,email FROM users WHERE email=? OR username=? OR phone=?')
      .get(identifier, identifier, identifier);

    if (!user) return res.json({ message: 'Si kont sa a egziste, ou pral resevwa yon kòd.' });

    const code    = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 15 * 60000).toISOString();
    db.prepare('DELETE FROM password_reset_codes WHERE user_id=?').run(user.id);
    db.prepare('INSERT INTO password_reset_codes (id,user_id,code,expires_at) VALUES (?,?,?,?)')
      .run(uuidv4(), user.id, code, expires);

    if (user.email) {
      sendMail({ to: user.email, ...resetCodeEmail({ username: user.username, code, expiresMinutes: 15 }) })
        .catch(err => logger.warn(`Reset email failed: ${err.message}`));
    }
    res.json({ message: 'Si kont sa a egziste, ou pral resevwa yon kòd.' });
  } catch (e) {
    logger.error('Reset request: ' + e.message);
    res.status(500).json({ detail: 'Erè. Eseye ankò.' });
  }
});

// ─── UNLOCK ACCOUNT ───────────────────────────────────────────────────────────
router.post('/unlock-account', [
  body('identifier').isString().isLength({ min: 2, max: 100 }).trim(),
  body('code').isString().isLength({ min: 6, max: 6 }).isNumeric(),
  body('new_password').isString().isLength({ min: 8, max: 100 })
    .matches(/[A-Za-z]/).withMessage('Modpas dwe genyen omwen yon lèt')
    .matches(/[0-9]/).withMessage('Modpas dwe genyen omwen yon chif'),
  body('confirm_password').isString().notEmpty(),
  validate
], (req, res) => {
  try {
    const { identifier, code, new_password, confirm_password } = req.body;
    if (new_password !== confirm_password)
      return res.status(400).json({ detail: 'Konfirmasyon modpas pa idantik.' });
    const db   = getDb();
    const user = db.prepare('SELECT id,username,hashed_password FROM users WHERE email=? OR username=? OR phone=?')
      .get(identifier, identifier, identifier);

    const ERR = { detail: 'Kòd envalid, ekspire, oswa idantifyan enkòrèk.' };
    if (!user) return res.status(400).json(ERR);

    const resetRow = db.prepare(
      "SELECT * FROM password_reset_codes WHERE user_id=? AND code=? AND used=0 AND expires_at > datetime('now')"
    ).get(user.id, code);
    if (!resetRow) return res.status(400).json(ERR);

    if (verifyPassword(new_password, user.hashed_password))
      return res.status(400).json({ detail: 'Nouvo modpas pa ka menm ak ansyen modpas la.' });

    db.transaction(() => {
      db.prepare("UPDATE users SET hashed_password=?,failed_attempts=0,locked_until=NULL,status='active',updated_at=datetime('now') WHERE id=?")
        .run(hashPassword(new_password), user.id);
      db.prepare("UPDATE password_reset_codes SET used=1 WHERE id=?").run(resetRow.id);
      revokeAllTokens(db, user.id);
      // Audit log — self-unlock via email code
      try {
        db.prepare(`INSERT INTO audit_log (id,action,entity_type,entity_id,user_id,details,ip,created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))`)
          .run(uuidv4(), 'ACCOUNT_UNLOCKED', 'user', user.id, user.id,
               JSON.stringify({ username: user.username, method: 'email_code' }), '');
      } catch {}
    })();

    logger.info(`Account unlocked: ${user.username}`);
    res.json({ message: 'Modpas chanje. Kont debloke. Konekte koulye a.' });
  } catch (e) {
    logger.error('Unlock: ' + e.message);
    res.status(500).json({ detail: 'Erè. Eseye ankò.' });
  }
});

// ─── VERIFY RESET ─────────────────────────────────────────────────────────────
router.post('/verify-reset', [
  body('identifier').isString().isLength({ min: 2, max: 100 }).trim(),
  body('code').isString().isLength({ min: 6, max: 6 }).isNumeric(),
  body('new_password').isString().isLength({ min: 8, max: 100 })
    .matches(/[A-Za-z]/).withMessage('Modpas dwe genyen omwen yon lèt')
    .matches(/[0-9]/).withMessage('Modpas dwe genyen omwen yon chif'),
  body('confirm_password').isString().notEmpty(),
  validate
], (req, res) => {
  try {
    const { identifier, code, new_password, confirm_password } = req.body;
    if (new_password !== confirm_password)
      return res.status(400).json({ detail: 'Konfirmasyon modpas pa idantik.' });
    const db   = getDb();
    const user = db.prepare('SELECT id,username,hashed_password FROM users WHERE email=? OR username=? OR phone=?')
      .get(identifier, identifier, identifier);

    if (!user) return res.status(400).json({ detail: 'Idantifyan pa jwenn.' });
    const resetRow = db.prepare(
      "SELECT * FROM password_reset_codes WHERE user_id=? AND code=? AND used=0 AND expires_at > datetime('now')"
    ).get(user.id, code);
    if (!resetRow) return res.status(400).json({ detail: 'Kòd envalid oswa ekspire.' });

    if (verifyPassword(new_password, user.hashed_password))
      return res.status(400).json({ detail: 'Nouvo modpas pa ka menm ak ansyen modpas la.' });

    db.transaction(() => {
      db.prepare("UPDATE users SET hashed_password=?,failed_attempts=0,locked_until=NULL,updated_at=datetime('now') WHERE id=?")
        .run(hashPassword(new_password), user.id);
      db.prepare("UPDATE password_reset_codes SET used=1 WHERE id=?").run(resetRow.id);
      revokeAllTokens(db, user.id);
    })();

    logger.info(`Password reset: ${user.username}`);
    res.json({ message: 'Modpas chanje avèk siksè! Konekte ak nouvo modpas ou.' });
  } catch (e) {
    logger.error('Reset verify: ' + e.message);
    res.status(500).json({ detail: 'Erè. Eseye ankò.' });
  }
});

// ─── GET / UPDATE PROFILE ─────────────────────────────────────────────────────
router.get('/profile', authenticate, (req, res) => {
  try {
    const user = getDb().prepare(
      'SELECT id,email,username,full_name,phone,role,status,balance,bonus_balance,is_email_verified,totp_enabled,last_login,created_at FROM users WHERE id=?'
    ).get(req.user.id);
    res.json(user);
  } catch { res.status(500).json({ detail: 'Erè' }); }
});

router.patch('/profile', authenticate, [
  body('full_name').optional().isString().isLength({ max: 100 }).trim(),
  body('phone').optional({ nullable: true }).custom(val => {
    if (val === null || val === '') return true;
    if (typeof val !== 'string' || val.length < 8 || val.length > 20)
      throw new Error('Nimewo telefòn envalid');
    return true;
  }),
  validate
], (req, res) => {
  try {
    const { phone, full_name } = req.body;
    const db = getDb();
    if (full_name !== undefined)
      db.prepare("UPDATE users SET full_name=?,updated_at=datetime('now') WHERE id=?")
        .run(sanitize(full_name), req.user.id);
    if (phone !== undefined) {
      if (phone) {
        const existing = db.prepare('SELECT id FROM users WHERE phone=? AND id!=?').get(phone, req.user.id);
        if (existing) return res.status(400).json({ detail: 'Nimewo sa deja itilize pa yon lòt kont.' });
        db.prepare("UPDATE users SET phone=?,updated_at=datetime('now') WHERE id=?").run(phone, req.user.id);
      } else {
        db.prepare("UPDATE users SET phone=NULL,updated_at=datetime('now') WHERE id=?").run(req.user.id);
      }
    }
    const updated = db.prepare(
      'SELECT id,email,username,full_name,phone,role,status,balance,bonus_balance,created_at FROM users WHERE id=?'
    ).get(req.user.id);
    res.json(updated);
  } catch (e) {
    logger.error('Profile update: ' + e.message);
    res.status(500).json({ detail: 'Erè aktyalizasyon' });
  }
});

// ─── SUGGEST USERNAME ─────────────────────────────────────────────────────────
router.get('/suggest-username', (req, res) => {
  try {
    const first = String(req.query.first || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 10);
    const last  = String(req.query.last  || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 10);
    const db    = getDb();
    const base  = first && last ? `${first}.${last}` : first || last || 'user';
    const candidates = [
      `${base}${Math.floor(Math.random() * 900 + 100)}`,
      `${first}${last.slice(0,1)}${Math.floor(Math.random() * 90 + 10)}`,
      `${base}${Math.floor(Math.random() * 9000 + 1000)}`,
    ].filter((v,i,a) => v && a.indexOf(v) === i);
    const available = candidates.filter(u => !db.prepare('SELECT id FROM users WHERE username=?').get(u)).slice(0,3);
    res.json({ suggestions: available });
  } catch { res.json({ suggestions: [] }); }
});

module.exports = router;
