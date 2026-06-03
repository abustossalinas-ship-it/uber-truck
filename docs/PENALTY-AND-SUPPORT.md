# Multas y ayuda (tipo Uber / Uber Eats)

## Flujo de pago (v0.0.52)

| Estado | Quién actúa | Operar (publicar / ofertar / emparejar) |
|--------|-------------|----------------------------------------|
| `pending` | — | Sí, si no vencieron los 7 días |
| `overdue` (tiempo) | Deudor debe declarar pago | **No** |
| `claimed` | Deudor declaró pago | **No** hasta que acreedor confirme |
| `confirmed` | Acreedor confirmó | **Sí** |
| `disputed` | Acreedor rechazó | **No** |
| `confirm_expired` | Pasaron 24 h sin respuesta | **No** → caso a moderador |
| `settled_moderator` | Admin cierra | **Sí** |

1. Multa sugerida al cancelar.
2. **7 días** (`PENALTY_DUE_DAYS`) para pagar antes del bloqueo por vencimiento.
3. Deudor: **Declarar pago realizado** → acreedor tiene **24 h** (`PENALTY_CONFIRM_HOURS`) para confirmar o rechazar.
4. Sin confirmación en 24 h → `confirm_expired`, escalado a **moderador** (no se desbloquea solo).
5. Admin: **Cerrar por moderador** en cualquier momento.

## SQL (Supabase)

1. `RUN_022_023_SUPABASE.sql` — ayuda + columnas pagada (023)
2. `RUN_024_SUPABASE.sql` — estados de pago (024)

## Cuenta bancaria (producción)

En producción (`BANK_ENFORCE`, por defecto activo con Supabase) **no puedes publicar, ofertar ni emparejar** sin inscribir cuenta bancaria (titular, RUT, banco, tipo, número).

## Comprobante de transferencia

Al **declarar pago** solo el **deudor** (transportista o embarcador según el caso) adjunta captura JPG/PNG/WebP (máx. ~1,8 MB).

El **acreedor** (la contraparte) **no sube** comprobante: solo **visualiza** el adjunto y **confirma** o **rechaza** que el pago externo llegó a su cuenta (24 h).

SQL: `025_penalty_payment_proof.sql` / `RUN_025_SUPABASE.sql`

## API

- `POST /api/account/penalties/:matchId/claim-paid` — deudor (`note`, `proof_base64`, `proof_mime`)
- `GET /api/account/penalties/:matchId/payment-proof` — imagen (JWT)
- `POST /api/account/penalties/:matchId/confirm-payment` — acreedor
- `POST /api/account/penalties/:matchId/dispute-payment` — acreedor (`note` obligatorio)
- `POST /api/account/penalties/:matchId/mark-paid` — admin / moderador
- `GET /api/account/summary` — `pending_confirmations`, `operating_status.block_reason`

## GPS vs tablero

El GPS del transportista sigue activo con sesión. El interruptor solo controla visibilidad en el tablero.

## Pendiente — producción futura (tipo Uber)

**No implementado.** El MVP actual usa:

- Cuenta bancaria inscrita (titular, RUT, banco, número) para operar.
- Pago de multas **fuera de la app** + comprobante del deudor + confirmación del acreedor.

### Objetivo posterior

| Capacidad | Descripción |
|-----------|-------------|
| **Medios de pago in-app** | Tarjeta débito/crédito y/o cuenta vinculada validada por pasarela (Webpay Plus, Mercado Pago, Stripe u otro acuerdo Chile). |
| **Validación de tarjeta / cuenta** | Verificación al registrar (microcargo, tokenización, 3DS) como en Uber: el usuario no opera cargos automáticos sin medio verificado. |
| **Cobro integrado de multas** | Cargo automático o botón «Pagar multa» dentro de la app; al liquidar, desbloqueo sin depender de transferencia manual + comprobante. |
| **Wallet / saldo interno** (opcional) | Compensación entre partes en plataforma antes de retiro a banco. |

### Qué queda fuera del alcance actual

- Tokenización de tarjetas, webhooks de pasarela, conciliación contable.
- Desbloqueo automático al pagar por pasarela (hoy solo `confirmed` por acreedor o `settled_moderator`).

Referencia de diseño: [PENALTIES-AND-ACCOUNTS.md](./PENALTIES-AND-ACCOUNTS.md) fase C · [PROXIMOS-PASOS-ESTRATEGIA.md](./PROXIMOS-PASOS-ESTRATEGIA.md).

## Validación tipo Copec (tarjeta + identidad) — piloto M2

Hoy la app **no procesa tarjetas**: solo pide datos bancarios (transferencia) y valida presencia de campos con `BANK_ENFORCE`. **No hay validación real de PAN ni cruce RUT↔titular** con el emisor.

Para acercarse al flujo Copec (medio de pago verificado antes de operar):

| Paso | Qué hace | Proveedor típico Chile |
|------|----------|-------------------------|
| 1 | Usuario ingresa tarjeta en **formulario hospedado** (PCI) | Transbank Webpay Plus, Mercado Pago, Flow |
| 2 | Pasarela devuelve **token** (nunca guardar PAN en Cubik) | API del proveedor |
| 3 | **Microcargo** o autorización ($50–$990 CLP, luego reversa) | Webpay Oneclick / MP preapproval |
| 4 | Guardar `payment_method_verified_at` + últimos 4 dígitos | Tabla `user_payment_methods` (futuro) |
| 5 | RUT | Validación **módulo 11** en app + nombre titular declarado; cruce estricto RUT↔tarjeta solo con KYC del proveedor o manual en piloto |

**Importante:** validar que la tarjeta existe y puede cobrarse **solo** la puede hacer una pasarela certificada. Cubik no debe recibir ni almacenar el número completo de tarjeta.

### Camino recomendado para piloto

1. **Corto plazo (sin contrato Transbank aún):** mantener cuenta bancaria + comprobante en multas; opcional validar RUT con algoritmo en UI y revisión manual admin para cuentas nuevas.
2. **Mediano (bloque D):** contrato **Transbank Webpay Plus** o **Mercado Pago Checkout Pro / Customers** → endpoint `POST /api/account/payment-methods/enroll` → webhook confirma token → desbloquear `operating_status` igual que hoy con banco.
3. **Multas:** reutilizar el mismo token para botón «Pagar multa» (cargo único) y desbloqueo automático al `approved` del webhook.

Estimación implementación mínima pasarela: backend + webview/form redirect + webhook + migración SQL (~1–2 sprints según contrato comercial del proveedor).
