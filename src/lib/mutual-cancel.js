'use strict';

function isMutualCancelReady(match) {
  return Boolean(match?.mutual_cancel_shipper_at && match?.mutual_cancel_carrier_at);
}

function mutualCancelStatus(match) {
  const shipper = Boolean(match?.mutual_cancel_shipper_at);
  const carrier = Boolean(match?.mutual_cancel_carrier_at);
  let waiting_role = null;
  if (!shipper && !carrier) waiting_role = 'both';
  else if (!shipper) waiting_role = 'shipper';
  else if (!carrier) waiting_role = 'carrier';
  return {
    shipper_confirmed: shipper,
    carrier_confirmed: carrier,
    ready: shipper && carrier,
    waiting_role,
  };
}

function fieldForRole(role) {
  if (role === 'carrier') return 'mutual_cancel_carrier_at';
  if (role === 'shipper') return 'mutual_cancel_shipper_at';
  return null;
}

module.exports = {
  isMutualCancelReady,
  mutualCancelStatus,
  fieldForRole,
};
