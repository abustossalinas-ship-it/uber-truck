'use strict';

const CHAT_PRESETS = [
  {
    code: 'delay_traffic',
    label: 'Retraso — tráfico / restricción',
    body: 'Informo retraso por tráfico o restricción vial. Nueva ETA en cuanto confirme.',
    category: 'coordination',
  },
  {
    code: 'delay_loading',
    label: 'Retraso — carga / descarga',
    body: 'Hay demora en carga o descarga. Coordinemos ventana alternativa.',
    category: 'coordination',
  },
  {
    code: 'coord_schedule',
    label: 'Coordinar horario',
    body: 'Necesito coordinar horario de retiro/entrega. ¿Qué ventana les acomoda?',
    category: 'coordination',
  },
  {
    code: 'issue_cargo',
    label: 'Inconveniente con la carga',
    body: 'Hay un inconveniente con la carga (daño, faltante, documentación). Revisemos antes de seguir.',
    category: 'coordination',
  },
  {
    code: 'mutual_cancel_request',
    label: 'Proponer cancelar por acuerdo',
    body: 'Propongo cancelar este emparejamiento por acuerdo mutuo sin multa. Confirma en «Cancelar emparejamiento».',
    category: 'coordination',
  },
  {
    code: 'emergency_theft',
    label: 'Emergencia — robo o incidente',
    body: 'Reporto emergencia: robo, asalto o incidente grave con el camión o la carga. Solicito agente Cubik de inmediato.',
    category: 'emergency',
    opens_support: true,
  },
  {
    code: 'emergency_payment',
    label: 'Problema con el pago',
    body: 'Hay un problema con el pago acordado o la liquidación del viaje. Solicito revisión de un agente Cubik.',
    category: 'emergency',
    opens_support: true,
  },
  {
    code: 'emergency_transport',
    label: 'Emergencia en el transporte',
    body: 'Emergencia operativa grave (accidente, avería mayor, riesgo para personas o carga). Solicito agente Cubik.',
    category: 'emergency',
    opens_support: true,
  },
  {
    code: 'emergency_damage',
    label: 'Daño grave a la mercadería',
    body: 'La mercadería sufrió daño grave durante el transporte. Solicito que un agente Cubik revise el caso.',
    category: 'emergency',
    opens_support: true,
  },
];

function otherRole(role) {
  return role === 'carrier' ? 'shipper' : 'carrier';
}

function presetByCode(code) {
  return CHAT_PRESETS.find((p) => p.code === code) || null;
}

module.exports = { CHAT_PRESETS, otherRole, presetByCode };
