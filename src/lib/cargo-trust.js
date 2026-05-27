'use strict';

const LEGAL_TERMS_VERSION = 'cargo-trust-v1';
const MIN_DECLARED_VALUE_CLP = 1000;
const MAX_DECLARED_VALUE_CLP = 5_000_000_000;

function termsAccepted(body) {
  const v = body?.terms_cargo_accepted;
  return v === true || v === 'true' || v === '1' || v === 1 || v === 'on';
}

function validateCargoDeclaration(body) {
  const errors = [];
  const desc = typeof body?.cargo_description === 'string' ? body.cargo_description.trim() : '';
  if (!desc || desc.length < 8) {
    errors.push('cargo_description: describe la mercadería (mín. 8 caracteres)');
  }
  if (desc.length > 2000) {
    errors.push('cargo_description: descripción demasiado larga');
  }
  const val = body?.declared_cargo_value_clp;
  if (val === undefined || val === null || val === '') {
    errors.push('declared_cargo_value_clp: indica el valor referencial de la mercadería en CLP');
  } else {
    const n = Number(val);
    if (Number.isNaN(n) || n < MIN_DECLARED_VALUE_CLP || n > MAX_DECLARED_VALUE_CLP) {
      errors.push(
        `declared_cargo_value_clp: valor entre $${MIN_DECLARED_VALUE_CLP.toLocaleString('es-CL')} y $${MAX_DECLARED_VALUE_CLP.toLocaleString('es-CL')}`
      );
    }
  }
  if (!termsAccepted(body)) {
    errors.push('terms_cargo_accepted: debes aceptar los términos de confianza y carga');
  }
  const folio = body?.dispatch_guide_folio?.trim?.() || '';
  if (folio.length > 120) {
    errors.push('dispatch_guide_folio: folio demasiado largo');
  }
  return errors;
}

function cargoTrustPayload(body) {
  const hasGuide =
    body?.has_dispatch_guide === true ||
    body?.has_dispatch_guide === 'yes' ||
    body?.has_dispatch_guide === '1';
  return {
    cargo_description: body.cargo_description.trim(),
    declared_cargo_value_clp: Number(body.declared_cargo_value_clp),
    has_dispatch_guide: hasGuide,
    dispatch_guide_folio: body.dispatch_guide_folio?.trim() || null,
    requires_cargo_insurance: Boolean(
      body.requires_cargo_insurance === true ||
        body.requires_cargo_insurance === '1' ||
        body.requires_cargo_insurance === 1
    ),
    legal_terms_version: LEGAL_TERMS_VERSION,
    terms_accepted_at: new Date().toISOString(),
  };
}

const INCIDENT_TYPES = ['theft', 'damage', 'shortage', 'delay', 'other'];

function validateIncident(body) {
  const errors = [];
  const type = body?.incident_type;
  if (!INCIDENT_TYPES.includes(type)) {
    errors.push(`incident_type: debe ser uno de ${INCIDENT_TYPES.join(', ')}`);
  }
  const desc = typeof body?.description === 'string' ? body.description.trim() : '';
  if (!desc || desc.length < 10) {
    errors.push('description: describe el incidente (mín. 10 caracteres)');
  }
  if (desc.length > 4000) {
    errors.push('description: texto demasiado largo');
  }
  return errors;
}

module.exports = {
  LEGAL_TERMS_VERSION,
  MIN_DECLARED_VALUE_CLP,
  MAX_DECLARED_VALUE_CLP,
  INCIDENT_TYPES,
  termsAccepted,
  validateCargoDeclaration,
  cargoTrustPayload,
  validateIncident,
};
