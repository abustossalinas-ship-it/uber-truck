# Despliegue — proyectos separados

Uber Truck **no** debe vivir en el proyecto Railway ni en el proyecto Supabase de **wa-fintech-mvp**. Crea recursos nuevos solo para este repo.

---

## 1. Supabase (proyecto uber-truck)

| Dato | Valor |
|------|--------|
| **Project ref** | `ljinhegtywixtbzjgjfn` |
| **Dashboard** | https://supabase.com/dashboard/project/ljinhegtywixtbzjgjfn |
| **API URL** | `https://ljinhegtywixtbzjgjfn.supabase.co` |

1. [SQL Editor](https://supabase.com/dashboard/project/ljinhegtywixtbzjgjfn/sql/new) → ejecutar migraciones en orden: `001` … `005_match_cancel_reasons.sql` (ver `supabase/migrations/`).
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
| `BUDGET_BASE_CLP` | `80000` — base sugerencia flete (opcional; default en código) |
| `BUDGET_RATE_KM_CLP` | `450` — $/km sugerencia |
| `BUDGET_RATE_KG_CLP` | `22` — $/kg sugerencia |
| `BUDGET_URGENT_MULT` | `1.18` — multiplicador urgente |
| `BUDGET_MIN_RATIO` | `0.82` — piso rango publicado |
| `BUDGET_MAX_RATIO` | `1.25` — techo rango publicado |

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

### Si push a GitHub no actualiza producción (redeploy manual)

Railway a veces deja de enlazar auto-deploy. En ese caso:

1. [railway.app](https://railway.app) → proyecto **uber-truck** → servicio web.
2. **Settings → Source**: repo `abustossalinas-ship-it/uber-truck`, rama **`main`**.
3. Pestaña **Deployments** → **Redeploy** (o **Deploy** del último commit).
4. Espera estado **Success** (1–3 min).

**Comprobar que llegó el build nuevo:**

```bash
curl https://uber-truck-production.up.railway.app/health
```

Debe incluir `"version":"0.0.2"` y `"ui":"match-flow-v2"`. Si no aparecen, producción sigue en un deploy viejo.

En el navegador: **Ctrl+F5** en `/`. El badge bajo el logo debe decir **v0.0.2 · emparejar mejorado** y en Tablero verás **Paso 1 / 2 / 3** y el botón **Crear match — emparejar ahora**.

### Deploy hook (opcional, GitHub Actions)

En Railway → Service → **Settings → Deploy** → copia **Deploy Hook URL**. En GitHub → repo → **Settings → Secrets** → `RAILWAY_DEPLOY_HOOK`. El workflow `.github/workflows/railway-deploy.yml` hace `POST` en cada push a `main`.

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
