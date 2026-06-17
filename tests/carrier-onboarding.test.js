'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  checklistProgress,
  validateOnboardingPatch,
  rubroLabel,
  deriveCarrierKycPhase,
} = require('../src/lib/carrier-onboarding');

describe('carrier-onboarding', () => {
  it('checklistProgress completo cuando todos los ítems ok', () => {
    const p = checklistProgress({
      role: 'carrier',
      onboarding_doc_ci: true,
      onboarding_doc_license: true,
      onboarding_doc_soap: true,
      onboarding_doc_insurance: true,
      carrier_rubro: 'construccion',
      insurance_level: 'A',
      onboarding_vehicle_plates: 'ABCD12',
    });
    assert.equal(p.complete, true);
    assert.equal(p.done, 7);
  });

  it('checklistProgress null para embarcador', () => {
    assert.equal(checklistProgress({ role: 'shipper' }), null);
  });

  it('validateOnboardingPatch rechaza rubro inválido', () => {
    const r = validateOnboardingPatch({ carrier_rubro: 'invalido' });
    assert.ok(r.error);
  });

  it('validateOnboardingPatch acepta patch válido', () => {
    const r = validateOnboardingPatch({
      carrier_rubro: 'retail_alimentos',
      insurance_level: 'b',
      onboarding_doc_ci: true,
    });
    assert.equal(r.error, undefined);
    assert.equal(r.patch.carrier_rubro, 'retail_alimentos');
    assert.equal(r.patch.insurance_level, 'B');
    assert.ok(r.patch.onboarding_updated_at);
  });

  it('rubroLabel devuelve etiqueta legible', () => {
    assert.match(rubroLabel('construccion'), /Construcción/i);
  });

  it('deriveCarrierKycPhase distingue docs y revisión', () => {
    const incomplete = checklistProgress({ role: 'carrier', onboarding_doc_ci: true });
    assert.equal(deriveCarrierKycPhase('pending', incomplete), 'docs_pending');
    assert.equal(deriveCarrierKycPhase('approved', incomplete, 'expired'), 'docs_expired');
    const complete = checklistProgress({
      role: 'carrier',
      onboarding_doc_ci: true,
      onboarding_doc_license: true,
      onboarding_doc_soap: true,
      onboarding_doc_insurance: true,
      carrier_rubro: 'construccion',
      insurance_level: 'A',
      onboarding_vehicle_plates: 'ABCD12',
    });
    assert.equal(deriveCarrierKycPhase('pending', complete), 'admin_review');
    assert.equal(deriveCarrierKycPhase('approved', complete), 'approved');
  });
});
