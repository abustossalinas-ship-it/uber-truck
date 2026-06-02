# Cubik — Play Store (prueba cerrada / demo)

**Marca producto:** Cubik — conectar cubicación disponible con demanda en tiempo real.  
**Backend actual:** Railway `uber-truck-production.up.railway.app` (sin cambiar infra).  
**Package Android:** `cl.cubik.logistics`

## Nombre (decisión)

| Opción | Notas |
|--------|--------|
| **Cubik** ✓ | Elegida — cubicación, tech, LATAM |
| Trayek | Alternativa |
| FlowCargo | Alternativa |
| RutaGo | Alternativa |
| Andes Flow | Alternativa |

Repositorio interno sigue `uber-truck`; la UI y Play usan **Cubik**.

---

## Qué hay en el repo

| Pieza | Ruta |
|-------|------|
| PWA | `public/manifest.webmanifest`, `public/sw.js`, `public/pwa-ui.js` |
| Marca UI | `public/brand-config.js` |
| Capacitor | `capacitor.config.json` → carga URL producción en WebView |
| Android | carpeta `android/` (generar con comandos abajo) |

La app Android **no empaqueta** todo el JS: abre la web en producción (actualizaciones sin republicar APK en cada deploy). Para bundle local, quitar bloque `server` en `capacitor.config.json` y ejecutar `npx cap sync`.

---

## Requisitos en tu PC

1. [Android Studio](https://developer.android.com/studio) (SDK 34+)
2. Cuenta [Google Play Console](https://play.google.com/console) — USD 25 única vez
3. Node 20+

---

## Comandos (primera vez)

```bash
npm install
npm run cap:sync
npm run cap:open:android
```

En Android Studio: **Build → Generate Signed Bundle / APK** → **Android App Bundle (.aab)** para Play.

---

## Play Console — prueba cerrada (demo clientes)

1. Crear app **Cubik** (categoría: Negocios o Maps & Navigation).
2. **Política de privacidad:** URL pública (puede ser `/docs/` o página simple en tu dominio).
3. **Prueba cerrada** → subir `.aab` → agregar emails de testers (cliente + tú).
4. Compartir **link de opt-in** de la prueba; el cliente instala desde Play Store.

No hace falta lanzamiento **producción abierta** para reuniones comerciales.

---

## Checklist demo con cliente

- [ ] SQL 022–025 aplicado (multas / soporte)
- [ ] Cuentas demo KYC `approved`
- [ ] Banco inscrito en cuentas demo (prod)
- [ ] APK/AAB firmado subido a prueba cerrada
- [ ] Cliente aceptó invitación tester
- [ ] Guion: publicar carga → oferta → match → viaje (ver `docs/Probar-Uber-Truck.html`)

---

## iOS (después)

TestFlight con mismo `capacitor.config.json` + `npx cap add ios` (Apple Developer USD 99/año).
