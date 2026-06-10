# Cubik — Push notifications (FCM)

**Costo:** Firebase Cloud Messaging es **gratuito**.

**Estado piloto:** **Validado 10 jun 2026** — app Android en segundo plano; 3 notificaciones push de acciones de viaje recibidas en dispositivo físico.

## Backend v0.0.81+

| Componente | Detalle |
|------------|---------|
| SQL 027 | Tabla `device_tokens` |
| Registro | `POST /api/devices/push-token` (app Android al login) |
| Estado | `GET /api/devices/push-status` |
| Prueba | `POST /api/devices/push-test` (usuario logueado) |
| Envío auto | Al crear notificación in-app (oferta, chat, etc.) |

## Configurar en Railway (elige una)

### Opción A — HTTP v1 (recomendado)

1. Firebase Console → **Project settings** → pestaña **Service accounts** → **Generate new private key** (archivo `*-firebase-adminsdk-*.json`).
2. **No** uses `google-services.json` de Android (ese es otro archivo).
3. En tu PC, genera el valor para Railway:

```bash
node scripts/encode-fcm-service-account.cjs "C:\ruta\al-firebase-adminsdk-xxxxx.json"
```

4. Railway → Variables:
   - **Nombre:** `FCM_SERVICE_ACCOUNT_B64`
   - **Valor:** la línea BASE64 que imprime el script (una sola línea, sin comillas)
   - **Borra** `FCM_SERVICE_ACCOUNT_JSON` si la tenías mal (evita conflicto).
5. **Redeploy** y revisa `/health` → `fcm.configured: true`, `fcm.env.env_source: "FCM_SERVICE_ACCOUNT_B64"`.

Alternativa: `FCM_SERVICE_ACCOUNT_JSON` = el JSON **en una sola línea** (salida `JSON en una línea` del script).

Si el log dice `no empieza con { y no es base64 válido`, el valor pegado no es el service account (suele ser texto corrupto o el archivo equivocado).

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
