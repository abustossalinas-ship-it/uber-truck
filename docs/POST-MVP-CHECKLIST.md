# Checklist Post-MVP — validación en orden

**Memoria:** v4.4 · **Software:** 0.0.129 · **Panel:** [/post-mvp-checklist.html](/post-mvp-checklist.html) · **API:** `GET /api/post-mvp/status`

Validar y cerrar cada ítem **en el orden de la tabla Post-MVP** de la memoria técnica.

---

## Orden de validación

| # | Ítem | Estado | Notas |
|---|------|--------|-------|
| 1 | Login Gmail / Apple | **Diferido** | Post-M2 — [AUTH-AND-EMAIL-ROADMAP.md](./AUTH-AND-EMAIL-ROADMAP.md) |
| 2 | Recuperar contraseña | **Código validado · piloto bloqueado** | Resend OK a cuenta Resend; multi-cuenta requiere dominio — [DOMAIN-AND-EMAIL.md](./DOMAIN-AND-EMAIL.md) |
| 2b | Política contraseña + cambio en app | **Cerrado** v0.0.128 | 8+ chars, mayúscula, número; APK Cuenta → Seguridad |
| 3 | Pago en app (prod) | Pendiente | Wallet real + ledger; hoy piloto simulado OK |
| 4 | Twilio Proxy | Pendiente | `TWILIO_MATCH_PROXY_NUMBER` en Railway |
| 5 | Push FCM | **Cerrado** | Validado — 3 push en segundo plano (acciones viaje) |
| 6 | GPS background | Diferido | Spike Capacitor si >30% quejas GPS |
| 7 | App iOS nativa | Diferido | Hoy PWA `/probar` |
| 8 | Escrow en ruta | Bloqueado | Tras ítem 3 (wallet prod) |

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
curl -s https://uber-truck-production.up.railway.app/api/post-mvp/status | jq

# Health (mail configurado)
curl -s https://uber-truck-production.up.railway.app/health | jq

# Push de prueba (requiere Bearer)
curl -X POST https://uber-truck-production.up.railway.app/api/devices/push-test \
  -H "Authorization: Bearer TU_JWT" \
  -H "Content-Type: application/json" \
  -d '{"title":"Cubik","body":"Prueba"}'
```

---

## Variables Railway (por ítem)

| Ítem | Variables |
|------|-----------|
| 2 Recuperar clave | `RESEND_API_KEY`, `EMAIL_FROM` (dominio verificado) |
| 3 Wallet prod | `PAYMENT_PROVIDER=mercadopago`, `MERCADOPAGO_*` |
| 4 Twilio | `TWILIO_MATCH_PROXY_NUMBER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` |
| 5 FCM | `FCM_SERVICE_ACCOUNT_B64` — [CUBIK-PUSH-FCM.md](./CUBIK-PUSH-FCM.md) |

---

## Cerrado en esta iteración (may 2026)

- **FCM** — push en segundo plano validado en dispositivo físico.
- **Contraseña fuerte** — backend + UI registro/reset/cambio.
- **Cambiar clave en APK** — panel Seguridad en Cuenta.
- **Resend** — flujo forgot/reset en prod; errores visibles; cooldown 2 min.
- **SQL Supabase** — verificación 23/23 OK (`RUN_VERIFY_ALL_MIGRATIONS.sql`); migración 014 aplicada.

---

## Ritual semanal

1. Abrir [/post-mvp-checklist.html](/post-mvp-checklist.html) → **Actualizar estado servidor**
2. Validar el **primer ítem no marcado** que no esté «Diferido»
3. Al cerrar: marcar en checklist + actualizar fila en `Memoria-tecnica-Uber-Truck.html`

Ver también: [PLAN-COMERCIAL-PILOTO.md](./PLAN-COMERCIAL-PILOTO.md) · [DOMAIN-AND-EMAIL.md](./DOMAIN-AND-EMAIL.md)
