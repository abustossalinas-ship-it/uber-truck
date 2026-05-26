-- Cuenta bancaria (cobro futuro) y cargos formales de multas

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bank_holder_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_rut TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_type TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_registered_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS penalty_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  debtor_user_id UUID REFERENCES users (id),
  creditor_user_id UUID REFERENCES users (id),
  debtor_role TEXT NOT NULL CHECK (debtor_role IN ('shipper', 'carrier')),
  amount_clp BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('suggested', 'pending', 'paid', 'waived', 'overdue')),
  due_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_penalty_charges_debtor ON penalty_charges (debtor_user_id, status);
CREATE INDEX IF NOT EXISTS idx_penalty_charges_due ON penalty_charges (due_at);
