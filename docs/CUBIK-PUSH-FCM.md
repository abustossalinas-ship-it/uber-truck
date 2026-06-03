# Cubik — Push notifications (FCM)

**Costo:** Firebase Cloud Messaging es **gratuito**.

## Backend v0.0.81

| Componente | Detalle |
|------------|---------|
| SQL 027 | Tabla `device_tokens` |
| Registro | `POST /api/devices/push-token` (app Android al login) |
| Estado | `GET /api/devices/push-status` |
| Prueba | `POST /api/devices/push-test` (usuario logueado) |
| Envío auto | Al crear notificación in-app (oferta, chat, etc.) |

## Configurar en Railway (elige una)

### Opción A — HTTP v1 (recomendado)

1. Firebase Console → Project Settings → **Service accounts** → Generate new private key.
2. Copia el JSON completo.
3. Railway variable: `FCM_SERVICE_ACCOUNT_JSON` = JSON en una línea **o** base64 del JSON.

### Opción B — Legacy server key

1. Firebase → Cloud Messaging → **Server key** (si existe en tu proyecto).
2. Railway: `FCM_SERVER_KEY=...`

## Android

1. `google-services.json` en `android/app/` (package `cl.cubik.logistics`).
2. Rebuild APK: `npm run cap:sync:bundle` + `npm run android:apk`.
3. Abrir app → login → permiso notificaciones.

## Probar push

```bash
# Con JWT de sesión
curl -X POST https://uber-truck-production.up.railway.app/api/devices/push-test \
  -H "Authorization: Bearer TU_JWT" \
  -H "Content-Type: application/json" \
  -d '{"title":"Cubik","body":"Prueba push"}'
```

O desde la app: login en Android, luego llamar push-test (futuro botón admin).

## Health

`GET /health` → `"fcm": { "configured": true, "mode": "v1", "project_id": "..." }`
