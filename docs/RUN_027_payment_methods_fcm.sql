-- Cubik — tarjetas verificadas (pasarela) + tokens FCM push
-- Ejecutar en Supabase SQL Editor después de 022–025.

CREATE TABLE IF NOT EXISTS user_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'sandbox',
  provider_token TEXT NOT NULL,
  card_brand TEXT,
  card_last4 TEXT NOT NULL,
  holder_name TEXT NOT NULL,
  holder_rut TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  microcharge_clp BIGINT,
  microcharge_status TEXT DEFAULT 'reversed',
  is_default BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_payment_methods_user
  ON user_payment_methods (user_id);

CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'android',
  token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens (user_id);

NOTIFY pgrst, 'reload schema';

SELECT 'user_payment_methods' AS check_name, COUNT(*) AS ok
FROM information_schema.tables
WHERE table_name = 'user_payment_methods'
UNION ALL
SELECT 'device_tokens', COUNT(*)
FROM information_schema.tables
WHERE table_name = 'device_tokens';
