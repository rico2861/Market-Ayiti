const validator = require('validator');

/**
 * Hybrid identity detection.
 * Determines if input is email, phone, or username — and normalizes the value.
 *
 *   "user@example.com"  → { type: 'email',    value: 'user@example.com' }
 *   "+509 3412-5678"    → { type: 'phone',    value: '+50934125678' }
 *   "50934125678"       → { type: 'phone',    value: '+50934125678' }
 *   "34125678"          → { type: 'phone',    value: '+50934125678' }
 *   "janpye_92"         → { type: 'username', value: 'janpye_92' }
 */
function detectIdentity(input) {
  if (!input || typeof input !== 'string') {
    return { type: 'invalid', value: '', error: 'Idantifyan obligatwa' };
  }

  const trimmed = input.trim();

  // Email
  if (trimmed.includes('@')) {
    const lower = trimmed.toLowerCase();
    if (validator.isEmail(lower)) {
      return { type: 'email', value: lower };
    }
    return { type: 'invalid', value: trimmed, error: 'Imel pa valid' };
  }

  // Phone — strip non-digit/plus
  const digits = trimmed.replace(/[^\d+]/g, '');
  if (/^\+?\d{8,15}$/.test(digits)) {
    let normalized = digits;

    if (normalized.startsWith('509') && normalized.length >= 11) {
      normalized = '+' + normalized;
    } else if (/^\d{8}$/.test(normalized)) {
      normalized = '+509' + normalized;
    } else if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }

    if (/^\+\d{10,15}$/.test(normalized)) {
      return { type: 'phone', value: normalized };
    }
    return { type: 'invalid', value: trimmed, error: 'Telefòn pa valid' };
  }

  // Username — letters, digits, _, -, 3-30 chars
  if (/^[a-zA-Z0-9_-]{3,30}$/.test(trimmed)) {
    return { type: 'username', value: trimmed.toLowerCase() };
  }

  return {
    type: 'invalid',
    value: trimmed,
    error: 'Antre imel, telefòn, oswa non itilizatè valid'
  };
}

function buildIdentityQuery(input) {
  const detected = detectIdentity(input);
  if (detected.type === 'invalid') return null;
  const fieldMap = { email: 'email', phone: 'phone', username: 'username' };
  return { field: fieldMap[detected.type], value: detected.value, type: detected.type };
}

module.exports = { detectIdentity, buildIdentityQuery };
