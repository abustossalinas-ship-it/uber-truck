-- 021 — Metadatos de oferta en notificaciones (monto anterior/nuevo y fechas)

ALTER TABLE match_notifications
  ADD COLUMN IF NOT EXISTS amount_clp BIGINT,
  ADD COLUMN IF NOT EXISTS previous_amount_clp BIGINT,
  ADD COLUMN IF NOT EXISTS previous_at TIMESTAMPTZ;
