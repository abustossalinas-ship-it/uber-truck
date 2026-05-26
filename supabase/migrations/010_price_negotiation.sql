-- Uber Truck v010 — rango embarcador y oferta transportista

ALTER TABLE load_requests
  ADD COLUMN IF NOT EXISTS budget_min_clp BIGINT,
  ADD COLUMN IF NOT EXISTS budget_max_clp BIGINT;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS budget_min_clp BIGINT,
  ADD COLUMN IF NOT EXISTS budget_max_clp BIGINT,
  ADD COLUMN IF NOT EXISTS carrier_offer_clp BIGINT,
  ADD COLUMN IF NOT EXISTS price_status TEXT DEFAULT 'pending_offer';
