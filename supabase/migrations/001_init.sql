-- Uber Truck v001 — esquema MVP (Supabase / PostgreSQL)
-- Ejecutar cuando tengas proyecto Supabase; el servidor usa JSON local hasta entonces.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('shipper', 'carrier', 'admin');
CREATE TYPE capacity_offer_status AS ENUM (
  'draft', 'published', 'reserved', 'expired', 'cancelled'
);
CREATE TYPE load_request_status AS ENUM (
  'draft', 'published', 'matched', 'in_transit', 'delivered', 'cancelled'
);
CREATE TYPE match_status AS ENUM (
  'proposed', 'accepted', 'in_progress', 'completed', 'disputed', 'cancelled'
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'shipper',
  company_name TEXT,
  phone TEXT,
  kyc_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE capacity_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_user_id UUID REFERENCES users (id),
  carrier_name TEXT NOT NULL,
  origin_city TEXT NOT NULL,
  origin_region TEXT NOT NULL DEFAULT 'RM',
  destination_city TEXT NOT NULL,
  destination_region TEXT NOT NULL DEFAULT 'RM',
  free_volume_m3 NUMERIC(8, 2),
  max_weight_kg NUMERIC(10, 2),
  cargo_types TEXT,
  available_from DATE,
  available_until DATE,
  status capacity_offer_status NOT NULL DEFAULT 'published',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE load_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipper_user_id UUID REFERENCES users (id),
  company_name TEXT NOT NULL,
  origin_city TEXT NOT NULL,
  origin_region TEXT NOT NULL DEFAULT 'RM',
  destination_city TEXT NOT NULL,
  destination_region TEXT NOT NULL DEFAULT 'RM',
  volume_m3 NUMERIC(8, 2),
  weight_kg NUMERIC(10, 2),
  pallets INT,
  cargo_type TEXT,
  urgency TEXT NOT NULL DEFAULT 'normal',
  needed_by DATE,
  status load_request_status NOT NULL DEFAULT 'published',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_request_id UUID NOT NULL REFERENCES load_requests (id),
  capacity_offer_id UUID NOT NULL REFERENCES capacity_offers (id),
  agreed_price_clp BIGINT,
  status match_status NOT NULL DEFAULT 'proposed',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (load_request_id, capacity_offer_id)
);

CREATE INDEX idx_capacity_offers_region ON capacity_offers (origin_region, status);
CREATE INDEX idx_load_requests_region ON load_requests (origin_region, status);
CREATE INDEX idx_matches_load ON matches (load_request_id);
