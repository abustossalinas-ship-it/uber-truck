# Política de cancelación de emparejamientos (MVP)

Las multas son **sugeridas** y quedan registradas para acuerdo entre partes. Uber Truck **no cobra automáticamente** en esta fase. Algunos motivos **afectan reputación** (registro + mensaje al usuario; strikes automáticos en hito futuro).

## Regla central

| Etapa | ¿Mercadería en camión? | Transportista cancela | Embarcador cancela |
|-------|------------------------|------------------------|-------------------|
| **Aceptado** | No (aún no «En ruta») | Sí, con motivo y multa posible | Sí |
| **En ejecución** | Sí | **No** (usa incidente o acuerdo mutuo) | Solo casos graves / mutuo |

## Plazo de retiro

- Si la carga tiene `needed_by`, ese es el plazo.
- Si no, SLA según urgencia: urgente 24 h, normal 48 h, flexible 120 h desde aceptación del match.
- Embarcador puede usar «Transportista no cumplió el plazo» solo cuando el plazo **ya venció** y el viaje sigue en **Aceptado** (sin «En ruta»).

## Fase 1 — Retirar propuesta (solo *Propuesto*, embarcador)

| Motivo | Multa sugerida |
|--------|----------------|
| Me equivoqué de oferta | Ninguna |
| Apareció oferta mejor | Ninguna |
| Cambió fecha/urgencia | Ninguna |
| Propuesta duplicada | Ninguna |
| Otro (detalle) | Revisión manual |

**Límite:** hasta 8 retiros por la misma carga en 24 h (anti-abuso).

## Fase 2 — Rechazar (solo *Propuesto*, transportista)

| Motivo | Multa sugerida |
|--------|----------------|
| Ruta no calza | Ninguna |
| Espacio ya asignado | Ninguna |
| Precio bajo piso | Ninguna |
| Otro (detalle) | Revisión manual |

## Fase 3 — *Aceptado* (antes de «Marcar en ruta»)

| Motivo | Quién | Multa / reputación |
|--------|-------|-------------------|
| Acuerdo mutuo | Ambos | Ninguna — requiere confirmación de ambas partes |
| Embarcador cambia planes | Embarcador | 15 % (mín. $30.000) · reputación |
| Transportista no puede cumplir | Transportista | 10 % (mín. $20.000) · reputación |
| No llegará al plazo (antes retiro) | Transportista | 12 % (mín. $25.000) · reputación |
| No cumplió plazo (vencido, sin en ruta) | Embarcador | 15 % (mín. $30.000) al carrier · reputación |
| No show al retiro | Embarcador | 20 % (mín. $40.000) · reputación |
| Desacuerdo de precio | Ambos | Mediación |
| Fuerza mayor | Ambos | Ninguna (detalle obligatorio) |
| Otro | Ambos | Revisión manual |

## Fase 4 — *En ejecución* (carga en ruta)

| Motivo | Quién | Notas |
|--------|-------|--------|
| Acuerdo mutuo | Ambos | Sin multa si ambos confirmaron |
| Embarcador cancela en ruta | Embarcador | 25 % (mín. $50.000) · reputación |
| Falla grave / no entregó | Embarcador | 20 % (mín. $40.000) · reputación |
| Fuerza mayor | Embarcador | Sin multa sugerida (detalle) |
| Otro grave en ruta | Embarcador | Revisión manual |

**Transportista:** no hay botón de cancelar; usar **Reportar incidente** o acuerdo mutuo vía embarcador.

## Próximos hitos (no MVP)

- Cobro / garantía integrada.
- Strikes automáticos en reputación tras cancelaciones con multa.
- Campo obligatorio `needed_by` en formulario de carga.
