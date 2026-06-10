# SQL Supabase — Uber Truck

Ejecutar en [SQL Editor](https://supabase.com/dashboard/project/ljinhegtywixtbzjgjfn/sql/new) del proyecto **ljinhegtywixtbzjgjfn**.

**Orden:** instalación nueva → `001_init.sql`, `003_auth_password.sql`, luego 004–008 (bloque abajo), `010_price_negotiation.sql`, **`011_cargo_trust.sql`**, **`012_uber_parity.sql`**, **`013_rating_tags.sql`**, **`014_match_ratings_rater_user.sql`**.

**Verificación prod (may 2026):** script [`RUN_VERIFY_ALL_MIGRATIONS.sql`](./RUN_VERIFY_ALL_MIGRATIONS.sql) → **23/23 OK**. Migración **014** (`rater_user_id`) aplicada. No ejecutar `RUN_PENDING.sql` completo en prod ya migrada.

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

## Verificación SQL 004–008 (si dudas)

Pega en [SQL Editor Supabase](https://supabase.com/dashboard/project/ljinhegtywixtbzjgjfn/sql/new):

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('match_messages', 'match_notifications', 'penalty_charges', 'user_bank_accounts');

SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' AND column_name LIKE 'bank_%'
ORDER BY column_name;
```

**Esperado si ya aplicaste todo:** 4 tablas (incl. `user_bank_accounts` de 030) y columnas `bank_*` en `users`. Si aparecen, **no vuelvas a ejecutar 008** (es idempotente pero innecesario).

**Checklist completo (001–030):** [`docs/RUN_VERIFY_ALL_MIGRATIONS.sql`](./RUN_VERIFY_ALL_MIGRATIONS.sql) — una sola consulta con filas `OK` / `FALTA` y script a ejecutar.

---

## 012 — Paridad Uber (mis viajes, calificaciones)

Ejecutar `supabase/migrations/012_uber_parity.sql` — columnas `delivery_note`, `completed_at` en `matches`; tabla `match_ratings` (`match_id`, `rater_role`, `stars`, `comment`, UNIQUE por rol).

## 013 — Chips de calificación

Ejecutar `supabase/migrations/013_rating_tags.sql` — columnas `tags` (TEXT[]), `tag_band` (low|mid|high) en `match_ratings`.

## 015 — Eventos de viaje (historial + realtime)

Ejecutar `supabase/migrations/015_trip_events.sql` — tabla `trip_events` (auditoría de estados).

API: `GET /api/matches/:id/events` · SSE `GET /api/realtime/matches/:id/stream?access_token=JWT`

## KYC semi-curado (piloto)

En producción (`KYC_ENFORCE` activo por defecto) las cuentas nuevas quedan `kyc_status = pending` hasta aprobación admin.

- `GET /api/admin/users?status=pending` (rol admin)
- `PATCH /api/admin/users/:id/kyc` body `{ "kyc_status": "approved" }`

Aprobar cuentas existentes:

```sql
UPDATE users SET kyc_status = 'approved' WHERE role IN ('shipper', 'carrier');
```

Desactivar en dev local: `KYC_ENFORCE=false` en `.env`

## 014 — rater_user_id (opcional)

Ejecutar `supabase/migrations/014_match_ratings_rater_user.sql` si la columna no existe.

## Recargar caché PostgREST (producción)

Tras aplicar 012–014, en SQL Editor:

```sql
NOTIFY pgrst, 'reload schema';
```

Esperar 1–2 minutos antes de probar calificaciones en la app.

## Verificación match_ratings

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'match_ratings'
ORDER BY ordinal_position;
```

`/health` en Railway debe reportar `match_ratings_table: true` y `match_ratings_tags_column: true`.

## 011 — Confianza y carga

Ejecutar `supabase/migrations/011_cargo_trust.sql` (o el bloque homónimo en `RUN_PENDING.sql`).

Campos en `load_requests`: declaración de mercadería, valor referencial CLP, guía de despacho (folio), términos aceptados. Tabla `match_incidents` para reportes en viaje.

Ver [CARGO-TRUST.md](./CARGO-TRUST.md) y [Terminos-Confianza-Carga-Uber-Truck.html](./Terminos-Confianza-Carga-Uber-Truck.html).

---

## 022 – 025 — Multas, soporte moderador y comprobante (IMPORTANTE)

**Un solo script** (copiar y Run en SQL Editor):

→ [`supabase/migrations/RUN_022_025_SUPABASE.sql`](../supabase/migrations/RUN_022_025_SUPABASE.sql)

[Abrir SQL Editor Supabase](https://supabase.com/dashboard/project/ljinhegtywixtbzjgjfn/sql/new)

| # | Contenido |
|---|-----------|
| **022** | Tablas `support_cases`, `support_messages` (ayuda / moderador) |
| **023** | `penalty_paid_at`, nota cierre moderador |
| **024** | `penalty_payment_status`, declarar pago, confirmar acreedor 24 h |
| **025** | `penalty_payment_proof_*` (comprobante transferencia) |

Al final del script: `NOTIFY pgrst, 'reload schema'` + consultas de verificación.

Archivos sueltos (mismo contenido): `RUN_022_023_SUPABASE.sql`, `RUN_024_SUPABASE.sql`, `RUN_025_SUPABASE.sql`.

### Cubik Saldo piloto — pago por viaje (026)

→ [`docs/RUN_026_pilot_payment.sql`](./RUN_026_pilot_payment.sql)

Columnas en `matches`: `pilot_payment_status` (`in_settlement` | `released`), `pilot_payment_at`. API: `POST /api/matches/:id/pilot-pay` (embarcador, viaje `completed`). Repo: `supabase/migrations/026_pilot_payment.sql`.

### Tarjeta verificada + push FCM (027)

→ [`docs/RUN_027_payment_methods_fcm.sql`](./RUN_027_payment_methods_fcm.sql)

Tablas `user_payment_methods` (pasarela tipo Copec) y `device_tokens` (FCM).

### Aprobar cuentas KYC (después del SQL)

En la app, ingresa como **admin** → barra **Panel administrador** → **Cuentas KYC — N pendientes** → Aprobar.

O en SQL:

```sql
UPDATE users SET kyc_status = 'approved' WHERE role IN ('shipper', 'carrier') AND kyc_status = 'pending';
NOTIFY pgrst, 'reload schema';
```

---

## Referencias

- [01-MEMORIA-TECNICA.md](./01-MEMORIA-TECNICA.md)
- [DEPLOY.md](./DEPLOY.md) — variables Railway incl. `BUDGET_*` (sugerencia flete v0.0.105)
- [PENALTIES-AND-ACCOUNTS.md](./PENALTIES-AND-ACCOUNTS.md)
- [MATCH-CANCEL-POLICY.md](./MATCH-CANCEL-POLICY.md)
- [CARGO-TRUST.md](./CARGO-TRUST.md)
