-- Ejecutar en Supabase SQL Editor (proyecto uber-truck) si aún no corriste 004–007.
-- Puedes pegar todo el archivo de una vez; IF NOT EXISTS evita errores si algo ya existe.

-- 004 — cancelación básica
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS cancel_action TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- 005 — motivos y multas sugeridas
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS reason_code TEXT,
  ADD COLUMN IF NOT EXISTS reason_detail TEXT,
  ADD COLUMN IF NOT EXISTS penalty_type TEXT,
  ADD COLUMN IF NOT EXISTS penalty_amount_clp BIGINT,
  ADD COLUMN IF NOT EXISTS agreement_accepted BOOLEAN DEFAULT false;

-- 006 — acuerdo mutuo bilateral
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS mutual_cancel_shipper_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mutual_cancel_carrier_at TIMESTAMPTZ;

-- 007 — chat y notificaciones
CREATE TABLE IF NOT EXISTS match_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('shipper', 'carrier', 'admin')),
  body TEXT NOT NULL,
  preset_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS match_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  for_role TEXT NOT NULL CHECK (for_role IN ('shipper', 'carrier')),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_messages_match ON match_messages (match_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_notifications_role ON match_notifications (for_role, read_at, created_at DESC);

-- 008 — cuenta bancaria y cargos de multas (ver docs/PENALTIES-AND-ACCOUNTS.md)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bank_holder_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_rut TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_type TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_registered_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS penalty_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  debtor_user_id UUID REFERENCES users (id),
  creditor_user_id UUID REFERENCES users (id),
  debtor_role TEXT NOT NULL CHECK (debtor_role IN ('shipper', 'carrier')),
  amount_clp BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('suggested', 'pending', 'paid', 'waived', 'overdue')),
  due_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_penalty_charges_debtor ON penalty_charges (debtor_user_id, status);
CREATE INDEX IF NOT EXISTS idx_penalty_charges_due ON penalty_charges (due_at);
