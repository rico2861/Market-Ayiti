const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.resolve(process.env.DATABASE_PATH || './data/ayiti_market.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let db = null;

// No-op: better-sqlite3 writes synchronously via WAL — no manual flush needed
function saveDb() {}

async function initDatabase() {
  db = new Database(DB_PATH);

  // WAL mode = concurrent reads + single writer, much faster than default journal
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('cache_size = -32000');    // 32 MB page cache
  db.pragma('synchronous = NORMAL');   // safe + fast under WAL
  db.pragma('temp_store = MEMORY');
  db.pragma('mmap_size = 268435456');  // 256 MB memory-mapped I/O

  const shutdown = () => { try { db.close(); } catch {} process.exit(0); };
  process.once('SIGINT',  shutdown);
  process.once('SIGTERM', shutdown);
  process.on('exit', () => { try { db.close(); } catch {} });

  logger.info('DB ready (better-sqlite3 + WAL): ' + DB_PATH);
  return db;
}

function getDb() {
  if (!db) throw new Error('DB not ready');
  return db;
}

function initializeSchema() {
  const d = getDb();

  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, username TEXT UNIQUE NOT NULL,
      full_name TEXT, phone TEXT UNIQUE, hashed_password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user', status TEXT NOT NULL DEFAULT 'active',
      balance REAL NOT NULL DEFAULT 0, is_email_verified INTEGER NOT NULL DEFAULT 0,
      last_login TEXT, last_ip TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS markets (
      id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL,
      description TEXT, category TEXT NOT NULL DEFAULT 'lot',
      status TEXT NOT NULL DEFAULT 'active', end_date TEXT NOT NULL,
      min_bet REAL NOT NULL DEFAULT 25, max_bet REAL NOT NULL DEFAULT 100000,
      yes_pool REAL NOT NULL DEFAULT 0, no_pool REAL NOT NULL DEFAULT 0,
      yes_prob REAL NOT NULL DEFAULT 0.5, no_prob REAL NOT NULL DEFAULT 0.5,
      total_volume REAL NOT NULL DEFAULT 0, bet_count INTEGER NOT NULL DEFAULT 0,
      resolution TEXT, resolution_source TEXT, image_url TEXT,
      created_by TEXT NOT NULL, resolved_by TEXT, resolved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bets (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, market_id TEXT NOT NULL,
      option TEXT NOT NULL, amount REAL NOT NULL, potential_payout REAL NOT NULL,
      actual_payout REAL, odds_at_bet REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', settled_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bet_slips (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      total_odds REAL NOT NULL DEFAULT 1.0, amount REAL NOT NULL DEFAULT 0,
      potential_gain REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      settled_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bet_slip_selections (
      id TEXT PRIMARY KEY, bet_slip_id TEXT NOT NULL, market_id TEXT NOT NULL,
      option_chosen TEXT NOT NULL, odds_at_time REAL NOT NULL,
      result TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT NOT NULL,
      amount REAL NOT NULL, balance_before REAL NOT NULL, balance_after REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed', description TEXT,
      reference_id TEXT, payment_method TEXT, phone_number TEXT,
      completed_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY, action TEXT NOT NULL, entity_type TEXT,
      entity_id TEXT, user_id TEXT, details TEXT,
      ip TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS price_points (
      id TEXT PRIMARY KEY, market_id TEXT NOT NULL,
      yes_price REAL NOT NULL, no_price REAL NOT NULL,
      volume REAL NOT NULL DEFAULT 0,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_reset_codes (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, code TEXT NOT NULL,
      expires_at TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS market_comments (
      id TEXT PRIMARY KEY, market_id TEXT NOT NULL, user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS market_favorites (
      id TEXT PRIMARY KEY, market_id TEXT NOT NULL, user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(market_id, user_id)
    );
  `);

  d.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      slug          TEXT UNIQUE NOT NULL,
      name          TEXT NOT NULL,
      name_fr       TEXT NOT NULL,
      icon          TEXT NOT NULL DEFAULT '📌',
      color         TEXT NOT NULL DEFAULT '#6B7280',
      display_order INTEGER NOT NULL DEFAULT 0,
      market_count  INTEGER NOT NULL DEFAULT 0,
      active        INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_categories_slug   ON categories(slug);
    CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(active, display_order);
  `);

  // Refresh tokens table — for rotation + reuse detection
  d.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      jti        TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      revoked    INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_rt_jti     ON refresh_tokens(jti);
    CREATE INDEX IF NOT EXISTS idx_rt_user    ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_rt_expires ON refresh_tokens(expires_at);
  `);

  // Safe migrations — idempotent (fail silently if column exists)
  const migrations = [
    "ALTER TABLE transactions ADD COLUMN phone_number TEXT",
    "ALTER TABLE markets ADD COLUMN image_url TEXT",
    "ALTER TABLE users ADD COLUMN bonus_balance REAL DEFAULT 0",
    "ALTER TABLE markets ADD COLUMN option_a TEXT DEFAULT 'Oui'",
    "ALTER TABLE markets ADD COLUMN option_b TEXT DEFAULT 'Non'",
    "ALTER TABLE markets ADD COLUMN source TEXT DEFAULT 'local'",
    "ALTER TABLE markets ADD COLUMN polymarket_id TEXT",
    "ALTER TABLE markets ADD COLUMN polymarket_url TEXT",
    "ALTER TABLE users ADD COLUMN failed_attempts INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN locked_until TEXT DEFAULT NULL",
    "ALTER TABLE markets ADD COLUMN liquidity REAL DEFAULT 0",
    "ALTER TABLE markets ADD COLUMN featured INTEGER DEFAULT 0",
    "ALTER TABLE bets ADD COLUMN is_bonus_bet INTEGER DEFAULT 0",
    `CREATE TABLE IF NOT EXISTS weekly_cashback_log (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, week_start TEXT NOT NULL,
      total_wagered REAL NOT NULL, cashback_amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT NOT NULL,
      title TEXT NOT NULL, message TEXT NOT NULL,
      ref_type TEXT, ref_id TEXT, read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    "ALTER TABLE users ADD COLUMN ban_reason TEXT DEFAULT NULL",
    // 2FA columns
    "ALTER TABLE users ADD COLUMN totp_secret TEXT DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0",
    // DELETE (not just close) any market whose title contains a past year — sync cannot re-insert
    // polymarket markets because polymarket_id unique constraint prevents duplicate insert
    // but status was being overwritten by the sync UPDATE; DELETE removes them entirely.
    "DELETE FROM markets WHERE (title LIKE '%2025%' OR title LIKE '%2024%' OR title LIKE '%2023%') AND NOT EXISTS (SELECT 1 FROM bets WHERE bets.market_id = markets.id)",
    // Also purge old end_date markets from Polymarket source (pre-2026)
    "DELETE FROM markets WHERE source='polymarket' AND end_date < '2026-01-01' AND NOT EXISTS (SELECT 1 FROM bets WHERE bets.market_id = markets.id)",
  ];
  for (const m of migrations) { try { d.exec(m); } catch {} }

  // Fix broken slugs: polymarket markets whose slug is the fallback pm-{id} form.
  // Rebuild from title so URLs become human-readable.
  try {
    const badSlugs = d.prepare(
      "SELECT id, title, polymarket_id FROM markets WHERE source='polymarket' AND (slug LIKE 'pm-%' OR slug LIKE 'pm-pm-%')"
    ).all();
    if (badSlugs.length > 0) {
      const fix = d.prepare("UPDATE markets SET slug=?, updated_at=datetime('now') WHERE id=?");
      const fixAll = d.transaction(() => {
        for (const row of badSlugs) {
          const titleSlug = (row.title || '')
            .toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 100);
          if (!titleSlug || titleSlug === row.polymarket_id) continue;
          // Check collision with another market
          const collision = d.prepare('SELECT id FROM markets WHERE slug=? AND id!=?').get(titleSlug, row.id);
          const finalSlug = collision
            ? `${titleSlug}-${row.polymarket_id.slice(-6)}`
            : titleSlug;
          fix.run(finalSlug.slice(0, 200), row.id);
        }
      });
      fixAll();
      logger.info(`Fixed ${badSlugs.length} broken polymarket slugs`);
    }
  } catch (e) { logger.warn('Slug fix skipped: ' + e.message); }

  // Global min_bet floor
  try { d.exec("UPDATE markets SET min_bet=25 WHERE min_bet < 25"); } catch {}

  try {
    d.exec(`
      CREATE INDEX IF NOT EXISTS idx_markets_status        ON markets(status);
      CREATE INDEX IF NOT EXISTS idx_markets_category      ON markets(category);
      CREATE INDEX IF NOT EXISTS idx_markets_slug          ON markets(slug);
      CREATE INDEX IF NOT EXISTS idx_markets_end_date      ON markets(end_date);
      CREATE INDEX IF NOT EXISTS idx_markets_created_at    ON markets(created_at);
      CREATE INDEX IF NOT EXISTS idx_bets_user             ON bets(user_id);
      CREATE INDEX IF NOT EXISTS idx_bets_market           ON bets(market_id);
      CREATE INDEX IF NOT EXISTS idx_bets_status           ON bets(status);
      CREATE INDEX IF NOT EXISTS idx_bets_created_at       ON bets(created_at);
      CREATE INDEX IF NOT EXISTS idx_slips_user            ON bet_slips(user_id);
      CREATE INDEX IF NOT EXISTS idx_slip_sel_slip         ON bet_slip_selections(bet_slip_id);
      CREATE INDEX IF NOT EXISTS idx_slip_sel_market       ON bet_slip_selections(market_id);
      CREATE INDEX IF NOT EXISTS idx_tx_user               ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_tx_type               ON transactions(type);
      CREATE INDEX IF NOT EXISTS idx_tx_status             ON transactions(status);
      CREATE INDEX IF NOT EXISTS idx_tx_created_at         ON transactions(created_at);
      CREATE INDEX IF NOT EXISTS idx_tx_user_created       ON transactions(user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_users_email           ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_phone           ON users(phone);
      CREATE INDEX IF NOT EXISTS idx_users_username        ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_status          ON users(status);
      CREATE INDEX IF NOT EXISTS idx_price_market          ON price_points(market_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_entity          ON audit_log(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_created_at      ON audit_log(created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_user            ON audit_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_comments_market       ON market_comments(market_id);
      CREATE INDEX IF NOT EXISTS idx_comments_user         ON market_comments(user_id);
      CREATE INDEX IF NOT EXISTS idx_favs_user             ON market_favorites(user_id);
      CREATE INDEX IF NOT EXISTS idx_favs_market           ON market_favorites(market_id);
      CREATE INDEX IF NOT EXISTS idx_reset_user            ON password_reset_codes(user_id);
      CREATE INDEX IF NOT EXISTS idx_notif_user            ON notifications(user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_notif_read            ON notifications(user_id, read);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_markets_polymarket_id ON markets(polymarket_id) WHERE polymarket_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_markets_source        ON markets(source);
    `);
  } catch {}

  // Purge expired refresh tokens older than 31 days (keep DB lean)
  try {
    d.exec("DELETE FROM refresh_tokens WHERE expires_at < datetime('now', '-1 day') AND revoked=1");
  } catch {}

  logger.info('Schema initialized');
}

function seedSampleMarkets(adminId) {
  const d = getDb();
  const existing = d.prepare('SELECT COUNT(*) as c FROM markets').get().c;
  if (existing > 0) return;

  const now = new Date();

  const markets = [
    // POLITIK
    { id: uuidv4(), slug: 'eleksyon-prezidansyel-2026-ayiti',
      title: 'Eleksyon Prezidansyèl 2026 – Èske yo pral fèt nan dat prevwa?',
      description: 'Eleksyon prezidansyèl Ayiti prevwa pou 2026. Mache sa a pale de si eleksyon an pral fèt nan dat ki planifye a oswa si y ap repòte li ankò akòz sitiyasyon politik ak sekirite peyi a.',
      category: 'politik', yes_prob: 0.32, no_prob: 0.68,
      yes_pool: 48000, no_pool: 96000, total_volume: 144000, bet_count: 287,
      end_date: new Date(now.getTime() + 180*86400000).toISOString(), min_bet: 25, max_bet: 50000 },
    { id: uuidv4(), slug: 'conseil-presidential-stability-2026',
      title: 'Konsèy Prezidansyèl – Èske li pral rete estab pou 12 mwa?',
      description: 'Konsèy Prezidansyèl Ayiti ki te kreye an 2024. Èske li pral rete estab pou omwen 12 mwa konplè?',
      category: 'politik', yes_prob: 0.41, no_prob: 0.59,
      yes_pool: 31000, no_pool: 44500, total_volume: 75500, bet_count: 156,
      end_date: new Date(now.getTime() + 120*86400000).toISOString(), min_bet: 25, max_bet: 25000 },
    // SPO
    { id: uuidv4(), slug: 'haiti-qualif-coupe-monde-2026',
      title: 'Ayiti – Èske ekip nasyonal la ap kalifye pou Wòld Kap 2026?',
      description: 'Ekip nasyonal foutbòl Ayiti nan eliminatwa CONCACAF pou Coupe du Monde 2026.',
      category: 'spo', yes_prob: 0.28, no_prob: 0.72,
      yes_pool: 22000, no_pool: 56000, total_volume: 78000, bet_count: 198,
      end_date: new Date(now.getTime() + 90*86400000).toISOString(), min_bet: 25, max_bet: 20000 },
    { id: uuidv4(), slug: 'tiger-woods-return-major-2026',
      title: 'Tiger Woods – Èske li ap genyen yon lòt Major anvan retrèt li?',
      description: 'Tigre Bwa sou wout retou li apre blesi li yo. Èske lejand sa a ap reyisi genyen yon 16yèm Major?',
      category: 'spo', yes_prob: 0.12, no_prob: 0.88,
      yes_pool: 8500, no_pool: 62000, total_volume: 70500, bet_count: 143,
      end_date: new Date(now.getTime() + 365*86400000).toISOString(), min_bet: 25, max_bet: 15000 },
    // EKONOMI
    { id: uuidv4(), slug: 'dollar-depase-130-htg-2026',
      title: 'Dola Ameriken – Èske li ap depase 130 HTG anvan Desanm 2026?',
      description: 'To chanj dola ameriken an Ayiti ap monte rapidman. Ekonomis yo debat si dola a ap depase 130 HTG anvan fen ane 2026.',
      category: 'ekonomi', yes_prob: 0.67, no_prob: 0.33,
      yes_pool: 87000, no_pool: 43000, total_volume: 130000, bet_count: 334,
      end_date: new Date(now.getTime() + 60*86400000).toISOString(), min_bet: 25, max_bet: 100000 },
    { id: uuidv4(), slug: 'bitcoin-100k-2026',
      title: 'Bitcoin – Èske li ap touche $100,000 USD anvan jen 2026?',
      description: 'Bitcoin ap fè mouvman rapid sou mache mondyal la. Mache sa a mezire si BTC ap rive nan nivo istorik $100,000.',
      category: 'ekonomi', yes_prob: 0.55, no_prob: 0.45,
      yes_pool: 112000, no_pool: 92000, total_volume: 204000, bet_count: 512,
      end_date: new Date(now.getTime() + 45*86400000).toISOString(), min_bet: 25, max_bet: 200000 },
    // KILTI
    { id: uuidv4(), slug: 'oscar-haitian-film-2026',
      title: 'Ayiti – Èske yon fim ayisyen ap jwenn nominasyon Oscar 2026?',
      description: 'Sinema ayisyen ap grandi rapidman sou sèn entènasyonal la.',
      category: 'kilti', yes_prob: 0.18, no_prob: 0.82,
      yes_pool: 9000, no_pool: 41000, total_volume: 50000, bet_count: 89,
      end_date: new Date(now.getTime() + 200*86400000).toISOString(), min_bet: 25, max_bet: 10000 },
    { id: uuidv4(), slug: 'wyclef-concert-haiti-2026',
      title: 'Wyclef Jean – Èske li ap bay yon gwo konsè ann Ayiti nan 2026?',
      description: 'Wyclef Jean te anonse plizyè fwa vle retounen ann Ayiti pou yon gwo evènman mizik anvan fen 2026.',
      category: 'kilti', yes_prob: 0.44, no_prob: 0.56,
      yes_pool: 28000, no_pool: 36000, total_volume: 64000, bet_count: 201,
      end_date: new Date(now.getTime() + 150*86400000).toISOString(), min_bet: 25, max_bet: 30000 },
    // SOSYAL
    { id: uuidv4(), slug: 'sekirite-pap-gang-40-pct',
      title: 'Sekirite PaP – Èske gang yo pral kontwole mwens pase 40% vil la an 2026?',
      description: 'Gang yo kontwole yon gwo pati nan Pòtoprens kounye a. Mache sa a mezire si gang yo pral redui prezans yo.',
      category: 'sosyal', yes_prob: 0.35, no_prob: 0.65,
      yes_pool: 54000, no_pool: 100000, total_volume: 154000, bet_count: 412,
      end_date: new Date(now.getTime() + 75*86400000).toISOString(), min_bet: 25, max_bet: 50000 },
    { id: uuidv4(), slug: 'diaspora-investment-500m-2026',
      title: 'Dyaspora – Èske envèstisman dirèk ap depase $500M USD nan 2026?',
      description: 'Dyaspora ayisyen voye plis pase $3 milya dola chak ane. Mache sa a konsantre sou envèstisman dirèk ki soti nan dyaspora.',
      category: 'sosyal', yes_prob: 0.22, no_prob: 0.78,
      yes_pool: 15000, no_pool: 53000, total_volume: 68000, bet_count: 167,
      end_date: new Date(now.getTime() + 240*86400000).toISOString(), min_bet: 25, max_bet: 40000 }
  ];

  const insertMarket = d.prepare(`
    INSERT OR IGNORE INTO markets
    (id,slug,title,description,category,status,end_date,min_bet,max_bet,
     yes_pool,no_pool,yes_prob,no_prob,total_volume,bet_count,created_by,created_at,updated_at)
    VALUES (?,?,?,?,?,'active',?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))
  `);
  const insertPrice = d.prepare(
    `INSERT INTO price_points (id,market_id,yes_price,no_price,volume,timestamp) VALUES (?,?,?,?,?,?)`
  );

  const insertMany = d.transaction((list) => {
    for (const m of list) {
      insertMarket.run(m.id,m.slug,m.title,m.description,m.category,m.end_date,m.min_bet,m.max_bet,
        m.yes_pool,m.no_pool,m.yes_prob,m.no_prob,m.total_volume,m.bet_count,adminId);
      for (let i = 30; i >= 0; i--) {
        const ts = new Date(now.getTime() - i*86400000).toISOString();
        const drift = (Math.random()-0.5)*0.08;
        const yp = Math.min(0.95,Math.max(0.05,m.yes_prob+drift));
        insertPrice.run(uuidv4(),m.id,yp,1-yp,m.total_volume/30,ts);
      }
    }
  });
  insertMany(markets);

  logger.info(`Seeded ${markets.length} sample markets`);
}

module.exports = { initDatabase, getDb, initializeSchema, saveDb, seedSampleMarkets };
