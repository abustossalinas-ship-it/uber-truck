-- Ejecutar en Supabase SQL Editor (mismo contenido que supabase/migrations/029)
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_truck_type_id TEXT;

ALTER TABLE capacity_offers ADD COLUMN IF NOT EXISTS available_pallets INTEGER;
ALTER TABLE capacity_offers ADD COLUMN IF NOT EXISTS pallet_type TEXT DEFAULT 'euro';
ALTER TABLE capacity_offers ADD COLUMN IF NOT EXISTS cargo_stackable BOOLEAN DEFAULT FALSE;
ALTER TABLE capacity_offers ADD COLUMN IF NOT EXISTS truck_type_id TEXT;
ALTER TABLE capacity_offers ADD COLUMN IF NOT EXISTS truck_type_label TEXT;

NOTIFY pgrst, 'reload schema';
