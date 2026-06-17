-- 034 — RUT transportista, vencimiento documentos y notificaciones de cuenta

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS national_rut TEXT,
  ADD COLUMN IF NOT EXISTS doc_ci_expires_at DATE,
  ADD COLUMN IF NOT EXISTS doc_license_expires_at DATE,
  ADD COLUMN IF NOT EXISTS doc_insurance_expires_at DATE,
  ADD COLUMN IF NOT EXISTS doc_soap_expires_at DATE,
  ADD COLUMN IF NOT EXISTS docs_compliance_status TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS docs_compliance_checked_at TIMESTAMPTZ;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_docs_compliance_status_check;
ALTER TABLE users ADD CONSTRAINT users_docs_compliance_status_check
  CHECK (docs_compliance_status IN ('unknown', 'valid', 'expiring', 'expired'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_national_rut
  ON users (national_rut)
  WHERE national_rut IS NOT NULL;

COMMENT ON COLUMN users.national_rut IS 'RUT titular transportista — lookup WhatsApp C3a';
COMMENT ON COLUMN users.docs_compliance_status IS 'valid | expiring (≤30d) | expired | unknown';

CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important')),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user
  ON user_notifications (user_id, read_at NULLS FIRST, created_at DESC);
