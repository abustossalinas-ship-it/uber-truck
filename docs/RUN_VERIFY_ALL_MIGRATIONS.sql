-- Cubik / Uber Truck — verificar migraciones en Supabase prod
-- Pegar y Run (una sola consulta). OK = aplicado, FALTA = ejecutar script indicado.

WITH checks AS (
  SELECT '001_init' AS mig, 'tabla matches' AS item,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'matches') AS ok,
    'supabase/migrations/001_init.sql' AS script
  UNION ALL
  SELECT '007', 'tabla match_messages',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'match_messages'), '004-008 en docs/SQL-SUPABASE.md o 007_match_chat_notifications.sql'
  UNION ALL
  SELECT '007', 'tabla match_notifications',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'match_notifications'), '004-008 en docs/SQL-SUPABASE.md o 007_match_chat_notifications.sql'
  UNION ALL
  SELECT '008', 'columnas users.bank_*',
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'users' AND column_name LIKE 'bank_%') >= 6,
    'supabase/migrations/008_accounts_penalties.sql'
  UNION ALL
  SELECT '008', 'tabla penalty_charges',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'penalty_charges'), 'supabase/migrations/008_accounts_penalties.sql'
  UNION ALL
  SELECT '010', 'load_requests.budget_min_clp',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'load_requests' AND column_name = 'budget_min_clp'),
    'supabase/migrations/010_price_negotiation.sql'
  UNION ALL
  SELECT '011', 'load_requests.cargo_description',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'load_requests' AND column_name = 'cargo_description'),
    'supabase/migrations/011_cargo_trust.sql'
  UNION ALL
  SELECT '011', 'tabla match_incidents',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'match_incidents'), 'supabase/migrations/011_cargo_trust.sql'
  UNION ALL
  SELECT '012', 'tabla match_ratings',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'match_ratings'), 'supabase/migrations/012_uber_parity.sql'
  UNION ALL
  SELECT '012', 'matches.completed_at',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'completed_at'),
    'supabase/migrations/012_uber_parity.sql'
  UNION ALL
  SELECT '013', 'match_ratings.tags',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'match_ratings' AND column_name = 'tags'),
    'supabase/migrations/013_rating_tags.sql'
  UNION ALL
  SELECT '014', 'match_ratings.rater_user_id',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'match_ratings' AND column_name = 'rater_user_id'),
    'supabase/migrations/014_match_ratings_rater_user.sql'
  UNION ALL
  SELECT '015', 'tabla trip_events',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trip_events'), 'supabase/migrations/015_trip_events.sql'
  UNION ALL
  SELECT '016', 'users.is_available (GPS)',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_available'),
    'supabase/migrations/016_carrier_gps.sql'
  UNION ALL
  SELECT '022', 'tabla support_cases',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'support_cases'), 'supabase/migrations/RUN_022_025_SUPABASE.sql'
  UNION ALL
  SELECT '024', 'matches.penalty_payment_status',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'penalty_payment_status'),
    'supabase/migrations/RUN_022_025_SUPABASE.sql'
  UNION ALL
  SELECT '025', 'matches.penalty_payment_proof_mime',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'penalty_payment_proof_mime'),
    'supabase/migrations/RUN_022_025_SUPABASE.sql'
  UNION ALL
  SELECT '027', 'tabla device_tokens (FCM)',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'device_tokens'), 'docs/RUN_027_payment_methods_fcm.sql'
  UNION ALL
  SELECT '027', 'tabla user_payment_methods',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_payment_methods'), 'docs/RUN_027_payment_methods_fcm.sql'
  UNION ALL
  SELECT '028', 'matches.chat_human_at',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'chat_human_at'),
    'docs/RUN_028_match_chat_human.sql'
  UNION ALL
  SELECT '029', 'capacity_offers.available_pallets',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'capacity_offers' AND column_name = 'available_pallets'),
    'docs/RUN_029_carrier_truck_offer_pallets.sql'
  UNION ALL
  SELECT '029', 'users.default_truck_type_id',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'default_truck_type_id'),
    'docs/RUN_029_carrier_truck_offer_pallets.sql'
  UNION ALL
  SELECT '030', 'tabla user_bank_accounts (billetera)',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_bank_accounts'), 'docs/RUN_030_user_bank_accounts.sql'
)
SELECT migracion, chequeo, estado, ejecutar_si_falta
FROM (
  SELECT
    mig AS migracion,
    item AS chequeo,
    CASE WHEN ok THEN 'OK' ELSE 'FALTA' END AS estado,
    script AS ejecutar_si_falta,
    0 AS sort_group,
    mig AS sort_mig,
    item AS sort_item
  FROM checks
  UNION ALL
  SELECT
    'RESUMEN',
    (SELECT COUNT(*) FILTER (WHERE ok)::text FROM checks) || ' OK / '
      || (SELECT COUNT(*) FILTER (WHERE NOT ok)::text FROM checks) || ' FALTA / '
      || (SELECT COUNT(*)::text FROM checks) || ' total',
    CASE
      WHEN (SELECT COUNT(*) FROM checks WHERE NOT ok) = 0 THEN 'TODO OK'
      ELSE 'REVISAR FILAS FALTA'
    END,
    '',
    1,
    'zzz',
    ''
) AS report
ORDER BY sort_group, sort_mig, sort_item;
