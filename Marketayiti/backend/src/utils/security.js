const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const xss     = require('xss');
const speakeasy = require('speakeasy');
const QRCode    = require('qrcode');
const { v4: uuidv4 } = require('uuid');

const SALT_ROUNDS = 12;

// ── Passwords ─────────────────────────────────────────────────────────────────
const hashPassword   = (pw)         => bcrypt.hashSync(pw, SALT_ROUNDS);
const verifyPassword = (plain, hash) => bcrypt.compareSync(plain, hash);

// ── Access token (short-lived JWT) ────────────────────────────────────────────
const createAccessToken = (payload) =>
  jwt.sign({ ...payload, type: 'access' }, process.env.JWT_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRE || '2h' });

const verifyAccessToken = (t) => jwt.verify(t, process.env.JWT_SECRET);

// ── Refresh token (JWT + jti for DB-backed rotation) ─────────────────────────
// Returns { token, jti } — caller must persist jti in refresh_tokens table.
const createRefreshToken = (payload) => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET not set');
  const jti = uuidv4();
  const token = jwt.sign(
    { ...payload, type: 'refresh', jti },
    secret,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRE || '30d' }
  );
  return { token, jti };
};

const verifyRefreshToken = (t) => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET not set');
  return jwt.verify(t, secret);
};

// ── 2FA pending token (5-min, type: '2fa_pending') ───────────────────────────
// Issued after correct password when TOTP is required — short-lived, no refresh.
const createTempToken = (userId) =>
  jwt.sign({ sub: userId, type: '2fa_pending' }, process.env.JWT_SECRET, { expiresIn: '5m' });

const verifyTempToken = (t) => {
  const p = jwt.verify(t, process.env.JWT_SECRET);
  if (p.type !== '2fa_pending') throw new Error('Invalid token type');
  return p;
};

// ── TOTP (RFC 6238 via speakeasy) ────────────────────────────────────────────
// 6-digit, 30-second step, ±1 step tolerance (handles ±30s clock skew)

const generateTotpSecret = () =>
  speakeasy.generateSecret({ length: 20 }).base32;

const verifyTotpToken = (token, secret) => {
  try {
    return speakeasy.totp.verify({ secret, encoding: 'base32', token: String(token).trim(), window: 1 });
  } catch { return false; }
};

const generateTotpQr = async (email, secret) => {
  const otpauth = speakeasy.otpauthURL({ secret, label: encodeURIComponent(email), issuer: 'AyitiMarket', encoding: 'base32' });
  const qrImage = await QRCode.toDataURL(otpauth, { width: 220, margin: 2 });
  return { otpauth, qrImage, secret };
};

// ── Sanitize (XSS strip) ─────────────────────────────────────────────────────
const sanitize = (s) => typeof s === 'string'
  ? xss(s.trim(), { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script'] })
  : s;

module.exports = {
  hashPassword, verifyPassword,
  createAccessToken, verifyAccessToken,
  createRefreshToken, verifyRefreshToken,
  createTempToken, verifyTempToken,
  generateTotpSecret, verifyTotpToken, generateTotpQr,
  sanitize,
};
