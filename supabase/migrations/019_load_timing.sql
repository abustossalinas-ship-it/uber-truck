-- 019 — Tiempos operativos (prep + carga + papeles + ruta + descarga), checklist y ventanas

ALTER TABLE load_requests
  ADD COLUMN IF NOT EXISTS needed_by_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cargo_ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prep_min INT,
  ADD COLUMN IF NOT EXISTS load_min INT,
  ADD COLUMN IF NOT EXISTS paperwork_min INT,
  ADD COLUMN IF NOT EXISTS unload_min INT,
  ADD COLUMN IF NOT EXISTS origin_ops_min INT,
  ADD COLUMN IF NOT EXISTS eta_total_min INT,
  ADD COLUMN IF NOT EXISTS prep_checklist JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN load_requests.origin_ops_min IS 'prep + carga física + papeles en origen (min)';
COMMENT ON COLUMN load_requests.eta_total_min IS 'origin_ops + distance_duration_min + unload (min)';
