-- Ejecutar en Supabase SQL Editor (piloto C3a — checklist transportista)
-- Mismo contenido que supabase/migrations/033_carrier_onboarding.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS carrier_rubro TEXT,
  ADD COLUMN IF NOT EXISTS carrier_fleet_type TEXT,
  ADD COLUMN IF NOT EXISTS insurance_level TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_doc_ci BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_doc_license BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_doc_soap BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_doc_insurance BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_vehicle_plates TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_notes TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_updated_at TIMESTAMPTZ;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_insurance_level_check;
ALTER TABLE users ADD CONSTRAINT users_insurance_level_check
  CHECK (insurance_level IS NULL OR insurance_level IN ('A', 'B', 'C'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_carrier_rubro_check;
ALTER TABLE users ADD CONSTRAINT users_carrier_rubro_check
  CHECK (
    carrier_rubro IS NULL
    OR carrier_rubro IN (
      'construccion',
      'retail_alimentos',
      'refrigerados',
      'retail_general',
      'quimicos'
    )
  );

CREATE INDEX IF NOT EXISTS idx_users_carrier_rubro ON users (carrier_rubro)
  WHERE role = 'carrier';

NOTIFY pgrst, 'reload schema';
