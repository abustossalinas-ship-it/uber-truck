# SQL Supabase — Uber Truck

Ejecutar en [SQL Editor](https://supabase.com/dashboard/project/ljinhegtywixtbzjgjfn/sql/new) del proyecto **ljinhegtywixtbzjgjfn**.

**Orden:** si es instalación nueva, corre primero `001_init.sql` y `003_auth_password.sql` desde `supabase/migrations/`. Luego pega **todo** el bloque siguiente (004–008).

**Archivo en repo:** `supabase/migrations/RUN_PENDING.sql`

---

## Script completo (004 – 008)

```sql
-- 004 — cancelación básica
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS cancel_action TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- 005 — motivos y multas sugeridas
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS reason_code TEXT,
  ADD COLUMN IF NOT EXISTS reason_detail TEXT,
  ADD COLUMN IF NOT EXISTS penalty_type TEXT,
  ADD COLUMN IF NOT EXISTS penalty_amount_clp BIGINT,
  ADD COLUMN IF NOT EXISTS agreement_accepted BOOLEAN DEFAULT false;

-- 006 — acuerdo mutuo bilateral
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS mutual_cancel_shipper_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mutual_cancel_carrier_at TIMESTAMPTZ;

-- 007 — chat y notificaciones
CREATE TABLE IF NOT EXISTS match_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('shipper', 'carrier', 'admin')),
  body TEXT NOT NULL,
  preset_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS match_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  for_role TEXT NOT NULL CHECK (for_role IN ('shipper', 'carrier')),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_messages_match ON match_messages (match_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_notifications_role ON match_notifications (for_role, read_at, created_at DESC);

-- 008 — cuenta bancaria y cargos de multas
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bank_holder_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_rut TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_type TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_registered_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS penalty_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  debtor_user_id UUID REFERENCES users (id),
  creditor_user_id UUID REFERENCES users (id),
  debtor_role TEXT NOT NULL CHECK (debtor_role IN ('shipper', 'carrier')),
  amount_clp BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('suggested', 'pending', 'paid', 'waived', 'overdue')),
  due_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_penalty_charges_debtor ON penalty_charges (debtor_user_id, status);
CREATE INDEX IF NOT EXISTS idx_penalty_charges_due ON penalty_charges (due_at);
```

---

## Verificación

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'matches' AND column_name LIKE 'mutual_cancel%';

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('match_messages', 'match_notifications', 'penalty_charges');
```

---

## Referencias

- [01-MEMORIA-TECNICA.md](./01-MEMORIA-TECNICA.md)
- [PENALTIES-AND-ACCOUNTS.md](./PENALTIES-AND-ACCOUNTS.md)
- [MATCH-CANCEL-POLICY.md](./MATCH-CANCEL-POLICY.md)
