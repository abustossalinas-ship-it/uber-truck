-- 026 — Cubik Saldo piloto: pago simulado por viaje completado

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS pilot_payment_status TEXT
    CHECK (pilot_payment_status IS NULL OR pilot_payment_status IN ('in_settlement', 'released')),
  ADD COLUMN IF NOT EXISTS pilot_payment_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_matches_pilot_payment ON matches (pilot_payment_status)
  WHERE pilot_payment_status IS NOT NULL;
