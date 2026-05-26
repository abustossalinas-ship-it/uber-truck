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
