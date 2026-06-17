'use strict';

/** Textos compartidos: wa.me (prospectos) y bot Meta Cloud API */

/** Mensaje corto al abrir wa.me desde la landing (sin emojis — evita caracteres rotos en el enlace). */
const WA_ME_PREFILL = {
  shipper:
    'Hola Cubik, soy empresa. Quiero información sobre publicar cargas y encontrar transportistas.',
  carrier:
    'Hola Cubik, soy transportista. Quiero información sobre cargas disponibles para mi ruta.',
};

const WELCOME = {
  shipper: `👋 Bienvenido a Cubik.
Te ayudo a mover tu carga de forma más rápida y eficiente.
Puedes preguntarme sobre:
• Publicar una carga
• Encontrar transportistas
• Costos y pagos
• Seguimiento de envíos
• Soporte de la plataforma

¿En qué te puedo ayudar?`,
  carrier: `👋 Bienvenido a Cubik.
Te ayudo a encontrar nuevas oportunidades de carga y sacar mayor provecho a tus rutas.
Puedes preguntarme sobre:
• Cargas disponibles
• Cómo emparejar viajes
• Pagos y liquidaciones
• Estado de tus viajes
• Soporte de la plataforma

¿En qué te puedo ayudar?`,
};

const MENU = {
  shipper: `¿En qué te ayudo?
1️⃣ Cómo publicar una carga
2️⃣ Cómo encuentro transportistas
3️⃣ Costos, pagos y comisiones
4️⃣ Seguimiento de envíos
5️⃣ Registro y demo
👤 Escribe *humano* para hablar con un ejecutivo`,
  carrier: `¿En qué te ayudo?
1️⃣ Cómo encuentro cargas
2️⃣ Cómo ofrezco mi camión / ruta
3️⃣ Pagos y liquidaciones
4️⃣ Estado de mis viajes
5️⃣ Registro en Cubik
6️⃣ Enviar documentos (piloto)
👤 Escribe *humano* para hablar con soporte`,
};

const HUMAN = {
  shipper: `Te conecto con un ejecutivo de Cubik.
Cuéntame en una línea: empresa, ruta que necesitas y urgencia.
Un agente te responderá a la brevedad (horario hábil Chile).`,
  carrier: `Te paso con soporte Cubik.
Indica: nombre, flota y ruta que te interesa (origen → destino).
Te respondemos pronto en horario hábil.`,
};

const FAQ = {
  shipper: {
    1: `*Publicar una carga*
1. Entra a getcubik.cl/app y crea cuenta de *empresa*.
2. Tras validar tu cuenta, ve a *Publicar carga*.
3. Indica origen, destino, peso/cubicación y fecha de retiro.
4. Los transportistas verán tu necesidad y podrán ofertar.`,
    2: `*Encontrar transportistas*
En el tablero de *Emparejar* ves propuestas por precio, tiempo y reputación. Tú aceptas la que prefieras.`,
    3: `*Costos y pagos*
El precio del flete se acuerda en la plataforma (CLP). Las reglas de comisión se informan al activar tu cuenta.`,
    4: `*Seguimiento*
Con un viaje activo tienes mapa en vivo y estados: asignado, en tránsito, entregado, etc.`,
    5: `*Registro y demo*
• App: getcubik.cl/app (rol empresa)
• Demo: getcubik.cl/empresas → *Agendar demo*
Revisamos tu cuenta el mismo día hábil antes de operar.`,
  },
  carrier: {
    1: `*Encontrar cargas*
1. Regístrate en getcubik.cl/app como *transportista*.
2. Con cuenta validada, revisa el *tablero* y cargas en tu corredor.
3. Oferta o acepta emparejamientos según precio y ruta.`,
    2: `*Ofertar ruta / camión*
En la app: *Ofertar ruta* — indica origen, destino, cubicación libre y fechas.`,
    3: `*Pagos*
Al activar tu cuenta te explicamos cuándo y cómo se paga cada viaje. Los acuerdos quedan registrados en Cubik.`,
    4: `*Mis viajes*
En *Mis viajes* ves estado, chat con la empresa, mapa en ruta y cierre de entrega.`,
    5: `*Registro*
• App: getcubik.cl/app (rol transportista)
• Demo: getcubik.cl/transportistas
Tras registrarte, envía documentos (opción *6*).`,
    6: `*Documentos piloto (C3a)*
Envía por este WhatsApp (fotos legibles):
1️⃣ Cédula de identidad (anverso y reverso)
2️⃣ Licencia de conducir vigente
3️⃣ SOAP al día
4️⃣ Póliza RC / seguro carga (según tu rubro)
5️⃣ Rubro principal + tipo de camión + patente(s)

Indica el *mismo email* con el que te registraste en la app.
Un agente marca el checklist y te aprueba en 24 h hábiles.`,
  },
};

const ONBOARDING_DOCS = {
  carrier: `*Checklist transportista — piloto Cubik*
Regístrate primero en getcubik.cl/app (rol transportista).

Luego envía por WhatsApp:
• Cédula (anverso/reverso)
• Licencia vigente
• SOAP + póliza RC/carga
• Rubro (construcción / retail / frío) + patente del camión

Usa el *mismo email* de la app. Escribe *6* para ver el detalle o *humano* para soporte.`,
  shipper:
    'Para empresas embarcadoras el registro es en getcubik.cl/app (rol empresa). Revisamos identidad y datos corporativos antes de publicar cargas.',
};

const GENERIC = {
  price:
    'El precio depende de ruta, peso y urgencia. Publica la carga o tu oferta en la app y recibirás propuestas en CLP.',
  register:
    'Regístrate en getcubik.cl/app con el rol correcto (empresa o transportista). Revisamos tu cuenta antes de operar.',
  demo: 'Agenda una demo en getcubik.cl/empresas o getcubik.cl/transportistas, o déjanos nombre, empresa y correo aquí.',
  tech: '¿Qué ves en pantalla? Si no puedes entrar, escribe *humano* y te deriva un agente.',
  escalate:
    'Eso lo revisa un agente de Cubik para darte una respuesta exacta. Escribe *humano* con tu nombre y empresa o flota.',
};

module.exports = {
  WA_ME_PREFILL,
  WELCOME,
  MENU,
  HUMAN,
  FAQ,
  ONBOARDING_DOCS,
  GENERIC,
};
