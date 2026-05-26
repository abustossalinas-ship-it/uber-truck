# Agentes (Cursor) — Uber Truck

## Qué es este repo

Proyecto **Uber Truck**: marketplace de transporte por camión (carga ↔ transportista).

## Cómo arrancar en Cursor

1. Abrir la **raíz** de `uber-truck` en Cursor.
2. Modo **Agent** para implementar; **Ask** solo para consultas.
3. Reglas en `.cursor/rules/` — leer `project-core.mdc` siempre.

## Tareas típicas → dónde mirar

| Tarea | Archivos (cuando existan) |
|-------|---------------------------|
| **Índice / memoria / Gantt / avance** | `docs/00-INDICE-DOCUMENTACION.md`, `docs/01-MEMORIA-TECNICA.md`, `canvases/estado-avance.canvas.tsx` |
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
