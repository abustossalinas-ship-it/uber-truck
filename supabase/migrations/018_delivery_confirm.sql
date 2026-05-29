-- 018 — Entrega en dos pasos: transportista marca, embarcador confirma

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS carrier_marked_delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipper_confirmed_receipt_at TIMESTAMPTZ;
