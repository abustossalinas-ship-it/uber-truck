# QA automatizado — Cubik

**Software:** 0.0.129 · **May 2026**

## Preparación (una sola vez)

```
npm install
npm run qa:install   → descarga Chromium para Playwright (E2E)
```

Sin Chromium instalado, `npm run test:e2e` / `npm run test:qa` fallan al lanzar el navegador.

## Flujo obligatorio antes de deploy

```
1. npm run dev          → probar cambio en local
2. npm run test:qa      → unit + E2E local (landing, app, piloto)
3. npm run test:qa:prod → smoke contra www.getcubik.cl (opcional pre-push)
4. git push main        → Railway despliega solo si CI/QA pasó
```

No hacer push a `main` sin `npm run test:qa` en verde.

## Resumen

| Capa | Herramienta | Comando |
|------|-------------|---------|
| Unitarios | Node test runner | `npm run test:unit` |
| E2E app | Playwright (Pixel 5) | `npm run test:e2e` |
| Smoke prod | Playwright → www.getcubik.cl | `npm run test:e2e:prod` |
| Suite completa | Script orquestador | `npm run test:qa` |
| CI | GitHub Actions | workflow `QA` en push/PR a `main` |
| Panel visual | Laboratorio QA | `npm run qa:lab` → `/qa-lab` |
| Reporte gráfico | Playwright HTML | `npm run qa:report` |

## Laboratorio QA (recomendado para ver el set)

```bash
npm run qa:lab
```

Abre **http://127.0.0.1:3001/qa-lab** con:

- Gráficos de torta (unit/E2E, obligatorio/opcional, áreas funcionales)
- Barras por suite
- Torta de última corrida (tras `npm run test:e2e`)
- Enlaces al reporte Playwright

## Estructura de tests

| Ruta | Qué cubre |
|------|-----------|
| `tests/auth-ui-syntax.test.js` | Sintaxis `auth-ui.js` (bloquea login APK) |
| `tests/android-bundle-sync.test.js` | Bundle Android vs `public/` |
| `tests/notification-visibility.test.js` | Notificaciones obsoletas |
| `tests/trip-proximity.test.js` | GPS proximidad embarcadero/destino |
| `e2e/app-welcome.spec.js` | Welcome + login |
| `e2e/landing-pilot.spec.js` | Portada getcubik + /probar + atrás sin overlay |
| `e2e/app-authed.spec.js` | Navegación con sesión mock |
| `e2e/app-board.spec.js` | Tablero + Supabase (opcional) |
| `e2e/prod-smoke.spec.js` | Smoke Railway |

## Credenciales opcionales (`.env`)

```
QA_CARRIER_EMAIL=...
QA_CARRIER_PASSWORD=...
```

Activa 3 tests E2E adicionales (login real + demo seed). Sin estas variables ni Supabase, esos specs (`app-board`, login real) se **omiten** automáticamente; el resto pasa contra el servidor local que Playwright levanta solo.

## Probar la app en el navegador local

El backend local sin Supabase usa `data/store.json` y no exige login (ver [README](../README.md#desarrollo-local)). Para que `http://localhost:3001/app` hable con ese backend local y no con producción, ejecuta en la consola del navegador (y tras cada reload):

```js
window.CUBIK_BRAND.productionUrl = location.origin;
```

Motivo: `public/brand-config.js` + `public/api-base.js` redirigen los `fetch` de `/api` y `/health` a `getcubik.cl` salvo que el origen coincida (necesario para el APK Capacitor).

## Android vs Playwright

- **Playwright** prueba la UI web/APK remoto (misma JavaScript).
- **JUnit/MockK/Espresso** solo aplican a código Kotlin nativo (hoy mínimo en Capacitor).
- Ver plan híbrido vs nativo: [PLAN-COMERCIAL-PILOTO.md](./PLAN-COMERCIAL-PILOTO.md).

## Referencias

- [Memoria técnica](./Memoria-tecnica-Uber-Truck.html)
- [Probar app](./Probar-Uber-Truck.html)
