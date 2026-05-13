const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { getDb } = require('../database');
const logger = require('../utils/logger');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.param('id', (req, res, next, id) => {
  if (!UUID_RE.test(id)) return res.status(400).json({ detail: 'Identifyan envalid' });
  next();
});

// GET /api/v1/notifications
router.get('/', authenticate, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50'), 100);
    const rows = getDb().prepare(
      'SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT ?'
    ).all(req.user.id, limit);
    const unread = getDb().prepare(
      "SELECT COUNT(*) c FROM notifications WHERE user_id=? AND read=0"
    ).get(req.user.id).c;
    res.json({ notifications: rows, unread });
  } catch (e) {
    logger.error('Notifications list: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// PATCH /api/v1/notifications/:id/read
router.patch('/:id/read', authenticate, (req, res) => {
  try {
    getDb().prepare(
      'UPDATE notifications SET read=1 WHERE id=? AND user_id=?'
    ).run(req.params.id, req.user.id);
    res.json({ ok: true });
  } catch (e) {
    logger.error('Notification read: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// PATCH /api/v1/notifications/read-all
router.patch('/read-all', authenticate, (req, res) => {
  try {
    getDb().prepare(
      "UPDATE notifications SET read=1 WHERE user_id=? AND read=0"
    ).run(req.user.id);
    res.json({ ok: true });
  } catch (e) {
    logger.error('Notification read-all: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

// DELETE /api/v1/notifications/:id
router.delete('/:id', authenticate, (req, res) => {
  try {
    getDb().prepare(
      'DELETE FROM notifications WHERE id=? AND user_id=?'
    ).run(req.params.id, req.user.id);
    res.json({ ok: true });
  } catch (e) {
    logger.error('Notification delete: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

/**
 * Push a notification to a user.
 * Can be called from any server-side code (market settlement, deposit approval, etc.)
 */
function pushNotification(userId, { type, title, message, ref_type = null, ref_id = null }, broadcastFn = null) {
  try {
    const db = getDb();
    const id = uuidv4();
    db.prepare(
      'INSERT INTO notifications (id,user_id,type,title,message,ref_type,ref_id,read,created_at) VALUES (?,?,?,?,?,?,?,0,datetime(\'now\'))'
    ).run(id, userId, type, title, message, ref_type, ref_id);

    if (broadcastFn) {
      broadcastFn({
        type: 'notification:new',
        user_id: userId,
        data: { id, type, title, message, ref_type, ref_id, read: false, created_at: new Date().toISOString() }
      });
    }
  } catch (e) {
    logger.error('pushNotification: ' + e.message);
  }
}

module.exports = router;
module.exports.pushNotification = pushNotification;
