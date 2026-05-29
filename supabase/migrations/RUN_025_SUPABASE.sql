-- Uber Truck — 025 comprobante transferencia (ejecutar en Supabase SQL Editor)

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS penalty_payment_proof_mime TEXT,
  ADD COLUMN IF NOT EXISTS penalty_payment_proof_data TEXT,
  ADD COLUMN IF NOT EXISTS penalty_payment_proof_at TIMESTAMPTZ;
