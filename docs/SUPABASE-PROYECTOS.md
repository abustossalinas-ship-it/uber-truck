# Supabase — dos proyectos distintos (no se pisan)

En Supabase **cada proyecto es una base de datos separada**. Uno **no puede sobrescribir** al otro; como máximo puedes haber ejecutado SQL del repo equivocado **dentro** de un solo proyecto.

## Referencias en tu máquina

| Producto | Carpeta repo | Project ref | API URL | Dashboard |
|----------|--------------|-------------|---------|-----------|
| **Chanchi / wa-fintech-mvp** | `wa-fintech-mvp` | `uwmcqmnbekvlwlbyffpi` | https://uwmcqmnbekvlwlbyffpi.supabase.co | https://supabase.com/dashboard/project/uwmcqmnbekvlwlbyffpi |
| **Uber Truck** | `uber-truck` | `ljinhegtywixtbzjgjfn` | https://ljinhegtywixtbzjgjfn.supabase.co | https://supabase.com/dashboard/project/ljinhegtywixtbzjgjfn |

Comprobación externa (sin login): ambas URLs responden **401** en `/rest/v1/` → los dos proyectos **existen y están activos**.

## Cómo abrir el proyecto correcto

1. Entra a https://supabase.com/dashboard/projects (lista de **todos** tus proyectos).
2. No uses solo el último enlace guardado: verifica el **ref** en la barra de direcciones (`/project/XXXXXXXX`).
3. En **Table Editor**, revisa qué tablas hay:
   - **Fintech:** `whatsapp_messages`, `transactions`, `fixed_monthly_expenses`, etc.
   - **Uber Truck (tras migración 001):** `load_requests`, `capacity_offers`, `matches`, `users`, `vehicles`.

Si en fintech ves tablas de camiones, ejecutaste `uber-truck/supabase/migrations/001_init.sql` en el proyecto equivocado (añade tablas, no borra las de Chanchi).

Si en uber-truck ves tablas de WhatsApp/transactions, aplicaste migraciones de fintech ahí.

## Enlaces directos Uber Truck

- Dashboard: https://supabase.com/dashboard/project/ljinhegtywixtbzjgjfn
- SQL: https://supabase.com/dashboard/project/ljinhegtywixtbzjgjfn/sql/new
- API keys: https://supabase.com/dashboard/project/ljinhegtywixtbzjgjfn/settings/api

## Enlaces directos wa-fintech-mvp

- Dashboard: https://supabase.com/dashboard/project/uwmcqmnbekvlwlbyffpi
- SQL: https://supabase.com/dashboard/project/uwmcqmnbekvlwlbyffpi/sql/new
- API keys: https://supabase.com/dashboard/project/uwmcqmnbekvlwlbyffpi/settings/api

## Si “no llegas” a una ruta

| Síntoma | Causa habitual |
|---------|----------------|
| 404 en dashboard | Ref mal copiado o proyecto **pausado/eliminado** (revisar lista en /dashboard/projects) |
| Entras pero tablas raras | Estás en el **otro** ref |
| Solo ves un proyecto | Otra **organización** en Supabase (selector arriba a la izquierda) |

## `.env` por repo

- `wa-fintech-mvp/.env` → debe tener `SUPABASE_URL=https://uwmcqmnbekvlwlbyffpi.supabase.co`
- `uber-truck/.env` → debe tener `SUPABASE_URL=https://ljinhegtywixtbzjgjfn.supabase.co`

Nunca intercambiar las `SUPABASE_SERVICE_ROLE_KEY` entre proyectos.
