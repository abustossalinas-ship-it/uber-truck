'use strict';

const { isPickupDeadlinePassed } = require('./match-deadline');

const ACTIVE_MATCH_STATUSES = new Set(['proposed', 'accepted', 'in_progress', 'disputed']);

function isStaleProposal(match, load) {
  if (!match || match.status !== 'proposed') return false;
  if (load && load.status !== 'published') return true;
  if (load && isPickupDeadlinePassed(load, match)) return true;
  return false;
}

/**
 * ¿Mostrar esta notificación según el estado actual del emparejamiento/carga?
 * @param {{ type: string }} n
 * @param {object|null} match
 * @param {object|null} [load]
 */
function notificationVisibleForMatch(n, match, load = null) {
  if (!match || !n?.type) return false;

  if (match.status === 'cancelled' || match.status === 'completed') return false;

  switch (n.type) {
    case 'price_offer':
      return match.status === 'proposed' && !isStaleProposal(match, load);

    case 'price_accepted':
      return match.status === 'accepted' || match.status === 'in_progress';

    case 'delivery_pending_confirm':
      return (
        match.status === 'in_progress' &&
        Boolean(match.carrier_marked_delivered_at) &&
        !match.shipper_confirmed_receipt_at
      );

    case 'approaching_destination':
      return (
        match.status === 'in_progress' &&
        !match.carrier_marked_delivered_at &&
        !match.arrived_at_destination_at
      );

    case 'arrived_at_destination':
      return match.status === 'in_progress' && !match.carrier_marked_delivered_at;

    case 'mutual_cancel':
      return match.status === 'accepted' || match.status === 'in_progress';

    case 'support':
      return ACTIVE_MATCH_STATUSES.has(match.status) && !match.chat_human_at;

    case 'chat':
      return ACTIVE_MATCH_STATUSES.has(match.status);

    case 'trip_completed':
      return false;

    case 'pilot_payment':
      return match.status === 'accepted' || match.status === 'in_progress';

    case 'incident':
      return ACTIVE_MATCH_STATUSES.has(match.status);

    default:
      return ACTIVE_MATCH_STATUSES.has(match.status);
  }
}

module.exports = {
  notificationVisibleForMatch,
  isStaleProposal,
  ACTIVE_MATCH_STATUSES,
};
