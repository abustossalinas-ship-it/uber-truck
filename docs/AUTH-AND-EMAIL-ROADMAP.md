# Auth, correo y login social — estado producción

**Software:** 0.0.129 · **Actualizado:** 25 may 2026

---

## Hoy en producción

| Capacidad | Estado | Versión / notas |
|-----------|--------|-----------------|
| Registro / login email + contraseña | **Hecho** | JWT — `POST /api/auth/register`, `POST /api/auth/login` |
| Roles shipper / carrier / admin | **Hecho** | KYC semi-curado |
| Política de contraseña fuerte | **Hecho** | v0.0.128 — 8+ chars, letra, mayúscula, número |
| UI fortaleza contraseña | **Hecho** | `password-strength-ui.js` en registro, reset y cambio |
| Cambiar contraseña en app (APK) | **Hecho** | v0.0.128 — `AppShell.openChangePassword()` |
| No reutilizar misma clave al resetear | **Hecho** | `password-reset.js` |
| Recuperar contraseña (código) | **Hecho** | SQL 017 + Resend + rutas forgot/reset |
| Recuperar contraseña (piloto multi-cuenta) | **Bloqueado** | Falta dominio verificado — ver [DOMAIN-AND-EMAIL.md](./DOMAIN-AND-EMAIL.md) |
| Login Gmail / Apple | **Diferido** | Bloque E — post-piloto |
| MFA TOTP / SMS | **Diferido** | Post-piloto |

---

## Bloque E — login social (pendiente)

| Bloque | Capacidad | Notas |
|--------|-----------|--------|
| **E1 — Google** | OAuth 2.0 «Continuar con Google» | Vincular o crear usuario; mismo KYC posterior |
| **E2 — Apple** | Sign in with Apple | Obligatorio con app iOS en App Store |
| **E3 — Correo** | Reset + avisos transaccionales | Código listo; **pendiente dominio** |
| **E3b — MFA** | TOTP / SMS | Post-piloto |

### Integración esperada (diseño)

1. Botones Google y Apple en login/registro (además de email).
2. Callback valida token → busca `users` por email o `oauth_provider` + `oauth_sub` (columnas futuras).
3. Primera vez: completar razón social, rol y datos mínimos.
4. Recuperación de clave: enlace por email (Resend + dominio propio).

### Qué no hacer aún

- Proyectos OAuth en Google Cloud / Apple Developer sin política de privacidad y dominio.
- Exponer secretos OAuth en el front (solo client id público).

---

## Variables Railway (correo)

| Variable | Uso |
|----------|-----|
| `RESEND_API_KEY` | API Resend |
| `EMAIL_FROM` | `Cubik <noreply@tudominio.com>` — **requiere dominio verificado** |

Hoy en sandbox: `onboarding@resend.dev` solo entrega al email de la cuenta Resend.

Ver `.env.example` sección auth y correo.

---

## Referencias

- [DOMAIN-AND-EMAIL.md](./DOMAIN-AND-EMAIL.md) — dominios ocupados, checklist compra
- [POST-MVP-CHECKLIST.md](./POST-MVP-CHECKLIST.md)
- [PROXIMOS-PASOS-ESTRATEGIA.md](./PROXIMOS-PASOS-ESTRATEGIA.md)
- [Memoria técnica](./Memoria-tecnica-Uber-Truck.html)
