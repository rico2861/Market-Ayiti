require('dotenv').config();
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

async function startServer() {
  await initDatabase();
  initializeSchema();

  const authRoutes    = require('./routes/auth');
  const marketsRoutes = require('./routes/markets');
  const adminRoutes   = require('./routes/admin');
  const walletRoutes  = require('./routes/wallet');

  const app  = express();
  const PORT = parseInt(process.env.PORT) || 4000;

  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));

  // Strip server-identifying headers
  app.use((req, res, next) => {
    res.removeHeader('X-Powered-By');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });

  // CORS — environment-driven allow-list
  const allowed = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001')
    .split(',').map(s => s.trim());
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || allowed.includes(origin)) return cb(null, true);
      cb(new Error('CORS blocked: ' + origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  // Rate limits
  app.use(rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    max:      parseInt(process.env.RATE_LIMIT_MAX) || 500,
    message: { detail: 'Twòp demann. Eseye ankò.' },
    skip: (req) => req.path === '/api/health'
  }));

  const authLimiter = rateLimit({
    windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 900000,
    max:      parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 50,
    message: { detail: 'Twòp tantativ. Eseye nan 15 minit.' }
  });

  app.use(compression());
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: false, limit: '10kb' }));
  app.use(cookieParser());
  app.use(morgan('tiny', { stream: { write: m => logger.info(m.trim()) } }));

  // Routes
  app.use('/api/v1/auth',    authLimiter, authRoutes);
  app.use('/api/v1/markets', marketsRoutes);
  app.use('/api/v1/admin',   adminRoutes);
  app.use('/api/v1/wallet',  walletRoutes);

  app.get('/api/health', (req, res) => res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  }));

  app.get('/', (req, res) => res.json({
    name: 'AyitiMarket API',
    version: '1.0.0',
    docs: '/api/health'
  }));

  // 404 + error handlers
  app.use((req, res) => res.status(404).json({ detail: 'Wout sa pa egziste' }));
  app.use((err, req, res, _next) => {
    logger.error('Unhandled: ' + err.message);
    res.status(500).json({ detail: 'Erè entèn' });
  });

  // Bootstrap admin
  try {
    const db = getDb();
    const email = process.env.ADMIN_EMAIL || 'admin@ayitimarket.com';
    const username = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'Admin2024!';
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (!existing) {
      db.prepare(`INSERT INTO users (id,email,username,full_name,hashed_password,role,status,balance,is_email_verified)
                  VALUES (?,?,?,?,?, 'admin','active',0,1)`)
        .run(uuidv4(), email, username, 'Administratè', hashPassword(password));
      logger.info(`Admin created: ${email} / ${username}`);
    } else {
      // Always sync password from env (so changing .env updates it)
      db.prepare('UPDATE users SET hashed_password=?, role=?, status=? WHERE email=?')
        .run(hashPassword(password), 'admin', 'active', email);
      logger.info(`Admin password synced: ${email}`);
    }
  } catch (e) {
    logger.error('Admin bootstrap: ' + e.message);
  }

  // Wrap in HTTP server so WS attaches
  const server = http.createServer(app);
  const { broadcast } = setupWebSocket(server);
  app.locals.broadcast = broadcast;

  // Auto-close expired markets every 5 minutes
  setInterval(() => {
    try {
      const db = getDb();
      const closed = db.prepare(
        "UPDATE markets SET status='closed',updated_at=datetime('now') WHERE status='active' AND end_date < datetime('now')"
      ).run();
      if (closed.changes > 0) logger.info(`Auto-closed ${closed.changes} expired markets`);
    } catch (e) { logger.warn('Auto-close error: ' + e.message); }
  }, 5 * 60 * 1000);

  server.listen(PORT, () => {
    logger.info(`AyitiMarket API:  http://localhost:${PORT}`);
    logger.info(`WebSocket:        ws://localhost:${PORT}/ws`);
    logger.info(`Admin login:      ${process.env.ADMIN_EMAIL} / ${process.env.ADMIN_PASSWORD}`);
    // Seed sample markets if DB is empty
    try {
      const { getDb } = require('./database');
      const adminUser = getDb().prepare('SELECT id FROM users WHERE role=?').get('admin');
      if (adminUser) seedSampleMarkets(adminUser.id);
    } catch(e) { logger.warn('Seed skipped: ' + e.message); }
  });
}

startServer().catch(e => {
  logger.error('FATAL: ' + e.message);
  process.exit(1);
});
