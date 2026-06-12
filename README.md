# Uber Truck — Optimización de capacidad logística ociosa

> **Cubik** — marketplace de transporte por camión (repo `uber-truck`). MVP flujo **cerrado** en prod. **Software:** v0.0.129 · **Memoria:** v4.4 (25 may 2026).

## Documentación

**Hub:** https://uber-truck-production.up.railway.app/docs/

| Documento | Enlace |
|-----------|--------|
| **Memoria técnica** (Gantt, backlog, stack) | [docs/Memoria-tecnica-Uber-Truck.html](docs/Memoria-tecnica-Uber-Truck.html) |
| Índice | [docs/00-INDICE-DOCUMENTACION.md](docs/00-INDICE-DOCUMENTACION.md) |
| Dominio + correo piloto | [docs/DOMAIN-AND-EMAIL.md](docs/DOMAIN-AND-EMAIL.md) |
| Post-MVP checklist | [docs/POST-MVP-CHECKLIST.md](docs/POST-MVP-CHECKLIST.md) |
| SQL Supabase | [docs/SQL-SUPABASE.md](docs/SQL-SUPABASE.md) |
| Canvas avance | `canvases/estado-avance.canvas.tsx` |

### Word

```bash
npm run export:memoria-docx
npm run export:all-docs
```

## Arranque

```bash
npm install
npm run dev
```

→ http://localhost:3001 · `/health`

### Desarrollo local

- **Sin Supabase = store JSON.** Si `.env` no define `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, el servidor usa `data/store.json` (sembrado) y `/health` reporta `"storage":"json"`. En este modo la API local no exige login. Datos demo: `POST /api/demo/seed`.
- **Login de desarrollo en el navegador:** sin Supabase no hay registro real. Inyecta una sesión mock en la consola con `Auth.save('<token>', { id, email, full_name, role: 'shipper'|'carrier', company_name, kyc_status: 'approved' })` (igual que `e2e/helpers.js`).
- **Gotcha — la UI web local apunta a producción.** `public/brand-config.js` (`productionUrl`) + `public/api-base.js` reescriben los `fetch` de `/api`, `/health` y `/docs/` hacia `getcubik.cl` salvo que el origen coincida. Para que `http://localhost:3001/app` use el backend local, ejecuta en la consola del navegador (y tras cada reload): `window.CUBIK_BRAND.productionUrl = location.origin;`. Las llamadas por `curl` a `localhost` no se ven afectadas.
- Sin claves de Google Maps / FCM / mail / WhatsApp / pasarela, esas integraciones quedan deshabilitadas y el servidor arranca igual.

### QA / pruebas

```bash
npm run qa:install   # una sola vez: descarga Chromium para Playwright
npm run test:unit    # pruebas unitarias (Node test runner)
npm run test:e2e     # E2E app/landing (Playwright; levanta el server solo)
npm run test:qa      # unit + E2E local
```

Los specs que requieren Supabase o credenciales `QA_*` se omiten automáticamente. Detalle en [docs/QA-AUTOMATIZADO.md](docs/QA-AUTOMATIZADO.md).

## Marca

Logo: `public/brand/logo.png` · [docs/BRAND.md](docs/BRAND.md)

## Deploy

[docs/DEPLOY.md](docs/DEPLOY.md)

## Cursor

[AGENTS.md](AGENTS.md)
