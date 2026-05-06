const router = require('express').Router();
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { getDb } = require('../database');
const logger = require('../utils/logger');

// MonCash ONLY
const MONCASH = {
  id: 'moncash', name: 'MonCash', code: 'MCH',
  min_deposit: 100, max_deposit: 500000,
  min_withdraw: 500, max_withdraw: 200000,
  fee_pct: 1.5, // 1.5% fee
  processing_time: '1-5 min', color: '#cc0000',
  logo: '🔴'
};

// GET /api/v1/wallet/methods
router.get('/methods', (req, res) => {
  res.json([MONCASH]);
});

// POST /api/v1/wallet/deposit
router.post('/deposit', authenticate, [
  body('amount').isFloat({ min: 100 }).withMessage('Minimòm 100 HTG'),
  body('phone').isString().isLength({ min: 8, max: 20 }).withMessage('Nimewo MonCash obligatwa'),
  validate
], (req, res) => {
  try {
    const { amount, phone } = req.body;
    if (amount > MONCASH.max_deposit)
      return res.status(400).json({ detail: `Maksimòm depozit: ${MONCASH.max_deposit.toLocaleString()} HTG` });
    if (amount < MONCASH.min_deposit)
      return res.status(400).json({ detail: `Minimòm depozit: ${MONCASH.min_deposit} HTG` });

    const db = getDb();
    const fee = Math.round(amount * MONCASH.fee_pct) / 100;
    const net = parseFloat((amount - fee).toFixed(2));
    const before = parseFloat(req.user.balance);
    const after  = parseFloat((before + net).toFixed(2));
    const txId   = uuidv4();

    db.transaction(() => {
      db.prepare('UPDATE users SET balance=?, updated_at=datetime("now") WHERE id=?').run(after, req.user.id);
      db.prepare(`INSERT INTO transactions 
        (id,user_id,type,amount,balance_before,balance_after,status,description,payment_method,phone_number,completed_at,created_at)
        VALUES (?,?,'deposit',?,?,?,'completed',?,?,?,datetime('now'),datetime('now'))`)
        .run(txId, req.user.id, net, before, after,
             `Depozit MonCash — ${net.toLocaleString()} HTG (frè: ${fee} HTG)`,
             'moncash', phone, new Date().toISOString());
    })();

    logger.info(`Deposit ${net} HTG via MonCash by ${req.user.username} (${phone})`);
    res.json({
      message: 'Depozit reyisi!',
      amount_sent: amount,
      fee,
      net_credited: net,
      new_balance: after,
      transaction_id: txId
    });
  } catch (e) {
    logger.error('Deposit error: ' + e.message);
    res.status(500).json({ detail: 'Erè depozit. Eseye ankò.' });
  }
});

// POST /api/v1/wallet/withdraw
router.post('/withdraw', authenticate, [
  body('amount').isFloat({ min: 500 }).withMessage('Minimòm retrè: 500 HTG'),
  body('phone').isString().isLength({ min: 8, max: 20 }).withMessage('Nimewo MonCash obligatwa'),
  validate
], (req, res) => {
  try {
    const { amount, phone } = req.body;
    if (amount > MONCASH.max_withdraw)
      return res.status(400).json({ detail: `Maksimòm retrè: ${MONCASH.max_withdraw.toLocaleString()} HTG` });

    const db = getDb();
    const fee = Math.round(amount * MONCASH.fee_pct) / 100;
    const total = parseFloat((amount + fee).toFixed(2));
    const before = parseFloat(req.user.balance);

    if (total > before)
      return res.status(400).json({
        detail: `Balans ensifizan. Ou bezwen ${total.toLocaleString()} HTG (${amount.toLocaleString()} + ${fee} HTG frè), ou gen ${before.toLocaleString()} HTG.`
      });

    const after = parseFloat((before - total).toFixed(2));
    const txId  = uuidv4();

    db.transaction(() => {
      db.prepare('UPDATE users SET balance=?, updated_at=datetime("now") WHERE id=?').run(after, req.user.id);
      db.prepare(`INSERT INTO transactions 
        (id,user_id,type,amount,balance_before,balance_after,status,description,payment_method,phone_number,created_at)
        VALUES (?,?,'withdrawal',?,?,?,'pending',?,?,?,datetime('now'))`)
        .run(txId, req.user.id, amount, before, after,
             `Retrè MonCash → ${phone} — ${amount.toLocaleString()} HTG (frè: ${fee} HTG)`,
             'moncash', phone);
    })();

    logger.info(`Withdraw ${amount} HTG via MonCash by ${req.user.username} → ${phone}`);
    res.json({
      message: 'Demann retrè soumèt! Admin ap konfime nan 1-5 minit.',
      amount_requested: amount,
      fee,
      total_deducted: total,
      new_balance: after,
      transaction_id: txId,
      send_to: phone
    });
  } catch (e) {
    logger.error('Withdraw error: ' + e.message);
    res.status(500).json({ detail: 'Erè retrè. Eseye ankò.' });
  }
});

// GET /api/v1/wallet/transactions
router.get('/transactions', authenticate, (req, res) => {
  try {
    const { skip = 0, limit = 50, type, month, year } = req.query;
    let sql = 'SELECT * FROM transactions WHERE user_id = ?';
    const params = [req.user.id];
    if (type) { sql += ' AND type = ?'; params.push(type); }
    if (month && year) {
      sql += ` AND strftime('%m', created_at) = ? AND strftime('%Y', created_at) = ?`;
      params.push(String(month).padStart(2, '0'), year);
    } else if (year) {
      sql += ` AND strftime('%Y', created_at) = ?`;
      params.push(year);
    }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(skip));
    res.json(getDb().prepare(sql).all(...params));
  } catch (e) {
    res.status(500).json({ detail: 'Erè' });
  }
});

// ADMIN: Approve withdrawal
router.post('/admin/approve/:txId', (req, res) => {
  try {
    const db = getDb();
    const tx = db.prepare("SELECT * FROM transactions WHERE id=? AND type='withdrawal'").get(req.params.txId);
    if (!tx) return res.status(404).json({ detail: 'Transaksyon pa jwenn' });
    db.prepare("UPDATE transactions SET status='completed', completed_at=datetime('now') WHERE id=?").run(req.params.txId);
    res.json({ message: 'Retrè konfime' });
  } catch (e) {
    res.status(500).json({ detail: 'Erè' });
  }
});

module.exports = router;
