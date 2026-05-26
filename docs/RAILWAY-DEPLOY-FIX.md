# Railway no actualiza el código (sigue en 0.0.5)

Si `/health` muestra `"version":"0.0.5"` y `"build":"95d447e"` pero en GitHub `main` ya está en **0.0.8+**, el **Redeploy** solo reinició el contenedor viejo. No descargó commits nuevos.

## Comprobar

```text
GitHub main:  https://github.com/abustossalinas-ship-it/uber-truck/commits/main
Producción:   https://uber-truck-production.up.railway.app/health
```

Deben coincidir el **build** (primeros 7 del commit) con el último commit de GitHub.

## Solución A — Forzar deploy del último commit (recomendado)

1. [railway.app](https://railway.app) → proyecto **blissful-alignment** → servicio **uber-truck**.
2. Pestaña **Deployments**.
3. Busca botón **Deploy** / **Deploy latest** (no solo **Redeploy** del deployment viejo).
4. Elige rama **`main`** y commit reciente (ej. mensaje `modal motivos` / `0.0.8`).
5. Espera **Success** y vuelve a abrir `/health` → debe decir `"version":"0.0.9"` o superior.

## Solución B — Reconectar GitHub

1. **Settings** → **Source**.
2. Confirma repo: `abustossalinas-ship-it/uber-truck`, rama **`main`**.
3. Si el último deploy ligado a GitHub es antiguo: **Disconnect** → volver a **Connect repo** → `uber-truck` → `main`.
4. Activa **Auto Deploys** y haz un push a `main` (o Deploy manual).

## Solución C — Deploy Hook (auto en cada push)

1. Railway → servicio → **Settings** → **Deploy** → copia **Deploy Hook URL**.
2. GitHub → repo → **Settings** → **Secrets** → `RAILWAY_DEPLOY_HOOK` = esa URL.
3. Cada `git push` a `main` dispara el workflow `.github/workflows/railway-deploy.yml`.

## Solución D — Root directory

Si el servicio apunta a una subcarpeta incorrecta, Railway construye otro árbol. **Root Directory** debe estar **vacío** (raíz del repo).

## Cuando esté bien

`/health` debería mostrar algo como:

```json
"version": "0.0.9",
"build": "xxxxxxxx",
"ui": "match-cancel-v2",
"features": ["cancel-reasons-modal", "penalty-by-phase"]
```

Y al cancelar un match debe abrirse el **modal con lista de motivos**, no el cuadro `prompt` del navegador.
