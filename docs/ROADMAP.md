# Roadmap — Uber Truck

## Visión

**MVP final:** una app (web, luego PWA/móvil) que funcione **como Uber**, pero para emparejar **carga ↔ camión** con capacidad ociosa. Los usuarios ya saben el patrón: publicar, aceptar, viaje en curso, chat, cancelar, cuenta.

**Después:** con viajes reales y métricas, explorar el producto como **add-on** integrable (API/widgets) en marketplaces o apps de movilidad — no sustituir a Uber desde el día uno.

---

## Estado actual (v0.0.19)

| Área | Estado |
|------|--------|
| Publicar carga / oferta | Hecho |
| Match, estados, chat, notificaciones | Hecho |
| Cancelación, acuerdo mutuo, multas UI | Hecho |
| Mis cargas / mis ofertas por usuario | **Pendiente** |
| Pago in-app | Pendiente |
| Mapa en vivo | Pendiente |
| Ratings | Pendiente |

---

## Fase A — MVP final tipo Uber (prioridad)

| # | Entregable |
|---|------------|
| A.1 | `owner_user_id` + **Mis cargas** / **Mis ofertas** |
| A.2 | Flujo UX unificado (misma app, sin herramientas externas) |
| A.3 | Piloto **20 viajes** en producción |
| A.4 | SQL 008 en prod + estabilidad Railway |

## Fase B — Confianza y cobro

| # | Entregable |
|---|------------|
| B.1 | Pasarela + botón generar cargo (2.10) |
| B.2 | Mapas / geocoding en publicación |
| B.3 | Ratings bidireccionales |
| B.4 | KYC manual |

## Fase C — Piloto escalado

- 5 embarcadores + 10 transportistas activos en la app
- Meta: **100 viajes** digitales
- Métricas: tiempo a match, NPS, retención 7 días

## Fase D — Escala y add-on

- Match semi-automático por corredor
- Dashboard embarcador frecuente
- Documentación API para socios (integración tipo add-on)

---

## Backlog técnico (detalle)

### Mis publicaciones (2.4–2.9)

| # | Tarea |
|---|--------|
| 2.4 | Migración `owner_user_id` en `load_requests` y `capacity_offers` |
| 2.5 | Persistir `req.user.id` al crear |
| 2.6 | `GET .../mine` |
| 2.7–2.8 | UI Mis cargas / Mis ofertas |
| 2.9 | Prellenar nombre empresa desde `users` |

### Multas y cobros (2.10)

Ver `docs/PENALTIES-AND-ACCOUNTS.md`.

---

**Principio:** paridad Uber + usuarios en **esta** app antes que partnerships o app nativa compleja.
