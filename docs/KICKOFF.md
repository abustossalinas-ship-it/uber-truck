# Kickoff — Uber Truck

**Última actualización:** mayo 2026

---

## 1. Problema

Las PYME y distribuidores enfrentan picos de demanda **no cubicados**: pedidos extras, cambios de fecha de retiro o imprevistos que obligan a **cotizar y pagar un camión adicional** (a veces casi fijo mes a mes) aunque solo necesitan mover pocos pallets en un corredor que otro transportista ya recorre.

Dolor validado en entrevista inicial: costo y fricción de cotizar camión dedicado por no saber cuándo llegará el próximo pedido ni tener visibilidad de **capacidad ociosa** en ruta.

---

## 2. Propuesta de valor

**Uber Truck** conecta **demanda incidental de carga** (embarcador) con **oferta de cubicación libre** en rutas ya planificadas (transportista / backhaul), con publicación, emparejamiento y estados del viaje en un solo lugar.

---

## 3. Usuarios

| Rol | Necesidad |
|-----|-----------|
| **Embarcador** (empresa / PYME) | Publicar carga urgente o extra sin contrato marco |
| **Transportista** (dueño camión / flota) | Monetizar m³ libres en retorno o ruta activa |
| **Operador** (MVP demo) | Emparejar oferta-demanda en tablero |

---

## 4. MVP (v0.1) — en curso

- [x] Publicar **necesidad de carga** (`POST /api/load-requests`)
- [x] Publicar **oferta de capacidad** (`POST /api/capacity-offers`)
- [x] Listado y **emparejamiento** manual (`POST /api/matches`, estados)
- [x] UI web demo en `public/`
- [ ] Registro / login (2 roles)
- [ ] Supabase en producción (migración `001_init.sql` lista)
- [ ] Notificaciones (email o WhatsApp)
- [ ] Panel admin con métricas

**Fuera del MVP v0.1:**

- App nativa iOS/Android
- Pagos in-app
- GPS en tiempo real
- ML de precios

---

## 5. Modelo de negocio (borrador)

- Comisión por viaje cerrado: **12–15%** (fase 1, ver modelo de negocio)
- Suscripción transportistas verificados _(opcional, fase 2)_

---

## 6. Stack técnico

| Capa | Elección |
|------|----------|
| Backend | Node 20 + Express |
| BD piloto demo | JSON local (`data/store.json`) |
| BD producción | Supabase (PostgreSQL) |
| Auth | Supabase Auth o JWT propio _(pendiente)_ |
| Frontend MVP | Web en `public/` |
| Deploy | Railway |
| Mapas | _Google / Mapbox — pendiente_ |

---

## 7. Riesgos y supuestos

- Confianza embarcador ↔ transportista (KYC manual en piloto)
- Calidad de datos de ruta (ciudad/región antes que GPS)
- Adopción lado oferta (camiones con cubicación reportada)

---

## 8. Próxima acción

1. Probar demo: `npm run dev` → http://localhost:3001
2. Mostrar flujo: publicar carga → publicar oferta → tablero → aceptar match
3. Conectar Supabase y desplegar en Railway para demo externa

Ver `ROADMAP.md` y `PROXIMOS-HITOS.md`.
