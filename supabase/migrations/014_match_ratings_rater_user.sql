-- 014 — Asegura rater_user_id en match_ratings (por si 012 se aplicó incompleto)

ALTER TABLE match_ratings
  ADD COLUMN IF NOT EXISTS rater_user_id UUID REFERENCES users (id);
