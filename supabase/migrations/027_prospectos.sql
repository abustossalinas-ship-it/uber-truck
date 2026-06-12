-- 027 — Prospectos comerciales (landing transportistas / empresas)

CREATE TABLE IF NOT EXISTS prospectos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('carrier', 'shipper')),
  source_page TEXT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  team_size INTEGER,
  monthly_volume TEXT,
  current_tools TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'archived')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospectos_created ON prospectos (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospectos_role_status ON prospectos (role, status);
