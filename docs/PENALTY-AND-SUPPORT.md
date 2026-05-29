# Multas y ayuda (tipo Uber / Uber Eats)

## Cómo lo hace Uber (referencia)

| Etapa | Uber / Uber Eats (simplificado) |
|--------|----------------------------------|
| Incumplimiento | Cancelación con motivo; a veces cargo al restaurante o al repartidor según quién falló |
| Cobro | No siempre automático al instante; disputa en app → **Soporte** revisa tickets |
| Bloqueo | Cuenta puede quedar **limitada** (no nuevos pedidos/viajes) mientras hay deuda o investigación |
| Resolución | Chat o formulario con **moderador humano**; acuerdo, reembolso parcial o perdón |

Uber Truck en piloto replica la **idea**, no el cobro integrado:

1. **Multa sugerida** al cancelar (por motivo y fase).
2. **Plazo 7 días** (`PENALTY_DUE_DAYS`) para regularizar entre partes.
3. Tras vencimiento → **bloqueo operativo** (no publicar carga, oferta ni emparejar). El **GPS del transportista sigue activo** con sesión (mapa en viaje).
4. **Caso de ayuda** auto-abierto si hay multa; chat con rol **moderador** (admin).
5. **Marcar multa pagada** (admin): desbloquea si no quedan otras deudas vencidas.

## Reglas en Uber Truck

- Deudor según motivo: ver `DEBTOR_BY_REASON` en `src/lib/penalty-ledger.js`.
- Embarcador y transportista pueden deber multas según el caso.
- Cobro automático: **no** (fase posterior + cuenta bancaria).
- Reputación: mensaje registrado; strikes automáticos en hito futuro.

## SQL (Supabase)

Ejecutar **`supabase/migrations/RUN_022_023_SUPABASE.sql`** (022 ayuda + 023 multa pagada).

## GPS vs «visible en tablero»

| Concepto | Uso |
|--------|-----|
| **GPS** | Siempre con sesión transportista (viaje en curso, última posición). |
| **Visible en tablero** | Interruptor `is_available`: solo para que embarcadores te encuentren cuando buscas carga nueva. |

## API

- `GET /api/account/summary` — incluye `operating_status.blocked` y `paid_history`.
- `POST /api/account/penalties/:matchId/mark-paid` — admin; body opcional `{ note }`.
- `POST /api/support/cases` — abrir revisión ligada a un `match_id`.
- `GET/POST /api/support/cases/:id/messages` — hilo con moderador.
