-- Cubik — billetera: varias cuentas bancarias por usuario (estilo Uber)
-- Ejecutar en Supabase SQL Editor después de 027+.

CREATE TABLE IF NOT EXISTS user_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  holder_name TEXT NOT NULL,
  holder_rut TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  account_number TEXT NOT NULL,
  label TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_bank_accounts_user
  ON user_bank_accounts (user_id);

-- Migrar cuenta única legacy en users → fila predeterminada
INSERT INTO user_bank_accounts (
  user_id,
  holder_name,
  holder_rut,
  bank_name,
  account_type,
  account_number,
  is_default,
  created_at
)
SELECT
  u.id,
  u.bank_holder_name,
  u.bank_rut,
  u.bank_name,
  u.bank_account_type,
  u.bank_account_number,
  true,
  COALESCE(u.bank_registered_at, now())
FROM users u
WHERE u.bank_holder_name IS NOT NULL
  AND u.bank_rut IS NOT NULL
  AND u.bank_name IS NOT NULL
  AND u.bank_account_type IS NOT NULL
  AND u.bank_account_number IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_bank_accounts b WHERE b.user_id = u.id
  );

NOTIFY pgrst, 'reload schema';
