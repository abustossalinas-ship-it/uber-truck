# Próximos pasos estratégicos — Cubik / Uber Truck

Alineado al estado del repo (**25 may 2026**, software **0.0.129**).

## Principio

No perseguir la app perfecta en web: construir **operación tipo Uber** con marketplace **semi-curado**, tracking y evidencia. Piloto masivo (M2, 20 viajes) cuando la base operacional esté lista. **Presentación comercial:** demo híbrida (web prod + APK remoto), no prometer rewrite nativo.

## Links operativos (testers)

| Uso | URL / comando |
|-----|----------------|
| **Landing testers** | https://uber-truck-production.up.railway.app/probar |
| **App directa** | https://uber-truck-production.up.railway.app/?app=1 |
| **APK remoto (prod)** | `npm run android:install:remote` |
| **APK bundle local** | `npm run android:apk` → `%USERPROFILE%\Downloads\cubik-android.apk` |
| **Laboratorio QA** | `npm run qa:lab` → `/qa-lab` |
| **iPhone** | Solo link `/probar` + Safari «Añadir a inicio» (sin APK) |

## Orden de implementación

| # | Bloque | Estado |
|---|--------|--------|
| C | Semi-curado KYC (aprobar cuentas) | Hecho v0.0.33 |
| A | `trip_events` + SSE realtime en viajes | Hecho v0.0.33 |
| B | GPS + «Disponible» + mapa en viaje activo | Hecho v0.0.34 |
| G | **Cubik** — shell móvil + Capacitor Android bundle | **Hecho v0.0.94+** |
| G2 | Distribución testers sin tienda (`/probar` + APK) | **Hecho** |
| G5 | Billetera multi-cuenta + RUT/bancos + cubicación carga | **Hecho v0.0.93–0.0.94** |
| G6 | Push FCM backend + registro token Android | **Cerrado** — validado en teléfono físico |
| **E3a** | **Contraseña fuerte + cambio en app** | **Cerrado v0.0.128** |
| **E3** | **Recuperar contraseña (Resend)** | **Código cerrado** — piloto multi-cuenta **bloqueado** sin dominio |
| **E0** | **Dominio + Resend verificado** | **P0 inmediato** — [DOMAIN-AND-EMAIL.md](./DOMAIN-AND-EMAIL.md) |
| **D0** | **Cubik Saldo piloto** — comisiones 10/5 | **Hecho v0.0.100–0.0.105** |
| **D0b** | **Calibración tarifas sugerencia flete** (RM–V) | **Hecho v0.0.105** |
| **Q1** | **QA automatizado** | **Hecho v0.0.107–0.0.125** |
| **N1** | **Notificaciones** — activos vs historial | **Hecho v0.0.125** |
| **SQL** | Verificación migraciones prod | **Cerrado** — 23/23 OK; 014 aplicada |
| **COM** | Plan comercial piloto 25/50 | Documentado |
| G3 | Play Store prueba cerrada | Opcional — USD 25 |
| G4 | iOS TestFlight | Futuro — hoy PWA |
| H | Piloto curado (5 carriers + 3 embarcadores) | Al final |
| D | Cubik Saldo **producción** — wallet real, escrow | **Siguiente** tras dominio/correo |
| D2 | Twilio Proxy (Llamar) | UI lista; proxy pendiente env |
| E | Login Gmail / Apple | Diferido — post-piloto |
| F | Panel admin KPIs | F1–F2 hecho v0.0.58 |

## Siguiente etapa inmediata (may–jun 2026)

1. **Dominio propio** — comprar variante Cubik; DNS Resend; `EMAIL_FROM` en Railway.
2. **Presentación comercial** — demo web prod + APK; guión [DEMO-GUION.md](./DEMO-GUION.md).
3. **Piloto comercial** — 25 empresas + 50 transportistas (onboarding curado).
4. **Wallet real + escrow en ruta** — retención al «En ruta».
5. **Twilio Proxy** — llamadas enmascaradas.
6. **Piloto M2** — 20 viajes `completed` corredor RM ↔ Valparaíso/San Antonio.

## Qué NO hacer aún

- App Store / Play producción abierta sin piloto M2
- Rewrite 100 % nativo sin tracción piloto
- OAuth sin priorizar dominio/correo y viajes reales
- Renombrar la app por `cubik.com` / `cubik.cl` ocupados

## Referencia

- [Dominio y correo](./DOMAIN-AND-EMAIL.md)
- [Memoria técnica](./Memoria-tecnica-Uber-Truck.html)
- [Auth y email](./AUTH-AND-EMAIL-ROADMAP.md)
- [Post-MVP checklist](./POST-MVP-CHECKLIST.md)
- [Plan comercial](./PLAN-COMERCIAL-PILOTO.md)
