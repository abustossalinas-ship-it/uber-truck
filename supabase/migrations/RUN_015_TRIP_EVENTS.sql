-- 015 — Crear tabla trip_events (historial de ofertas y estados del viaje)
-- Ejecutar en Supabase SQL Editor si ves: relation "trip_events" does not exist

CREATE TABLE IF NOT EXISTS trip_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  actor_role TEXT CHECK (actor_role IN ('shipper', 'carrier', 'admin', 'system')),
  actor_user_id UUID REFERENCES users (id),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_events_match ON trip_events (match_id, created_at ASC);
