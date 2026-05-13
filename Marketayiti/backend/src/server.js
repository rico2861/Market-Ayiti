require('dotenv').config();

// ── Startup secrets validation — fail fast if critical secrets are missing ────
// JWT secrets must be long and strong
const REQUIRED_SECRETS = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
const WEAK_SECRETS = [
  'ayitimarket-development-secret',
  'ayitimarket-refresh-secret',
  'changeme', 'secret', 'password', 'dev', 'test',
];
for (const key of REQUIRED_SECRETS) {
  const val = process.env[key] || '';
  if (!val || val.length < 32) {
    console.error(`FATAL: ${key} is missing or too short (min 32 chars). Set a strong secret.`);
    process.exit(1);
  }
  if (WEAK_SECRETS.some(w => val.toLowerCase().includes(w))) {
    if (process.env.APP_ENV === 'production') {
      console.error(`FATAL: ${key} contains a weak/default value. Rotate it before going to production.`);
      process.exit(1);
    } else {
      console.warn(`WARN: ${key} appears to be a development default — rotate before production.`);
    }
  }
}

// Admin password: required in production, warn in development
if (!process.env.ADMIN_PASSWORD) {
  if (process.env.APP_ENV === 'production') {
    console.error('FATAL: ADMIN_PASSWORD must be set in production.');
    process.exit(1);
  } else {
    console.warn('WARN: ADMIN_PASSWORD not set — using default (CHANGE BEFORE PRODUCTION).');
  }
} else if (process.env.ADMIN_PASSWORD.length < 12) {
  if (process.env.APP_ENV === 'production') {
    console.error('FATAL: ADMIN_PASSWORD too short (min 12 chars) in production.');
    process.exit(1);
  } else {
    console.warn('WARN: ADMIN_PASSWORD is short — use a stronger password in production.');
  }
}

const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

const logger = require('./utils/logger');
const { initDatabase, initializeSchema, getDb, seedSampleMarkets } = require('./database');
const { hashPassword } = require('./utils/security');
const { setupWebSocket } = require('./websocket');
const CacheService = require('./services/cache.service');
const CategoryService = require('./services/category.service');
const { startSyncLoop, runSync, runResolutionCheck } = require('./services/sync.service');
const { getBreakerStatus } = require('./services/polymarket.service');
const { startCashbackScheduler } = require('./services/cashback.service');

async function startServer() {
  await initDatabase();
  initializeSchema();

  const authRoutes          = require('./routes/auth');
  const marketsRoutes       = require('./routes/markets');
  const adminRoutes         = require('./routes/admin');
  const walletRoutes        = require('./routes/wallet');
  const polymarketsRoutes   = require('./routes/polymarkets');
  const notificationsRoutes = require('./routes/notifications');

  const app  = express();
  const PORT = parseInt(process.env.PORT) || 4000;

  // Trust first proxy (needed for correct req.ip behind nginx/docker)
  app.set('trust proxy', 1);

  // Security headers via Helmet — CSP enabled with sensible policy
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:     ["'self'"],
        scriptSrc:      ["'self'"],
        styleSrc:       ["'self'", "'unsafe-inline'"],
        imgSrc:         ["'self'", 'data:', 'https:'],
        connectSrc:     ["'self'", 'wss:', 'ws:'],
        fontSrc:        ["'self'", 'https:'],
        objectSrc:      ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: process.env.APP_ENV === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // Strip server-identifying headers + add missing security headers
  app.use((_req, res, next) => {
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    // HSTS — only in production behind HTTPS
    if (process.env.APP_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }
    next();
  });

  // CORS — environment-driven allow-list (dev: allow any LAN origin)
  const allowed = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001')
    .split(',').map(s => s.trim()).filter(Boolean);
  const isDev = (process.env.APP_ENV || 'development') === 'development';

  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (isDev) return cb(null, true); // allow all origins in development
      if (allowed.includes(origin)) return cb(null, true);
      cb(new Error('CORS bloqué: ' + origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }));

  // Global rate limit — generous for normal browsing
  app.use(rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
    max:      parseInt(process.env.RATE_LIMIT_MAX) || 300,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { detail: 'Twòp demann. Eseye ankò.' },
    skip: (req) => req.path === '/api/health',
  }));

  // Strict rate limit for auth endpoints
  const authLimiter = rateLimit({
    windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 900_000,
    max:      parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 20,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { detail: 'Twòp tantativ. Eseye nan 15 minit.' },
  });

  // Rate limit for bet placement — 60 bets/min per IP+user
  const betLimiter = rateLimit({
    windowMs: 60_000,
    max:      60,
    keyGenerator: (req) => req.ip + (req.user?.id || ''),
    message: { detail: 'Twòp pari. Eseye nan yon minit.' },
  });

  // Strict rate limit for wallet operations — 10 per 15 min per IP+user
  const walletLimiter = rateLimit({
    windowMs: 15 * 60_000,
    max:      10,
    keyGenerator: (req) => req.ip + (req.user?.id || ''),
    standardHeaders: true,
    legacyHeaders:   false,
    message: { detail: 'Twòp operasyon walèt. Eseye nan 15 minit.' },
  });
  app.locals.walletLimiter = walletLimiter;

  // Rate limit for admin operations — 60 ops per 15 min per admin user
  const adminOpLimiter = rateLimit({
    windowMs: 15 * 60_000,
    max:      60,
    keyGenerator: (req) => req.ip + (req.user?.id || ''),
    standardHeaders: true,
    legacyHeaders:   false,
    message: { detail: 'Twòp operasyon admin. Eseye nan 15 minit.' },
  });
  app.locals.adminOpLimiter = adminOpLimiter;

  app.use(compression());
  // Body limit: 2mb to support base64 images; most JSON payloads are tiny
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());
  app.use(morgan('tiny', { stream: { write: m => logger.info(m.trim()) } }));

  // Routes
  app.use('/api/v1/auth',          authLimiter, authRoutes);
  app.use('/api/v1/markets',       marketsRoutes);
  app.use('/api/v1/admin',         adminRoutes);
  app.use('/api/v1/wallet',        walletRoutes);
  app.use('/api/v1/polymarkets',   polymarketsRoutes);
  app.use('/api/v1/notifications', notificationsRoutes);

  // Expose betLimiter so markets route can use it
  app.locals.betLimiter = betLimiter;

  app.get('/api/health', (_req, res) => res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    ws: { connections: app.locals.getWsConnectionCount?.() ?? 0 },
    cache: CacheService.getStatus(),
  }));

  // GET /api/v1/categories — public, cached
  app.get('/api/v1/categories', (_req, res) => {
    try {
      let categories = CacheService.get('categories:all');
      if (!categories) {
        categories = CategoryService.getAll();
        CacheService.set('categories:all', categories, 300); // 5 min TTL
      }
      res.json({ success: true, data: categories });
    } catch (e) {
      logger.error('GET /categories error: ' + e.message);
      res.status(500).json({ detail: 'Erè entèn' });
    }
  });

  // Serve security.txt and other well-known static files
  app.use('/.well-known', express.static(require('path').join(__dirname, '../public/.well-known'), { dotfiles: 'allow' }));

  app.get('/', (_req, res) => res.json({
    name: 'AyitiMarket API',
    version: '1.0.0',
    docs: '/api/health',
  }));

  // Admin sync / resolution endpoints
  const { requireAdmin } = require('./middleware/auth');

  // POST /api/v1/admin/sync — full market sync
  app.post('/api/v1/admin/sync', requireAdmin, (req, res) => {
    res.json({ message: 'Sync lancé en arrière-plan' });
    runSync(app.locals.broadcast).catch(() => {});
  });

  // POST /api/v1/admin/resolve-check — trigger resolution detection + auto-settlement now
  app.post('/api/v1/admin/resolve-check', requireAdmin, async (req, res) => {
    await runResolutionCheck(app.locals.broadcast).catch(() => {});
    res.json({ message: 'Resolution check déclenché' });
  });

  // GET /api/v1/admin/polymarket-status — circuit breaker + sync health
  app.get('/api/v1/admin/polymarket-status', requireAdmin, (_req, res) => {
    res.json({ breaker: getBreakerStatus(), mock: process.env.POLYMARKET_MOCK === 'true' });
  });

  // 404
  app.use((_req, res) => res.status(404).json({ detail: 'Wout sa pa egziste' }));

  // Global error handler
  app.use((err, _req, res, _next) => {
    const msg = err.message || '';
    if (msg.includes('CORS')) {
      logger.warn('CORS blocked: ' + msg);
      return res.status(403).json({ detail: 'CORS' });
    }
    logger.error('Unhandled: ' + msg);
    res.status(500).json({ detail: 'Erè entèn' });
  });

  // Bootstrap default admin account
  try {
    const db       = getDb();
    const email    = process.env.ADMIN_EMAIL    || 'admin@ayitimarket.com';
    const username = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!password) {
      logger.warn('ADMIN_PASSWORD not set in .env — using default (CHANGE IN PRODUCTION)');
    }

    const pw       = password || 'Admin2024!';
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

    if (!existing) {
      db.prepare(`INSERT INTO users (id,email,username,full_name,hashed_password,role,status,balance,is_email_verified)
                  VALUES (?,?,?,?,?, 'admin','active',0,1)`)
        .run(uuidv4(), email, username, 'Administratè', hashPassword(pw));
      logger.info(`Admin account created: ${email}`);
    } else {
      // Sync password from env on every restart
      db.prepare('UPDATE users SET hashed_password=?,role=?,status=? WHERE email=?')
        .run(hashPassword(pw), 'admin', 'active', email);
      logger.info(`Admin account synced: ${email}`);
    }
  } catch (e) {
    logger.error('Admin bootstrap error: ' + e.message);
  }

  // HTTP + WebSocket server
  const server = http.createServer(app);
  const { broadcast, getConnectionCount } = setupWebSocket(server);
  app.locals.broadcast = broadcast;
  app.locals.getWsConnectionCount = getConnectionCount;

  // Auto-close expired markets every 5 minutes (background job, not blocking requests)
  setInterval(() => {
    try {
      const db     = getDb();
      const result = db.prepare(
        "UPDATE markets SET status='closed',updated_at=datetime('now') WHERE status='active' AND end_date < datetime('now')"
      ).run();
      if (result.changes > 0) logger.info(`Auto-closed ${result.changes} expired markets`);
    } catch (e) {
      logger.warn('Auto-close error: ' + e.message);
    }
  }, 5 * 60 * 1000);

  server.listen(PORT, () => {
    logger.info(`AyitiMarket API ready → http://localhost:${PORT}`);
    logger.info(`WebSocket ready       → ws://localhost:${PORT}/ws`);
    logger.info(`Admin email           → ${process.env.ADMIN_EMAIL || 'admin@ayitimarket.com'}`);

    // Initialize categories
    try {
      CategoryService.initialize();
      CategoryService.refreshCounts();
    } catch (e) {
      logger.warn('Category init skipped: ' + e.message);
    }

    // Start Polymarket sync loop
    try {
      startSyncLoop(broadcast);
      logger.info('Polymarket sync loop started');
    } catch (e) {
      logger.warn('Polymarket sync skipped: ' + e.message);
    }

    // Start weekly cashback scheduler (5% of weekly real bets → bonus_balance)
    try {
      startCashbackScheduler(broadcast);
    } catch (e) {
      logger.warn('Cashback scheduler skipped: ' + e.message);
    }

    // Seed sample markets if DB is empty
    try {
      const adminUser = getDb().prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
      if (adminUser) seedSampleMarkets(adminUser.id);
    } catch (e) {
      logger.warn('Seed skipped: ' + e.message);
    }
  });
}

startServer().catch(e => {
  logger.error('FATAL startup error: ' + e.message);
  process.exit(1);
});
