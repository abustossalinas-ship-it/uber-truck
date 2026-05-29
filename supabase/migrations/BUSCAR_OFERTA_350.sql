-- =============================================================================
-- Uber Truck — Encontrar tu emparejamiento y ver si existe la oferta $350
-- Pegar en Supabase → SQL Editor → Run (no necesitas saber el match_id)
-- =============================================================================

-- A) ¿Existe la columna carrier_offer_clp en matches?
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'matches'
  AND column_name IN ('carrier_offer_clp', 'agreed_price_clp', 'price_status')
ORDER BY column_name;
-- Si carrier_offer_clp NO aparece → falta migración 010 en Supabase.

-- B) Emparejamientos recientes con AMBOS montos (oferta vs acordado)
SELECT
  m.id AS match_id,
  m.status,
  m.carrier_offer_clp AS oferta_transportista,
  m.agreed_price_clp AS precio_acordado_al_aceptar,
  m.price_status,
  m.created_at,
  m.updated_at,
  co.carrier_name AS transportista,
  lr.company_name AS embarcador
FROM matches m
LEFT JOIN capacity_offers co ON co.id = m.capacity_offer_id
LEFT JOIN load_requests lr ON lr.id = m.load_request_id
ORDER BY m.updated_at DESC NULLS LAST
LIMIT 20;

-- C) Buscar por nombre BusesDiaz (ajusta si el nombre es otro)
SELECT
  m.id AS match_id,
  m.status,
  m.carrier_offer_clp,
  m.agreed_price_clp,
  co.carrier_name
FROM matches m
JOIN capacity_offers co ON co.id = m.capacity_offer_id
WHERE co.carrier_name ILIKE '%BusesDiaz%'
   OR co.carrier_name ILIKE '%Diaz%'
ORDER BY m.updated_at DESC;

-- D) ¿Hay algún 350 en el historial de eventos? (aquí debería estar la oferta vieja)
SELECT
  te.match_id,
  te.event_type,
  te.created_at,
  te.payload
FROM trip_events te
WHERE te.payload::text LIKE '%350%'
   OR (te.payload->>'previous_offer_clp')::bigint = 350
   OR (te.payload->>'carrier_offer_clp')::bigint = 350
ORDER BY te.created_at DESC
LIMIT 30;

-- E) Notificaciones de precio con 350 o 350000
SELECT
  n.id,
  n.match_id,
  n.title,
  n.created_at,
  n.amount_clp,
  n.previous_amount_clp,
  n.previous_at,
  LEFT(n.body, 120) AS body
FROM match_notifications n
WHERE n.type = 'price_offer'
  AND (
    n.amount_clp IN (350, 350000)
    OR n.previous_amount_clp IN (350, 350000)
    OR n.body LIKE '%350%'
  )
ORDER BY n.created_at DESC
LIMIT 20;

-- F) Si la consulta D no devuelve filas con previous_offer_clp = 350,
--    el monto 350 NUNCA se guardó en la base (solo quedó 350000 en matches).
