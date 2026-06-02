# Cubik — Push notifications (Fase 4)

El código ya incluye `@capacitor/push-notifications` (registro al abrir la app). Para que **lleguen notificaciones reales** hace falta Firebase (FCM) y Play Console.

## Requisitos

- Cuenta [Firebase](https://console.firebase.google.com/)
- Mismo proyecto vinculado a Play Console
- App Android `cl.cubik.logistics` registrada en Firebase

## Pasos

### 1. Firebase

1. Crear proyecto **Cubik** (o usar uno existente).
2. **Agregar app** → Android.
3. Package name: `cl.cubik.logistics` (exacto).
4. Descargar **`google-services.json`**.

### 2. Colocar en el repo Android

```
android/app/google-services.json
```

No commitear si el repo es público — usar variable/secreto en CI. En repo privado está bien.

### 3. Gradle (Android Studio)

En `android/build.gradle` (proyecto), classpath de Google services si no está.

En `android/app/build.gradle`, al final:

```gradle
apply plugin: 'com.google.gms.google-services'
```

(Capacitor ya intenta aplicarlo si existe el JSON.)

### 4. Sync y rebuild

```bash
npm run cap:sync:remote
```

Android Studio → **Build → Clean** → **Run**.

### 5. Probar token

1. Instalar en dispositivo físico (emulador a veces no recibe push).
2. Logcat: buscar registro FCM / Capacitor Push.
3. En Firebase → **Messaging** → enviar prueba al token del dispositivo.

### 6. Backend (pendiente producto)

Hoy las notificaciones in-app son **campana + polling/WebSocket**. Para push desde servidor:

- Guardar `device_token` por usuario en Supabase.
- Endpoint o job que llame a FCM HTTP v1 al crear notificación.

Eso es una tarea aparte del shell móvil.

## Si no configurás FCM

La app **no falla**: el plugin hace `register` y falla en silencio. Todo lo demás (login, viajes) sigue funcionando.
