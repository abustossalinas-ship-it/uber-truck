# Dominio y correo transaccional — Cubik

**Software:** 0.0.129 · **Actualizado:** 25 may 2026

Dominio **getcubik.cl** activo en Railway + Resend verificado. Reset de contraseña llega a **cualquier email** (Gmail, Yahoo, corporativo).

---

## Decisión de producto

| Tema | Decisión |
|------|----------|
| **Nombre de la app** | **Cubik** — no renombrar por ahora |
| **Dominio web/correo** | Variante compuesta (`cubikenvios.com`, `cubikfletes.cl`, etc.) |
| **Remitente Resend** | `Cubik <noreply@tudominio.com>` |
| **Destinatarios** | Cualquier email (Gmail, Yahoo, corporativo) una vez verificado el dominio |

La marca en APK, correos y UI sigue siendo **Cubik**; el dominio es infraestructura técnica.

---

## Dominio adquirido

| Dominio | Registrador / DNS | Uso |
|---------|-------------------|-----|
| **getcubik.cl** | HostGator Chile (`ns00010.hostgator.cl`, `ns00011.hostgator.cl`) | Sitio + correo Resend + app en Railway |

**No usar** el asistente «Crear Sitio WordPress» de HostGator — la app y la landing viven en **Railway** (`public/landing.html`).

### URLs del producto

| URL | Contenido |
|-----|-----------|
| `https://getcubik.cl/` | Landing marketing |
| `https://getcubik.cl/app` | App Cubik (misma que `/?app=1`) |
| `https://getcubik.cl/probar` | Onboarding testers / APK |

---

## Dominios no disponibles (referencia)

| Dominio | Estado |
|---------|--------|
| **cubik.cl** | Ocupado |
| **cubik.com** | Ocupado (desde 1995) |

---

## Estado Resend (may 2026)

| Ítem | Estado |
|------|--------|
| Código forgot/reset en prod | **Hecho** v0.0.127+ |
| `RESEND_API_KEY` en Railway | Configurado |
| Dominio **getcubik.cl** en Resend | **Verificado** |
| `EMAIL_FROM` prod | `Cubik <no_reply@getcubik.cl>` (sin sandbox) |
| `/health` → `mail.sandbox_sender` | **false** (confirma dominio propio) |
| Reset a Gmail / testers externos | **OK** — ya no limitado a cuenta Resend |
| Errores Resend visibles en API | **Hecho** v0.0.129 |
| Cooldown forgot-password (2 min) | **Hecho** v0.0.129 |

---

## Checklist DNS HostGator → Railway + Resend

### A) Web (landing + app)

1. **Railway** → proyecto uber-truck → **Settings** → **Networking** → **Custom Domain**.
2. Agregar `getcubik.cl` y `www.getcubik.cl`.
3. Railway muestra un **CNAME** (ej. `xxxx.up.railway.app`) — copiarlo.
4. **HostGator cPanel** → **Zone Editor** / **Editor de zona DNS**:
   - `www` → **CNAME** → valor que dio Railway.
   - `@` (raíz): si HostGator no permite CNAME en raíz, usar el **registro A** o **ALIAS** que indique Railway, o redirección que recomiende el panel.
5. Esperar propagación (15 min – 24 h). Probar `https://getcubik.cl/`.

### B) Correo Resend

1. **Resend** → Domains → Add **`getcubik.cl`**.
2. Copiar registros **TXT** (SPF) y **CNAME** (DKIM).
3. En **Zone Editor** de HostGator, agregar esos registros (no borrar los de Railway).
4. Verificar dominio en Resend.
5. **Railway** → variables:
   ```env
   APP_PUBLIC_URL=https://getcubik.cl
   EMAIL_FROM=Cubik <no_reply@getcubik.cl>
   ```
6. **Redeploy** y probar forgot-password a Gmail tester.

### C) HostGator onboarding

En «Defina cómo desea proceder»: **cerrar / omitir** — no crear WordPress ni Website Builder.

---

## OAuth vs Resend

| Capacidad | OAuth Google/Apple | Resend + dominio |
|-----------|-------------------|------------------|
| Login sin contraseña | Sí (futuro bloque E) | No |
| Reset contraseña email+clave | No sustituye | **Sí — obligatorio** |
| Cuentas ya registradas con email | Complemento | **Requerido hoy** |

OAuth **no reemplaza** Resend para usuarios email+contraseña. Ver [AUTH-AND-EMAIL-ROADMAP.md](./AUTH-AND-EMAIL-ROADMAP.md).

---

## Referencias

- [AUTH-AND-EMAIL-ROADMAP.md](./AUTH-AND-EMAIL-ROADMAP.md)
- [POST-MVP-CHECKLIST.md](./POST-MVP-CHECKLIST.md) — ítem 2
- [BRAND.md](./BRAND.md)
- [DEPLOY.md](./DEPLOY.md)
