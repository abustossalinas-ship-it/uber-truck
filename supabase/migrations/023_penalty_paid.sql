-- 023 — Multa marcada como pagada / regularizada (desbloqueo operativo)

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS penalty_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS penalty_paid_by_user_id UUID REFERENCES users (id),
  ADD COLUMN IF NOT EXISTS penalty_payment_note TEXT;

CREATE INDEX IF NOT EXISTS idx_matches_penalty_paid ON matches (penalty_paid_at)
  WHERE penalty_paid_at IS NOT NULL;
