# Memoria técnica — Uber Truck

| Campo | Valor |
|-------|--------|
| **Versión documento** | 2.0 |
| **Versión software** | 0.0.19 |
| **Fecha** | Mayo 2026 |
| **Estado** | MVP digital en producción (adelanto vs Gantt planificado) |
| **Producción** | https://uber-truck-production.up.railway.app |
| **Health** | `GET /health` |
| **Índice docs** | [00-INDICE-DOCUMENTACION.md](./00-INDICE-DOCUMENTACION.md) |
| **Canvas avance** | `canvases/estado-avance.canvas.tsx` (Cursor) |
| **SQL** | [SQL-SUPABASE.md](./SQL-SUPABASE.md) |

---

## 1. Resumen ejecutivo

Uber Truck conecta **capacidad ociosa en ruta** (transportista) con **carga incidental** (embarcador / PYME). El MVP digital valida emparejamiento, cancelación con política de multas sugeridas, chat, notificaciones y resumen de cuenta — **sin cobro automático** aún.

---

## 2. Arquitectura

| Capa | Tecnología | Estado |
|------|------------|--------|
| Frontend | HTML/JS `public/` | ✅ Producción |
| API | Node 20 + Express 4 | ✅ |
| Datos | Supabase PostgreSQL / JSON local | ✅ Supabase prod |
| Auth | JWT + tabla `users` | ✅ |
| Deploy | Railway + GitHub `main` | ✅ |
| Maps | Google Maps (opcional) | ✅ si `GOOGLE_MAPS_API_KEY` |
| Pagos / cobro multas | Pasarela (futuro) | ⏳ Diseño |

```
Cliente (navegador)
    → Railway (Express)
        → Supabase (loads, offers, matches, users, comms)
        → JSON store (fallback local)
```

---

## 3. API implementada (resumen)

| Área | Rutas |
|------|--------|
| Auth | `POST /api/auth/register`, `login`, `GET /me` |
| Cargas | `GET/POST /api/load-requests`, sugerencias match |
| Ofertas | `GET/POST /api/capacity-offers` |
| Matches | `GET/POST /api/matches`, `PATCH .../status`, `POST .../mutual-cancel`, `GET /cancel-options` |
| Comunicación | `GET/POST /api/comms/:id/messages`, notificaciones |
| Cuenta | `GET /api/account/summary`, `PATCH /api/account/bank` |
| Ops | `GET /health`, `POST /api/demo/seed` |

Detalle políticas: [MATCH-CANCEL-POLICY.md](./MATCH-CANCEL-POLICY.md), [PENALTIES-AND-ACCOUNTS.md](./PENALTIES-AND-ACCOUNTS.md).

---

## 4. Modelo de datos (tablas activas)

| Tabla | Uso |
|-------|-----|
| `users` | Auth, rol, KYC, **datos bancarios** (008) |
| `load_requests` | Demanda embarcador |
| `capacity_offers` | Oferta transportista |
| `matches` | Emparejamiento + cancelación + multas + acuerdo mutuo |
| `match_messages` | Chat por match |
| `match_notifications` | Campana in-app |
| `penalty_charges` | Cargos formales (futuro cobro) |

Migraciones: `supabase/migrations/` · ejecutar [SQL-SUPABASE.md](./SQL-SUPABASE.md).

---

## 5. Funcionalidades MVP (checklist)

| Funcionalidad | Estado |
|---------------|--------|
| Publicar carga / oferta + Maps | ✅ |
| Tablero emparejar + sugerencias | ✅ |
| Estados match (proposed → accepted → in_progress → completed) | ✅ |
| Cancelar con motivos y multas sugeridas | ✅ |
| Acuerdo mutuo bilateral (modal) | ✅ |
| Chat + mensajes rápidos | ✅ |
| Notificaciones (JWT, sin sesión no muestra) | ✅ |
| Recuadro cuenta y multas + plazo 7 días | ✅ |
| Cuenta bancaria (guardar, obligatoria para cobro futuro) | ✅ API |
| Mis cargas / ofertas por usuario | ⏳ Roadmap 2.4–2.9 |
| Cobro automático multas | ⏳ Fase 2.10e |

---

## 6. Seguridad

- Secretos en `.env` (nunca en git).
- Notificaciones y resumen cuenta requieren **JWT**.
- Multas: registro sugerido; cobro solo con banco + pasarela (pendiente).

---

## 7. Repositorio

Ver [AGENTS.md](../AGENTS.md) y `.cursor/rules/project-core.mdc`.

---

## 8. Enlaces rápidos (memoria y anexos)

| Recurso | Enlace |
|---------|--------|
| Índice documentación | [00-INDICE-DOCUMENTACION.md](./00-INDICE-DOCUMENTACION.md) |
| Gantt HTML (detalle) | [Gantt-Uber-Truck.html](./Gantt-Uber-Truck.html) |
| Journey | [Journey-Usuario-Uber-Truck.html](./Journey-Usuario-Uber-Truck.html) |
| Modelo negocio | [Modelo-Negocio-Uber-Truck.html](./Modelo-Negocio-Uber-Truck.html) |
| Roadmap editable | [ROADMAP.md](./ROADMAP.md) |
| Deploy | [DEPLOY.md](./DEPLOY.md) |
| **Canvas estado avance** | Abrir en Cursor: `canvases/estado-avance.canvas.tsx` |

---

## 9. Fases técnicas (roadmap)

| Fase | Contenido | Estado |
|------|-----------|--------|
| MVP 0 Concierge | WhatsApp + Airtable | Planificado Gantt |
| MVP 1 Digital | BD + API + web | **En curso — adelantado** |
| MVP 2 Confianza | KYC, ratings, seguro | Pendiente |
| Escala | Match auto, pricing | Pendiente |

---

## 10. Riesgos

- Datos ubicación / Maps sin API key.
- Multas sin pasarela → riesgo morosidad (mitigación: plazo, banco obligatorio, bloqueos futuros).
- Notificaciones históricas en JSON compartido por rol (mejorar con `user_id`).

---

## 11. Referencias externas

- Informe evaluación estratégica (origen Word en Downloads del equipo).
- Supabase dashboard: `ljinhegtywixtbzjgjfn`.

---

## 12. Cronograma (Gantt) y estado de avance

> **Estructura tipo proyecto fintech:** el Gantt planificado vive **aquí**; el HTML [Gantt-Uber-Truck.html](./Gantt-Uber-Truck.html) es el detalle exportable a Word. El **avance real** se actualiza con cada release.

### 12.1 Horizonte planificado

**Jun 2026 – Mar 2027** (ver Gantt HTML para tabla mensual completa).

| Fase | Nombre | Plan inicio | Plan fin |
|------|--------|-------------|----------|
| 0 | Descubrimiento y legal | 2026-06-01 | 2026-06-28 |
| 1 | Concierge MVP | 2026-06-15 | 2026-08-09 |
| 2 | MVP digital v1 | 2026-08-01 | 2026-10-25 |
| 3 | Piloto escalado + confianza | 2026-10-01 | 2027-01-31 |
| 4 | Producto B2B SaaS | 2027-02-01 | 2027-03-31 |

### 12.2 Hitos (milestones)

| ID | Hito | Fecha plan | Estado real (may 2026) |
|----|------|------------|-------------------------|
| M1 | Descubrimiento + legal | 28-jun-2026 | ⏳ En curso |
| M2 | 20 emparejamientos concierge | 09-ago-2026 | ⏳ |
| M3 | MVP digital en producción | 25-oct-2026 | ✅ **Adelantado** (Railway activo) |
| M4 | 100 viajes digitales | 31-ene-2027 | ⏳ |
| M5 | Match semi-auto + SaaS | 31-mar-2027 | ⏳ |

### 12.3 Tareas fase 2 (digital) — plan vs real

| ID | Tarea Gantt | Plan | Estado real |
|----|-------------|------|-------------|
| 2.1 | Esquema BD Supabase | ago 2026 | ✅ 001–008 |
| 2.2 | API Express | ago–sep 2026 | ✅ |
| 2.3 | Web carrier / shipper | sep–oct 2026 | ✅ v0.0.19 |
| 2.4 | Panel operador + estados | sep–oct 2026 | ✅ Tablero + matches |
| 2.5 | Deploy Railway | oct 2026 | ✅ |
| 2.6+ | Chat, cancel, multas, notificaciones | No en Gantt original | ✅ Extra MVP |
| 2.10 | Cuenta bancaria + resumen multas | Roadmap | ✅ UI + API (sin pasarela) |

### 12.4 Avance global estimado

| Bloque | % estimado |
|--------|------------|
| Fase 2 MVP digital (núcleo) | **~75%** |
| Fase 2.10 cobros | **~25%** (diseño + UI) |
| Fase 3 confianza | 0% |
| Proyecto total (hasta M5) | **~35%** |

Actualización visual: **Canvas** `canvases/estado-avance.canvas.tsx`.

---

## 13. Control de versiones documento

| Versión doc | Fecha | Cambio |
|-------------|-------|--------|
| 1.0 | may 2026 | Borrador HTML kickoff |
| 2.0 | may 2026 | Gantt integrado, estado avance, enlaces canvas y SQL |
