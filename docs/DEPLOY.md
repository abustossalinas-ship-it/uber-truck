# Despliegue — proyectos separados

Uber Truck **no** debe vivir en el proyecto Railway ni en el proyecto Supabase de **wa-fintech-mvp**. Crea recursos nuevos solo para este repo.

---

## 1. Supabase (proyecto uber-truck)

| Dato | Valor |
|------|--------|
| **Project ref** | `ljinhegtywixtbzjgjfn` |
| **Dashboard** | https://supabase.com/dashboard/project/ljinhegtywixtbzjgjfn |
| **API URL** | `https://ljinhegtywixtbzjgjfn.supabase.co` |

1. [SQL Editor](https://supabase.com/dashboard/project/ljinhegtywixtbzjgjfn/sql/new) → ejecutar `supabase/migrations/001_init.sql`.
2. [Settings → API](https://supabase.com/dashboard/project/ljinhegtywixtbzjgjfn/settings/api) → copiar **service_role** (no la anon key en el servidor MVP).
3. En `.env` (local) y Railway (producción):

```env
SUPABASE_URL=https://ljinhegtywixtbzjgjfn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

> Cuando conectes la API a Supabase, el MVP dejará de usar solo `data/store.json`.

---

## 2. Railway (proyecto nuevo, no wa-fintech-mvp)

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
2. Elige el repositorio **`uber-truck`** (o el nombre exacto de este repo en GitHub).
3. **Importante:** no selecciones el servicio ni variables del proyecto **wa-fintech-mvp**. Si Railway sugiere reutilizar un proyecto existente, crea uno vacío llamado por ejemplo `uber-truck-prod`.
4. Variables de entorno en Railway (Variables):

| Variable | Valor |
|----------|--------|
| `NODE_ENV` | `production` |
| `PORT` | `3001` (Railway suele inyectar `PORT`; si falla health, usa la que asigne Railway) |
| `SUPABASE_URL` | URL del proyecto Supabase **uber-truck** |
| `SUPABASE_SERVICE_ROLE_KEY` | service role del mismo proyecto |

5. El repo ya incluye `railway.json`:

```json
{
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health"
  }
}
```

6. Tras el deploy, abre la URL pública → debe responder `/health` y servir la web en `/`.

### Comprobar

```bash
curl https://TU_APP.up.railway.app/health
```

---

## 3. Checklist antes de mostrar demo en URL pública

- [ ] Proyecto Railway **uber-truck** (separado de wa-fintech-mvp)
- [ ] Proyecto Supabase **uber-truck** (migración 001 aplicada)
- [ ] Variables en Railway apuntan al Supabase correcto
- [ ] Logo visible en `/` (`/brand/logo.png`)

---

## 4. Dominio (opcional)

En Railway → Settings → Networking → Custom Domain. Apunta DNS cuando tengas dominio de marca.

---

## 5. Local vs producción

| Entorno | Datos |
|---------|--------|
| Local `npm run dev` | `data/store.json` (JSON) |
| Producción (fase actual) | Mismo hasta integrar Supabase en código |

Siguiente hito técnico: servicio `src/services/supabase.js` + persistencia en tablas de `001_init.sql`.
