# Guión demo comercial — Cubik

**Software:** 0.0.129 · **16 jun 2026** · Duración sugerida: **15–20 min**

## Antes de empezar

- Web prod: https://uber-truck-production.up.railway.app/?app=1
- APK remoto en teléfono: `npm run android:install:remote` (o link `/probar`)
- Dos cuentas listas: embarcador + transportista
- **No prometer:** app 100 % nativa, wallet real, cobertura nacional día uno

## Apertura (2 min)

> Cubik conecta empresas que necesitan mover carga con transportistas que tienen camión disponible en la ruta — como Uber, pero para flete. Hoy está en **producción real** en Railway, con app Android instalable y QA automatizado.

## Problema (2 min)

- Camiones vuelven vacíos; embarcadores no encuentran capacidad confiable.
- WhatsApp y planillas no escalan ni dejan trazabilidad.

## Demo en vivo (10 min)

| Paso | Rol | Qué mostrar |
|------|-----|-------------|
| 1 | Embarcador | Publicar carga — Maps, presupuesto sugerido, urgencia |
| 2 | Transportista | Ofertar ruta compatible |
| 3 | Ambos | Emparejar → aceptar precio → viaje activo |
| 4 | Ambos | Chat ruta + «Marcar en ruta» + mapa/GPS |
| 5 | Embarcador | Completar → **Pagar con Cubik Saldo (piloto)** |
| 6 | Transportista | Campana «Embarcador pagó» + badge cobro |
| 7 | Opcional | Cuenta → Cubik Saldo piloto · calificación mutua |

**Tip:** alternar web (proyector) y APK (teléfono) para mostrar paridad híbrida.

## Piloto propuesto (3 min)

| Fase | Alcance | Stack |
|------|---------|-------|
| Piloto | 25 empresas + 50 transportistas | Capacitor + APK firmado |
| Corredor | RM ↔ Valparaíso / San Antonio | 20 viajes M2 |
| Escala | 50+ empresas, 200 camiones | Híbrido + nativo GPS si aplica |

Detalle: [PLAN-COMERCIAL-PILOTO.md](./PLAN-COMERCIAL-PILOTO.md) · canvas `cubik-plan-native-escala`.

## Diferenciadores técnicos (2 min)

- Paridad UX Uber adaptada a carga
- QA: Playwright + Laboratorio `/qa-lab` + CI GitHub
- Notificaciones inteligentes (activas vs historial)
- Take rate dual 10/5 ya simulado en piloto

## Cierre y próximos pasos (1 min)

1. Onboarding curado piloto
2. Wallet real + escrow (post-piloto)
3. KPIs semanales — match rate, viajes completados, NPS

## Preguntas frecuentes

| Pregunta | Respuesta |
|----------|-----------|
| ¿Es nativa? | Híbrida Capacitor hoy; nativo selectivo (GPS background) si escala lo exige |
| ¿Cobra la app? | Piloto simula 10% embarcador + 5% transportista; wallet real en roadmap |
| ¿Cobertura? | Piloto en un corredor; expansión con datos de liquidez |

## Referencias

- [Journey usuario](./Journey-Usuario-Uber-Truck.html)
- [Memoria técnica](./Memoria-tecnica-Uber-Truck.html)
- [Probar app](./Probar-Uber-Truck.html)
