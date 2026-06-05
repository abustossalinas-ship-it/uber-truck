# Cubik — experiencia app móvil

Shell tipo Uber (bottom nav) sobre la misma API Railway. Activo en:

- APK / Capacitor nativo
- `?app=1` en el navegador (pruebas)
- PWA instalada en pantalla &lt; 900px

## Navegación

| Tab | Contenido |
|-----|-----------|
| **Inicio** | Saludo, accesos rápidos, viaje activo |
| **Opciones** | Grilla: publicar, ofertar, emparejar, viajes, notificaciones |
| **Actividad** | Mis viajes (+ pull-to-refresh) |
| **Cuenta** | Perfil, multas, KYC, admin, salir |

Flujo sin login: splash nativo → bienvenida → ingresar / crear cuenta.

## Archivos

| Archivo | Rol |
|---------|-----|
| `public/app-shell.css` | Layout móvil, bottom nav, gate |
| `public/app-shell.js` | Rutas, Capacitor, auth |
| `public/api-base.js` | API Railway si UI local en APK |

## Capacitor

```bash
# Demo con web remota (actualiza UI sin republicar APK)
npm run cap:sync:remote

# UI empaquetada en APK (Play Store “app cerrada”)
npm run cap:sync:bundle
npm run cap:open:android
```

Plugins: SplashScreen, StatusBar, App (back), PushNotifications (stub; requiere `google-services.json` para FCM). Guía push: [CUBIK-PUSH-FCM.md](./CUBIK-PUSH-FCM.md).

## Probar en PC

Abrir `https://uber-truck-production.up.railway.app/?app=1` en ventana estrecha o DevTools móvil.

Forzar modo app: `localStorage.setItem('cubik_force_app','1')` y recargar.

## Desktop

Ancho ≥ 900px mantiene la UI web clásica (pestañas superiores).

## Cubik Saldo piloto (v0.0.100–0.0.104)

| Rol | Dónde | Acción |
|-----|-------|--------|
| Embarcador | Mis viajes → Completados | **Pagar con Cubik Saldo** (drawer; en web desktop modal centrado abajo) |
| Transportista | Campana + Mis viajes | Notificación **Embarcador pagó el flete**; badges **Embarcador pagó** + **Cobro en gestión** |
| Ambos | Cuenta | Sección **Cubik Saldo (piloto)** con desglose 10% / 5% |

API: `POST /api/matches/:id/pilot-pay` · SQL: `docs/RUN_026_pilot_payment.sql`
