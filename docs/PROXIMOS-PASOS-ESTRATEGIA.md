# Próximos pasos estratégicos — Uber Truck

Alineado al documento *«Tu siguiente paso NO debería ser»* y al estado del repo (mayo 2026).

## Principio

No perseguir la app perfecta en web: construir **operación tipo Uber** con marketplace **semi-curado**, tracking y evidencia. Piloto masivo (M2, 20 viajes) cuando la base operacional esté lista.

## Orden de implementación

| # | Bloque | Estado |
|---|--------|--------|
| C | Semi-curado KYC (aprobar cuentas) | Hecho v0.0.33 |
| A | `trip_events` + SSE realtime en viajes | Hecho v0.0.33 |
| B | GPS + «Disponible» + mapa en viaje activo | Hecho v0.0.34 |
| — | Mis cargas / mis ofertas (`owner_user_id`) | Después de B |
| — | PWA instalable | Paralelo a móvil |
| — | React Native + Expo + TestFlight | Tras GPS en web/API |
| H | Piloto curado (5 carriers + 3 embarcadores) | Al final |
| — | Recuperación de contraseña por email (Resend + SQL 017) | **Futuro** — código en repo v0.0.38, no activar aún |

## Qué NO hacer aún

- Configurar Resend / `EMAIL_FROM` ni migración 017 (recuperación por correo)
- Marketplace abierto sin aprobación
- App Store / Play Store pública
- IA, pricing dinámico, pasarela obligatoria
- Piloto 20 viajes sin GPS ni evidencia de entrega

## Operación (rol del fundador)

1. Crear cuenta **admin** (`ADMIN_REGISTER_KEY`)
2. Aprobar en panel **Aprobación de cuentas** o SQL en `docs/SQL-SUPABASE.md`
3. Invitar 5 transportistas + 3 embarcadores del corredor RM ↔ V / San Antonio
4. WhatsApp solo para excepciones; la app para match, estados y tracking

## Referencia

- [Memoria técnica](./Memoria-tecnica-Uber-Truck.html)
- [SQL Supabase](./SQL-SUPABASE.md)
- [Journey](./Journey-Usuario-Uber-Truck.html)
