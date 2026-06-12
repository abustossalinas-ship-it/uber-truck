# Checklist Post-MVP — validación en orden

**Memoria:** v4.5.1 · **Software:** 0.0.129 · **Panel:** [/post-mvp-checklist.html](/post-mvp-checklist.html) · **API:** `GET /api/post-mvp/status`

## ¿Qué es esta lista?

- El **MVP de flujo** (publicar, emparejar, viaje, chat, multas, captación) está **cerrado** — ver memoria técnica, tabla «MVP final».
- Esta checklist es el **backlog post-MVP**: mejoras de piloto y escala que **no bloquean** demo ni piloto 25/50.
- Los ítems «Pendiente» o «Diferido» son **planificados**, no errores de deploy.

Validar y cerrar cada ítem **en orden** solo cuando negocio lo priorice.

---

## Orden de validación

| # | Ítem | Estado | Notas |
|---|------|--------|-------|
| 1 | Login Gmail / Apple | **Diferido** | Post-M2 — [AUTH-AND-EMAIL-ROADMAP.md](./AUTH-AND-EMAIL-ROADMAP.md) |
| 2 | Recuperar contraseña | **Código validado · piloto bloqueado** | Resend OK; multi-cuenta requiere dominio — [DOMAIN-AND-EMAIL.md](./DOMAIN-AND-EMAIL.md) |
| 2b | Política contraseña + cambio en app | **Cerrado** v0.0.128 | 8+ chars, mayúscula, número; APK Cuenta → Seguridad |
| 3 | Pago en app (prod) | Pendiente | Wallet real + ledger; hoy piloto simulado OK |
| 4 | Contacto en viaje | **Piloto cerrado sin Twilio** | Ver sección abajo — chat in-app + WhatsApp comercial |
| 4b | Voz enmascarada (Twilio) | Opcional P1 | Solo si quieren llamada PSTN tipo Uber desde el botón Llamar |
| 5 | Push FCM | **Cerrado** | Validado — 3 push en segundo plano |
| 6 | GPS background | Diferido | Spike Capacitor si >30% quejas GPS |
| 7 | App iOS nativa | Diferido | Hoy PWA `/probar` |
| 8 | Escrow en ruta | Bloqueado | Tras ítem 3 (wallet prod) |

---

## Ítem 4 — ¿Twilio obligatorio? ¿WhatsApp?

**No.** Twilio **no es obligatorio** para el piloto ni para operar como hace el mercado chileno.

| Canal | Uso en Cubik hoy | ¿Enmascara teléfonos? |
|-------|------------------|------------------------|
| **Chat in-app** | Coordinación embarcador ↔ transportista en viaje activo | Sí (no expone números en UI) |
| **WhatsApp Cubik** | Captación landing, FAQ bot, escalado a humano comercial | Número de marca Cubik |
| **Twilio Proxy** | Botón «Llamar» con voz PSTN enmascarada (estilo Uber) | Sí — **no configurado** |

### Qué hace la industria

En logística B2B Chile es **muy común** coordinar por **WhatsApp personal** (texto y notas de voz). Cubik **no replica** eso en el piloto para evitar bypass de la plataforma: el chat bloquea números y el botón Llamar no muestra teléfonos reales.

### Recomendación piloto 25/50

1. **Usar chat in-app** como canal principal en viaje (ya disponible).
2. **WhatsApp** solo vía número Cubik para leads, soporte y dudas comerciales — [WHATSAPP-META-CLOUD.md](./WHATSAPP-META-CLOUD.md).
3. **Twilio** solo si testers exigen **llamada de voz tradicional** desde el botón Llamar sin salir de la app (paridad Uber PSTN). Requiere `TWILIO_MATCH_PROXY_NUMBER` + cuenta Twilio.

Meta Cloud API **no ofrece** llamadas de voz enmascaradas entre dos usuarios como Twilio Proxy; las llamadas de WhatsApp son app-a-app y exponen identidad.

---

## Bloqueante piloto — correo (acción inmediata)

1. Comprar dominio libre (variante Cubik) — ver lista en [DOMAIN-AND-EMAIL.md](./DOMAIN-AND-EMAIL.md).
2. Verificar dominio en Resend (SPF/DKIM).
3. Railway: `EMAIL_FROM=Cubik <noreply@tudominio>`.
4. Probar reset a Gmail tester + corporativo.

---

## Comandos útiles

```bash
# Estado server-side
curl -s https://www.getcubik.cl/api/post-mvp/status | jq

# Health (mail configurado)
curl -s https://www.getcubik.cl/health | jq
```

---

## Variables Railway (por ítem)

| Ítem | Variables |
|------|-----------|
| 2 Recuperar clave | `RESEND_API_KEY`, `EMAIL_FROM` (dominio verificado) |
| 3 Wallet prod | `PAYMENT_PROVIDER=mercadopago`, `MERCADOPAGO_*` |
| 4b Twilio (opcional) | `TWILIO_MATCH_PROXY_NUMBER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` |
| 5 FCM | `FCM_SERVICE_ACCOUNT_B64` — [CUBIK-PUSH-FCM.md](./CUBIK-PUSH-FCM.md) |
| WhatsApp comercial | `WHATSAPP_*`, `CUBIK_WHATSAPP_E164` — [WHATSAPP-META-CLOUD.md](./WHATSAPP-META-CLOUD.md) |

---

## Cerrado en esta iteración

- **MVP flujo** — tabla core en memoria v4.5.
- **FCM** — push en segundo plano validado.
- **Contraseña fuerte** — backend + UI.
- **Contacto en viaje (piloto)** — chat in-app; WhatsApp comercial para captación/soporte.
- **Captación** — landing v3, prospectos, bot Meta, legal.

---

## Ritual semanal (opcional)

1. Abrir [/post-mvp-checklist.html](/post-mvp-checklist.html) → **Actualizar estado servidor**
2. Validar el **primer ítem no marcado** que no esté «Diferido»
3. Al cerrar: marcar en checklist + actualizar fila en `Memoria-tecnica-Uber-Truck.html`

Ver también: [PLAN-COMERCIAL-PILOTO.md](./PLAN-COMERCIAL-PILOTO.md) · [DOMAIN-AND-EMAIL.md](./DOMAIN-AND-EMAIL.md)
