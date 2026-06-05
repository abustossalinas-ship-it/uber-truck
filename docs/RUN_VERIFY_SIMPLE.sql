-- VERIFICACION SIMPLE — una sola consulta, sin CTE partido
-- Si alguna fila dice FALTA, ejecuta el script de la ultima columna.

SELECT migracion, chequeo, estado, ejecutar_si_falta
FROM (
  SELECT '001' AS migracion, 'matches' AS chequeo,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'matches') THEN 'OK' ELSE 'FALTA' END AS estado,
    '001_init.sql' AS ejecutar_si_falta, 1 AS ord, '001' AS s1, 'a' AS s2
  UNION ALL SELECT '007', 'match_messages',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'match_messages') THEN 'OK' ELSE 'FALTA' END,
    '007 o bloque 004-008', 1, '007', 'a'
  UNION ALL SELECT '007', 'match_notifications',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'match_notifications') THEN 'OK' ELSE 'FALTA' END,
    '007 o bloque 004-008', 1, '007', 'b'
  UNION ALL SELECT '008', 'users.bank_*',
    CASE WHEN (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'users' AND column_name LIKE 'bank_%') >= 6 THEN 'OK' ELSE 'FALTA' END,
    '008_accounts_penalties.sql', 1, '008', 'a'
  UNION ALL SELECT '008', 'penalty_charges',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'penalty_charges') THEN 'OK' ELSE 'FALTA' END,
    '008_accounts_penalties.sql', 1, '008', 'b'
  UNION ALL SELECT '010', 'budget_min_clp',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'load_requests' AND column_name = 'budget_min_clp') THEN 'OK' ELSE 'FALTA' END,
    '010_price_negotiation.sql', 1, '010', 'a'
  UNION ALL SELECT '011', 'cargo_description',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'load_requests' AND column_name = 'cargo_description') THEN 'OK' ELSE 'FALTA' END,
    '011_cargo_trust.sql', 1, '011', 'a'
  UNION ALL SELECT '011', 'match_incidents',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'match_incidents') THEN 'OK' ELSE 'FALTA' END,
    '011_cargo_trust.sql', 1, '011', 'b'
  UNION ALL SELECT '012', 'match_ratings',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'match_ratings') THEN 'OK' ELSE 'FALTA' END,
    '012_uber_parity.sql', 1, '012', 'a'
  UNION ALL SELECT '013', 'rating tags',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'match_ratings' AND column_name = 'tags') THEN 'OK' ELSE 'FALTA' END,
    '013_rating_tags.sql', 1, '013', 'a'
  UNION ALL SELECT '015', 'trip_events',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trip_events') THEN 'OK' ELSE 'FALTA' END,
    '015_trip_events.sql', 1, '015', 'a'
  UNION ALL SELECT '016', 'GPS is_available',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_available') THEN 'OK' ELSE 'FALTA' END,
    '016_carrier_gps.sql', 1, '016', 'a'
  UNION ALL SELECT '022', 'support_cases',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'support_cases') THEN 'OK' ELSE 'FALTA' END,
    'RUN_022_025_SUPABASE.sql', 1, '022', 'a'
  UNION ALL SELECT '024', 'penalty_payment_status',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'penalty_payment_status') THEN 'OK' ELSE 'FALTA' END,
    'RUN_022_025_SUPABASE.sql', 1, '024', 'a'
  UNION ALL SELECT '027', 'device_tokens',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'device_tokens') THEN 'OK' ELSE 'FALTA' END,
    'RUN_027_payment_methods_fcm.sql', 1, '027', 'a'
  UNION ALL SELECT '027', 'user_payment_methods',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_payment_methods') THEN 'OK' ELSE 'FALTA' END,
    'RUN_027_payment_methods_fcm.sql', 1, '027', 'b'
  UNION ALL SELECT '028', 'chat_human_at',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'chat_human_at') THEN 'OK' ELSE 'FALTA' END,
    'RUN_028_match_chat_human.sql', 1, '028', 'a'
  UNION ALL SELECT '029', 'available_pallets',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'capacity_offers' AND column_name = 'available_pallets') THEN 'OK' ELSE 'FALTA' END,
    'RUN_029_carrier_truck_offer_pallets.sql', 1, '029', 'a'
  UNION ALL SELECT '030', 'user_bank_accounts',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_bank_accounts') THEN 'OK' ELSE 'FALTA' END,
    'RUN_030_user_bank_accounts.sql', 1, '030', 'a'
) t
ORDER BY ord, s1, s2
