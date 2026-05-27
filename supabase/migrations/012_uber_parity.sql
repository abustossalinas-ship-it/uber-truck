-- 012 — Paridad Uber: calificaciones, cierre de viaje

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS delivery_note TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS match_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  rater_role TEXT NOT NULL CHECK (rater_role IN ('shipper', 'carrier')),
  rater_user_id UUID REFERENCES users (id),
  stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, rater_role)
);

CREATE INDEX IF NOT EXISTS idx_match_ratings_match ON match_ratings (match_id);
