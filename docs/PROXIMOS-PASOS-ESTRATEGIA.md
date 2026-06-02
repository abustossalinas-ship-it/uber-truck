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
| G | **Cubik** — PWA + Capacitor → Play prueba cerrada | **En curso v0.0.60** — ver [CUBIK-PLAY-STORE.md](./CUBIK-PLAY-STORE.md) |
| H | Piloto curado (5 carriers + 3 embarcadores) | Al final |
| — | Recuperación de contraseña por email (Resend + SQL 017) | **Futuro** — código en repo v0.0.38, no activar aún (parte del bloque E) |
| D | Pagos in-app tipo Uber (validar tarjeta/cuenta, cobro multas integrado) | **Pendiente producción** — hoy: banco inscrito + pago externo + comprobante; ver [PENALTY-AND-SUPPORT.md](./PENALTY-AND-SUPPORT.md) |
| E | Login con **Gmail (Google)** y **Apple** + correo transaccional | **Pendiente producción** — hoy solo email/contraseña; ver [AUTH-AND-EMAIL-ROADMAP.md](./AUTH-AND-EMAIL-ROADMAP.md) |
| F | **Panel admin** — viajes, KPIs marketplace, NPS/★, corredor piloto | **F1–F2 hecho v0.0.58** — KPIs + tabla viajes; NPS import en roadmap |

## Qué NO hacer aún

- Configurar Resend / `EMAIL_FROM` ni migración 017 (recuperación por correo)
- OAuth Google (Gmail) / Sign in with Apple en login (bloque E — documentado, no desarrollar aún)
- Marketplace abierto sin aprobación
- App Store / Play Store pública
- IA, pricing dinámico
- Pasarela / validación de tarjetas / cobro automático de multas (bloque D — documentado, no desarrollar aún)
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
