const { verifyAccessToken } = require('../utils/security');
const { getDb } = require('../database');
const logger = require('../utils/logger');

function authenticate(req, res, next) {
  try {
    let token = req.cookies?.access_token;
    if (!token) {
      const auth = req.headers.authorization;
      if (auth?.startsWith('Bearer ')) token = auth.slice(7);
    }
    if (!token) return res.status(401).json({ detail: 'Konekte anvan' });

    const payload = verifyAccessToken(token);
    if (payload.type !== 'access') return res.status(401).json({ detail: 'Token envalid' });

    const user = getDb().prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!user) return res.status(401).json({ detail: 'Itilizatè pa jwenn' });
    if (user.status !== 'active') return res.status(403).json({ detail: 'Kont dezaktive' });

    req.user = user;
    next();
  } catch (e) {
    if (e.name === 'TokenExpiredError') return res.status(401).json({ detail: 'Sesyon ekspire' });
    return res.status(401).json({ detail: 'Token envalid' });
  }
}

function requireAdmin(req, res, next) {
  authenticate(req, res, () => {
    if (req.user?.role !== 'admin') {
      logger.warn(`Admin denied: user=${req.user?.id}`);
      return res.status(403).json({ detail: 'Admin sèlman' });
    }
    next();
  });
}

module.exports = { authenticate, requireAdmin };
