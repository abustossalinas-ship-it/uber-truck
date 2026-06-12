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
npm run dev          # servidor local → http://localhost:3001/app
npm run test:qa      # unit + E2E local (obligatorio antes de deploy)
npm run test:qa:prod # + smoke www.getcubik.cl
npm run qa:lab       # Laboratorio QA gráfico
npm run android:install:remote  # APK apunta a prod
```

## Idioma

- Instrucciones del usuario y copy de producto: **español** (Chile si aplica).
- Código y variables: **inglés**.

## Lo que el agente no hace solo

- Crear cuentas en Supabase, Railway, mapas, pagos.
- Commits o push salvo petición explícita.

## Cursor Cloud specific instructions

Servidor único Node/Express (CommonJS). Comandos estándar en `package.json` y arriba (`npm run dev`, `npm run test:unit`, `npm run test:e2e`, `npm run test:qa`). El update script ya deja dependencias y Chromium de Playwright instalados.

Notas no obvias para desarrollar aquí:

- **Backend local sin Supabase = store JSON.** Si no hay `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` en `.env`, `src/lib/repository.js` usa un store JSON en `data/store.json` (sembrado). `/health` reporta `"storage":"json"`. En este modo la autenticación se relaja (`src/lib/require-auth.js` deja pasar sin JWT), así que la API local funciona sin login. Sembrar datos demo: `POST /api/demo/seed` (sin `DEMO_SEED_KEY` en dev).
- **La UI web local apunta a PRODUCCIÓN por defecto (gotcha clave).** `public/brand-config.js` fija `productionUrl: https://www.getcubik.cl` y `public/api-base.js` reescribe todo `fetch` de `/api`, `/health`, `/docs/` hacia ese origen salvo que `location.origin` coincida. Por eso, abrir `http://localhost:3001/app` en el navegador habla con el backend de producción (errores CORS al escribir). Para que la UI use el backend local, ejecuta en la consola del navegador, **antes de cualquier llamada y de nuevo tras cada reload**: `window.CUBIK_BRAND.productionUrl = location.origin;`. Las llamadas directas por `curl` a `localhost:3001` no se ven afectadas.
- **Login de desarrollo en el navegador:** no hay registro real sin Supabase. Inyecta una sesión mock con `Auth.save('<token>', { id, email, full_name, role: 'shipper'|'carrier', company_name, kyc_status: 'approved' })` (igual que `e2e/helpers.js` → `loginAsMockUser`).
- **Publicar carga (`POST /api/load-requests`) exige declaración de confianza:** `cargo_description` (≥8 chars), `declared_cargo_value_clp`, `terms_cargo_accepted`, `has_dispatch_guide` y `pallets` **o** `volume_m3`. Faltar uno devuelve 400 con la lista de errores.
- **E2E (Playwright):** requiere Chromium (`npm run qa:install`, ya cubierto por el update script). Los specs que necesitan Supabase o credenciales `QA_*` se saltan automáticamente; sin esas variables el resto pasa contra el servidor local que Playwright levanta solo.
- **Sin secretos configurados** Google Maps, FCM, mail, WhatsApp y pasarela quedan deshabilitados; el server arranca igual y el picker de direcciones se vuelve texto libre.
