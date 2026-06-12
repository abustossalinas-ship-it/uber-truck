# Cubik — WhatsApp Meta Cloud API

Integración **solo Meta** (sin Twilio). El bot responde automáticamente cuando un usuario escribe al número de Cubik.

## Arquitectura

```
Landing «Comenzar Ahora» → wa.me (mensaje precargado)
        ↓
Usuario envía en WhatsApp
        ↓
Meta Cloud API → POST /api/whatsapp/webhook
        ↓
Cubik (Node) → bot FAQ + escalamiento humano
```

| Pieza | Archivo |
|-------|---------|
| Webhook | `src/routes/whatsapp.js` |
| Cliente Graph API | `src/services/whatsapp-cloud.js` |
| Lógica bot / FAQ | `src/lib/whatsapp-bot.js` |
| Textos | `src/lib/whatsapp-copy.js` |
| wa.me landing | `src/lib/prospectos.js` |

## 1. Meta Business (una sola cuenta)

1. [business.facebook.com](https://business.facebook.com) → crear **Portfolio comercial Cubik**.
2. [developers.facebook.com](https://developers.facebook.com) → **Crear app** → tipo *Negocios* → WhatsApp.
3. En la app: **WhatsApp → API Setup**:
   - Agregar número de teléfono (el de Cubik, ej. +56 9 7141 9384).
   - Copiar **Phone number ID** y **WhatsApp Business Account ID**.
4. **Settings → Basic** → copiar **App Secret**.
5. Generar **token de acceso permanente** (System User en Business Settings con permiso `whatsapp_business_messaging`).

## 2. Webhook en Meta

En **WhatsApp → Configuration → Webhook**:

| Campo | Valor |
|-------|--------|
| Callback URL | `https://www.getcubik.cl/api/whatsapp/webhook` |
| Verify token | el mismo que `WHATSAPP_VERIFY_TOKEN` en Railway |
| Campos | `messages` |

Meta hará un `GET` de verificación; Cubik responde el `hub.challenge` si el token coincide.

## 3. Variables en Railway

```env
WHATSAPP_CLOUD_ENABLED=true
WHATSAPP_ACCESS_TOKEN=EAAxxxxx
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_VERIFY_TOKEN=un-string-largo-aleatorio
WHATSAPP_APP_SECRET=tu-app-secret
CUBIK_WHATSAPP_E164=56971419384
```

Verificar en producción:

- `GET https://www.getcubik.cl/health` → `whatsapp.active: true`
- `GET https://www.getcubik.cl/api/whatsapp/status`

## 4. Probar

1. Desde `getcubik.cl/empresas` → **Comenzar Ahora** (abre wa.me).
2. Envía el mensaje (o escribe «Hola»).
3. Debes recibir bienvenida + menú 1–5.
4. Prueba `1`, `precio`, `humano`.

## 5. Costos (Chile, referencia 2026)

Meta cobra por **mensaje plantilla** que tú inicias. En este flujo el usuario escribe primero (wa.me) → las respuestas del bot dentro de **24 h** son conversación de servicio → **sin costo Meta** en la mayoría de los casos.

| Escenario | Costo aprox. |
|-----------|----------------|
| Usuario escribe primero, bot responde en 24 h | $0 (servicio) |
| Tú envías plantilla marketing sin que escriban | ~USD 0.01–0.02/msg Chile |
| Plataforma Twilio u otro BSP | No usamos — evita markup extra |

**Recomendación:** mantener flujo *click-to-chat* (wa.me) para que el usuario inicie; el bot solo responde.

## 6. Escalamiento humano

Si el usuario escribe **humano**, **ejecutivo**, **soporte**, etc., el bot deja de automatizar y pide datos para un agente. Hoy se registra en logs del servidor; el agente responde desde **WhatsApp Business** en el mismo número.

Próximo paso opcional: notificar a `admin@getcubik.cl` o panel admin cuando `awaitingHuman`.

## 7. Checklist producción

- [ ] Número Cubik verificado en Meta (no personal)
- [ ] Webhook verificado (check verde en Meta)
- [ ] Variables en Railway
- [ ] `CUBIK_WHATSAPP_E164` = mismo número que Meta
- [ ] Deploy último commit
- [ ] Prueba end-to-end desde landing
