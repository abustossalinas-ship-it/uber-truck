# Agentes (Cursor) — Uber Truck

## Qué es este repo

Proyecto **Uber Truck / Cubik**: marketplace de transporte por camión (carga ↔ transportista), Chile.

## Cómo arrancar en Cursor

1. Abrir la **raíz** de `uber-truck` en Cursor.
2. Modo **Agent** para implementar; **Ask** solo para consultas.
3. Reglas en `.cursor/rules/` — leer `project-core.mdc` siempre.

## Documentación en producción (`/docs/`)

| Documento | URL (Railway) |
|-----------|----------------|
| Hub | https://uber-truck-production.up.railway.app/docs/ |
| Memoria técnica | https://uber-truck-production.up.railway.app/docs/Memoria-tecnica-Uber-Truck.html |
| QA automatizado | https://uber-truck-production.up.railway.app/docs/QA-AUTOMATIZADO.md |
| SQL Supabase | https://uber-truck-production.up.railway.app/docs/Sql-Supabase-Uber-Truck.html |

Word local: `npm run export:all-docs` → pack completo; `npm run export:memoria-docx` → solo memoria. Salida: `docs/*.docx` y `Downloads/Proyecto Uber Truck/`.

## Tareas típicas → dónde mirar

| Tarea | Archivos (cuando existan) |
|-------|---------------------------|
| **Memoria (Gantt, roadmap, próximos pasos)** | `docs/Memoria-tecnica-Uber-Truck.html`, `docs/01-MEMORIA-TECNICA.md` — **v4.4 / 0.0.129** |
| **Dominio + correo piloto** | `docs/DOMAIN-AND-EMAIL.md`, `docs/AUTH-AND-EMAIL-ROADMAP.md`, `docs/POST-MVP-CHECKLIST.md` |
| **Auth / contraseña** | `src/lib/password-policy.js`, `src/routes/auth.js`, `src/services/mail.js` |
| **QA + Laboratorio** | `docs/QA-AUTOMATIZADO.md`, `public/qa-lab.html`, `e2e/`, `tests/`, `.github/workflows/qa.yml` |
| **Plan comercial piloto/escala** | `docs/PLAN-COMERCIAL-PILOTO.md`, `canvases/cubik-plan-native-escala.canvas.tsx` |
| **Demo comercial** | `docs/DEMO-GUION.md` |
| **Cubik Saldo piloto** | `src/lib/payment-simulation.js`, `pilot-pay-ui.js`, `docs/RUN_026_pilot_payment.sql` |
| **Notificaciones** | `src/lib/notification-visibility.js`, `src/routes/match-comms.js` |
| **Índice** | `docs/00-INDICE-DOCUMENTACION.md`, `docs/index.html` |
| Canvas avance | `canvases/estado-avance.canvas.tsx` |
| **SQL Supabase** | `docs/SQL-SUPABASE.md`, `supabase/migrations/RUN_PENDING.sql` |
| API HTTP | `src/app.js`, `src/routes/` |
| Modelo de datos | `supabase/migrations/` |
| Deploy | `railway.json`, `.env.example` |

## Comandos útiles

```bash
npm run dev          # servidor local
npm run qa:lab       # Laboratorio QA gráfico
npm run test:unit    # tests unitarios
npm run test:e2e     # E2E Playwright local
npm run android:install:remote  # APK apunta a prod
```

## Idioma

- Instrucciones del usuario y copy de producto: **español** (Chile si aplica).
- Código y variables: **inglés**.

## Lo que el agente no hace solo

- Crear cuentas en Supabase, Railway, mapas, pagos.
- Commits o push salvo petición explícita.
