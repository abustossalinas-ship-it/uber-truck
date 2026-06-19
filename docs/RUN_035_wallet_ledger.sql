-- 035 — Cubik Saldo prod (ejecutar en Supabase SQL Editor)
-- Copia de supabase/migrations/035_wallet_ledger.sql

CREATE TABLE IF NOT EXISTS wallet_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  balance_clp BIGINT NOT NULL DEFAULT 0 CHECK (balance_clp >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_accounts_user ON wallet_accounts (user_id);

CREATE TABLE IF NOT EXISTS wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  amount_clp BIGINT NOT NULL,
  balance_after_clp BIGINT NOT NULL,
  entry_type TEXT NOT NULL CHECK (
    entry_type IN (
      'topup_sandbox',
      'topup_mercadopago',
      'escrow_hold',
      'escrow_release',
      'escrow_refund'
    )
  ),
  match_id UUID REFERENCES matches (id) ON DELETE SET NULL,
  note TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user ON wallet_ledger (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_match ON wallet_ledger (match_id)
  WHERE match_id IS NOT NULL;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS wallet_escrow_clp BIGINT,
  ADD COLUMN IF NOT EXISTS wallet_escrow_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wallet_shipper_fee_clp BIGINT,
  ADD COLUMN IF NOT EXISTS wallet_carrier_fee_clp BIGINT,
  ADD COLUMN IF NOT EXISTS wallet_payment_status TEXT
    CHECK (
      wallet_payment_status IS NULL
      OR wallet_payment_status IN ('held', 'released', 'refunded')
    ),
  ADD COLUMN IF NOT EXISTS wallet_settled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_matches_wallet_payment ON matches (wallet_payment_status)
  WHERE wallet_payment_status IS NOT NULL;

CREATE OR REPLACE FUNCTION wallet_apply_entry(
  p_user_id UUID,
  p_amount BIGINT,
  p_entry_type TEXT,
  p_match_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_meta JSONB DEFAULT '{}'::jsonb
) RETURNS wallet_ledger
LANGUAGE plpgsql
AS $$
DECLARE
  v_account wallet_accounts;
  v_new_balance BIGINT;
  v_row wallet_ledger;
BEGIN
  IF p_amount = 0 THEN
    RAISE EXCEPTION 'wallet_amount_zero';
  END IF;

  INSERT INTO wallet_accounts (user_id, balance_clp)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_account
  FROM wallet_accounts
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_new_balance := v_account.balance_clp + p_amount;
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'wallet_insufficient_balance';
  END IF;

  UPDATE wallet_accounts
  SET balance_clp = v_new_balance, updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO wallet_ledger (
    user_id,
    amount_clp,
    balance_after_clp,
    entry_type,
    match_id,
    note,
    meta
  ) VALUES (
    p_user_id,
    p_amount,
    v_new_balance,
    p_entry_type,
    p_match_id,
    p_note,
    COALESCE(p_meta, '{}'::jsonb)
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

NOTIFY pgrst, 'reload schema';
