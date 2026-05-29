-- 025 — Comprobante de transferencia al declarar pago de multa

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS penalty_payment_proof_mime TEXT,
  ADD COLUMN IF NOT EXISTS penalty_payment_proof_data TEXT,
  ADD COLUMN IF NOT EXISTS penalty_payment_proof_at TIMESTAMPTZ;
