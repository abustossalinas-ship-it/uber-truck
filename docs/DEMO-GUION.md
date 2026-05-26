# Guion demo Uber Truck (3 minutos)

**URL para testers:** https://uber-truck-production.up.railway.app

**Guía invitados:** [Probar-Uber-Truck.html](./Probar-Uber-Truck.html) · [Journey](./Journey-Usuario-Uber-Truck.html)

## Antes de mostrar (solo dueño del proyecto)

1. Supabase con migración `003_auth_password.sql` (y 004–008 si usas chat/multas).
2. Variables en Railway: `SUPABASE_*`, `JWT_SECRET`.

## Guion rápido

1. Problema: carga incidental sin camión dedicado.
2. Embarcador: cuenta → publica carga (Maps + rango CLP, opcional «Ver rango sugerido»).
3. Transportista: cuenta → publica oferta → tablero → oferta precio CLP.
4. Embarcador: acepta precio → en ruta → chat.
5. Cierre: todo en la misma app web.

## Cuentas

Cada tester se registra solo. Para dos roles: dos emails (ej. `nombre+embarcador@gmail.com` y `nombre+transportista@gmail.com`).
