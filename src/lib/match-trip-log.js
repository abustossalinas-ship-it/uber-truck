'use strict';

const { recordTripEvent } = require('./trip-events');
const { normalizeRole } = require('./match-cancel');
const realtime = require('../services/realtime-bus');

function actorFromReq(req) {
  if (req.user?.role === 'admin') return 'admin';
  const role = req.user?.role || req.body?.actor_role || req.query?.actor_role;
  return normalizeRole(role) || 'system';
}

async function logMatchTrip(req, match, { event_type, from_status, to_status, payload = {} }) {
  if (!match?.id) return null;
  let row = null;
  try {
    row = await recordTripEvent({
      match_id: match.id,
      event_type,
      from_status: from_status ?? null,
      to_status: to_status ?? null,
      actor_role: actorFromReq(req),
      actor_user_id: req.user?.sub || null,
      payload,
    });
  } catch (e) {
    console.error('trip_event log failed', e.message || e);
  }
  if (to_status) {
    realtime.publishMatch(match.id, {
      type: 'status',
      from_status,
      to_status,
      match_status: to_status,
    });
  }
  return row;
}

module.exports = { logMatchTrip, actorFromReq };
