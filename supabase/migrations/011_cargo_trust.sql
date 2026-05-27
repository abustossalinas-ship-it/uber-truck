-- 011 — Declaración de mercadería, términos y incidentes en ruta

ALTER TABLE load_requests
  ADD COLUMN IF NOT EXISTS cargo_description TEXT,
  ADD COLUMN IF NOT EXISTS declared_cargo_value_clp BIGINT,
  ADD COLUMN IF NOT EXISTS has_dispatch_guide BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS dispatch_guide_folio TEXT,
  ADD COLUMN IF NOT EXISTS requires_cargo_insurance BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS legal_terms_version TEXT,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS match_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  reporter_role TEXT NOT NULL CHECK (reporter_role IN ('shipper', 'carrier', 'admin')),
  reporter_user_id UUID REFERENCES users (id),
  incident_type TEXT NOT NULL CHECK (
    incident_type IN ('theft', 'damage', 'shortage', 'delay', 'other')
  ),
  description TEXT NOT NULL,
  declared_value_clp_at_report BIGINT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_incidents_match ON match_incidents (match_id, created_at DESC);
