const router = require('express').Router();
const { body, query } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { getDb } = require('../database');
const logger = require('../utils/logger');

const MONCASH = {
  id: 'moncash', name: 'MonCash', code: 'MCH',
  min_deposit: 100, max_deposit: 500000,
  min_withdraw: 500, max_withdraw: 200000,
  fee_pct: 1.5,
  processing_time: '1-5 min', color: '#cc0000'
};

// GET /api/v1/wallet/methods
router.get('/methods', (req, res) => {
  res.json([{ ...MONCASH }]);
});

// POST /api/v1/wallet/deposit
// Deposits are created as PENDING — balance is only credited after admin approval.
// This prevents fraudulent self-crediting without real payment.
router.post('/deposit', authenticate, (req, res, next) => {
  const limiter = req.app.locals.walletLimiter;
  if (limiter) return limiter(req, res, next);
  next();
}, [
  body('amount').isFloat({ min: 100, max: 500000 }).withMessage('Minimòm 100 HTG, maksimòm 500,000 HTG'),
  body('phone').isString().isLength({ min: 8, max: 20 }).trim().withMessage('Nimewo MonCash obligatwa'),
  validate
], (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    const phone  = req.body.phone.trim();

    const db     = getDb();
    const fee    = Math.round(amount * MONCASH.fee_pct) / 100;
    const net    = parseFloat((amount - fee).toFixed(2));
    const snap   = db.prepare('SELECT balance FROM users WHERE id=?').get(req.user.id);
    const before = parseFloat(snap?.balance ?? 0);
    const txId   = uuidv4();

    // Balance_after stores expected balance once admin confirms — not applied yet
    const expectedAfter = parseFloat((before + net).toFixed(2));

    db.prepare(`INSERT INTO transactions
      (id,user_id,type,amount,balance_before,balance_after,status,description,payment_method,phone_number,created_at)
      VALUES (?,?,'deposit',?,?,?,'pending',?,?,?,datetime('now'))`)
      .run(txId, req.user.id, net, before, expectedAfter,
           `Depozit MonCash — ${net.toLocaleString()} HTG (frè: ${fee} HTG)`,
           'moncash', phone);

    logger.info(`Deposit request ${net} HTG via MonCash by ${req.user.username} — PENDING admin approval`);
    res.json({
      message: 'Demann depozit voye! Ap tann konfirmasyon admin nan 1-5 minit.',
      amount_sent: amount,
      fee,
      net_to_credit: net,
      status: 'pending',
      transaction_id: txId
    });
  } catch (e) {
    logger.error('Deposit error: ' + e.message);
    res.status(500).json({ detail: 'Erè depozit. Eseye ankò.' });
  }
});

// POST /api/v1/wallet/withdraw
router.post('/withdraw', authenticate, (req, res, next) => {
  const limiter = req.app.locals.walletLimiter;
  if (limiter) return limiter(req, res, next);
  next();
}, [
  body('amount').isFloat({ min: 500, max: 200000 }).withMessage('Minimòm retrè: 500 HTG'),
  body('phone').isString().isLength({ min: 8, max: 20 }).trim().withMessage('Nimewo MonCash obligatwa'),
  validate
], (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    const phone  = req.body.phone.trim();

    const db  = getDb();
    const fee = Math.round(amount * MONCASH.fee_pct) / 100;
    const total = parseFloat((amount + fee).toFixed(2));

    // Re-read user inside transaction for fresh balance
    const user = db.prepare('SELECT id,balance,bonus_balance FROM users WHERE id=?').get(req.user.id);
    if (!user) return res.status(401).json({ detail: 'Itilizatè pa jwenn' });

    const before       = parseFloat(user.balance);
    const bonusBalance = parseFloat(user.bonus_balance || 0);
    const withdrawable = parseFloat((before - bonusBalance).toFixed(2));

    if (total > before) {
      return res.status(400).json({
        detail: `Balans ensifizan. Ou bezwen ${total.toLocaleString()} HTG (${amount.toLocaleString()} + ${fee} frè), ou gen ${before.toLocaleString()} HTG.`
      });
    }
    if (total > withdrawable) {
      return res.status(400).json({
        detail: `Ou pa ka retire fonz bonus. Balans disponib pou retrè: ${Math.max(0, withdrawable).toLocaleString()} HTG.`
      });
    }

    const txId = uuidv4();
    let after;

    db.transaction(() => {
      // Atomic deduct: only succeeds if balance is still sufficient (prevents race/double-spend)
      const result = db.prepare(
        "UPDATE users SET balance=ROUND(balance-?,2),updated_at=datetime('now') WHERE id=? AND balance>=?"
      ).run(total, req.user.id, total);

      if (result.changes === 0) throw new Error('INSUFFICIENT_BALANCE');

      after = parseFloat((before - total).toFixed(2));
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
    if (e.message === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ detail: 'Balans ensifizan pou retrè sa a.' });
    }
    logger.error('Withdraw error: ' + e.message);
    res.status(500).json({ detail: 'Erè retrè. Eseye ankò.' });
  }
});

// GET /api/v1/wallet/transactions
router.get('/transactions', authenticate, [
  query('skip').optional().isInt({ min: 0 }),
  query('limit').optional().isInt({ min: 1, max: 500 }),
  query('type').optional().isIn(['deposit','withdrawal','bet','win','refund','bonus','bet_slip']),
  validate
], (req, res) => {
  try {
    const skip  = parseInt(req.query.skip  || '0');
    const limit = Math.min(parseInt(req.query.limit || '50'), 500);
    const { type, month, year } = req.query;

    let sql = 'SELECT id,type,amount,balance_before,balance_after,status,description,payment_method,phone_number,reference_id,created_at FROM transactions WHERE user_id=?';
    const params = [req.user.id];

    if (type)  { sql += ' AND type=?'; params.push(type); }
    if (month && year) {
      sql += " AND strftime('%m',created_at)=? AND strftime('%Y',created_at)=?";
      params.push(String(month).padStart(2,'0'), String(year));
    } else if (year) {
      sql += " AND strftime('%Y',created_at)=?";
      params.push(String(year));
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, skip);
    res.json(getDb().prepare(sql).all(...params));
  } catch (e) {
    logger.error('Transactions: ' + e.message);
    res.status(500).json({ detail: 'Erè' });
  }
});

module.exports = router;
