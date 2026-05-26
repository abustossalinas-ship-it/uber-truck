# Multas sugeridas, cuentas pendientes y cobro (diseño)

Hoy las multas son **sugeridas** y se registran en el match al cancelar (`penalty_amount_clp`, `reason_code`). **No hay cobro automático** en MVP.

## Objetivo

1. **Recuadro «Cuenta y multas»** (con sesión): lo que debes, lo que te deben, plazos y días de atraso.
2. **Notificaciones**: mismo resumen arriba del listado (multas + plazo).
3. **Cuenta bancaria obligatoria** antes de **generar un cargo** formal (fase siguiente); sin banco no se emite cobro a pasarela.

## Quién debe a quién (por motivo)

| Motivo (`reason_code`) | Deudor |
|------------------------|--------|
| `shipper_change_plans` | Embarcador |
| `shipper_cancel_in_transit` | Embarcador |
| `carrier_unavailable` | Transportista |
| `carrier_no_show` | Transportista |
| `mutual_agreement` | Nadie (sin multa) |

El acreedor es la contraparte del emparejamiento (empresa embarcador ↔ transportista en el match).

## Plazo (deadline)

- **Días para pagar:** 7 desde la cancelación (`updated_at` del match).
- **Estado:** `pending` (dentro de plazo), `overdue` (vencido).
- Configurable luego vía `PENALTY_DUE_DAYS` en servidor.

## Cuenta bancaria (Chile)

Campos en `users` (migración `008`):

- Titular, RUT, banco, tipo cuenta, número.
- `bank_registered_at` cuando está completo.

**Regla:** `can_generate_charge = false` si falta banco; la UI muestra aviso y formulario. El botón «Generar cargo» (fase 4) queda deshabilitado hasta completar.

## Fases de implementación

| Fase | Qué |
|------|-----|
| **A (ahora)** | Resumen desde matches cancelados + recuadro + bloque en notificaciones |
| **B** | Tabla `penalty_charges`, estados `suggested → pending → paid` |
| **C** | Integración pasarela (Webpay / transferencia) + bloqueo por mora |

## API

- `GET /api/account/summary` — JWT, resumen multas y banco.
- `PATCH /api/account/bank` — JWT, guardar datos bancarios.

Ver memoria técnica HTML — fase 2.10 multas/cobros y tabla de próximos pasos.
