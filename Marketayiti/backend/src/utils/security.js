const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const xss = require('xss');

const SALT_ROUNDS = 12;

const hashPassword = (pw) => bcrypt.hashSync(pw, SALT_ROUNDS);
const verifyPassword = (plain, hash) => bcrypt.compareSync(plain, hash);

const createAccessToken = (payload) =>
  jwt.sign({ ...payload, type: 'access' }, process.env.JWT_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRE || '2h' });

const createRefreshToken = (payload) =>
  jwt.sign({ ...payload, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRE || '30d' });

const verifyAccessToken = (t) => jwt.verify(t, process.env.JWT_SECRET);
const verifyRefreshToken = (t) =>
  jwt.verify(t, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);

const sanitize = (s) => typeof s === 'string'
  ? xss(s.trim(), { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script'] })
  : s;

module.exports = {
  hashPassword, verifyPassword,
  createAccessToken, createRefreshToken,
  verifyAccessToken, verifyRefreshToken,
  sanitize
};
