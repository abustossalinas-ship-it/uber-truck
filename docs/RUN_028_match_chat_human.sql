-- Ejecutar en Supabase SQL Editor (piloto M2)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS chat_human_at TIMESTAMPTZ;
