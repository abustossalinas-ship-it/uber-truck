# Auth, sesiones y correo — Cubik

## Resumen

| Fase | Qué incluye | Estado |
|------|-------------|--------|
| **1 (actual)** | OTP **email** vía Resend en dispositivo nuevo; sesión **30 días** por dispositivo (web + APK) | Implementado |
| **2 (prod)** | OTP **SMS/WhatsApp** (Twilio) además de email; mismo modelo de sesión | Roadmap |

Comportamiento tipo Uber Freight:

1. Email + contraseña.
2. Si el dispositivo ya tiene sesión activa (< 30 días y sin «Cerrar sesión») → entra directo.
3. Si es dispositivo nuevo → código **4 dígitos** al correo (10 min).
4. Tras verificar → correo **«Nuevo inicio de sesión»** con datos del dispositivo.

---

## Resend + getcubik.cl (paso a paso)

### A) Verificar dominio en Resend

1. Entra a [resend.com](https://resend.com) → **Domains** → **Add Domain** → `getcubik.cl`.
2. Resend muestra registros DNS (SPF **TXT** + DKIM **CNAME**, a veces un MX opcional).
3. **HostGator** → cPanel → **Zone Editor** / **Editor de zona DNS** de `getcubik.cl`.
4. Agrega **todos** los registros que pide Resend (no borres los CNAME/A de Railway).
5. En Resend → **Verify**. Puede tardar 15 min – 24 h.
6. **API Keys** → crea o reutiliza una key → copia `re_...`.

### B) Remitente transaccional (no_reply@)

No necesitas buzón real para `no_reply@` — solo dominio verificado en Resend.

En **Railway** (proyecto uber-truck):

```env
RESEND_API_KEY=re_...
EMAIL_FROM=Cubik <no_reply@getcubik.cl>
APP_PUBLIC_URL=https://www.getcubik.cl
SESSION_TTL_DAYS=30
JWT_EXPIRES=30d
```

Redeploy y prueba:

- Forgot password → Gmail tester.
- Login en incógnito (dispositivo nuevo) → OTP 4 dígitos.

> `onboarding@resend.dev` solo entrega al email de tu cuenta Resend. Con dominio verificado llega a cualquier destinatario.

### C) Admin operativo (admin@getcubik.cl)

| Uso | Dirección |
|-----|-----------|
| **Login super-admin Cubik** | `admin@getcubik.cl` (tabla `users`, role `admin`) |
| **Correos automáticos OTP / reset** | `no_reply@getcubik.cl` vía Resend (no recibe respuestas) |

**Buzón admin (opcional, para recibir mail):**

1. HostGator cPanel → **Email Accounts** → crear `admin@getcubik.cl` (contraseña propia del buzón).
2. Eso es **independiente** de Resend (MX de HostGator vs registros Resend para envío).
3. En Supabase ejecuta `supabase/migrations/RUN_032_admin_getcubik_email.sql` para cambiar el email de la cuenta admin en la app (**misma contraseña de login** que tenías con `admin@cubik.cl`).
4. Entra a Cubik con `admin@getcubik.cl` + tu contraseña anterior.

El front reconoce super-admin por email exacto (`public/roles-ui.js` → `admin@getcubik.cl`).

---

## Supabase — SQL a ejecutar

Orden recomendado en **SQL Editor**:

| Orden | Archivo | Qué hace |
|-------|---------|----------|
| 1 | `supabase/migrations/RUN_031_AUTH_SESSIONS.sql` | Tablas `user_sessions` + `auth_otp_codes` |
| 2 | `supabase/migrations/RUN_032_admin_getcubik_email.sql` | Admin → `admin@getcubik.cl` |

Si las tablas 031 no existen, el login sigue **sin OTP** (fallback).

---

## API

| Método | Ruta | Uso |
|--------|------|-----|
| POST | `/api/auth/login` | `{ email, password, device_id, … }` → `token` o `need_otp` |
| POST | `/api/auth/otp/verify` | `{ otp_id, code, email, password, device_id, … }` |
| POST | `/api/auth/otp/resend` | Cooldown 60 s |
| POST | `/api/auth/logout` | Bearer + `device_id` → revoca sesión del dispositivo |

## Fase 2 — SMS / Twilio

Reutilizar `auth_otp_codes.channel` (`sms`, `whatsapp`). Ver roadmap en `DOMAIN-AND-EMAIL.md`.

## Desactivar OTP (solo dev)

```env
AUTH_DEVICE_SESSIONS=false
```
