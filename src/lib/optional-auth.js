'use strict';

const { verifyToken } = require('./auth');

/** Si hay JWT válido, rellena req.user; si no, sigue (demo). */
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    const payload = verifyToken(token);
    if (payload) req.user = payload;
  }
  next();
}

module.exports = { optionalAuth };
