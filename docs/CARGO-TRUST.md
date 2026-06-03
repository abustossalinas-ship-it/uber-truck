# Confianza y declaración de carga

**Versión:** cargo-trust-v1 · mayo 2026  
**Docs relacionados:** [Memoria técnica](./Memoria-tecnica-Uber-Truck.html) v3.3 · [Journey](./Journey-Usuario-Uber-Truck.html) v2.2 · [Probar testers](./Probar-Uber-Truck.html) v3

Uber Truck actúa como **intermediario** (marketplace). No es transportista ni asegurador salvo contrato futuro explícito.

## Campos al publicar carga

| Campo | Uso |
|-------|-----|
| `cargo_description` | Qué va en el camión (texto del embarcador) |
| `declared_cargo_value_clp` | Valor referencial CLP para seguro / límites entre partes |
| `has_dispatch_guide` | Si declara llevar guía de despacho o factura |
| `dispatch_guide_folio` | Folio o referencia DTE (opcional; sin validación SII en MVP) |
| `requires_cargo_insurance` | Flag de interés en seguro (piloto: manual) |
| `legal_terms_version` / `terms_accepted_at` | Aceptación de términos v1 |

## Incidentes

`POST /api/matches/:id/incidents` — robo, daño, faltante, atraso, otro. Estado inicial `open` (revisión manual).

## SQL

Ejecutar `supabase/migrations/011_cargo_trust.sql` en Supabase (o bloque en `RUN_PENDING.sql`).

## Términos legales

Documento para usuarios: [Terminos-Confianza-Carga-Uber-Truck.html](./Terminos-Confianza-Carga-Uber-Truck.html) (incluye **§9 checklist abogado** para piloto). Revisión legal externa antes de escala comercial.

## Próximas fases

- Subida de PDF guía (Storage)
- Integración DTE/guía SII vía facturador autorizado
- Microseguro por viaje
- KYC transportista en app
