# Roadmap — Uber Truck

## Fase 0 — Kickoff (ahora)

- [x] Plantilla proyecto + Cursor
- [ ] Completar `KICKOFF.md`
- [ ] 3–5 entrevistas usuarios
- [ ] Wireframe flujo principal (Figma / papel)

## Fase 1 — MVP backend (4–6 semanas)

| # | Entregable |
|---|------------|
| 1.1 | Esquema BD: users, loads, trips, statuses |
| 1.2 | API: CRUD carga + listado por región |
| 1.3 | API: asignar viaje + cambio de estado |
| 1.4 | Auth mínimo (2 roles) |
| 1.5 | Deploy Railway + `/health` |

## Fase 2 — MVP web (3–4 semanas)

| # | Entregable |
|---|------------|
| 2.1 | UI embarcador: publicar y ver mis cargas |
| 2.2 | UI transportista: board de cargas + aceptar |
| 2.3 | Notificaciones básicas |

### Backlog — cuenta y “mis” publicaciones (post-login)

Hoy el login guarda rol (`shipper` / `carrier`) pero **cargas y ofertas no tienen `owner_user_id`**; el tablero lista todo el marketplace.

| # | Tarea |
|---|--------|
| 2.4 | Migración: `owner_user_id` (o `shipper_user_id` / `carrier_user_id`) en `load_requests` y `capacity_offers` |
| 2.5 | Al crear carga/oferta: persistir `req.user.id` (JWT); rechazar o anonimizar si no hay sesión (definir política) |
| 2.6 | API: `GET /api/load-requests/mine` y `GET /api/capacity-offers/mine` (filtro por usuario) |
| 2.7 | UI embarcador: sección **Mis cargas** (solo las de la cuenta) + tablero “mercado” opcional |
| 2.8 | UI transportista: **Mis ofertas** + cargas asociadas vía **emparejamientos activos** (match ↔ oferta) |
| 2.9 | Prellenar `company_name` / `carrier_name` desde `users.company_name` al publicar |

## Fase 3 — Piloto

- 5 embarcadores + 10 transportistas
- Métricas: viajes cerrados, tiempo a match, NPS

## Fase 4 — Escala (post-validación)

- Pagos, GPS, app nativa, pricing dinámico

---

**Principio:** validar **match carga–camión** antes de invertir en pagos o app nativa.
