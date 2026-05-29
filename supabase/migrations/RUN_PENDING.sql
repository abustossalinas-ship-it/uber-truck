-- Uber Truck — migraciones pendientes (ejecutar en Supabase SQL Editor)
-- Orden: 001_init, 003_auth_password si instalación nueva; luego 004–010 si aplica; luego 011.

-- 011 — Declaración de mercadería, términos y incidentes
ALTER TABLE load_requests
  ADD COLUMN IF NOT EXISTS cargo_description TEXT,
  ADD COLUMN IF NOT EXISTS declared_cargo_value_clp BIGINT,
  ADD COLUMN IF NOT EXISTS has_dispatch_guide BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS dispatch_guide_folio TEXT,
  ADD COLUMN IF NOT EXISTS requires_cargo_insurance BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS legal_terms_version TEXT,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS match_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  reporter_role TEXT NOT NULL CHECK (reporter_role IN ('shipper', 'carrier', 'admin')),
  reporter_user_id UUID REFERENCES users (id),
  incident_type TEXT NOT NULL CHECK (
    incident_type IN ('theft', 'damage', 'shortage', 'delay', 'other')
  ),
  description TEXT NOT NULL,
  declared_value_clp_at_report BIGINT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_incidents_match ON match_incidents (match_id, created_at DESC);

-- 012 — Paridad Uber (calificaciones, cierre viaje)
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

-- 013 — Chips de calificación (tags estilo Uber)
ALTER TABLE match_ratings
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tag_band TEXT CHECK (tag_band IN ('low', 'mid', 'high'));

-- 014 — rater_user_id si falta
ALTER TABLE match_ratings
  ADD COLUMN IF NOT EXISTS rater_user_id UUID REFERENCES users (id);

-- 016 — GPS transportista (disponible + tracking en viaje)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS track_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS track_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS track_updated_at TIMESTAMPTZ;

-- 017 — Recuperación de contraseña
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens (user_id, created_at DESC);

-- 018 — Confirmación de entrega (transportista marca, embarcador confirma)
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS carrier_marked_delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipper_confirmed_receipt_at TIMESTAMPTZ;

-- 019 — Tiempos operativos en carga
ALTER TABLE load_requests
  ADD COLUMN IF NOT EXISTS needed_by_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cargo_ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prep_min INT,
  ADD COLUMN IF NOT EXISTS load_min INT,
  ADD COLUMN IF NOT EXISTS paperwork_min INT,
  ADD COLUMN IF NOT EXISTS unload_min INT,
  ADD COLUMN IF NOT EXISTS origin_ops_min INT,
  ADD COLUMN IF NOT EXISTS eta_total_min INT,
  ADD COLUMN IF NOT EXISTS prep_checklist JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 020 — Programar viaje
ALTER TABLE load_requests
  ADD COLUMN IF NOT EXISTS schedule_mode TEXT NOT NULL DEFAULT 'now',
  ADD COLUMN IF NOT EXISTS scheduled_pickup_at TIMESTAMPTZ;

ALTER TABLE capacity_offers
  ADD COLUMN IF NOT EXISTS schedule_mode TEXT NOT NULL DEFAULT 'now',
  ADD COLUMN IF NOT EXISTS scheduled_depart_at TIMESTAMPTZ;

-- 021 — Metadatos oferta en notificaciones
ALTER TABLE match_notifications
  ADD COLUMN IF NOT EXISTS amount_clp BIGINT,
  ADD COLUMN IF NOT EXISTS previous_amount_clp BIGINT,
  ADD COLUMN IF NOT EXISTS previous_at TIMESTAMPTZ;

-- 015 — Historial del viaje (obligatorio para oferta $350 → $350.000 en notificaciones)
CREATE TABLE IF NOT EXISTS trip_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  actor_role TEXT CHECK (actor_role IN ('shipper', 'carrier', 'admin', 'system')),
  actor_user_id UUID REFERENCES users (id),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_events_match ON trip_events (match_id, created_at ASC);

-- 022 — Ayuda / moderación
CREATE TABLE IF NOT EXISTS support_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  opened_by_user_id UUID REFERENCES users (id),
  opened_by_role TEXT NOT NULL CHECK (opened_by_role IN ('shipper', 'carrier', 'admin', 'system')),
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'closed')),
  auto_opened BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES support_cases (id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('shipper', 'carrier', 'moderator')),
  sender_user_id UUID REFERENCES users (id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_cases_match ON support_cases (match_id, status);
CREATE INDEX IF NOT EXISTS idx_support_messages_case ON support_messages (case_id, created_at ASC);

-- 023 — Multa pagada (moderador / admin)
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS penalty_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS penalty_paid_by_user_id UUID REFERENCES users (id),
  ADD COLUMN IF NOT EXISTS penalty_payment_note TEXT;

CREATE INDEX IF NOT EXISTS idx_matches_penalty_paid ON matches (penalty_paid_at)
  WHERE penalty_paid_at IS NOT NULL;

-- 025 — Comprobante transferencia (declarar pago multa)
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS penalty_payment_proof_mime TEXT,
  ADD COLUMN IF NOT EXISTS penalty_payment_proof_data TEXT,
  ADD COLUMN IF NOT EXISTS penalty_payment_proof_at TIMESTAMPTZ;

-- 024 — Flujo declarar pago → confirmar acreedor (24 h)
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS penalty_payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS penalty_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS penalty_claimed_by_user_id UUID REFERENCES users (id),
  ADD COLUMN IF NOT EXISTS penalty_claim_note TEXT,
  ADD COLUMN IF NOT EXISTS penalty_confirm_deadline_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS penalty_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS penalty_confirmed_by_user_id UUID REFERENCES users (id),
  ADD COLUMN IF NOT EXISTS penalty_disputed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS penalty_dispute_note TEXT;

UPDATE matches
SET penalty_payment_status = 'settled_moderator'
WHERE penalty_paid_at IS NOT NULL
  AND penalty_payment_status = 'pending';
