# Plan comercial — piloto y escala

**Software:** 0.0.129 · **May–Jun 2026**

Canvas interactivo (Gantt, costos, checklist nativo): `canvases/cubik-plan-native-escala.canvas.tsx`

## Fases

| Fase | Alcance | Stack | Infra aprox. |
|------|---------|-------|--------------|
| **Demo comercial** | Presentación may 2026 | Web prod + APK remoto | Railway actual |
| **Piloto** | 25 empresas + 50 transportistas | Capacitor híbrido + APK bundle firmado | ~USD 320/mes |
| **Escala** | 50+ empresas + 200 camiones | Híbrido + módulo nativo GPS si aplica | ~USD 2.100/mes |

## Mensaje comercial

1. **Hoy:** producto real en producción (no mockup).
2. **Piloto:** mismo stack, onboarding curado, KPIs M2 (20 viajes corredor RM–V).
3. **Escala:** presupuesto Maps/infra antes de crecer; nativo selectivo (GPS background), no rewrite completo.

**Onboarding por rubros, seguros y discurso captación:** [ONBOARDING-PILOTO-RUBROS.md](./ONBOARDING-PILOTO-RUBROS.md) — registro transportista/empresa (identidad, licencia, seguro acotado, rubros), **10 camiones/rubro**, empresas ancla plan B, pitches comerciales.

## Cuándo invertir en nativo (Kotlin/Swift)

- GPS confiable con app en background
- Más de ~40 camiones simultáneos en mapa en vivo
- Clientes exigen Play Store enterprise / MDM

## Qué NO prometer en demo

- App 100 % nativa reescrita
- Wallet real / escrow (siguiente fase tras piloto)
- Cobertura nacional día uno

## Prerrequisito piloto — correo transaccional

Antes de onboarding masivo (25/50), cerrar:

1. Comprar dominio libre (variante Cubik — `cubik.cl` y `cubik.com` ocupados).
2. Verificar dominio en Resend + `EMAIL_FROM` en Railway.
3. Probar reset de contraseña a Gmail y correo corporativo tester.

Detalle: [DOMAIN-AND-EMAIL.md](./DOMAIN-AND-EMAIL.md).

## Tareas pre-presentación

Ver checklist en canvas `cubik-plan-native-escala` → sección «Antes del jueves».

## Referencias

- [Piloto M2 KPIs](./Piloto-M2-Corredor-KPIs-Riesgos.html)
- [Journey usuario](./Journey-Usuario-Uber-Truck.html)
- [Próximos pasos](./PROXIMOS-PASOS-ESTRATEGIA.md)
