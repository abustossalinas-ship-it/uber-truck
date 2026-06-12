# Cubik — WhatsApp Business: guion del bot y FAQ

Documento de referencia para configurar el bot (Vambe, Respond.io, Meta Cloud API, etc.) y alinear copy con la web y la API de prospectos.

**Número comercial (wa.me):** `+56 9 7141 9384` — variable `CUBIK_WHATSAPP_E164=56971419384`  
**App:** https://www.getcubik.cl/app  
**Agendar demo:** formulario en `/empresas` y `/transportistas` → `POST /api/prospectos`

---

## Arquitectura recomendada

1. **Número público Cubik** (WhatsApp Business API) → bot con menú y FAQ.
2. **Agente humano** en panel del proveedor (no mezclar con WhatsApp personal).
3. Escalamiento cuando el usuario elige «Hablar con persona» o el bot no resuelve.

```
Usuario → WhatsApp Cubik → Bot (menú + FAQ) → ¿Resuelve?
                                              ├─ Sí → link app / prospecto
                                              └─ No → agente humano
```

---

## Mensajes de bienvenida (primer mensaje del usuario)

### Empresa (recomendado)

```
👋 Bienvenido a Cubik.
Te ayudo a mover tu carga de forma más rápida y eficiente.
Puedes preguntarme sobre:
• Publicar una carga
• Encontrar transportistas
• Costos y pagos
• Seguimiento de envíos
• Soporte de la plataforma

¿En qué te puedo ayudar?
```

### Transportista (recomendado)

```
👋 Bienvenido a Cubik.
Te ayudo a encontrar nuevas oportunidades de carga y sacar mayor provecho a tus rutas.
Puedes preguntarme sobre:
• Cargas disponibles
• Cómo emparejar viajes
• Pagos y liquidaciones
• Estado de tus viajes
• Soporte de la plataforma

¿En qué te puedo ayudar?
```

Implementación en código: `src/lib/prospectos.js` → `WHATSAPP_MESSAGES`.

---

## Menú rápido

### Empresa

```
¿En qué te ayudo?
1️⃣ Cómo publicar una carga
2️⃣ Cómo encuentro transportistas
3️⃣ Costos, pagos y comisiones
4️⃣ Seguimiento de envíos
5️⃣ Registro y demo
👤 Hablar con un ejecutivo
```

### Transportista

```
¿En qué te ayudo?
1️⃣ Cómo encuentro cargas
2️⃣ Cómo ofrezco mi camión / ruta
3️⃣ Pagos y liquidaciones
4️⃣ Estado de mis viajes
5️⃣ Registro en Cubik
👤 Hablar con soporte
```

---

## FAQ — Empresa

### 1. ¿Qué es Cubik?

Cubik es una plataforma logística que conecta **empresas que necesitan transporte** con **transportistas verificados** en Chile. Publicas tu carga, comparas propuestas y sigues el viaje en un solo lugar.

### 2. ¿Cómo publico una carga?

1. Entra a **getcubik.cl/app** y crea cuenta de **empresa**.
2. Tras la validación de tu cuenta, ve a **Publicar carga**.
3. Indica origen, destino, peso/cubicación y cuándo necesitas el retiro.
4. Los transportistas verán tu necesidad y podrán ofertar.

### 3. ¿Cuánto cuesta usar Cubik?

El precio del flete se acuerda entre empresa y transportista en la plataforma (CLP). Las reglas de comisión o fee se te informan al registrarte y activar tu cuenta.

### 4. ¿Cómo elijo un transportista?

En el **tablero de emparejamiento** ves propuestas por precio, tiempo y reputación. Tú **aceptas** la que prefieras; no es asignación automática obligatoria.

### 5. ¿Puedo ver dónde va mi carga?

Sí. Con un viaje activo tienes **seguimiento en mapa** y estados del viaje (asignado, en tránsito, entregado, etc.).

### 6. ¿Cubik transporta mi mercadería?

No. Cubik es **intermediación tecnológica**: conecta empresas con transportistas. El transporte y la custodia de la carga son responsabilidad del transportista contratado.

### 7. ¿Necesito contrato o solo usar la app?

Para operar en Cubik basta con **registrarte en la plataforma y aceptar los términos de uso**. Si tu empresa necesita un **contrato marco** con el transportista, eso se acuerda entre ustedes; la plataforma facilita el contacto, el viaje y el registro del servicio.

### 8. ¿Cuánto tarda el registro?

Completas los datos mínimos en **pocos minutos**. Antes de publicar cargas o emparejar, **revisamos tu cuenta** (empresa, contacto y datos básicos) para mantener la red confiable; en general te respondemos **el mismo día hábil**.

### 9. ¿Puedo agendar una demo?

Sí. En la web elige **Agendar demo** o indícanos nombre, empresa, correo y volumen mensual de envíos. También puedes completar el formulario en getcubik.cl/empresas.

### 10. No puedo entrar / olvidé mi contraseña

Usa **¿Olvidaste tu contraseña?** en la app con el mismo correo de registro. Si el problema continúa, un ejecutivo te ayuda (escalamiento humano).

### Escalamiento humano (empresa)

```
Te conecto con un ejecutivo de Cubik.
Cuéntame en una línea: empresa, ruta que necesitas y urgencia.
Un agente te responderá a la brevedad (horario hábil Chile).
```

---

## FAQ — Transportista

### 1. ¿Qué es Cubik para mí?

Cubik te ayuda a **encontrar cargas** para tus rutas y reducir viajes vacíos. Publicas tu capacidad u ofertas y emparejas con empresas que buscan transporte.

### 2. ¿Cómo encuentro cargas?

1. Regístrate en **getcubik.cl/app** como **transportista**.
2. Cuando tu cuenta esté validada, revisa el **tablero** y las cargas en tu corredor.
3. Oferta o acepta emparejamientos según precio y ruta.

### 3. ¿Cómo publico mi camión o ruta?

En la app: **Ofertar ruta / capacidad** — indica origen, destino, cubicación libre y fechas. Las empresas con necesidad compatible te verán en el matching.

### 4. ¿Yo fijo el precio?

Sí. Puedes **proponer precio en CLP** o responder a cargas publicadas. La empresa acepta la propuesta que le acomode.

### 5. ¿Cuándo me pagan?

Al **activar tu cuenta** te explicamos **cuándo y cómo se paga** cada viaje. Los acuerdos quedan **registrados en Cubik**; según el caso puedes cobrar por transferencia y, cuando tu cuenta tenga habilitado el módulo, también por los **medios de pago integrados** en la app.

### 6. ¿Tengo que estar disponible todo el día?

No. Activas **disponibilidad** cuando tienes camión libre. Puedes ofertar solo en rutas que ya haces.

### 7. ¿Cómo sigo mis viajes?

En **Mis viajes** ves estado, chat con la empresa, mapa en ruta y cierre de entrega cuando corresponda.

### 8. ¿Qué necesito para registrarme?

Datos de tu **empresa o flota**, un **contacto responsable** y, si te lo solicitamos, **documentos que acrediten tu operación** (por ejemplo razón social y patente o permisos de transporte). Hasta que **validemos tu cuenta** no podrás ofertar ni tomar viajes: es para cuidar a empresas y transportistas de la red.

### 9. ¿Hay costo por usar Cubik?

No cobramos mensualidad fija por usar la plataforma. Cualquier comisión o fee operativo se comunica al activar tu cuenta.

### 10. ¿En qué zonas operan?

Cubik opera en corredores de Chile (por ejemplo **RM ↔ V / puertos**), con expansión gradual. Si tu ruta es otra, indícala y vemos si hay demanda en la red.

### Escalamiento humano (transportista)

```
Te paso con soporte Cubik.
Indica: nombre, flota y ruta que te interesa (origen → destino).
Te respondemos pronto en horario hábil.
```

---

## Respuestas comodín

| Usuario dice | Bot responde |
|--------------|--------------|
| Hola / buenas | Bienvenida + menú 1–5 |
| Precio / cuánto sale | Depende de ruta, peso y urgencia. Publica la carga o tu oferta y recibirás propuestas en CLP. |
| Registro / cuenta | Link getcubik.cl/app + rol correcto + «revisamos tu cuenta antes de operar» |
| Demo | Agenda demo en la web o deja nombre, empresa y correo |
| Problema técnico | ¿Qué ves en pantalla? Si no puedes entrar, derivo a un agente |
| Hablar con persona / ejecutivo / humano | Mensaje de escalamiento + notificación al agente |

---

## Siempre escalar a humano

- Reclamos por daño, robo o faltante de carga
- Disputas de pago entre partes
- Excepciones de precio o contrato
- Cambio de tipo de cuenta (empresa ↔ transportista)
- Acceso bloqueado tras muchos intentos

Mensaje tipo:

```
Eso lo revisa un agente de Cubik para darte una respuesta exacta según tu caso.
Te derivo ahora — ¿tu nombre y empresa o flota?
```

---

## Integración técnica (repo)

| Pieza | Ubicación |
|-------|-----------|
| Textos bienvenida / FAQ | `src/lib/whatsapp-copy.js` |
| Bot Meta Cloud API | `src/lib/whatsapp-bot.js` + `src/routes/whatsapp.js` |
| Setup Meta | `docs/WHATSAPP-META-CLOUD.md` |
| Mensajes wa.me por rol | `src/lib/prospectos.js` |
| Guardar leads demo | `POST /api/prospectos` → tabla `prospectos` |
| Migración SQL | `supabase/migrations/027_prospectos.sql` |
| CTAs landing | `public/empresas.html`, `public/transportistas.html` |
| Modal demo | `public/prospect-lead.js` |

**Admin:** `GET /api/prospectos` (JWT admin) lista prospectos.

---

## Checklist antes de producción WhatsApp Business

- [ ] Número dedicado Cubik (no personal) en Meta Business
- [ ] Proveedor bot configurado (Vambe / Meta / otro)
- [ ] Plantillas Meta aprobadas si envías mensajes proactivos
- [ ] Agentes en panel con horario hábil Chile
- [ ] `CUBIK_WHATSAPP_E164` en Railway
- [ ] Migración `027_prospectos` ejecutada en Supabase
