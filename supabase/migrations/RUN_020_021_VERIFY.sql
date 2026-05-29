-- =============================================================================
-- Uber Truck — Supabase: verificar 020/021 + aplicar si falta
-- El "Reload schema" NO es SQL: después de Run, en el panel:
--   Project Settings → API → "Reload schema" (o "Reload" en Schema cache)
-- =============================================================================

-- ---------- 1) VERIFICAR (debe devolver 3 filas en 021, 2 tablas en 020) ----------
SELECT 'load_requests' AS tabla, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'load_requests'
  AND column_name IN ('schedule_mode', 'scheduled_pickup_at')
ORDER BY column_name;

SELECT 'capacity_offers' AS tabla, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'capacity_offers'
  AND column_name IN ('schedule_mode', 'scheduled_depart_at')
ORDER BY column_name;

SELECT 'match_notifications' AS tabla, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'match_notifications'
  AND column_name IN ('amount_clp', 'previous_amount_clp', 'previous_at')
ORDER BY column_name;

-- ---------- 2) APLICAR 020 + 021 (seguro re-ejecutar: IF NOT EXISTS) ----------
ALTER TABLE load_requests
  ADD COLUMN IF NOT EXISTS schedule_mode TEXT NOT NULL DEFAULT 'now',
  ADD COLUMN IF NOT EXISTS scheduled_pickup_at TIMESTAMPTZ;

ALTER TABLE capacity_offers
  ADD COLUMN IF NOT EXISTS schedule_mode TEXT NOT NULL DEFAULT 'now',
  ADD COLUMN IF NOT EXISTS scheduled_depart_at TIMESTAMPTZ;

ALTER TABLE match_notifications
  ADD COLUMN IF NOT EXISTS amount_clp BIGINT,
  ADD COLUMN IF NOT EXISTS previous_amount_clp BIGINT,
  ADD COLUMN IF NOT EXISTS previous_at TIMESTAMPTZ;

-- Forzar recarga del catálogo en Postgres (ayuda; PostgREST igual necesita Reload en UI)
NOTIFY pgrst, 'reload schema';

-- ---------- 3) DIAGNÓSTICO notificaciones de precio (últimas 10) ----------
SELECT
  n.id,
  n.title,
  n.created_at,
  n.amount_clp,
  n.previous_amount_clp,
  n.previous_at,
  LEFT(n.body, 80) AS body_preview,
  m.carrier_offer_clp AS match_precio_actual
FROM match_notifications n
JOIN matches m ON m.id = n.match_id
WHERE n.type = 'price_offer'
ORDER BY n.created_at DESC
LIMIT 10;

-- ---------- 4) Eventos del viaje (para reconstruir $350 → $350.000) ----------
-- Cambia el match_id por el tuyo si quieres un emparejamiento concreto:
SELECT
  te.match_id,
  te.event_type,
  te.created_at,
  te.payload
FROM trip_events te
WHERE te.event_type IN ('match_created', 'carrier_offer_updated')
ORDER BY te.created_at DESC
LIMIT 20;
