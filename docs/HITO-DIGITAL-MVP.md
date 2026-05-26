# Hito — MVP digital v1 (Uber Truck)

Bitácora técnica del adelanto **mayo 2026** vs Gantt planificado (M3 oct 2026). **No incluir secretos** en copias públicas.

---

## Objetivo

Marketplace web: publicar **oferta de capacidad** y **demanda de carga**, **emparejar**, gestionar **estados**, **chat**, **cancelación** (acuerdo mutuo / multas) y **notificaciones** con sesión JWT.

---

## Stack entregado

| Capa | Implementación |
|------|----------------|
| API | Node 20 + Express 4 (`src/app.js`, `src/routes/`) |
| Datos | Supabase PostgreSQL (`supabase/migrations/001`–`008`) |
| UI | `public/` — embarcador, transportista, matches, cuenta/multas |
| Auth | JWT (`users` + bcrypt) |
| Deploy | Railway + `/health` |
| Docs | `/docs/` estático, memoria HTML v2.1+ |

---

## Entregables (estado)

| ID | Entregable | Estado |
|----|------------|--------|
| 2.1 | Migraciones base + auth + matches | Hecho |
| 2.2 | API capacity-offers, load-requests, matches | Hecho |
| 2.3 | Formularios web + roles demo | Hecho |
| 2.4 | Panel matches, estados, chat | Hecho |
| 2.5 | Railway producción | Hecho |
| + | Sugerencias match automático | Hecho |
| + | Acuerdo mutuo cancelación | Hecho v0.0.13+ |
| + | Notificaciones in-app (JWT) | Hecho |
| + | Cuenta y multas UI + API (sin pasarela) | Parcial (2.10) |

---

## Problemas frecuentes (Windows / deploy)

- **SQL pendiente en Supabase:** ejecutar `docs/SQL-SUPABASE.md` o `RUN_PENDING.sql` (008 banco + `penalty_charges`).
- **GitHub Action “failed”:** el workflow solo valida; el deploy es por integración Railway ↔ GitHub.
- **Notificaciones sin login:** requieren JWT; al logout `Comms.resetUi()`.

---

## Archivos clave

- `public/app.js` — matches, modal cancelar, acuerdo mutuo
- `public/comms-ui.js`, `public/penalties-ui.js`
- `src/routes/matches.js`, `match-comms.js`, `account.js`
- `docs/MATCH-CANCEL-POLICY.md`, `docs/PENALTIES-AND-ACCOUNTS.md`

---

## Siguiente (ver `PROXIMOS-HITOS.md`)

- P0: SQL 008 en Supabase prod
- P1: Mis cargas/ofertas por `owner_user_id`
- P2: Botón generar cargo + pasarela (diseño)
