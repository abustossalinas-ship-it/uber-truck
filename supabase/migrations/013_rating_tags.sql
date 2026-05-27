-- 013 — Chips de calificación estilo Uber (tags por viaje)

ALTER TABLE match_ratings
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tag_band TEXT CHECK (tag_band IN ('low', 'mid', 'high'));
