const { validationResult } = require('express-validator');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      detail: 'Données invalides',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
}

// Rejects requests where :id param is not a valid UUID.
// Prevents oversized or malformed strings from reaching DB queries.
function validateUUID(req, res, next) {
  const id = req.params.id || req.params.marketId || req.params.commentId;
  if (id && !UUID_RE.test(id)) {
    return res.status(400).json({ detail: 'Identifyan envalid' });
  }
  next();
}

module.exports = { validate, validateUUID };
