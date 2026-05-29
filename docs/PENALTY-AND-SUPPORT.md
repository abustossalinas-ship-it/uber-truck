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

## API

- `POST /api/account/penalties/:matchId/claim-paid` — deudor
- `POST /api/account/penalties/:matchId/confirm-payment` — acreedor
- `POST /api/account/penalties/:matchId/dispute-payment` — acreedor (`note` obligatorio)
- `POST /api/account/penalties/:matchId/mark-paid` — admin / moderador
- `GET /api/account/summary` — `pending_confirmations`, `operating_status.block_reason`

## GPS vs tablero

El GPS del transportista sigue activo con sesión. El interruptor solo controla visibilidad en el tablero.
