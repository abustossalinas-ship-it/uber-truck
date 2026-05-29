-- Ejecutar en Supabase → SQL Editor (una sola vez)
-- 020 — Programar viaje
-- 021 — Notificaciones: oferta anterior/nueva con fechas

-- ========== 020 ==========
ALTER TABLE load_requests
  ADD COLUMN IF NOT EXISTS schedule_mode TEXT NOT NULL DEFAULT 'now',
  ADD COLUMN IF NOT EXISTS scheduled_pickup_at TIMESTAMPTZ;

ALTER TABLE capacity_offers
  ADD COLUMN IF NOT EXISTS schedule_mode TEXT NOT NULL DEFAULT 'now',
  ADD COLUMN IF NOT EXISTS scheduled_depart_at TIMESTAMPTZ;

COMMENT ON COLUMN load_requests.schedule_mode IS 'now | scheduled';
COMMENT ON COLUMN load_requests.scheduled_pickup_at IS 'Retiro programado (embarcador)';
COMMENT ON COLUMN capacity_offers.scheduled_depart_at IS 'Salida programada (transportista)';

-- ========== 021 ==========
ALTER TABLE match_notifications
  ADD COLUMN IF NOT EXISTS amount_clp BIGINT,
  ADD COLUMN IF NOT EXISTS previous_amount_clp BIGINT,
  ADD COLUMN IF NOT EXISTS previous_at TIMESTAMPTZ;
