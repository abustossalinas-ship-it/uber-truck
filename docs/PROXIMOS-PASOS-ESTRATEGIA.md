# Próximos pasos estratégicos — Cubik / Uber Truck

Alineado al estado del repo (**25 may 2026**, software **0.0.98**).

## Principio

No perseguir la app perfecta en web: construir **operación tipo Uber** con marketplace **semi-curado**, tracking y evidencia. Piloto masivo (M2, 20 viajes) cuando la base operacional esté lista.

## Links operativos (testers)

| Uso | URL |
|-----|-----|
| **Landing testers** | https://uber-truck-production.up.railway.app/probar |
| **App directa** | https://uber-truck-production.up.railway.app/?app=1 |
| **APK Android** | `npm run android:apk` → `%USERPROFILE%\Downloads\cubik-android.apk` |
| **iPhone** | Solo link `/probar` + Safari «Añadir a inicio» (sin APK) |

## Orden de implementación

| # | Bloque | Estado |
|---|--------|--------|
| C | Semi-curado KYC (aprobar cuentas) | Hecho v0.0.33 |
| A | `trip_events` + SSE realtime en viajes | Hecho v0.0.33 |
| B | GPS + «Disponible» + mapa en viaje activo | Hecho v0.0.34 |
| G | **Cubik** — shell móvil + Capacitor Android bundle | **Hecho v0.0.94** — ver [CUBIK-APP-UX.md](./CUBIK-APP-UX.md) |
| G2 | Distribución testers sin tienda (`/probar` + APK) | **Hecho jun 2026** |
| G5 | Billetera multi-cuenta + RUT/bancos + cubicación carga | **Hecho v0.0.93–0.0.94** |
| G6 | Push FCM backend + registro token Android | **Backend OK** — validación `push-test` en teléfono pendiente |
| G3 | Play Store prueba cerrada «Cubik Envíos Chile» | **Siguiente opcional** — USD 25 |
| G4 | iOS TestFlight | **Futuro** — USD 99/año + Mac; hoy PWA |
| H | Piloto curado (5 carriers + 3 embarcadores) | Al final |
| — | Recuperación contraseña por email | Futuro — bloque E |
| D | Cubik Saldo + fees 10/5 + escrow en ruta | **Diseño cerrado** — implementación próxima semana; ver Memoria § monetización |
| D2 | Twilio Proxy (Llamar) | UI v0.0.98 lista; proxy semana siguiente |
| E | Login Gmail / Apple | Pendiente — [AUTH-AND-EMAIL-ROADMAP.md](./AUTH-AND-EMAIL-ROADMAP.md) |
| F | Panel admin KPIs | F1–F2 hecho v0.0.58 |

## Siguiente etapa inmediata (may–jun 2026)

1. **Cubik Saldo** — wallet, 10% embarcador + 5% transportista (cada rol ve solo su %), retención al **En ruta**, 20% saldo para publicar, tier ≥ $1M sin cash.
2. **Twilio Proxy** — llamadas enmascaradas (botón Llamar ya en v0.0.98).
3. **Checkout UX** — «Terminar y confirmar» tipo Uber Eats; ayuda «Cómo funciona el dinero».
4. **Piloto M2** — 20 viajes `completed` corredor RM ↔ Valparaíso/San Antonio.
5. **Push FCM** — confirmar recepción en celular físico.
6. **Cubik Plus Empresa** — suscripción vs descuento % (diseño; post-M2).

## Qué NO hacer aún

- App Store / Play producción abierta sin piloto M2
- OAuth / Resend sin priorizar viajes reales
- Marketplace abierto sin aprobación KYC

## Referencia

- [Memoria técnica](./Memoria-tecnica-Uber-Truck.html)
- [Journey](./Journey-Usuario-Uber-Truck.html)
- [Probar app](./Probar-Uber-Truck.html)
- [Play Store](./CUBIK-PLAY-STORE.md)
