/**
 * Category service — manages the categories table.
 * 13 Haitian market categories covering all major prediction market domains.
 */

const { getDb } = require('../database');
const logger = require('../utils/logger');

const DEFAULT_CATEGORIES = [
  { slug: 'politik',   name: 'Politik',    name_fr: 'Politique',      icon: '🏛️',  color: '#EF4444', display_order: 0 },
  { slug: 'spo',       name: 'Spo',        name_fr: 'Sport',          icon: '⚽',   color: '#3B82F6', display_order: 1 },
  { slug: 'krypto',    name: 'Krypto',     name_fr: 'Crypto',         icon: '₿',    color: '#F59E0B', display_order: 2 },
  { slug: 'ekonomi',   name: 'Ekonomi',    name_fr: 'Économie',       icon: '💹',   color: '#10B981', display_order: 3 },
  { slug: 'teknoloji', name: 'Teknoloji',  name_fr: 'Technologie',    icon: '🤖',   color: '#8B5CF6', display_order: 4 },
  { slug: 'kilti',     name: 'Kilti',      name_fr: 'Culture',        icon: '🎬',   color: '#EC4899', display_order: 5 },
  { slug: 'sante',     name: 'Sante',      name_fr: 'Santé',          icon: '🏥',   color: '#06B6D4', display_order: 6 },
  { slug: 'syans',     name: 'Syans',      name_fr: 'Science',        icon: '🔬',   color: '#14B8A6', display_order: 7 },
  { slug: 'sosyal',    name: 'Sosyal',     name_fr: 'Social',         icon: '🤝',   color: '#A855F7', display_order: 8 },
  { slug: 'espas',     name: 'Espas',      name_fr: 'Espace',         icon: '🚀',   color: '#0EA5E9', display_order: 9 },
  { slug: 'jewopolitik', name: 'Jewopolitik', name_fr: 'Géopolitique', icon: '🌍',  color: '#F97316', display_order: 10 },
  { slug: 'nouvo',     name: 'Nouvo',      name_fr: 'Nouveaux',       icon: '✨',   color: '#84CC16', display_order: 11 },
  { slug: 'lot',       name: 'Lòt',        name_fr: 'Autres',         icon: '📌',   color: '#6B7280', display_order: 12 },
];

class CategoryService {
  static initialize() {
    const db = getDb();
    let created = 0;
    for (const cat of DEFAULT_CATEGORIES) {
      try {
        const r = db.prepare(
          `INSERT OR IGNORE INTO categories (slug,name,name_fr,icon,color,display_order) VALUES (?,?,?,?,?,?)`
        ).run(cat.slug, cat.name, cat.name_fr, cat.icon, cat.color, cat.display_order);
        if (r.changes > 0) created++;
      } catch (e) {
        logger.error(`Category insert failed (${cat.slug}): ${e.message}`);
      }
    }
    if (created > 0) logger.info(`Categories initialized: ${created} created`);
  }

  static getAll() {
    const db = getDb();
    return db.prepare(
      `SELECT id,slug,name,name_fr,icon,color,display_order,market_count
       FROM categories WHERE active=1 ORDER BY display_order ASC`
    ).all();
  }

  static getBySlug(slug) {
    return getDb().prepare('SELECT * FROM categories WHERE slug=?').get(slug) || null;
  }

  static refreshCounts() {
    const db = getDb();
    try {
      db.prepare(
        `UPDATE categories SET market_count=(
           SELECT COUNT(*) FROM markets
           WHERE markets.category=categories.slug AND markets.status='active'
         )`
      ).run();
    } catch (e) {
      logger.error('Category count refresh failed: ' + e.message);
    }
  }

  static create({ slug, name, name_fr, icon, color }) {
    const db = getDb();
    const maxOrder = db.prepare('SELECT MAX(display_order) m FROM categories').get()?.m ?? -1;
    db.prepare(
      `INSERT INTO categories (slug,name,name_fr,icon,color,display_order) VALUES (?,?,?,?,?,?)`
    ).run(slug, name, name_fr || name, icon || '📌', color || '#6B7280', maxOrder + 1);
    return CategoryService.getBySlug(slug);
  }
}

module.exports = CategoryService;
