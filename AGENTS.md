# Agentes (Cursor) — Uber Truck

## Qué es este repo

Proyecto **Uber Truck**: marketplace de transporte por camión (carga ↔ transportista).

## Cómo arrancar en Cursor

1. Abrir la **raíz** de `uber-truck` en Cursor.
2. Modo **Agent** para implementar; **Ask** solo para consultas.
3. Reglas en `.cursor/rules/` — leer `project-core.mdc` siempre.

## Documentación en producción (`/docs/`)

| Documento | URL (Railway) |
|-----------|----------------|
| Hub | https://uber-truck-production.up.railway.app/docs/ |
| Memoria técnica | https://uber-truck-production.up.railway.app/docs/Memoria-tecnica-Uber-Truck.html |
| SQL Supabase | https://uber-truck-production.up.railway.app/docs/Sql-Supabase-Uber-Truck.html |

Word local (como Chanchi): `npm run export:all-docs` → pack completo; `npm run export:memoria-docx` → solo memoria. Salida: `docs/*.docx` y `Downloads/Proyecto Uber Truck/`.

## Tareas típicas → dónde mirar

| Tarea | Archivos (cuando existan) |
|-------|---------------------------|
| **Memoria (Gantt, roadmap, próximos pasos)** | `docs/Memoria-tecnica-Uber-Truck.html`, `docs/index.html` — v4.0 / software 0.0.104 |
| **Cubik Saldo piloto** | `src/lib/payment-simulation.js`, `pilot-pay-ui.js`, `docs/RUN_026_pilot_payment.sql` |
| **Índice** | `docs/00-INDICE-DOCUMENTACION.md` |
| Canvas avance | `canvases/estado-avance.canvas.tsx` |
| **SQL Supabase** | `docs/SQL-SUPABASE.md`, `supabase/migrations/RUN_PENDING.sql` |
| API HTTP | `src/app.js`, `src/routes/` |
| Modelo de datos | `supabase/migrations/` |
| Deploy | `railway.json`, `.env.example` |

## Idioma

- Instrucciones del usuario y copy de producto: **español** (Chile si aplica).
- Código y variables: **inglés**.

## Lo que el agente no hace solo

- Crear cuentas en Supabase, Railway, mapas, pagos.
- Commits o push salvo petición explícita.
