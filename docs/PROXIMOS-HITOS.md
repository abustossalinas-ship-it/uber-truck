# Próximos hitos — Uber Truck

**Estrategia:** un solo producto — **app tipo Uber** para carga por camión. Piloto y usuarios **dentro de la app** (no WhatsApp ni planillas externas). Objetivo futuro: tracción → posible **add-on** a plataformas grandes.

Prioridad: **P0** bloquea · **P1** siguiente · **P2** después del piloto.

---

## P0 — Ahora

| # | Tarea | Estado |
|---|-------|--------|
| 1 | SQL **008** en Supabase prod | Pendiente usuario |
| 2 | **Mis cargas / mis ofertas** (`owner_user_id` + UI «Mis viajes») | Pendiente |
| 3 | Prod `/health` + login JWT | Hecho |

## P1 — MVP final tipo Uber

| # | Tarea | Estado |
|---|-------|--------|
| 4 | Refino UX: publicar → match → activos (copy/pasos estilo Uber) | En curso |
| 5 | **Piloto 20 viajes** completados solo en la app (M2) | Pendiente |
| 6 | Capturas `docs/img/` + métricas (tiempo match, NPS) | Pendiente |

## P2 — Cierre MVP + escala

| # | Tarea | Estado |
|---|-------|--------|
| 7 | Pasarela + generar cargo (2.10) | Diseño |
| 8 | Mapa / seguimiento en ruta | Planificado |
| 9 | Ratings + KYC (fase 3) | Planificado |
| 10 | Paquete API para add-on (post 100 viajes) | Visión |

## No hacer aún

- WhatsApp + Airtable como producto principal
- App nativa (salvo PWA)
- Open Finance
- Integración directa con Uber antes de tener usuarios propios

## Referencias

- [Memoria-tecnica-Uber-Truck.html](./Memoria-tecnica-Uber-Truck.html) — visión, paridad Uber, Gantt
- [ROADMAP.md](./ROADMAP.md)
