# Auth, correo y login social — pendiente producción

## Hoy (MVP v0.0.57)

- **Registro e ingreso:** email + contraseña → JWT (`POST /api/auth/register`, `POST /api/auth/login`).
- **Roles:** embarcador, transportista, admin (con clave).
- **Sin** «Continuar con Google» ni «Continuar con Apple».
- **Sin** recuperación de contraseña activa en producción (código preparado, no desplegado).

## Pendiente — producción futura (tipo Uber)

| Bloque | Capacidad | Notas |
|--------|-----------|--------|
| **E1 — Google (Gmail)** | OAuth 2.0 / OpenID: «Continuar con Google» | Cuenta Google Workspace o @gmail.com; vincular o crear usuario en `users`; mismo flujo KYC posterior. |
| **E2 — Apple** | Sign in with Apple | Obligatorio si hay app iOS en App Store; email relay de Apple; claves en Apple Developer. |
| **E3 — Correo transaccional** | Recuperación de contraseña, avisos críticos | Resend (o similar) + migración SQL 017; variables `RESEND_API_KEY`, `EMAIL_FROM`. |

### Integración esperada (diseño)

1. Botones en pantalla de login/registro: **Google** y **Apple** (además de email/contraseña).
2. Callback en backend valida token del proveedor → busca `users` por email o `oauth_provider` + `oauth_sub` (columnas futuras en BD).
3. Primera vez: completar razón social, rol y datos mínimos (como hoy el registro manual).
4. Recuperación de clave: enlace por email (no depender solo de soporte manual).

### Qué no hacer aún

- Crear proyectos OAuth en Google Cloud / Apple Developer para prod sin plan de dominio y política de privacidad.
- Activar Resend ni migración 017 hasta definir dominio de envío (`EMAIL_FROM`).
- Exponer secretos OAuth en el front (solo client id público; secret en servidor).

## Variables (.env — comentadas)

Ver `.env.example` sección «Auth social y correo (pendiente)».

## Referencias

- [PROXIMOS-PASOS-ESTRATEGIA.md](./PROXIMOS-PASOS-ESTRATEGIA.md) — bloque E
- [Memoria técnica](./Memoria-tecnica-Uber-Truck.html) — paridad UX login
- [Journey](./Journey-Usuario-Uber-Truck.html) — etapa registro
- [Probar la app](./Probar-Uber-Truck.html) — hoy: dos emails o alias `+rol@gmail.com`
