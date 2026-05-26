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
| Próximos hitos | https://uber-truck-production.up.railway.app/docs/PROXIMOS-HITOS.md |
| SQL Supabase | https://uber-truck-production.up.railway.app/docs/SQL-SUPABASE.md |

Word local (como Chanchi): `npm run export:all-docs` → pack completo; `npm run export:memoria-docx` → solo memoria. Salida: `docs/*.docx` y `Downloads/Proyecto Uber Truck/`.

## Tareas típicas → dónde mirar

| Tarea | Archivos (cuando existan) |
|-------|---------------------------|
| **Índice / memoria / Gantt / avance** | `docs/index.html`, `docs/00-INDICE-DOCUMENTACION.md`, `docs/01-MEMORIA-TECNICA.md`, `docs/HITO-DIGITAL-MVP.md`, `canvases/estado-avance.canvas.tsx` |
| **Comparar con Chanchi** | `docs/COMPARACION-ESTRUCTURA-CHANCHI.md` |
| **SQL Supabase** | `docs/SQL-SUPABASE.md`, `supabase/migrations/RUN_PENDING.sql` |
| Plan / prioridades | `docs/KICKOFF.md`, `docs/ROADMAP.md` |
| API HTTP | `src/app.js`, `src/routes/` |
| Modelo de datos | `supabase/migrations/` |
| Deploy | `railway.json`, `.env.example` |

## Idioma

- Instrucciones del usuario y copy de producto: **español** (Chile si aplica).
- Código y variables: **inglés**.

## Lo que el agente no hace solo

- Crear cuentas en Supabase, Railway, mapas, pagos.
- Commits o push salvo petición explícita.
