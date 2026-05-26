-- Uber Truck v009 — índices dueño de carga/oferta (scopes por rol)

CREATE INDEX IF NOT EXISTS idx_load_requests_shipper_user
  ON load_requests (shipper_user_id, status);

CREATE INDEX IF NOT EXISTS idx_capacity_offers_carrier_user
  ON capacity_offers (carrier_user_id, status);
