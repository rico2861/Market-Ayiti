/**
 * In-memory cache with TTL and version tracking.
 * Drop-in replacement for Redis in development / SQLite environments.
 *
 * Usage:
 *   CacheService.set('markets:all', data, 10)   // TTL 10s
 *   CacheService.get('markets:all')             // null on miss
 *   CacheService.invalidate('markets:all')
 *   CacheService.invalidatePattern('markets:')  // prefix-based invalidation
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

// Map<key, { data, expiresAt, version, hash }>
const store = new Map();

class CacheService {
  /**
   * Store a value with optional TTL (seconds). Default: 10s.
   */
  static set(key, value, ttl = 10) {
    const version = (store.get(key)?.version ?? 0) + 1;
    const hash = crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 12);
    store.set(key, {
      data: value,
      expiresAt: Date.now() + ttl * 1000,
      version,
      hash,
      cachedAt: new Date().toISOString(),
    });
    logger.debug(`Cache set: ${key} v${version} (TTL ${ttl}s)`);
    return version;
  }

  /**
   * Retrieve a cached value. Returns null on miss or expiry.
   */
  static get(key) {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      logger.debug(`Cache expired: ${key}`);
      return null;
    }
    logger.debug(`Cache hit: ${key} v${entry.version}`);
    return entry.data;
  }

  /**
   * Get metadata (version, hash, age) without returning data.
   */
  static getMeta(key) {
    const entry = store.get(key);
    if (!entry || Date.now() > entry.expiresAt) return null;
    return {
      version: entry.version,
      hash: entry.hash,
      cachedAt: entry.cachedAt,
      ttlRemaining: Math.max(0, Math.round((entry.expiresAt - Date.now()) / 1000)),
    };
  }

  /**
   * Get current version number for a key (0 if absent).
   */
  static getVersion(key) {
    return store.get(key)?.version ?? 0;
  }

  /**
   * Remove a single key.
   */
  static invalidate(key) {
    const deleted = store.delete(key);
    if (deleted) logger.debug(`Cache invalidated: ${key}`);
    return deleted;
  }

  /**
   * Remove all keys whose name starts with prefix.
   */
  static invalidatePattern(prefix) {
    let count = 0;
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) { store.delete(key); count++; }
    }
    if (count > 0) logger.debug(`Cache invalidated ${count} keys matching "${prefix}*"`);
    return count;
  }

  /**
   * Summary for /health endpoint.
   */
  static getStatus() {
    let valid = 0;
    let expired = 0;
    const now = Date.now();
    for (const entry of store.values()) {
      now > entry.expiresAt ? expired++ : valid++;
    }
    return { valid, expired, total: store.size };
  }

  /**
   * Purge all expired entries (called automatically by the sweeper below).
   */
  static _sweep() {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of store.entries()) {
      if (now > entry.expiresAt) { store.delete(key); removed++; }
    }
    if (removed > 0) logger.debug(`Cache sweep: removed ${removed} expired entries`);
  }
}

// Background sweep every 60 seconds to keep memory clean
setInterval(() => CacheService._sweep(), 60_000).unref();

module.exports = CacheService;
