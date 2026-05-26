# Guion demo Uber Truck (3 minutos)

**URL:** https://uber-truck-production.up.railway.app

## Antes de mostrar

1. Ejecutar migración `003_auth_password.sql` en Supabase (si usar login).
2. Opcional: cargar datos demo → botón **“Cargar demo”** en la web (requiere `DEMO_SEED_KEY` en Railway) o `POST /api/demo/seed`.

## Guion

### 1. Problema (30 s)

> “Las PYME publican pedidos extras y muchas veces terminan cotizando un camión dedicado casi fijo, aunque solo necesitan 2–4 pallets en un corredor que otro transportista ya recorre.”

### 2. Publicar carga (45 s)

Pestaña **Necesito mover carga** → buscar dirección con Maps → comuna/región se rellenan → elegir cubicación → **Publicar carga**.

### 3. Oferta de capacidad (30 s)

**Tengo espacio en ruta** → publicar camión con m³ libres en el mismo corredor.

### 4. Match inteligente (45 s)

**Tablero** → elegir carga → ver **Sugerencias automáticas** (puntaje por región y cubicación) → **Crear match** → **Aceptar** → **En ruta** → **Cerrar**.

### 5. Cierre (30 s)

> “Todo queda en Supabase; el piloto valida tiempo a match y repetición de embarcadores sin contratar camión extra mensual.”

## Cuentas demo (opcional)

Registrar en la app:

- Embarcador: `demo@embarcador.cl` / rol embarcador  
- Transportista: `demo@transportista.cl` / rol transportista  

Contraseña mínimo 6 caracteres.
