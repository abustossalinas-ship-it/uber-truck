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

## 0. Configuración básica de la app (obligatorio antes del webhook)

En **Configuración de la app → Básica**, completa y **Guardar cambios**:

| Campo Meta | Valor Cubik |
|------------|-------------|
| Dominios de la app | `getcubik.cl` y `www.getcubik.cl` |
| URL política de privacidad | `https://www.getcubik.cl/privacidad` |
| URL términos del servicio | `https://www.getcubik.cl/terminos` |
| Eliminación de datos | `https://www.getcubik.cl/privacidad#eliminacion` |
| Categoría | Negocios |
| Ícono | logo Cubik 1024×1024 (puedes usar `/brand/logo-mark.png` escalado) |
| Contacto delegado protección datos | Nombre Cubik, `admin@getcubik.cl`, Chile |

**No necesitas publicar la app en modo Live** para probar el webhook con la cuenta **Test** de WhatsApp. Basta con guardar la configuración básica y dejar la app en **Desarrollo**.

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

## 8. WhatsApp vs Twilio — comunicación en viaje

| Pregunta | Respuesta |
|----------|-----------|
| ¿Las llamadas en viaje deben ser Twilio? | **No** para el piloto. Twilio es **opcional** (voz PSTN enmascarada estilo Uber). |
| ¿Se puede coordinar por WhatsApp? | **Sí**, como hace el mercado — pero el canal Cubik en viaje es el **chat in-app** (no expone números). |
| ¿Para qué sirve WhatsApp en Cubik? | **Captación** (landing wa.me), **FAQ bot**, **soporte comercial** al número Cubik. |
| ¿WhatsApp reemplaza Twilio? | **No** para voz enmascarada API→API. Las llamadas de WhatsApp son entre apps con identidad visible. |

**Piloto recomendado:** embarcador y transportista coordinan en el **chat del match**. Dudas comerciales o leads → WhatsApp Cubik. Activar **Twilio Proxy** solo si el piloto exige botón «Llamar» con teléfono tradicional sin mostrar números reales.

Ver [POST-MVP-CHECKLIST.md](./POST-MVP-CHECKLIST.md) ítem 4.

## 9. El bot no responde — qué revisar

### ¿Hay que “activar” algo?

**No hay código secreto.** El bot se activa cuando **tú escribes primero** al número (o abres wa.me desde la landing). Eso abre la **ventana de 24 horas** de Meta para respuestas gratis.

| Acción | ¿Activa el bot? |
|--------|----------------|
| Abrir wa.me y enviar el mensaje | Sí |
| Escribir `Hola` al número test | Sí |
| Esperar sin escribir | No — nadie inicia la conversación |
| Cubik te escribe primero (plantilla) | Requiere plantilla aprobada en Meta (no usamos en piloto) |

### Por qué a veces respondió y después no

1. **Token de Meta expirado** — los tokens temporales de Developers duran ~24 h. Si pasó un día, el webhook recibe tu mensaje pero **falla al enviar** la respuesta. Solución: token **permanente** (System User) en Railway → `WHATSAPP_ACCESS_TOKEN`.

2. **Cada deploy en Railway borra la “memoria” del bot** — las sesiones viven en RAM. No impide responder, pero si escribes solo `1` tras un deploy puede repetir bienvenida en lugar de FAQ. Escribe **`Hola`** o el mensaje completo de wa.me de nuevo.

3. **Número de prueba Meta (“Test Number”)** — solo responde a teléfonos **agregados como testers** en Meta Developers → WhatsApp → API Setup → “To” / phone numbers. Tu celular debe estar en la lista.

4. **Menú numérico** — responde a `1`, `2`, … `5` o `1️⃣`…`5️⃣`. Texto libre fuera del menú → el bot repite opciones o pide *humano*.

5. **Ventana 24 h cerrada** — si no escribes en 24 h, el bot no puede contestar con mensajes libres hasta que **vuelvas a escribir tú** (reabre ventana).

6. **Escalado humano** — si antes escribiste *humano*, el bot solo acusa recibo hasta que un agente responda desde WhatsApp Business.

### Comprobar que el servidor está OK

```bash
curl -s https://www.getcubik.cl/api/whatsapp/status | jq
curl -s https://www.getcubik.cl/health | jq .whatsapp
```

Debe mostrar `"active": true`. Si el bot sigue mudo, revisa **logs de Railway** buscando `[whatsapp] Error` (token inválido, número no autorizado, etc.).

### Prueba rápida (desde cero)

1. Desde getcubik.cl/empresas → **Comenzar ahora** (wa.me).
2. Envía el mensaje precargado (una sola vez).
3. Debes recibir **bienvenida + menú**.
4. Responde **`1`** (solo el número).
5. Debes recibir la FAQ + menú otra vez.

Si el paso 3 falla → token Meta, webhook o teléfono no autorizado en test.
