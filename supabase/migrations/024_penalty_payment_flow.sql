-- 024 — Flujo pago multa: declarar → acreedor confirma (24 h) → moderador

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS penalty_payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS penalty_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS penalty_claimed_by_user_id UUID REFERENCES users (id),
  ADD COLUMN IF NOT EXISTS penalty_claim_note TEXT,
  ADD COLUMN IF NOT EXISTS penalty_confirm_deadline_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS penalty_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS penalty_confirmed_by_user_id UUID REFERENCES users (id),
  ADD COLUMN IF NOT EXISTS penalty_disputed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS penalty_dispute_note TEXT;

-- Migrar filas ya marcadas pagadas (023)
UPDATE matches
SET penalty_payment_status = 'settled_moderator'
WHERE penalty_paid_at IS NOT NULL
  AND (penalty_payment_status IS NULL OR penalty_payment_status = 'pending');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'matches_penalty_payment_status_check'
  ) THEN
    ALTER TABLE matches
      ADD CONSTRAINT matches_penalty_payment_status_check
      CHECK (
        penalty_payment_status IN (
          'pending',
          'claimed',
          'confirmed',
          'disputed',
          'confirm_expired',
          'settled_moderator'
        )
      );
  END IF;
END $$;
