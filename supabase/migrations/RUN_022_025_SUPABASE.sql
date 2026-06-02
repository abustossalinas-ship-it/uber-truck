-- =============================================================================
-- Uber Truck — SQL 022 + 023 + 024 + 025 (UN SOLO RUN)
-- Proyecto: ljinhegtywixtbzjgjfn
-- Supabase → SQL Editor → pegar todo → Run
-- Seguro re-ejecutar (IF NOT EXISTS). Orden: 022 → 023 → 024 → 025
-- =============================================================================

-- ========== 022 — Casos de ayuda / moderación ==========
CREATE TABLE IF NOT EXISTS support_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  opened_by_user_id UUID REFERENCES users (id),
  opened_by_role TEXT NOT NULL CHECK (opened_by_role IN ('shipper', 'carrier', 'admin', 'system')),
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'closed')),
  auto_opened BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES support_cases (id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('shipper', 'carrier', 'moderator')),
  sender_user_id UUID REFERENCES users (id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_cases_match ON support_cases (match_id, status);
CREATE INDEX IF NOT EXISTS idx_support_messages_case ON support_messages (case_id, created_at ASC);

-- ========== 023 — Multa cerrada por moderador (legacy) ==========
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS penalty_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS penalty_paid_by_user_id UUID REFERENCES users (id),
  ADD COLUMN IF NOT EXISTS penalty_payment_note TEXT;

CREATE INDEX IF NOT EXISTS idx_matches_penalty_paid ON matches (penalty_paid_at)
  WHERE penalty_paid_at IS NOT NULL;

-- ========== 024 — Flujo pago: declarar → confirmar acreedor (24 h) ==========
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

UPDATE matches
SET penalty_payment_status = 'settled_moderator'
WHERE penalty_paid_at IS NOT NULL
  AND penalty_payment_status = 'pending';

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

-- ========== 025 — Comprobante transferencia (captura JPG/PNG/WebP) ==========
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS penalty_payment_proof_mime TEXT,
  ADD COLUMN IF NOT EXISTS penalty_payment_proof_data TEXT,
  ADD COLUMN IF NOT EXISTS penalty_payment_proof_at TIMESTAMPTZ;

-- Recargar caché PostgREST
NOTIFY pgrst, 'reload schema';

-- ========== Verificación (debe devolver filas) ==========
SELECT 'support_cases' AS check_item, COUNT(*) AS ok FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'support_cases'
UNION ALL
SELECT 'penalty_payment_status', COUNT(*) FROM information_schema.columns
WHERE table_name = 'matches' AND column_name = 'penalty_payment_status'
UNION ALL
SELECT 'penalty_payment_proof_data', COUNT(*) FROM information_schema.columns
WHERE table_name = 'matches' AND column_name = 'penalty_payment_proof_data';
