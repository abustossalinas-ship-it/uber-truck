# Línea de tiempo — Cubik (Uber Truck)

**Una página · actualizado 19 jun 2026 · software v0.0.130**

---

## Origen (antes del código)

- **Nombre formal:** Optimización dinámica de capacidad logística ociosa (**Uber Truck**).
- **Tesis:** monetizar **backhaul** — cubicación libre en rutas ya planificadas, no solo “Uber de camiones”.
- **Documentos previos:** informe estratégico, kickoff, journey, Gantt, memoria técnica, modelo de negocio (en `docs/`).
- **Plan original del informe:** entrevistas → concierge WhatsApp + Airtable → MVP digital (ago–oct 2026).

---

## 25 mayo 2026 — Arranque de construcción

**Primer commit:** `142c64b` — *MVP Uber Truck: API, Supabase, Maps y web demo* (17:33, Chile).

**Primera instrucción en Cursor** ([sesión 25 may](0547069a-0005-47ab-bb23-4e605f461dca)):

> Dejar entrevistas para después. La idea nace de una entrevista: a las PYMEs les cuesta cotizar un **camión adicional mensual** por picos no cubicados o por no saber cuándo llegará el próximo pedido. **Avanzar con MVP funcional para mostrar.**

**Entregado ese día:**

| Pieza | Detalle |
|-------|---------|
| API | `load-requests`, `capacity-offers`, `matches` |
| Persistencia | JSON local (`data/store.json`) sin Supabase obligatorio |
| UI | Demo web: publicar carga, ofertar ruta, tablero emparejar |
| Problema | Documentado en kickoff: dolor de camión extra por falta de cubicación |

---

## 26 mayo — Flujo operativo y deploy

- Login JWT, seed demo, match automático sugerido.
- Cancelación en 3 fases, multas, chat y notificaciones.
- Deploy Railway (v0.0.2+), Supabase WebSocket en Node 20.

---

## 2–9 jun — Marca Cubik y app móvil

| Fecha | Hito |
|-------|------|
| **2 jun** | Marca **Cubik**, PWA, Capacitor Android (`v0.0.60`) |
| **2 jun** | Shell app: bottom nav, splash nativo (`v0.0.64`) |
| **9 jun** | Contraseña segura + cambio de clave en Cuenta |

---

## 11–16 jun — Captación, WhatsApp y compliance

| Fecha | Hito |
|-------|------|
| **11 jun** | Landing v3 (`/transportistas`, `/empresas`), CTAs demo |
| **11 jun** | Bot **WhatsApp Meta Cloud API** + FAQ |
| **16 jun** | Checklist **C3a** transportista (WhatsApp + admin) |
| **16 jun** | OCR CI/licencia, bloqueo por docs vencidos |
| **16 jun** | Onboarding piloto por rubros documentado |

---

## 17–19 jun — Wallet, Cuenta y QA

| Fecha | Hito |
|-------|------|
| **17–18 jun** | Registro transportista: RUT, patente obligatorios |
| **19 jun** | **Cubik Saldo** prod + escrow en ruta (piloto sandbox) |
| **19 jun** | Acordeón **Cuenta** (KYC, contraseña, multas, notificaciones, ayuda) |
| **19 jun** | Fix acordeón + QA obligatorio antes de push (`v0.0.130`) |

---

## Estado hoy

| Área | Estado |
|------|--------|
| **Prod** | https://www.getcubik.cl/app |
| **MVP flujo** | Cerrado (publicar → emparejar → viaje → cierre) |
| **App Android** | Capacitor híbrido + APK remoto (`/probar`) |
| **P0 operacional** | Dominio propio + Resend (reset clave, onboarding masivo) |
| **Piloto comercial** | 25 empresas + 50 transportistas (plan documentado) |

---

## Lectura recomendada

1. [Memoria técnica](./Memoria-tecnica-Uber-Truck.html) — backlog y Gantt vivo  
2. [Próximos pasos](./PROXIMOS-PASOS-ESTRATEGIA.md) — orden de implementación  
3. [Plan comercial piloto](./PLAN-COMERCIAL-PILOTO.md) — demo → piloto → escala  
4. [Kickoff original](./Kickoff-Uber-Truck.html) — concepto y preguntas MVP  

**Kickoff editable v0.1** (may 2026, commit inicial): `git show 142c64b:docs/KICKOFF.md`
