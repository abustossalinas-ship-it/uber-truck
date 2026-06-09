-- 019 — Llegada automática al destino (GPS) antes de marcar entregado

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS arrived_at_destination_at TIMESTAMPTZ;
