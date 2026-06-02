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
npm run cap:icons          # iconos Cubik + sync assets
npm run cap:open:android   # abre Android Studio
```

En Android Studio: **Build → Generate Signed Bundle / APK** → **Android App Bundle (.aab)** para Play.

---

## Android Studio — paso a paso

### 1. Abrir el proyecto

```bash
cd uber-truck
npm run cap:open:android
```

- Si pide **Gradle Sync**, acepta y espera (primera vez puede tardar varios minutos).
- SDK mínimo: **API 23** · compilar con **API 35** (ya configurado en `variables.gradle`).

### 2. Probar en celular o emulador

1. Conecta un Android con **depuración USB** activada, o crea un emulador (**Device Manager**).
2. Arriba elige el dispositivo y pulsa **Run ▶** (app `Cubik`).
3. Debe abrir la web de producción en WebView: `uber-truck-production.up.railway.app`.
4. Inicia sesión con tu cuenta admin y verifica que carga el panel.

> La app es un **contenedor WebView** apuntando a Railway. Los cambios de UI en el servidor se ven sin republicar APK (salvo iconos/splash nativos).

### 3. Iconos (ya automatizado)

```bash
npm run cap:icons
```

Regenera desde `public/brand/logo.png` → `android/app/src/main/res/mipmap-*`.  
Si quieres retocar a mano: **File → New → Image Asset** con el isotipo Cubik.

### 4. Keystore (solo la primera vez)

1. **Build → Generate Signed App Bundle / APK**
2. Elige **Android App Bundle**
3. **Create new…** keystore:
   - Ruta sugerida: fuera del repo, ej. `C:\Users\TU\keystores\cubik-upload.jks`
   - Alias: `cubik`
   - Contraseñas: guárdalas en gestor de claves (no commitear)
4. Build variant: **release**
5. El `.aab` queda en `android/app/release/app-release.aab`

**Importante:** el `.jks` no va al repo (está en `.gitignore`). Sin él no podrás actualizar la app en Play.

### 5. Play Console — prueba cerrada

1. [Play Console](https://play.google.com/console) → **Crear app** → nombre **Cubik**
2. **Testing → Closed testing** → crear pista → subir `app-release.aab`
3. **Testers** → lista de emails (tú + clientes demo)
4. Copiar **link de opt-in** y enviarlo; instalan desde Play Store

Ficha mínima antes de publicar la pista:
- **Icono** 512×512 (exportar desde `public/brand/logo.png`)
- **Capturas** de pantalla (celular)
- **Política de privacidad** (URL pública)
- Categoría sugerida: **Negocios** o **Maps & Navigation**

### 6. Troubleshooting

| Problema | Solución |
|----------|----------|
| Gradle sync failed | **File → Settings → Android SDK** → instalar API 35 + Build-Tools |
| Pantalla blanca | Verificar internet; URL en `capacitor.config.json` |
| SSL / certificado | Railway usa HTTPS válido; no mezclar HTTP |
| Cambié iconos | `npm run cap:icons` y rebuild release |

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
