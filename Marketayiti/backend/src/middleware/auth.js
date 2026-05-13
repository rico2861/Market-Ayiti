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

    const user = getDb().prepare('SELECT id,email,username,full_name,role,status,balance,COALESCE(bonus_balance,0) as bonus_balance,created_at FROM users WHERE id = ?').get(payload.sub);
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
  try {
    // Use dedicated admin_access_token cookie to avoid conflict with user sessions
    let token = req.cookies?.admin_access_token;
    if (!token) {
      const auth = req.headers.authorization;
      if (auth?.startsWith('Bearer ')) token = auth.slice(7);
    }
    if (!token) return res.status(401).json({ detail: 'Konekte anvan (admin)' });

    const payload = verifyAccessToken(token);
    if (payload.type !== 'access') return res.status(401).json({ detail: 'Token envalid' });

    const user = getDb().prepare('SELECT id,email,username,full_name,role,status,balance,COALESCE(bonus_balance,0) as bonus_balance,created_at FROM users WHERE id = ?').get(payload.sub);
    if (!user) return res.status(401).json({ detail: 'Itilizatè pa jwenn' });
    if (user.status !== 'active') return res.status(403).json({ detail: 'Kont dezaktive' });
    if (user.role !== 'admin') {
      logger.warn(`Admin denied: user=${user.id} role=${user.role}`);
      return res.status(403).json({ detail: 'Admin sèlman' });
    }

    req.user = user;
    next();
  } catch (e) {
    if (e.name === 'TokenExpiredError') return res.status(401).json({ detail: 'Sesyon admin ekspire' });
    return res.status(401).json({ detail: 'Token envalid' });
  }
}

module.exports = { authenticate, requireAdmin };
