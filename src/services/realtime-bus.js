'use strict';

const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(200);

function publishMatch(matchId, payload) {
  if (!matchId) return;
  bus.emit(`match:${matchId}`, { match_id: matchId, at: new Date().toISOString(), ...payload });
}

function subscribeMatch(matchId, listener) {
  const channel = `match:${matchId}`;
  bus.on(channel, listener);
  return () => bus.off(channel, listener);
}

module.exports = { publishMatch, subscribeMatch };
