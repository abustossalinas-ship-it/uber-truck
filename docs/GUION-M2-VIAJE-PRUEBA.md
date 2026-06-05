# Guion M2 — viaje de prueba (Calera de Tango → Peñalolén)

**Fecha objetivo:** mañana · **Corredor:** RM (piloto M2)  
**Setup:** transportista = **APK en celular** · embarcador = **web en PC** (misma prod)

**URLs:** app https://uber-truck-production.up.railway.app/?app=1 · docs https://uber-truck-production.up.railway.app/docs/

---

## Antes de salir (10 min)

| Check | Cómo |
|-------|------|
| 2 cuentas distintas | Ej. `tu+carrier@gmail.com` (transportista) y `tu+shipper@gmail.com` (embarcador) |
| KYC aprobado | Admin → Panel → aprobar ambas |
| Billetera | Al menos 1 cuenta bancaria en cada rol |
| APK transportista | Ubicación **Permitir siempre** (Ajustes → Apps → Cubik) |
| Web embarcador | Chrome/Edge, sesión solo embarcador (no mezclar con carrier en la misma pestaña) |
| SQL GPS | `016_carrier_gps.sql` aplicado (ver `RUN_VERIFY_SIMPLE.sql`) |

---

## Fase 1 — Embarcador (web, PC)

1. Abrir https://uber-truck-production.up.railway.app/?app=1  
2. **Iniciar sesión** cuenta embarcador.  
3. Pestaña **Pedir flete** → **Publicar carga**.  
4. **Origen:** escribe `Calera de Tango` → elige sugerencia **Google Maps** (no solo texto libre).  
5. **Destino:** `Peñalolén` → misma regla (sugerencia Maps).  
6. Cubicación mínima (ej. 1 pallet), términos, valor ref., rango flete.  
7. **Publicar**.  
8. Anotar que la carga quedó **publicada** (id visible en Emparejar si hace falta).

> **Crítico:** sin elegir sugerencias Maps no hay `lat/lng` → **no hay mapa en vivo**.

---

## Fase 2 — Transportista (APK, celular)

1. Abrir **Cubik** → login cuenta **transportista**.  
2. Aceptar **ubicación** cuando lo pida.  
3. Opción A — **Ofertar ruta** con mismo origen/destino (Maps) y enviar propuesta + precio CLP.  
   Opción B — Si ya hay match desde web demo, ir directo a **Emparejar**.  
4. En **Emparejar** → emparejar con la carga de Calera → Peñalolén.  
5. Embarcador (web): **Aceptar precio** / confirmar match → estado **Aceptado**.

---

## Fase 3 — GPS y mapa (transportista en ruta)

1. **APK transportista:** pestaña **Emparejar** → ver el match **Aceptado**.  
2. Antes o al arrancar: en **Cuenta** verifica texto tipo «GPS activo en sesión».  
3. Pulsa **Marcar en ruta** (solo transportista) al salir de Calera de Tango.  
4. Mantén la **app abierta** en primer plano mientras manejas (mejor señal GPS).  
5. Cada ~25–45 s la app envía posición al servidor.

**Embarcador (web):**

1. **Emparejar** o **Mis viajes → En curso**.  
2. Debe aparecer **mapa del viaje** (origen verde, destino rojo, camión naranja).  
3. Si no se mueve: refresca Emparejar; al moverte debería actualizarse vía SSE.  
4. Prueba **Chat** con un mensaje desde cada lado.

---

## Fase 4 — Cierre (cuenta para M2)

1. **Transportista (APK):** al llegar a Peñalolén → **Marcar entregado en destino**.  
2. **Embarcador (web):** **Confirmar recepción de carga** → estado **Completado**.  
3. Opcional: **Calificar** en **Mis viajes → Completados** (ambos roles).  
4. Viaje = **1 de 20** del piloto M2 si corredor RM y `status = completed`.

---

## Si algo falla

| Síntoma | Qué hacer |
|---------|-----------|
| No hay mapa | Republicar carga eligiendo sugerencias Maps; revisar `GOOGLE_MAPS_API_KEY` en Railway |
| Camión naranja no aparece | Permiso ubicación APK; match en **Aceptado/En ejecución**; transportista con app abierta |
| Mapa congelado | Refrescar Emparejar; transportista debe seguir en ruta con GPS |
| No empareja | KYC pending, banco faltante, multa vencida |
| Sesión cruzada | Cerrar sesión en web antes de cambiar de rol |

---

## Mapa interactivo en vivo (v0.0.95)

Mapa **Google Maps JS**: zoom, pan, marcador naranja animado al moverte. Requiere **Maps JavaScript API** en Google Cloud (misma clave o `GOOGLE_MAPS_BROWSER_KEY` en Railway).

Si falla, la app usa mapa estático como respaldo.
