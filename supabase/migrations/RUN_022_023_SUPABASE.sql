-- Uber Truck — ejecutar en Supabase → SQL Editor (copiar y Run)
-- Incluye 022 (ayuda/moderador) + 023 (multa pagada). Seguro re-ejecutar (IF NOT EXISTS).

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

-- ========== 023 — Multa pagada (moderador / admin) ==========
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS penalty_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS penalty_paid_by_user_id UUID REFERENCES users (id),
  ADD COLUMN IF NOT EXISTS penalty_payment_note TEXT;

CREATE INDEX IF NOT EXISTS idx_matches_penalty_paid ON matches (penalty_paid_at)
  WHERE penalty_paid_at IS NOT NULL;
