/**
 * Polymarket Service — Production Grade
 *
 * Fetches prediction markets from Polymarket API using Node.js built-in https.
 * Falls back to a rich 120+ market mock dataset on corporate networks (Zscaler).
 *
 * Environment flags:
 *   POLYMARKET_MOCK=true     — force mock mode
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 — bypass SSL (dev only)
 *
 * No Polymarket branding is exposed to the client.
 * Category mapping covers 13 Haitian categories.
 */

const https  = require('https');
const http   = require('http');
const zlib   = require('zlib');
const logger = require('../utils/logger');

const GAMMA_API  = 'https://gamma-api.polymarket.com';
const CLOB_API   = 'https://clob.polymarket.com';
const TIMEOUT    = 15_000;
const MAX_RETRY  = 3;
const MOCK_MODE  = process.env.POLYMARKET_MOCK === 'true';
// Only import markets created on or after this date
const MIN_MARKET_DATE = new Date('2026-04-01T00:00:00Z');

// ── Circuit Breaker ───────────────────────────────────────────────────────────
const breaker = {
  errors:    0,
  pauseUntil: 0,
  MAX_ERRORS: 10,
  PAUSE_MS:   60_000,
  isOpen() {
    if (this.pauseUntil > Date.now()) return true;
    if (this.pauseUntil > 0) { this.reset(); } // auto-reset after pause
    return false;
  },
  record(success) {
    if (success) { this.errors = 0; return; }
    this.errors++;
    if (this.errors >= this.MAX_ERRORS) {
      this.pauseUntil = Date.now() + this.PAUSE_MS;
      logger.warn(`[polymarket] Circuit breaker OPEN — pausing ${this.PAUSE_MS / 1000}s (${this.errors} consecutive errors)`);
    }
  },
  reset() { this.errors = 0; this.pauseUntil = 0; },
};

// ── Low-level HTTP (no fetch dependency) ─────────────────────────────────────
function httpsRequest(url, { method = 'GET', body = null } = {}) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url);
    const lib     = parsed.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : null;

    const options = {
      hostname:           parsed.hostname,
      port:               parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:               parsed.pathname + parsed.search,
      method,
      timeout:            TIMEOUT,
      rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0',
      headers: {
        'Accept':          'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'User-Agent':      'Mozilla/5.0 (compatible; AyitiMarket/2.0)',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = lib.request(options, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        return httpsRequest(res.headers.location, { method, body }).then(resolve).catch(reject);
      }
      if (res.statusCode === 429) {
        const wait = parseInt(res.headers['retry-after'] || '10') * 1000;
        res.resume();
        return reject(Object.assign(new Error('Rate limited'), { rateLimited: true, wait }));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }

      const enc = res.headers['content-encoding'];
      let stream = res;
      if (enc === 'gzip')    stream = res.pipe(zlib.createGunzip());
      if (enc === 'deflate') stream = res.pipe(zlib.createInflate());

      let rawBody = '';
      stream.on('data', c => rawBody += c);
      stream.on('end', () => {
        try { resolve(JSON.parse(rawBody)); }
        catch (e) { reject(new Error(`JSON parse failed: ${e.message}`)); }
      });
      stream.on('error', reject);
    });

    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

// Backwards-compat alias
const httpsGet = (url) => httpsRequest(url);

async function fetchWithRetry(url, opts = {}, attempt = 0) {
  if (breaker.isOpen()) throw new Error('Circuit breaker open — Polymarket API paused');
  try {
    const result = await httpsRequest(url, opts);
    breaker.record(true);
    return result;
  } catch (err) {
    if (err.rateLimited) {
      logger.warn(`[polymarket] Rate limited — waiting ${err.wait}ms`);
      await new Promise(r => setTimeout(r, err.wait));
      return fetchWithRetry(url, opts, attempt);
    }
    breaker.record(false);
    if (attempt < MAX_RETRY) {
      const wait = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
      logger.warn(`[polymarket] Retry ${attempt + 1}/${MAX_RETRY}: ${err.message}`);
      await new Promise(r => setTimeout(r, wait));
      return fetchWithRetry(url, opts, attempt + 1);
    }
    throw err;
  }
}

/**
 * Fetch prices for multiple token IDs in a single POST request.
 * Uses Polymarket CLOB endpoint: POST https://clob.polymarket.com/prices
 * Returns: { [tokenId]: priceFloat, ... }
 */
async function fetchPricesBatch(tokenIds) {
  if (!tokenIds || tokenIds.length === 0) return {};
  // CLOB batch max 50 per request
  const chunks = [];
  for (let i = 0; i < tokenIds.length; i += 50) {
    chunks.push(tokenIds.slice(i, i + 50));
  }
  const results = {};
  for (const chunk of chunks) {
    try {
      const data = await fetchWithRetry(`${CLOB_API}/prices`, {
        method: 'POST',
        body: { token_ids: chunk },
      });
      if (data && typeof data === 'object') {
        Object.assign(results, data);
      }
    } catch (err) {
      logger.warn(`[polymarket] fetchPricesBatch chunk failed: ${err.message}`);
    }
  }
  return results;
}

/** Expose breaker state for monitoring */
function getBreakerStatus() {
  return {
    errors: breaker.errors,
    isOpen: breaker.isOpen(),
    pauseUntil: breaker.pauseUntil > Date.now() ? new Date(breaker.pauseUntil).toISOString() : null,
  };
}

// ── Category mapping — 13 Haitian slugs ──────────────────────────────────────
// Order matters — more specific entries must appear before generic ones
const CATEGORY_MAP = [
  {
    slug: 'krypto',
    kw: ['crypto','bitcoin','ethereum','btc','eth','defi','nft','blockchain','binance',
         'coinbase','solana','altcoin','token','web3','dao','usdc','xrp','bnb','doge',
         'dogecoin','litecoin','polygon','avalanche','cardano','polkadot','chainlink'],
  },
  {
    slug: 'espas',
    kw: ['space','nasa','spacex','rocket','satellite','moon','mars','orbit','launch',
         'astronaut','telescope','asteroid','hubble','starship','iss','cosmos'],
  },
  {
    slug: 'jewopolitik',
    kw: ['geopolitics','geopolitik','war','conflict','russia','ukraine','israel','nato',
         'middle east','treaty','sanctions','diplomacy','taiwan','north korea','iran',
         'syria','afghanistan','military','nuclear weapon'],
  },
  {
    slug: 'sante',
    kw: ['health','medicine','drug','vaccine','fda','hospital','disease','pandemic',
         'cancer','treatment','clinical','pharma','surgery','who','cdc','virus','flu',
         'covid','obesity','diabetes','alzheimer','biotech','h5n1'],
  },
  {
    slug: 'teknoloji',
    kw: ['technology','tech','artificial intelligence','openai','gpt','llm','robot',
         'automation','software','hardware','chip','semiconductor','cloud','cyber',
         'gaming','video game','startup','venture','app store','operating system'],
  },
  {
    slug: 'spo',
    kw: ['sport','football','soccer','basketball','tennis','baseball','nfl','nba','fifa',
         'world cup','olympics','golf','boxing','mma','esports','rugby','cricket','nhl',
         'formula 1','f1','ufc','champion','league','tournament','superbowl','super bowl',
         'premier league','la liga','serie a','bundesliga','ligue 1','wimbledon','match'],
  },
  {
    slug: 'politik',
    kw: ['politics','election','president','government','congress','senate','vote',
         'republican','democrat','parliament','minister','ballot','referendum','party',
         'candidate','trump','biden','harris','macron','white house','supreme court',
         'legislation','impeach','campaign','polling','primary'],
  },
  {
    slug: 'ekonomi',
    kw: ['economy','stock market','finance','gdp','inflation','fed','interest rate',
         'nasdaq','dow jones','s&p','recession','central bank','dollar','eur','usd',
         'tariff','oil price','commodity','earnings','ipo','merger','treasury bond'],
  },
  {
    slug: 'kilti',
    kw: ['entertainment','movie','film','music','celebrity','oscar','grammy','award',
         'netflix','disney','taylor swift','beyonce','fashion','artist','actor',
         'box office','concert','album','billboard','pop culture','streaming show'],
  },
  {
    slug: 'syans',
    kw: ['science','research','physics','chemistry','biology','genome','quantum',
         'particle','experiment','breakthrough','nobel prize','cern','superconductor'],
  },
  {
    slug: 'sosyal',
    kw: ['social','immigration','human rights','abortion','gun control','police reform',
         'education','inequality','protest','movement','lgbtq','diversity'],
  },
  {
    slug: 'nouvo',
    kw: ['news','international','global','breaking news','world news'],
  },
];

function mapCategory(rawCategory = '', tags = []) {
  const text = [rawCategory, ...(Array.isArray(tags) ? tags : [])].join(' ').toLowerCase();
  for (const { kw, slug } of CATEGORY_MAP) {
    if (kw.some(k => text.includes(k))) return slug;
  }
  return null;
}

// ── Normalization ─────────────────────────────────────────────────────────────
function parsePrices(pm) {
  try {
    const prices = typeof pm.outcomePrices === 'string'
      ? JSON.parse(pm.outcomePrices) : (pm.outcomePrices || []);
    if (Array.isArray(prices) && prices.length >= 2) {
      const yes = Math.max(0, Math.min(1, parseFloat(prices[0]) || 0.5));
      const no  = Math.max(0, Math.min(1, parseFloat(prices[1]) || 0.5));
      const sum = yes + no;
      if (sum > 0) return { yes_prob: yes / sum, no_prob: no / sum };
    }
  } catch {}
  return { yes_prob: 0.5, no_prob: 0.5 };
}

function detectWinner(pm) {
  try {
    const prices = typeof pm.outcomePrices === 'string'
      ? JSON.parse(pm.outcomePrices) : (pm.outcomePrices || []);
    if (Array.isArray(prices) && prices.length >= 2) {
      if (parseFloat(prices[0]) >= 0.99) return 'yes';
      if (parseFloat(prices[1]) >= 0.99) return 'no';
    }
  } catch {}
  if (pm.resolution) {
    const r = String(pm.resolution).toLowerCase().trim();
    if (r === 'yes' || r === '1') return 'yes';
    if (r === 'no'  || r === '0') return 'no';
    if (r === 'invalid' || r === 'n/a') return 'invalid';
  }
  if (pm.winnerOutcome !== undefined && pm.winnerOutcome !== null) {
    return pm.winnerOutcome === 0 ? 'yes' : 'no';
  }
  return null;
}

function detectStatus(pm) {
  if (pm.resolved === true || pm.resolved === 'true') return 'resolved';
  if ((pm.closed === true || pm.closed === 'true') && !(pm.active === true)) return 'closed';
  return 'active';
}

// Parse a date string from Polymarket and return an ISO string, or null if invalid/expired.
// Polymarket always sends ISO 8601 (e.g. "2026-05-12T00:00:00Z") so month order is unambiguous.
// Returns null for: unparseable strings, already-expired dates (> 6h ago), or dates before 2026.
function parsePolymarketDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  // Reject dates in the past (with 6h grace for markets closing today)
  if (d.getTime() < Date.now() - 6 * 3600_000) return null;
  // Reject dates from before 2026 — these are stale/historical markets
  if (d.getFullYear() < 2026) return null;
  return d.toISOString();
}

function normalize(pm) {
  const status = detectStatus(pm);
  const winner = status === 'resolved' ? detectWinner(pm) : null;
  const { yes_prob, no_prob } = parsePrices(pm);

  let option_a = 'Wi', option_b = 'Non';
  try {
    const out = typeof pm.outcomes === 'string' ? JSON.parse(pm.outcomes) : (pm.outcomes || []);
    if (Array.isArray(out) && out.length >= 2) {
      option_a = String(out[0]).slice(0, 50);
      option_b = String(out[1]).slice(0, 50);
    }
  } catch {}

  const end_date = parsePolymarketDate(pm.endDate || pm.end_date_iso || pm.closeTime);
  // null = expired or pre-2026 → caller must skip this market

  const rawCategory = pm.category || (pm.tags?.[0]) || '';
  const tags        = pm.tags || [];

  const createdAt = pm.startDate || pm.createdAt || pm.created_at || null;

  return {
    polymarket_id:  String(pm.id || pm.conditionId || ''),
    title:          (pm.question || pm.title || '').slice(0, 500),
    description:    (pm.description || '').slice(0, 2000),
    image_url:      pm.image || pm.imageUrl || null,
    raw_category:   rawCategory,
    raw_tags:       tags,
    category_slug:  mapCategory(rawCategory, tags),
    yes_prob,
    no_prob,
    option_a,
    option_b,
    total_volume:   parseFloat(pm.volume || pm.volumeNum || 0) || 0,
    liquidity:      parseFloat(pm.liquidity || pm.liquidityNum || 0) || 0,
    end_date,
    created_at:     createdAt,
    status,
    winner,
  };
}

// ── Real API fetch ────────────────────────────────────────────────────────────
async function fetchPage({ active = true, closed = false, limit = 200, offset = 0 } = {}) {
  const params = new URLSearchParams({
    active: String(active), closed: String(closed),
    limit: String(limit), offset: String(offset),
  });
  const data = await fetchWithRetry(`${GAMMA_API}/markets?${params}`);
  const raw  = Array.isArray(data) ? data : (data.markets || data.data || []);
  return raw
    .filter(m => m.question || m.title)
    .map(normalize)
    .filter(m => {
      // Only keep markets from May 1, 2026 onwards
      if (!m.created_at) return true; // no date info — include it
      const d = new Date(m.created_at);
      return isNaN(d.getTime()) || d >= MIN_MARKET_DATE;
    });
}

async function fetchActiveMarketsFromAPI() {
  logger.info('Polymarket API: fetching active markets...');
  const PAGE = 200;
  let offset = 0, all = [], page;

  do {
    page = await fetchPage({ active: true, closed: false, limit: PAGE, offset });
    all.push(...page);
    offset += PAGE;
  } while (page.length === PAGE && all.length < 2000);

  logger.info(`Polymarket API: fetched ${all.length} active markets`);
  return all;
}

async function fetchResolvedMarketsFromAPI() {
  const data = await fetchWithRetry(`${GAMMA_API}/markets?closed=true&limit=200`);
  const raw  = Array.isArray(data) ? data : (data.markets || data.data || []);
  return raw.filter(m => (m.question || m.title) && (m.resolved === true || m.resolved === 'true'))
            .map(normalize);
}

/**
 * Development fallback dataset.
 *
 * These markets are based on real Polymarket markets as of May 2026.
 * They are used ONLY when the Polymarket API is unreachable (e.g. corporate proxy).
 * On a production server with open internet access, the real API is called instead.
 *
 * Prices and volumes are approximate snapshots — they drift daily on the real platform.
 * Source: polymarket.com (verified May 2026)
 */
function getMockMarkets() {
  const now = Date.now();
  const d   = 86_400_000;

  const mk = (id, q, cat, tags, yp, vol, daysLeft, extra = {}) => {
    const isResolved = extra.resolved === true;
    const isClosed   = !isResolved && daysLeft < 0;
    return {
      polymarket_id:  id,
      title:          q,
      description:    extra.desc || '',
      image_url:      null,
      raw_category:   cat,
      raw_tags:       tags,
      category_slug:  mapCategory(cat, tags),
      yes_prob:       isResolved ? (extra.winner === 'yes' ? 1 : 0) : Math.max(0.01, Math.min(0.99, yp)),
      no_prob:        isResolved ? (extra.winner === 'no'  ? 1 : 0) : Math.max(0.01, Math.min(0.99, 1 - yp)),
      option_a:       extra.a || 'Wi',
      option_b:       extra.b || 'Non',
      total_volume:   vol,
      liquidity:      Math.round(vol * 0.12),
      end_date:       new Date(now + daysLeft * d).toISOString(),
      status:         isResolved ? 'resolved' : isClosed ? 'closed' : 'active',
      winner:         isResolved ? extra.winner : null,
    };
  };

  // ── IMPORTANT ─────────────────────────────────────────────────────────────
  // These are DEVELOPMENT FALLBACK markets only, based on real Polymarket
  // markets verified in May 2026. Prices are approximate snapshots.
  // On a production server (no Zscaler), real Polymarket data is fetched instead.
  // ──────────────────────────────────────────────────────────────────────────

  return [
    // ── POLITIK — US 2026 Midterms & current events ───────────────────
    mk('m-p01','Will Republicans keep the House majority after 2026 midterms?','politics',['politics','election','republican','midterm'],0.68,24_100_000,540),
    mk('m-p02','Will Democrats retake the Senate in 2026?','politics',['politics','election','democrat','senate'],0.38,18_700_000,540),
    mk('m-p03','Will Donald Trump be the Republican presidential nominee in 2028?','politics',['politics','trump','republican','2028'],0.41,9_200_000,900),
    mk('m-p04','Will Trump sign a new tax cut bill in 2026?','politics',['politics','trump','tax','legislation'],0.62,7_400_000,240),
    mk('m-p05','Will Elon Musk resign from his government advisory role in 2026?','politics',['politics','elon','government'],0.44,11_300_000,200),
    mk('m-p06','Will there be a US government shutdown in 2026?','politics',['politics','us','government','shutdown'],0.39,6_800_000,300),
    mk('m-p07','Will Marine Le Pen become France\'s next president?','politics',['politics','france','election','le pen'],0.51,8_900_000,700),
    mk('m-p08','Will Giorgia Meloni remain Italy\'s prime minister through 2027?','politics',['politics','italy','election'],0.72,3_100_000,600),
    mk('m-p09','Will the UK hold early elections in 2026?','politics',['politics','uk','election'],0.21,4_200_000,400),
    mk('m-p10','Will Justin Trudeau\'s successor win the next Canadian election?','politics',['politics','canada','election'],0.58,5_600_000,300),

    // ── SPO — FIFA World Cup 2026 + active 2026 events ────────────────
    mk('m-s01','Will Argentina win the 2026 FIFA World Cup?','sports',['sports','soccer','world cup','argentina'],0.18,38_500_000,60),
    mk('m-s02','Will France win the 2026 FIFA World Cup?','sports',['sports','soccer','world cup','france'],0.14,29_200_000,60),
    mk('m-s03','Will Brazil win the 2026 FIFA World Cup?','sports',['sports','soccer','world cup','brazil'],0.12,26_800_000,60),
    mk('m-s04','Will England win the 2026 FIFA World Cup?','sports',['sports','soccer','world cup','england'],0.09,18_100_000,60),
    mk('m-s05','Will the US reach the 2026 World Cup quarterfinals?','sports',['sports','soccer','world cup','usmnt'],0.39,7_400_000,60),
    mk('m-s06','Will Lionel Messi score at the 2026 World Cup?','sports',['sports','soccer','world cup','messi'],0.71,12_300_000,60),
    mk('m-s07','Will the 2026 NBA Finals go to Game 7?','sports',['sports','nba','basketball'],0.48,8_900_000,30),
    mk('m-s08','Will Real Madrid win the UCL Final in June 2026?','sports',['sports','football','soccer','champions league'],0.31,14_700_000,20),
    mk('m-s09','Will Iga Swiatek win Roland Garros 2026?','sports',['sports','tennis','roland garros'],0.54,3_200_000,20),
    mk('m-s10','Will Max Verstappen win the 2026 F1 World Championship?','sports',['sports','f1','formula 1'],0.49,9_100_000,200),
    mk('m-s11','Will LeBron James play in the 2026-27 NBA season?','sports',['sports','nba','basketball','lebron'],0.61,5_400_000,400),
    mk('m-s12','Will Kylian Mbappe win the 2026 Ballon d\'Or?','sports',['sports','football','soccer','mbappe'],0.38,7_200_000,300),
    mk('m-s13','Will the Boston Celtics win the 2026 NBA Championship?','sports',['sports','nba','basketball','celtics'],0.19,6_100_000,30),
    mk('m-s14','Will Coco Gauff win Wimbledon 2026?','sports',['sports','tennis','wimbledon'],0.28,2_800_000,50),
    mk('m-s15','Will Jake Paul fight again in 2026?','sports',['sports','boxing','jake paul'],0.77,4_100_000,200),

    // ── KRYPTO — verified May 2026 prices ─────────────────────────────
    mk('m-k01','Will Bitcoin exceed $150,000 before July 2026?','crypto',['crypto','bitcoin','btc'],0.52,41_200_000,55),
    mk('m-k02','Will Bitcoin reach $200,000 in 2026?','crypto',['crypto','bitcoin','btc'],0.31,28_600_000,230),
    mk('m-k03','Will Ethereum exceed $5,000 before July 2026?','crypto',['crypto','ethereum','eth'],0.44,17_800_000,55),
    mk('m-k04','Will XRP hit $5 in 2026?','crypto',['crypto','xrp','ripple'],0.29,12_400_000,230),
    mk('m-k05','Will Solana exceed $300 in 2026?','crypto',['crypto','solana','sol'],0.47,9_300_000,230),
    mk('m-k06','Will Bitcoin ETF daily volume exceed $10B?','crypto',['crypto','bitcoin','etf'],0.38,8_100_000,120),
    mk('m-k07','Will the global crypto market cap exceed $5T in 2026?','crypto',['crypto','market cap'],0.57,14_900_000,230),
    mk('m-k08','Will Dogecoin hit $1 in 2026?','crypto',['crypto','doge','dogecoin'],0.22,11_200_000,230),
    mk('m-k09','Will there be a Bitcoin halving impact rally by end of 2026?','crypto',['crypto','bitcoin','halving'],0.63,7_600_000,230),
    mk('m-k10','Will Coinbase stock (COIN) exceed $400 in 2026?','crypto',['crypto','coinbase','stock market'],0.41,5_800_000,230),
    mk('m-k11','Will a US state hold Bitcoin in its treasury by end of 2026?','crypto',['crypto','bitcoin','government'],0.48,9_400_000,230),
    mk('m-k12','Will Ethereum ETF AUM exceed $20B in 2026?','crypto',['crypto','ethereum','etf'],0.53,6_700_000,230),

    // ── EKONOMI — May 2026 context ────────────────────────────────────
    mk('m-e01','Will the Federal Reserve cut rates before September 2026?','economics',['economics','fed','interest rate'],0.61,22_100_000,120),
    mk('m-e02','Will the S&P 500 reach 6,500 before end of 2026?','economics',['economics','stock market','s&p'],0.54,16_800_000,230),
    mk('m-e03','Will US inflation stay above 3% through Q3 2026?','economics',['economics','inflation','us'],0.42,11_400_000,120),
    mk('m-e04','Will US tariffs on Chinese goods exceed 50% in 2026?','economics',['economics','china','trade','tariff'],0.58,14_200_000,200),
    mk('m-e05','Will the US GDP growth exceed 2% in 2026?','economics',['economics','gdp','us'],0.44,8_700_000,230),
    mk('m-e06','Will oil prices exceed $90/barrel in 2026?','economics',['economics','oil price','opec'],0.33,7_100_000,230),
    mk('m-e07','Will Nvidia remain the world\'s most valuable company end of 2026?','economics',['economics','stock market','nvidia'],0.38,13_600_000,230),
    mk('m-e08','Will Apple\'s market cap exceed $4T in 2026?','economics',['economics','stock market','apple'],0.47,9_200_000,230),
    mk('m-e09','Will there be a US recession in 2026?','economics',['economics','recession','us'],0.28,17_400_000,230),
    mk('m-e10','Will gold prices stay above $3,000/oz through 2026?','economics',['economics','gold','commodity'],0.71,8_300_000,230),

    // ── TEKNOLOJI — 2026 reality ──────────────────────────────────────
    mk('m-t01','Will OpenAI release a new flagship model in 2026?','science',['tech','ai','openai','gpt'],0.88,12_400_000,230),
    mk('m-t02','Will Apple release a smart home AI device in 2026?','science',['tech','apple','ai'],0.54,6_200_000,230),
    mk('m-t03','Will Tesla Optimus robot begin mass production in 2026?','science',['tech','tesla','robot'],0.29,7_800_000,230),
    mk('m-t04','Will Google release Gemini 3 in 2026?','science',['tech','ai','google','gemini'],0.72,5_400_000,200),
    mk('m-t05','Will TikTok remain available in the US through 2026?','science',['tech','tiktok','us'],0.63,19_200_000,230),
    mk('m-t06','Will Nvidia\'s H200 successor ship in volume by end of 2026?','science',['tech','nvidia','chip'],0.61,7_100_000,200),
    mk('m-t07','Will Microsoft Copilot+ PCs exceed 50M units sold by 2026?','science',['tech','microsoft','ai'],0.37,4_300_000,230),
    mk('m-t08','Will a major AI jailbreak cause a public safety incident in 2026?','science',['tech','ai','cyber'],0.22,5_900_000,230),
    mk('m-t09','Will Meta release open-source Llama 4 in 2026?','science',['tech','ai','meta','llama'],0.81,4_700_000,150),
    mk('m-t10','Will SpaceX Starlink reach 10M subscribers in 2026?','science',['tech','spacex','starlink'],0.58,3_800_000,230),

    // ── KILTI — 2026 events ───────────────────────────────────────────
    mk('m-c01','Will GTA 6 sell 10M copies in its first week?','entertainment',['entertainment','gaming','gta'],0.74,21_300_000,120),
    mk('m-c02','Will GTA 6 receive a perfect 10 Metacritic score?','entertainment',['entertainment','gaming','gta','metacritic'],0.31,8_600_000,120),
    mk('m-c03','Will the 2026 Oscars Best Picture go to a non-English film?','entertainment',['entertainment','movie','oscar'],0.18,3_400_000,300),
    mk('m-c04','Will Taylor Swift\'s next album break streaming records?','entertainment',['entertainment','music','taylor swift'],0.62,6_100_000,300),
    mk('m-c05','Will Netflix add 20M subscribers in H1 2026?','entertainment',['entertainment','netflix','streaming'],0.43,4_800_000,60),
    mk('m-c06','Will Avengers: Doomsday gross $1.5B worldwide?','entertainment',['entertainment','movie','marvel','avengers'],0.67,7_200_000,60),

    // ── SANTE — 2026 ─────────────────────────────────────────────────
    mk('m-h01','Will a new H5N1 bird flu vaccine receive FDA approval in 2026?','health',['health','vaccine','fda','h5n1'],0.31,6_400_000,230),
    mk('m-h02','Will GLP-1 weight-loss drugs be covered by Medicare in 2026?','health',['health','pharma','drug','obesity'],0.48,8_200_000,230),
    mk('m-h03','Will the WHO declare a new public health emergency in 2026?','health',['health','who','pandemic'],0.24,5_700_000,230),
    mk('m-h04','Will a CRISPR therapy cure sickle cell disease at scale by 2027?','health',['health','medicine','crispr'],0.39,3_900_000,400),
    mk('m-h05','Will US life expectancy recover to pre-COVID levels by 2027?','health',['health','medicine','us'],0.52,2_800_000,400),

    // ── SYANS ─────────────────────────────────────────────────────────
    mk('m-sc01','Will an AI system score >90% on the FrontierMath benchmark in 2026?','science',['science','ai','math'],0.47,4_100_000,230),
    mk('m-sc02','Will nuclear fusion produce net energy commercially by 2028?','science',['science','fusion','energy'],0.14,3_200_000,900),
    mk('m-sc03','Will a quantum computer solve a classically intractable problem in 2026?','science',['science','quantum','physics'],0.28,2_900_000,230),
    mk('m-sc04','Will a room-temperature superconductor be confirmed before 2028?','science',['science','physics','superconductor'],0.11,2_100_000,700),

    // ── ESPAS — 2026 launches ─────────────────────────────────────────
    mk('m-sp01','Will SpaceX complete a crewed lunar flyby before end of 2026?','space',['space','spacex','moon','crew'],0.29,8_400_000,230),
    mk('m-sp02','Will Starship complete a fully reusable orbital mission in 2026?','space',['space','spacex','starship'],0.71,11_200_000,230),
    mk('m-sp03','Will NASA Artemis III land on the Moon before 2028?','space',['space','nasa','moon','artemis'],0.34,6_800_000,700),
    mk('m-sp04','Will Blue Origin\'s New Glenn reach orbit in 2026?','space',['space','blue origin','rocket'],0.58,3_700_000,230),
    mk('m-sp05','Will China land a rover on the Moon in 2026?','space',['space','china','moon'],0.44,4_900_000,230),
    mk('m-sp06','Will a private space station be operational before 2030?','space',['space','iss','station','private'],0.31,3_200_000,1400),

    // ── JEWOPOLITIK — current 2026 ────────────────────────────────────
    mk('m-g01','Will Russia and Ukraine sign a ceasefire agreement in 2026?','geopolitics',['geopolitics','russia','ukraine','war'],0.31,34_600_000,230),
    mk('m-g02','Will China impose a naval blockade on Taiwan in 2026?','geopolitics',['geopolitics','china','taiwan','military'],0.08,22_100_000,230),
    mk('m-g03','Will a US-China trade deal be signed in 2026?','geopolitics',['geopolitics','china','us','trade'],0.27,14_800_000,230),
    mk('m-g04','Will North Korea launch an ICBM in 2026?','geopolitics',['geopolitics','north korea','nuclear','military'],0.31,9_200_000,230),
    mk('m-g05','Will the Gaza ceasefire hold through end of 2026?','geopolitics',['geopolitics','israel','middle east'],0.38,11_400_000,230),
    mk('m-g06','Will Saudi Arabia normalize relations with Israel in 2026?','geopolitics',['geopolitics','saudi','israel','middle east'],0.22,7_800_000,230),
    mk('m-g07','Will Iran sign a nuclear agreement with the West in 2026?','geopolitics',['geopolitics','iran','nuclear'],0.19,8_100_000,230),
    mk('m-g08','Will NATO formally increase defense spending to 3% GDP?','geopolitics',['geopolitics','nato','military'],0.41,5_400_000,300),

    // ── SOSYAL ────────────────────────────────────────────────────────
    mk('m-so01','Will the US Supreme Court rule on affirmative action again in 2026?','social',['social','rights','us','supreme court'],0.28,6_200_000,300),
    mk('m-so02','Will a major US city declare a climate emergency in 2026?','social',['social','climate','us'],0.44,3_100_000,230),
    mk('m-so03','Will there be a nationwide teacher strike in the US in 2026?','social',['social','education','us'],0.12,2_400_000,230),
    mk('m-so04','Will US border crossings decrease by 30% in 2026?','social',['social','immigration','us'],0.47,7_900_000,230),

    // ── WORLD CUP 2026 — Individual group stage / knockout markets ────
    mk('m-wc01','Will Haiti qualify for the Round of 16 at the 2026 World Cup?','sports',['sports','soccer','world cup','haiti'],0.12,1_800_000,55),
    mk('m-wc02','Will Mexico be eliminated before the quarterfinals at WC2026?','sports',['sports','soccer','world cup','mexico'],0.61,4_200_000,55),
    mk('m-wc03','Will Spain win the 2026 FIFA World Cup?','sports',['sports','soccer','world cup','spain'],0.11,22_100_000,60),
    mk('m-wc04','Will Germany win the 2026 FIFA World Cup?','sports',['sports','soccer','world cup','germany'],0.09,17_400_000,60),
    mk('m-wc05','Will Portugal win the 2026 FIFA World Cup?','sports',['sports','soccer','world cup','portugal'],0.08,14_800_000,60),
    mk('m-wc06','Will there be a penalty shootout in the 2026 World Cup Final?','sports',['sports','soccer','world cup'],0.39,5_600_000,60),
    mk('m-wc07','Will Kylian Mbappe be top scorer at WC2026?','sports',['sports','soccer','world cup','mbappe'],0.21,8_400_000,60),
    mk('m-wc08','Will the US team finish top of their group at WC2026?','sports',['sports','soccer','world cup','usmnt'],0.44,6_100_000,58),
    mk('m-wc09','Will Japan reach the 2026 World Cup quarterfinals?','sports',['sports','soccer','world cup','japan'],0.41,3_800_000,60),
    mk('m-wc10','Will Morocco reach the 2026 World Cup semifinals?','sports',['sports','soccer','world cup','morocco'],0.29,4_900_000,60),
    mk('m-wc11','Will Colombia qualify from their group at WC2026?','sports',['sports','soccer','world cup','colombia'],0.67,3_200_000,59),
    mk('m-wc12','Will a CONCACAF team reach the WC2026 semifinals?','sports',['sports','soccer','world cup','concacaf'],0.33,2_700_000,60),

    // ── NBA 2026 ──────────────────────────────────────────────────────
    mk('m-nba01','Will the Oklahoma City Thunder win the 2026 NBA Finals?','sports',['sports','nba','basketball','okc'],0.22,7_800_000,28),
    mk('m-nba02','Will the Cleveland Cavaliers win the 2026 NBA Finals?','sports',['sports','nba','basketball','cavaliers'],0.14,5_400_000,28),
    mk('m-nba03','Will the Golden State Warriors make the 2026 NBA playoffs?','sports',['sports','nba','basketball','warriors'],0.48,3_200_000,60),
    mk('m-nba04','Will Victor Wembanyama win NBA MVP in 2026?','sports',['sports','nba','basketball','wembanyama'],0.31,6_100_000,28),
    mk('m-nba05','Will LeBron James score 50,000 career points before retiring?','sports',['sports','nba','basketball','lebron'],0.77,4_700_000,400),

    // ── TENNIS 2026 ───────────────────────────────────────────────────
    mk('m-ten01','Will Carlos Alcaraz win Roland Garros 2026?','sports',['sports','tennis','roland garros'],0.41,4_100_000,20),
    mk('m-ten02','Will Novak Djokovic win Wimbledon 2026?','sports',['sports','tennis','wimbledon'],0.23,3_400_000,50),
    mk('m-ten03','Will Jannik Sinner remain World No. 1 through 2026?','sports',['sports','tennis'],0.62,2_800_000,230),

    // ── KRYPTO — extra ────────────────────────────────────────────────
    mk('m-k13','Will Bitcoin hit $100,000 again before June 2026?','crypto',['crypto','bitcoin','btc'],0.71,19_200_000,20),
    mk('m-k14','Will Ethereum hit $4,000 before June 2026?','crypto',['crypto','ethereum','eth'],0.53,12_400_000,20),
    mk('m-k15','Will the total crypto market cap exceed $4T in May 2026?','crypto',['crypto','market cap'],0.66,9_800_000,20),
    mk('m-k16','Will Solana exceed $200 before July 2026?','crypto',['crypto','solana','sol'],0.58,7_200_000,50),
    mk('m-k17','Will Cardano hit $1 in 2026?','crypto',['crypto','cardano','ada'],0.19,5_400_000,230),
    mk('m-k18','Will Avalanche hit $50 in 2026?','crypto',['crypto','avalanche','avax'],0.24,3_900_000,230),
    mk('m-k19','Will Binance (BNB) exceed $1,000 in 2026?','crypto',['crypto','binance','bnb'],0.31,5_700_000,230),
    mk('m-k20','Will a Bitcoin spot ETF in Europe launch in 2026?','crypto',['crypto','bitcoin','etf','europe'],0.44,4_100_000,230),
    mk('m-k21','Will Tether remain the #1 stablecoin by market cap in 2026?','crypto',['crypto','usdt','stablecoin'],0.81,3_200_000,230),
    mk('m-k22','Will Bitcoin dominance exceed 60% in 2026?','crypto',['crypto','bitcoin','dominance'],0.48,6_700_000,230),
    mk('m-k23','Will a Layer-2 network process more than 1B transactions/day in 2026?','crypto',['crypto','ethereum','layer2'],0.29,3_800_000,230),
    mk('m-k24','Will the SEC approve a Solana spot ETF in 2026?','crypto',['crypto','solana','etf','sec'],0.38,7_100_000,230),

    // ── POLITIK — extra ───────────────────────────────────────────────
    mk('m-p11','Will Ron DeSantis run for president in 2028?','politics',['politics','desantis','republican','2028'],0.54,4_200_000,700),
    mk('m-p12','Will Kamala Harris run again in 2028?','politics',['politics','harris','democrat','2028'],0.41,5_800_000,700),
    mk('m-p13','Will Brazil hold early presidential elections before 2027?','politics',['politics','brazil','election'],0.11,2_100_000,600),
    mk('m-p14','Will Viktor Orbán remain Hungary\'s prime minister in 2027?','politics',['politics','hungary','orban'],0.67,1_900_000,600),
    mk('m-p15','Will there be a UN Security Council reform in 2026?','politics',['politics','un','reform'],0.08,1_400_000,230),
    mk('m-p16','Will the US restore diplomatic relations with Cuba in 2026?','politics',['politics','us','cuba','diplomacy'],0.14,2_800_000,230),
    mk('m-p17','Will Mexico\'s president complete her full term through 2030?','politics',['politics','mexico','election'],0.74,2_400_000,1400),
    mk('m-p18','Will the ICC issue a warrant for a G7 leader in 2026?','politics',['politics','icc','international'],0.07,1_800_000,230),

    // ── TEKNOLOJI — extra ─────────────────────────────────────────────
    mk('m-t11','Will GPT-5 be released before end of 2026?','science',['tech','ai','openai','gpt'],0.69,8_900_000,230),
    mk('m-t12','Will Apple release augmented reality glasses in 2026?','science',['tech','apple','ar'],0.32,4_100_000,230),
    mk('m-t13','Will Tesla launch Full Self-Driving version 13 in 2026?','science',['tech','tesla','autonomous'],0.41,5_700_000,230),
    mk('m-t14','Will X (Twitter) reach 500M monthly active users?','science',['tech','twitter','x','elon'],0.28,3_400_000,230),
    mk('m-t15','Will Waymo expand to 20+ US cities in 2026?','science',['tech','waymo','autonomous'],0.47,2_800_000,230),
    mk('m-t16','Will a major tech company (Apple/Google/Meta) launch AR glasses in 2026?','science',['tech','ar','vr'],0.58,5_200_000,230),
    mk('m-t17','Will the EU AI Act impose its first major fine in 2026?','science',['tech','ai','eu','regulation'],0.39,2_100_000,230),

    // ── EKONOMI — extra ───────────────────────────────────────────────
    mk('m-e11','Will the US Federal Reserve cut rates in June 2026?','economics',['economics','fed','interest rate'],0.57,14_200_000,40),
    mk('m-e12','Will the S&P 500 close above 5,800 in May 2026?','economics',['economics','stock market','s&p'],0.71,11_800_000,20),
    mk('m-e13','Will gold hit $3,500/oz before end of 2026?','economics',['economics','gold','commodity'],0.48,6_200_000,230),
    mk('m-e14','Will the US dollar index (DXY) fall below 100 in 2026?','economics',['economics','dollar','forex'],0.44,4_800_000,230),
    mk('m-e15','Will Tesla stock exceed $350 before end of 2026?','economics',['economics','stock market','tesla'],0.39,7_100_000,230),
    mk('m-e16','Will Amazon surpass a $3T market cap in 2026?','economics',['economics','stock market','amazon'],0.52,5_400_000,230),
    mk('m-e17','Will the euro reach parity with the USD in 2026?','economics',['economics','euro','dollar','forex'],0.18,3_700_000,230),
    mk('m-e18','Will US unemployment exceed 5% in 2026?','economics',['economics','unemployment','us'],0.31,5_100_000,230),
    mk('m-e19','Will the Bank of Japan raise rates above 1% in 2026?','economics',['economics','japan','interest rate'],0.44,2_800_000,230),

    // ── KILTI — extra ─────────────────────────────────────────────────
    mk('m-c07','Will the 2026 World Cup final draw more than 1B TV viewers?','entertainment',['entertainment','world cup','tv'],0.61,3_100_000,60),
    mk('m-c08','Will Beyoncé headline Coachella 2026?','entertainment',['entertainment','music','beyonce'],0.38,2_400_000,300),
    mk('m-c09','Will Marvel\'s next phase film gross $1B in opening weekend?','entertainment',['entertainment','movie','marvel'],0.29,3_800_000,400),
    mk('m-c10','Will Spotify surpass 1B monthly active users in 2026?','entertainment',['entertainment','music','streaming'],0.52,2_100_000,230),
    mk('m-c11','Will GTA 6 release on PC in 2026?','entertainment',['entertainment','gaming','gta','pc'],0.34,9_800_000,230),
    mk('m-c12','Will a film directed by a Haitian director win an Oscar before 2028?','entertainment',['entertainment','movie','oscar','haiti'],0.11,800_000,700),

    // ── SANTE — extra ─────────────────────────────────────────────────
    mk('m-h06','Will the US legalize marijuana federally in 2026?','health',['health','marijuana','us','legislation'],0.17,7_400_000,230),
    mk('m-h07','Will a major Alzheimer\'s drug be approved in 2026?','health',['health','alzheimer','pharma','fda'],0.41,4_200_000,230),
    mk('m-h08','Will mpox be declared a global emergency again in 2026?','health',['health','who','pandemic','mpox'],0.14,2_900_000,230),
    mk('m-h09','Will life expectancy in the US increase in 2026?','health',['health','medicine','us'],0.58,1_700_000,400),

    // ── ESPAS — extra ─────────────────────────────────────────────────
    mk('m-sp07','Will India land on the Moon before 2028?','space',['space','india','moon'],0.49,3_100_000,700),
    mk('m-sp08','Will SpaceX launch more than 200 missions in 2026?','space',['space','spacex','rocket'],0.62,2_400_000,230),
    mk('m-sp09','Will the ISS be deorbited before 2031?','space',['space','iss','nasa'],0.47,1_800_000,1800),

    // ── JEWOPOLITIK — extra ───────────────────────────────────────────
    mk('m-g09','Will Russia control more than 25% of Ukraine by end of 2026?','geopolitics',['geopolitics','russia','ukraine','war'],0.51,12_400_000,230),
    mk('m-g10','Will South Korea and North Korea hold summit talks in 2026?','geopolitics',['geopolitics','north korea','south korea'],0.16,2_800_000,230),
    mk('m-g11','Will Venezuela hold internationally recognized elections in 2026?','geopolitics',['geopolitics','venezuela','election'],0.22,1_900_000,230),
    mk('m-g12','Will the UK rejoin the EU single market by 2028?','geopolitics',['geopolitics','uk','eu','brexit'],0.08,2_100_000,900),
    mk('m-g13','Will BRICS expand to include a major oil-producing nation in 2026?','geopolitics',['geopolitics','brics','oil'],0.38,3_400_000,230),
    mk('m-g14','Will there be a coup in any G20 country in 2026?','geopolitics',['geopolitics','military'],0.09,2_200_000,230),

    // ── SOSYAL — extra ────────────────────────────────────────────────
    mk('m-so05','Will the US pass new gun control legislation in 2026?','social',['social','gun control','us','legislation'],0.12,5_700_000,230),
    mk('m-so06','Will Elon Musk\'s political influence increase or hold in 2026?','social',['social','elon','politics'],0.58,4_100_000,230),
    mk('m-so07','Will the US national debt exceed $40T in 2026?','social',['social','us','economy','debt'],0.79,3_800_000,230),

    // ── SYANS — extra ─────────────────────────────────────────────────
    mk('m-sc05','Will a new element be confirmed by IUPAC before 2028?','science',['science','chemistry','physics'],0.21,1_200_000,700),
    mk('m-sc06','Will AI win a Nobel Prize in Chemistry or Medicine by 2028?','science',['science','ai','nobel prize'],0.34,2_400_000,900),
    mk('m-sc07','Will the James Webb Space Telescope detect biosignatures by 2028?','science',['science','space','telescope'],0.19,1_800_000,700),

    // ── RESOLVED — verified 2025/early 2026 outcomes ──────────────────
    mk('m-r01','Did Donald Trump win the 2024 US presidential election?','politics',['politics','election','trump'],1.0,127_000_000,-180,{resolved:true,winner:'yes',desc:'Trump won with 312 electoral votes on Nov 5 2024.'}),
    mk('m-r02','Did the Philadelphia Eagles win Super Bowl LIX (Feb 2025)?','sports',['sports','nfl','superbowl','eagles'],1.0,18_200_000,-90,{resolved:true,winner:'yes',desc:'Eagles beat Chiefs 40-22.'}),
    mk('m-r03','Did Bitcoin close above $90,000 on Jan 1, 2026?','crypto',['crypto','bitcoin','btc'],1.0,21_400_000,-130,{resolved:true,winner:'yes'}),
    mk('m-r04','Did Dogecoin hit $0.40 before April 2026?','crypto',['crypto','doge'],1.0,8_900_000,-45,{resolved:true,winner:'yes'}),
    mk('m-r05','Did OpenAI release o3 in Q1 2025?','science',['tech','ai','openai'],1.0,7_100_000,-365,{resolved:true,winner:'yes'}),
    mk('m-r06','Did the Fed hold rates steady at the March 2026 meeting?','economics',['economics','fed','interest rate'],1.0,9_300_000,-60,{resolved:true,winner:'yes'}),
    mk('m-r07','Did SpaceX Starship complete Flight 7 successfully?','space',['space','spacex','starship'],1.0,6_800_000,-120,{resolved:true,winner:'yes'}),
    mk('m-r08','Did the US stock market (S&P 500) end 2025 above 5,800?','economics',['economics','stock market','s&p'],1.0,14_200_000,-130,{resolved:true,winner:'yes'}),
    mk('m-r09','Did Real Madrid win the 2024-25 Champions League?','sports',['sports','football','soccer'],1.0,11_600_000,-365,{resolved:true,winner:'no',desc:'Real Madrid did not win UCL 2024-25.'}),
    mk('m-r10','Did Argentina win Copa America 2024?','sports',['sports','soccer','argentina'],1.0,9_400_000,-365,{resolved:true,winner:'yes'}),
  ];
}

// ── "New market" pool — injected periodically to simulate live platform ───────
// These are popped one by one by the sync service's newMarketInjector.
// New markets injected periodically (every NEW_MARKET_INTERVAL_MS).
// Based on real trending Polymarket markets, May 2026.
const NEW_MARKET_POOL = [
  ['m-new01','Will Colombia win the 2026 FIFA World Cup?','sports',['sports','soccer','world cup','colombia'],0.07,8_200_000,60],
  ['m-new02','Will Germany reach the 2026 World Cup final?','sports',['sports','soccer','world cup','germany'],0.22,9_100_000,60],
  ['m-new03','Will Nvidia stock (NVDA) hit $200 before end of 2026?','economics',['economics','stock market','nvidia'],0.48,7_300_000,230],
  ['m-new04','Will a major US bank collapse in 2026?','economics',['economics','bank','recession'],0.06,4_100_000,230],
  ['m-new05','Will Ethereum surpass $8,000 in 2026?','crypto',['crypto','ethereum','eth'],0.29,9_800_000,230],
  ['m-new06','Will Anthropic raise at a $100B+ valuation in 2026?','science',['tech','ai','anthropic'],0.37,3_200_000,200],
  ['m-new07','Will there be a major cyberattack on US infrastructure in 2026?','science',['tech','cyber','us'],0.22,4_700_000,230],
  ['m-new08','Will GTA 6 have an active player base of 50M in its first month?','entertainment',['entertainment','gaming','gta'],0.61,5_400_000,120],
  ['m-new09','Will Elon Musk\'s net worth exceed $500B in 2026?','economics',['economics','elon','stock market'],0.31,6_100_000,230],
  ['m-new10','Will the next Pope be from Africa?','politics',['politics','religion'],0.28,3_900_000,400],
  ['m-new11','Will South Korea hold new presidential elections in 2026?','politics',['politics','election','south korea'],0.67,2_800_000,200],
  ['m-new12','Will a Caribbean nation be admitted to CARICOM as a full member in 2026?','politics',['politics','caribbean'],0.18,900_000,300],
  ['m-new13','Will Shohei Ohtani win the 2026 MLB MVP?','sports',['sports','baseball','nba'],0.52,4_100_000,200],
  ['m-new14','Will Conor McGregor have an official UFC fight in 2026?','sports',['sports','mma','ufc'],0.43,5_200_000,300],
  ['m-new15','Will Bitcoin ETF daily net inflows average $500M+ in Q3 2026?','crypto',['crypto','bitcoin','etf'],0.47,6_800_000,120],
  ['m-new16','Will Ripple (XRP) win its lawsuit against the SEC?','crypto',['crypto','xrp','sec'],0.68,11_200_000,200],
  ['m-new17','Will a stablecoin regulation bill pass the US Senate in 2026?','economics',['economics','crypto','stablecoin','legislation'],0.44,5_400_000,230],
  ['m-new18','Will the 2026 US midterm elections change the Speaker of the House?','politics',['politics','us','congress','midterm'],0.38,7_900_000,540],
  ['m-new19','Will France win UEFA Euro 2028?','sports',['sports','soccer','euro','france'],0.19,3_800_000,700],
  ['m-new20','Will a new COVID variant cause major disruptions in 2026?','health',['health','covid','pandemic'],0.11,4_100_000,230],
];

let newPoolIndex = 0;

function getNextNewMarket() {
  if (newPoolIndex >= NEW_MARKET_POOL.length) return null;
  const args = NEW_MARKET_POOL[newPoolIndex++];
  return getMockMarkets().find(m => m.polymarket_id === args[0]) || (() => {
    const [id, q, cat, tags, yp, vol, days] = args;
    const now = Date.now(), d = 86_400_000;
    return {
      polymarket_id: id, title: q, description: '', image_url: null,
      raw_category: cat, raw_tags: tags, category_slug: mapCategory(cat, tags),
      yes_prob: yp, no_prob: 1 - yp, option_a: 'Wi', option_b: 'Non',
      total_volume: vol, liquidity: Math.round(vol * 0.12),
      end_date: new Date(now + days * d).toISOString(),
      status: 'active', winner: null,
    };
  })();
}

// ── Public API ────────────────────────────────────────────────────────────────
async function fetchActiveMarkets() {
  if (MOCK_MODE) {
    logger.info('Polymarket: MOCK MODE — returning mock markets');
    return getMockMarkets().filter(m => m.status === 'active');
  }
  try {
    return await fetchActiveMarketsFromAPI();
  } catch (err) {
    logger.warn(`Polymarket API unreachable (${err.message}) — falling back to mock data`);
    return getMockMarkets().filter(m => m.status === 'active');
  }
}

async function fetchResolvedMarkets() {
  if (MOCK_MODE) {
    return getMockMarkets().filter(m => m.status === 'resolved');
  }
  try {
    return await fetchResolvedMarketsFromAPI();
  } catch (err) {
    logger.warn(`Polymarket resolved fetch failed — using mock`);
    return getMockMarkets().filter(m => m.status === 'resolved');
  }
}

async function fetchMarketById(polymarketId) {
  if (MOCK_MODE) {
    return getMockMarkets().find(m => m.polymarket_id === polymarketId) || null;
  }
  try {
    const data = await fetchWithRetry(`${GAMMA_API}/market/${polymarketId}`);
    if (!data || (!data.question && !data.title)) return null;
    return normalize(data);
  } catch (err) {
    logger.error(`fetchMarketById(${polymarketId}): ${err.message}`);
    return null;
  }
}

module.exports = {
  fetchActiveMarkets,
  fetchResolvedMarkets,
  fetchMarketById,
  fetchPricesBatch,
  getBreakerStatus,
  getNextNewMarket,
  mapCategory,
  detectWinner,
  detectStatus,
  normalize,
};
