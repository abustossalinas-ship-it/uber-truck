'use strict';

const supabase = require('../services/supabase');

const { validateRut } = require('./rut-chile');
const { validateDocDateField, DOC_SELECT } = require('./carrier-documents');

const RUBROS = [
  { id: 'construccion', label: 'Construcción / materiales' },
  { id: 'retail_alimentos', label: 'Retail / alimentos secos' },
  { id: 'refrigerados', label: 'Refrigerados / congelados' },
  { id: 'retail_general', label: 'Retail / carga general' },
  { id: 'quimicos', label: 'Químicos / especial (curaduría)' },
];

const INSURANCE_LEVELS = ['A', 'B', 'C'];

/** Checkbox C3a ↔ campo de vencimiento (fecha impresa en documento legal). */
const LEGAL_DOC_PAIRS = [
  { check: 'onboarding_doc_ci', expiry: 'doc_ci_expires_at', label: 'CI' },
  { check: 'onboarding_doc_license', expiry: 'doc_license_expires_at', label: 'Licencia' },
  { check: 'onboarding_doc_soap', expiry: 'doc_soap_expires_at', label: 'SOAP' },
  { check: 'onboarding_doc_insurance', expiry: 'doc_insurance_expires_at', label: 'Seguro RC/carga' },
];

const ONBOARDING_SELECT = `${DOC_SELECT}, carrier_rubro, carrier_fleet_type, insurance_level, onboarding_doc_ci, onboarding_doc_license, onboarding_doc_soap, onboarding_doc_insurance, onboarding_vehicle_plates, onboarding_notes, onboarding_updated_at`;

function rubroLabel(id) {
  return RUBROS.find((r) => r.id === id)?.label || id || '—';
}

function insuranceLabel(level) {
  if (level === 'A') return 'A — Básico (SOAP + RC)';
  if (level === 'B') return 'B — Rubro';
  if (level === 'C') return 'C — Especial';
  return '—';
}

function checklistProgress(user) {
  if (!user || user.role !== 'carrier') return null;
  const items = [
    { key: 'onboarding_doc_ci', ok: !!user.onboarding_doc_ci, label: 'CI' },
    { key: 'onboarding_doc_license', ok: !!user.onboarding_doc_license, label: 'Licencia' },
    { key: 'onboarding_doc_soap', ok: !!user.onboarding_doc_soap, label: 'SOAP' },
    { key: 'onboarding_doc_insurance', ok: !!user.onboarding_doc_insurance, label: 'Seguro RC/carga' },
    { key: 'carrier_rubro', ok: !!String(user.carrier_rubro || '').trim(), label: 'Rubro' },
    { key: 'insurance_level', ok: !!String(user.insurance_level || '').trim(), label: 'Nivel seguro' },
    {
      key: 'onboarding_vehicle_plates',
      ok: !!String(user.onboarding_vehicle_plates || '').trim(),
      label: 'Patente(s)',
    },
  ];
  const done = items.filter((i) => i.ok).length;
  return {
    items,
    done,
    total: items.length,
    complete: done === items.length,
  };
}

function validateOnboardingPatch(body) {
  const patch = {};
  if (body.carrier_rubro !== undefined) {
    const v = String(body.carrier_rubro || '').trim();
    if (v && !RUBROS.some((r) => r.id === v)) {
      return { error: 'Rubro inválido' };
    }
    patch.carrier_rubro = v || null;
  }
  if (body.carrier_fleet_type !== undefined) {
    patch.carrier_fleet_type = String(body.carrier_fleet_type || '').trim().slice(0, 120) || null;
  }
  if (body.insurance_level !== undefined) {
    const v = String(body.insurance_level || '').trim().toUpperCase();
    if (v && !INSURANCE_LEVELS.includes(v)) {
      return { error: 'Nivel de seguro debe ser A, B o C' };
    }
    patch.insurance_level = v || null;
  }
  for (const key of [
    'onboarding_doc_ci',
    'onboarding_doc_license',
    'onboarding_doc_soap',
    'onboarding_doc_insurance',
  ]) {
    if (body[key] !== undefined) patch[key] = !!body[key];
  }
  if (body.onboarding_vehicle_plates !== undefined) {
    patch.onboarding_vehicle_plates =
      String(body.onboarding_vehicle_plates || '').trim().slice(0, 200) || null;
  }
  if (body.onboarding_notes !== undefined) {
    patch.onboarding_notes = String(body.onboarding_notes || '').trim().slice(0, 2000) || null;
  }
  if (body.national_rut !== undefined) {
    const raw = String(body.national_rut || '').trim();
    if (!raw) {
      patch.national_rut = null;
    } else {
      const rut = validateRut(raw);
      if (!rut.ok) return { error: rut.error || 'RUT inválido' };
      patch.national_rut = rut.rut;
    }
  }
  for (const [field, label] of [
    ['doc_ci_expires_at', 'Vencimiento CI'],
    ['doc_license_expires_at', 'Vencimiento licencia'],
    ['doc_insurance_expires_at', 'Vencimiento seguro'],
    ['doc_soap_expires_at', 'Vencimiento SOAP'],
  ]) {
    if (body[field] !== undefined) {
      const parsed = validateDocDateField(body[field], label);
      if (!parsed.ok) return { error: parsed.error };
      if (parsed.value !== undefined) patch[field] = parsed.value;
    }
  }
  if (Object.keys(patch).length) {
    patch.onboarding_updated_at = new Date().toISOString();
  }
  return { patch };
}

/**
 * Valida que RUT y fechas coincidan con documentación legal revisada (WhatsApp).
 * @param {object|null|undefined} user
 * @returns {string[]}
 */
function validateLegalDocumentation(user) {
  if (!user || user.role !== 'carrier') return [];
  const errors = [];
  const anyDocChecked = LEGAL_DOC_PAIRS.some((p) => user[p.check]);
  if (anyDocChecked && !String(user.national_rut || '').trim()) {
    errors.push('RUT titular obligatorio — debe coincidir con la cédula recibida por WhatsApp.');
  }
  for (const pair of LEGAL_DOC_PAIRS) {
    const checked = !!user[pair.check];
    const expiry = String(user[pair.expiry] || '').trim();
    if (checked && !expiry) {
      errors.push(
        `${pair.label}: documento marcado como recibido — ingresa la fecha de vencimiento impresa en el original legal.`
      );
    }
    if (expiry && !checked) {
      errors.push(
        `${pair.label}: hay fecha de vencimiento pero el documento no está marcado como recibido/verificado.`
      );
    }
  }
  return errors;
}

function mergeOnboardingState(existing, patch) {
  return { ...(existing || {}), ...(patch || {}) };
}

function deriveCarrierKycPhase(kycStatus, progress, docsCompliance) {
  if (docsCompliance === 'expired') return 'docs_expired';
  if (kycStatus === 'approved') return 'approved';
  if (kycStatus === 'rejected') return 'rejected';
  if (!progress || !progress.complete) return 'docs_pending';
  return 'admin_review';
}

async function attachOnboardingToUser(userRow) {
  if (!userRow || userRow.role !== 'carrier' || !supabase.isConfigured()) {
    return userRow;
  }
  const sb = supabase.getClient();
  const { data, error } = await sb
    .from('users')
    .select(ONBOARDING_SELECT)
    .eq('id', userRow.id)
    .maybeSingle();
  if (error) {
    console.warn('[onboarding] campos no disponibles:', error.message);
    return userRow;
  }
  return { ...userRow, ...(data || {}) };
}

/**
 * Resumen solo lectura para app Cuenta (espejo checklist C3a admin).
 * @param {object|null|undefined} user
 * @param {object|null|undefined} [compliance]
 */
function buildCarrierDocumentProfile(user, compliance) {
  if (!user || user.role !== 'carrier') return null;

  const legalDocs = LEGAL_DOC_PAIRS.map((pair) => {
    const verified = !!user[pair.check];
    const expiresAt = user[pair.expiry] ? String(user[pair.expiry]).slice(0, 10) : null;
    let status = 'missing';
    if (verified && expiresAt) {
      status = 'ok';
      const tracked = compliance?.tracked?.find((t) => t.key === pair.expiry);
      if (tracked && tracked.daysLeft < 0) status = 'expired';
      else if (tracked && tracked.daysLeft <= (compliance?.warnDays ?? 30)) status = 'expiring';
    } else if (verified || expiresAt) {
      status = 'incomplete';
    }
    return {
      key: pair.check,
      label: pair.label,
      verified,
      expires_at: expiresAt,
      status,
    };
  });

  const meta = [
    {
      key: 'carrier_rubro',
      label: 'Rubro',
      value: rubroLabel(user.carrier_rubro),
      ok: !!String(user.carrier_rubro || '').trim(),
    },
    {
      key: 'insurance_level',
      label: 'Nivel seguro',
      value: insuranceLabel(user.insurance_level),
      ok: !!String(user.insurance_level || '').trim(),
    },
    {
      key: 'onboarding_vehicle_plates',
      label: 'Patente(s)',
      value: String(user.onboarding_vehicle_plates || '').trim() || '—',
      ok: !!String(user.onboarding_vehicle_plates || '').trim(),
    },
    {
      key: 'carrier_fleet_type',
      label: 'Tipo flota',
      value: String(user.carrier_fleet_type || '').trim() || '—',
      ok: !!String(user.carrier_fleet_type || '').trim(),
    },
  ];

  const progress = checklistProgress(user);
  const missingLabels = [];
  for (const doc of legalDocs) {
    if (doc.status === 'missing' || doc.status === 'incomplete') missingLabels.push(doc.label);
  }
  for (const item of meta) {
    if (!item.ok) missingLabels.push(item.label);
  }

  let warningMessage = null;
  let warningLevel = 'info';
  if (compliance?.status === 'expired' && compliance.expired?.length) {
    warningLevel = 'danger';
    warningMessage = `Documentación vencida: ${compliance.expired.map((d) => d.label).join(', ')}. Actualiza por WhatsApp Cubik (escribe documentos).`;
  } else if (missingLabels.length) {
    warningLevel = 'warn';
    warningMessage = `Falta validar: ${missingLabels.join(', ')}. Envía fotos por WhatsApp Cubik (escribe documentos e indica tu RUT).`;
  } else if (compliance?.status === 'expiring' && compliance.expiring?.length) {
    warningLevel = 'warn';
    warningMessage = `Documentos por vencer: ${compliance.expiring.map((d) => `${d.label} (${d.dateLabel})`).join(' · ')}.`;
  }

  return {
    rut: user.national_rut || null,
    legal_docs: legalDocs,
    meta,
    progress,
    missing_labels: missingLabels,
    warning_message: warningMessage,
    warning_level: warningMessage ? warningLevel : null,
    docs_compliance_status: compliance?.status || user.docs_compliance_status || 'unknown',
    complete: Boolean(progress?.complete && !missingLabels.length),
  };
}

module.exports = {
  RUBROS,
  INSURANCE_LEVELS,
  ONBOARDING_SELECT,
  rubroLabel,
  insuranceLabel,
  checklistProgress,
  validateOnboardingPatch,
  validateLegalDocumentation,
  mergeOnboardingState,
  LEGAL_DOC_PAIRS,
  deriveCarrierKycPhase,
  attachOnboardingToUser,
  buildCarrierDocumentProfile,
};
