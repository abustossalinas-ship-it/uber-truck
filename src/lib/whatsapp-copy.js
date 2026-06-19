'use strict';

/** Textos compartidos: wa.me (prospectos) y bot Meta Cloud API */

/** Mensaje corto al abrir wa.me desde la landing (sin emojis — evita caracteres rotos en el enlace). */
const WA_ME_PREFILL = {
  shipper:
    'Hola Cubik, soy empresa. Quiero información sobre publicar cargas y encontrar transportistas.',
  carrier:
    'Hola Cubik, soy transportista. Quiero enviar documentos para validar mi cuenta (CI, licencia, SOAP, seguro).',
};

const DOCS_ROLE_PICK = `*Documentos de validación — Cubik*

¿Eres *transportista* o *empresa*?

• Escribe *soy transportista* → checklist CI, licencia, SOAP y seguro
• Escribe *soy empresa* → registro embarcador en getcubik.cl/app

Si ya te registraste, responde *soy transportista* o envía tu *RUT* / *email* de la app.

📄 Escribe *documentos* en cualquier momento para volver a validación.
↩️ Escribe *volver* para reiniciar desde cero.`;

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

function welcomeWithMenu(role) {
  const key = role === 'carrier' ? 'carrier' : 'shipper';
  const intro = WELCOME[key].replace(/\n\n¿En qué te puedo ayudar\?\s*$/, '');
  return `${intro}\n\n${MENU[key]}`;
}

const MENU = {
  shipper: `¿En qué te ayudo?
1️⃣ Cómo publicar una carga
2️⃣ Cómo encuentro transportistas
3️⃣ Costos, pagos y comisiones
4️⃣ Seguimiento de envíos
5️⃣ Registro y demo
📄 *documentos* — validación de cuenta
↩️ *volver* — reiniciar conversación
👤 Escribe *humano* para hablar con un ejecutivo`,
  carrier: `¿En qué te ayudo?
1️⃣ Cómo encuentro cargas
2️⃣ Cómo ofrezco mi camión / ruta
3️⃣ Pagos y liquidaciones
4️⃣ Estado de mis viajes
5️⃣ Registro en Cubik
6️⃣ Enviar documentos (piloto)
📄 *documentos* — validación de cuenta
↩️ *volver* — reiniciar conversación
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
*Fase 1 — ya con OCR automático:*
1️⃣ Cédula (anverso y reverso)
2️⃣ Licencia (solo anverso, fecha de control visible)

*Fase 2 — cuando los tengas:*
3️⃣ SOAP del camión (patente + vencimiento)
4️⃣ RC vehículo o póliza carga en tránsito (PDF/foto con vigencia)

*Fase 3 — en un mensaje de texto:*
5️⃣ Rubro + tipo de camión + patente(s)

Indica el *mismo email* de la app. Escribe *pendientes* para ver qué falta.`,
  },
};

const ONBOARDING_DOCS = {
  carrier: `*Checklist transportista — piloto Cubik*
Regístrate primero en getcubik.cl/app (rol transportista).

*Envía por WhatsApp:*
• Cédula + licencia (OCR automático)
• Cuando los tengas: SOAP + póliza RC/carga
• Texto: rubro + tipo camión + patente(s)

Escribe *pendientes* para ver tu avance o *6* para el detalle.`,
  shipper:
    'Para empresas embarcadoras el registro es en getcubik.cl/app (rol empresa). Revisamos identidad y datos corporativos antes de publicar cargas.',
};

/** Lista copy-paste tras CI/licencia OK — SOAP/RC pueden llegar después. */
function carrierDocsPendingReminder() {
  return `*Documentación pendiente — Cubik*

Ya registramos CI/licencia si las enviaste. Para quedar *verificado (7/7)* falta:

*Fotos (cuando las tengas):*
• *SOAP* — patente y fecha de vencimiento visibles
• *Seguro* — RC del vehículo *o* póliza de *carga en tránsito* (PDF/foto con vigencia)

*Un mensaje de texto con:*
• Rubro: construcción / retail-alimentos / frío / general
• Tipo camión: tracto, furgón 8t, tolva, thermo…
• Patente(s): ej. ABCD12

📌 Sin SOAP/RC puedes usar la app si CI y licencia están al día; la *oferta pública* queda pendiente hasta que el agente complete el checklist.

Escribe *soap*, *seguro* o *humano* cuando tengas los documentos.`;
}

/** Texto corto para pedir datos de flota (admin puede reenviar). */
function carrierFleetTextPrompt() {
  return `Envía en *un solo mensaje* (copia y completa):

Rubro: …
Tipo camión: …
Patente(s): …
Email app: …`;
}

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

function identityPrompt() {
  return `*Validación de cuenta — Cubik*
Indica tu *RUT* (ej. 12.345.678-9), el *email* con el que te registraste en la app o tu *nombre completo*.

Con eso verificamos si tu cuenta existe, está pendiente o aprobada, y qué documentos debes enviar.

↩️ Escribe *volver* para reiniciar · 📄 *documentos* para empezar de nuevo.`;
}

function identityNotFound() {
  return `No encontramos una cuenta transportista con esos datos.

1. Regístrate primero en getcubik.cl/app (rol *transportista*)
2. Vuelve aquí con tu *RUT* o *email* registrado
3. Escribe *documentos* para el checklist

¿Necesitas ayuda? Escribe *humano*.`;
}

function identityAmbiguous(count) {
  return `Encontramos *${count}* cuentas con ese nombre. Indica tu *RUT* o *email* exacto de la app para identificarte.`;
}

function identityWrongRole() {
  return 'Esa cuenta es de *empresa embarcadora*. Para transportistas regístrate en getcubik.cl/app con rol transportista.';
}

function formatExpiryLine(label, dateStr) {
  if (!dateStr) return `• ${label}: sin fecha registrada`;
  return `• ${label}: vence ${dateStr}`;
}

function carrierDocStatusLines(user) {
  return [
    formatExpiryLine('CI', user.doc_ci_expires_at),
    formatExpiryLine('Licencia', user.doc_license_expires_at),
    formatExpiryLine('Seguro', user.doc_insurance_expires_at),
    formatExpiryLine('SOAP', user.doc_soap_expires_at),
  ].join('\n');
}

function carrierPendingDocsMessage(user) {
  return `*Cuenta encontrada — pendiente de validación*
${user.full_name || 'Transportista'} · ${user.email}

Tu cuenta aún no está aprobada. Envía por este WhatsApp:
• Cédula (anverso/reverso)
• Licencia vigente
• SOAP + póliza RC/carga
• Rubro + patente(s)

Indica el *mismo email* de la app. Un agente completa el checklist en 24 h hábiles.`;
}

function carrierApprovedDocsMessage(user, compliance) {
  const lines = carrierDocStatusLines(user);
  let lead = `*Cuenta aprobada* — ${user.full_name || 'Transportista'}`;
  const pending = [];
  if (!user.doc_license_expires_at) pending.push('licencia');
  if (!user.doc_soap_expires_at) pending.push('SOAP');
  if (!user.doc_insurance_expires_at) pending.push('seguro');

  if (compliance?.status === 'expiring' && compliance.expiring?.length) {
    const warn = compliance.expiring.map((d) => d.label).join(', ');
    lead += `\n⚠️ Por vencer: ${warn}`;
  } else if (pending.length) {
    lead += `\n📋 Pendiente registrar: ${pending.join(', ')}.`;
  } else {
    lead += '\n✅ Documentación al día según registros Cubik.';
  }
  return `${lead}

${lines}

¿Necesitas *actualizar* algún documento? Responde: *CI*, *licencia*, *seguro* o *SOAP* y envía foto legible.`;
}

function carrierExpiredDocsMessage(user, compliance) {
  const names = (compliance?.expired || []).map((d) => d.label).join(', ');
  return `*Cuenta bloqueada — documentación vencida*
${user.full_name || 'Transportista'} · ${user.email}

Vencido: ${names || 'documentos registrados'}.
No puedes operar en la app hasta regularizar.

Envía por WhatsApp la foto *actualizada* del documento vencido (fecha legible).
Responde qué actualizas: *CI*, *licencia*, *seguro* o *SOAP*.`;
}

function docRenewInstruction(kind) {
  const map = {
    ci: 'Envía foto legible de tu *cédula* (anverso y reverso) con fecha de vencimiento visible.',
    license:
      'Envía *solo el anverso* de tu licencia (foto grande, buena luz). Debe verse *N° de licencia*, nombre y *fecha de control*.',
    insurance: 'Envía foto o PDF de tu *póliza RC/carga* con vigencia visible.',
    soap: 'Envía foto de tu *SOAP* al día con patente y vigencia visibles.',
  };
  return `${map[kind] || map.ci}

📎 Envía la foto ahora por este chat.
🔍 Cubik *lee automáticamente* cédula y licencia (RUT + vencimiento) si la foto es legible.
SOAP y seguro siguen con revisión manual por ahora.`;
}

const MEDIA_ACK_MANUAL = `⚠️ Si la foto no es legible, un agente revisará manualmente el checklist en el panel admin.`;

function mediaReceivedAck({ label, count, uploadTarget, ocrPending }) {
  const docLabel = label || 'documento';
  const extra =
    uploadTarget === 'ci'
      ? '\nSi falta el *reverso* de la cédula, envía otra foto.'
      : uploadTarget === 'license'
        ? '\nAsegúrate que se vea *clase* y *fecha de vencimiento*.'
        : '';

  if (ocrPending) {
    return `✅ Recibimos tu ${docLabel} (archivo ${count}).

🔍 *Leyendo documento…* En unos segundos te confirmamos si es *cédula* o *licencia*, con RUT y vencimiento.${extra}`;
  }

  return `✅ Recibimos tu ${docLabel} (archivo ${count}).

${MEDIA_ACK_MANUAL}${extra}

Puedes seguir enviando SOAP, seguro, etc. Escribe *humano* si necesitas ayuda.`;
}

function ocrDocumentApplied({ docType, rut, expiresAt, fullName, licenseClass, compliance }) {
  const docLabel = docType === 'license' ? 'Licencia de conducir' : 'Cédula de identidad';
  const lines = [`*${docLabel} validada automáticamente*`];
  if (fullName) lines.push(`Nombre: ${fullName}`);
  if (rut) lines.push(`RUT: ${rut}`);
  if (expiresAt && expiresAt !== '—') {
    lines.push(docType === 'license' ? `Fecha de control (vence): ${expiresAt}` : `Vence: ${expiresAt}`);
  }
  if (licenseClass && docType === 'license') lines.push(`Clase: ${licenseClass}`);

  const docExpired =
    compliance?.status === 'expired' &&
    compliance.expired?.some((d) => d.renewKey === docType);

  if (docExpired) {
    lines.push(
      '',
      `⚠️ *${docLabel} vencida* — debes renovarla en la municipalidad.`,
      '🚫 *Acceso a la app suspendido* hasta enviar la licencia vigente por este WhatsApp.',
      'Cuando renueves, escribe *licencia* y envía la foto actualizada.'
    );
  } else {
    lines.push('', carrierDocsPendingReminder());
  }
  return lines.join('\n');
}

function ocrDocumentFailed({ reason, docType, expectedRut, foundRut, foundName, expectedName, hint }) {
  if (reason === 'rut_mismatch') {
    return `⚠️ El RUT leído (${foundRut || '—'}) no coincide con tu cuenta (${expectedRut || '—'}).
Reenvía foto legible de *tu* cédula o licencia, o escribe *humano*.`;
  }
  if (reason === 'name_mismatch') {
    const label = docType === 'license' ? 'licencia' : 'cédula';
    return `⚠️ El nombre en la ${label} (${foundName || '—'}) no coincide con tu cuenta (${expectedName || '—'}).
Debe ser el mismo titular que tu CI. Reenvía *tu* documento o escribe *humano*.`;
  }
  if (reason === 'unknown_document' || reason === 'no_text_detected' || reason === 'text_too_short') {
    const suggest =
      hint === 'license'
        ? 'licencia de conducir'
        : hint === 'ci'
          ? 'cédula de identidad'
          : 'cédula o licencia';
    const dateHint =
      hint === 'license'
        ? 'con *fecha de control* (vencimiento) visible'
        : 'con *fecha de vencimiento* visible';
    return `No pudimos leer tu ${suggest} en la foto (poca luz, borrosa o recortada).
Reenvía con buena luz, sin reflejos y ${dateHint}. Escribe *CI* o *licencia* antes de la foto.`;
  }
  if (reason === 'missing_expiry' || reason === 'missing_rut') {
    const label = docType === 'license' ? 'licencia' : 'cédula';
    const missing =
      reason === 'missing_rut'
        ? 'el RUT (N° de licencia)'
        : docType === 'license'
          ? 'la *fecha de control* (vencimiento)'
          : 'la fecha de vencimiento';
    const tip =
      docType === 'license'
        ? '\nEnvía *solo el anverso*, foto grande con buena luz (no anverso+reverso juntos).'
        : '';
    return `Leímos tu ${label}, pero falta ${missing} legible.
Reenvía foto más nítida con todos los datos visibles.${tip}`;
  }
  if (reason === 'vision_error' || reason === 'download_failed' || reason === 'db_error' || reason === 'tesseract_error') {
    return `Recibimos tu archivo, pero hubo un error técnico al leerlo. Intenta de nuevo en 1 minuto o escribe *humano*.`;
  }
  return `No pudimos validar el documento automáticamente. Reenvía foto legible o escribe *humano* para revisión manual.`;
}

function ocrNeedIdentity() {
  return `Para registrar tu documento automáticamente, primero identifica tu cuenta:
*documentos* → *soy transportista* → tu *RUT* o *email* de la app.
Luego reenvía la foto de CI o licencia.`;
}

function mediaReceivedNeedIdentity() {
  return `Recibimos tu archivo, pero aún no identificamos tu cuenta.

Escribe *documentos* → *soy transportista* → indica tu *RUT* o *email* de la app.
Luego reenvía las fotos.`;
}

module.exports = {
  WA_ME_PREFILL,
  DOCS_ROLE_PICK,
  WELCOME,
  welcomeWithMenu,
  MENU,
  HUMAN,
  FAQ,
  ONBOARDING_DOCS,
  GENERIC,
  identityPrompt,
  identityNotFound,
  identityAmbiguous,
  identityWrongRole,
  carrierPendingDocsMessage,
  carrierApprovedDocsMessage,
  carrierExpiredDocsMessage,
  docRenewInstruction,
  mediaReceivedAck,
  mediaReceivedNeedIdentity,
  MEDIA_ACK_MANUAL,
  ocrDocumentApplied,
  ocrDocumentFailed,
  ocrNeedIdentity,
  carrierDocsPendingReminder,
  carrierFleetTextPrompt,
};
