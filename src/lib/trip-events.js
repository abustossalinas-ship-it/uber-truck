'use strict';

const repo = require('./repository');
const realtime = require('../services/realtime-bus');

async function recordTripEvent({
  match_id,
  event_type,
  from_status = null,
  to_status = null,
  actor_role = 'system',
  actor_user_id = null,
  payload = {},
}) {
  if (!match_id || !event_type) return null;
  const row = await repo.insert('trip_events', {
    match_id,
    event_type,
    from_status,
    to_status,
    actor_role,
    actor_user_id,
    payload,
  });
  realtime.publishMatch(match_id, {
    type: 'trip_event',
    event: row,
  });
  return row;
}

async function listTripEvents(matchId) {
  return repo.list('trip_events', { match_id: matchId });
}

module.exports = { recordTripEvent, listTripEvents };
