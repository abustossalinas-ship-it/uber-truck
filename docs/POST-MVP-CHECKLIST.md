# Checklist Post-MVP — validación en orden

**Memoria:** v4.3 · **Panel interactivo:** [/post-mvp-checklist.html](/post-mvp-checklist.html) · **API:** `GET /api/post-mvp/status`

Validar y cerrar cada ítem **en el orden de la tabla Post-MVP** de la memoria técnica. El panel guarda tus marcas en `localStorage`; al cerrar un ítem en prod, actualiza también la memoria (celda `g-done`).

---

## Orden de validación

| # | Ítem | Cuándo cerrar | Acción |
|---|------|---------------|--------|
| 1 | Login Gmail / Apple | Post-M2 | **Diferido** — no prometer en demo. Doc: [AUTH-AND-EMAIL-ROADMAP.md](./AUTH-AND-EMAIL-ROADMAP.md) |
| 2 | Recuperar contraseña | Con Resend en Railway | App → ¿Olvidaste tu contraseña? → correo real → `reset-password.html` |
| 3 | Pago en app (prod) | Sem 2–8 piloto | Wallet real + ledger; hoy piloto simulado OK |
| 4 | Twilio Proxy | Sem 2–4 | `TWILIO_MATCH_PROXY_NUMBER` en Railway → Llamar en viaje activo |
| 5 | Push FCM | Sem 1–3 | **Hecho 10 jun 2026** — segundo plano, acciones de viaje |
| 6 | GPS background | Sem 4–9 si aplica | Spike Capacitor solo si >30% quejas GPS |
| 7 | App iOS nativa | Post escala | Hoy PWA `/probar` — cerrar como diferido |
| 8 | Escrow en ruta | Tras ítem 3 | Retención al «Marcar en ruta» — bloqueado hasta wallet prod |

---

## Comandos útiles

```bash
# Estado server-side (con JWT opcional para contar tokens FCM)
curl -s https://uber-truck-production.up.railway.app/api/post-mvp/status | jq

# Push de prueba (requiere Bearer de sesión)
curl -X POST https://uber-truck-production.up.railway.app/api/devices/push-test \
  -H "Authorization: Bearer TU_JWT" \
  -H "Content-Type: application/json" \
  -d '{"title":"Cubik","body":"Prueba"}'
```

---

## Variables Railway (por ítem)

| Ítem | Variables |
|------|-----------|
| 2 Recuperar clave | `RESEND_API_KEY`, `EMAIL_FROM` |
| 3 Wallet prod | `PAYMENT_PROVIDER=mercadopago`, `MERCADOPAGO_*` |
| 4 Twilio | `TWILIO_MATCH_PROXY_NUMBER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` |
| 5 FCM | `FCM_SERVICE_ACCOUNT_B64` — ver [CUBIK-PUSH-FCM.md](./CUBIK-PUSH-FCM.md) |

---

## Ritual semanal

1. Abrir [/post-mvp-checklist.html](/post-mvp-checklist.html) → **Actualizar estado servidor**
2. Validar el **primer ítem no marcado** que no esté «Diferido»
3. Al cerrar: marcar en checklist + actualizar fila en `Memoria-tecnica-Uber-Truck.html` + bitácora

Ver también: [PLAN-COMERCIAL-PILOTO.md](./PLAN-COMERCIAL-PILOTO.md) · canvas `cubik-plan-native-escala`
