'use strict';

const supabase = require('../services/supabase');
const { optionalAuth } = require('./optional-auth');

/** Exige JWT si la base de datos está activa (producción). */
function requireAuthIfDb(req, res, next) {
  optionalAuth(req, res, () => {
    if (!supabase.isConfigured()) return next();
    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'Inicia sesión para continuar' });
    }
    next();
  });
}

module.exports = { requireAuthIfDb };
