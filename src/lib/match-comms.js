'use strict';

const CHAT_PRESETS = [
  {
    code: 'request_human',
    label: 'Solicitar agente Cubik',
    body: 'Solicito que un agente humano de Cubik revise este emparejamiento y nos ayude a coordinar.',
    opens_support: true,
  },
  {
    code: 'delay_traffic',
    label: 'Retraso — tráfico / restricción',
    body: 'Informo retraso por tráfico o restricción vial. Nueva ETA en cuanto confirme.',
  },
  {
    code: 'delay_loading',
    label: 'Retraso — carga / descarga',
    body: 'Hay demora en carga o descarga. Coordinemos ventana alternativa.',
  },
  {
    code: 'coord_schedule',
    label: 'Coordinar horario',
    body: 'Necesito coordinar horario de retiro/entrega. ¿Qué ventana les acomoda?',
  },
  {
    code: 'issue_cargo',
    label: 'Inconveniente con la carga',
    body: 'Hay un inconveniente con la carga (daño, faltante, documentación). Revisemos antes de seguir.',
  },
  {
    code: 'mutual_cancel_request',
    label: 'Proponer cancelar por acuerdo',
    body: 'Propongo cancelar este emparejamiento por acuerdo mutuo sin multa. Confirma en «Cancelar emparejamiento».',
  },
];

function otherRole(role) {
  return role === 'carrier' ? 'shipper' : 'carrier';
}

function presetByCode(code) {
  return CHAT_PRESETS.find((p) => p.code === code) || null;
}

module.exports = { CHAT_PRESETS, otherRole, presetByCode };
