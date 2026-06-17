'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluateDocumentCompliance,
  parseIsoDate,
  docsBlockMessage,
} = require('../src/lib/carrier-documents');

describe('carrier-documents', () => {
  it('evaluateDocumentCompliance marca expired', () => {
    const c = evaluateDocumentCompliance(
      {
        role: 'carrier',
        doc_ci_expires_at: '2020-01-01',
        doc_license_expires_at: '2030-06-01',
      },
      30
    );
    assert.equal(c.status, 'expired');
    assert.equal(c.expired.length, 1);
    assert.equal(c.expired[0].label, 'Cédula de identidad');
  });

  it('evaluateDocumentCompliance marca expiring', () => {
    const soon = new Date();
    soon.setUTCDate(soon.getUTCDate() + 10);
    const iso = soon.toISOString().slice(0, 10);
    const c = evaluateDocumentCompliance(
      {
        role: 'carrier',
        doc_license_expires_at: iso,
      },
      30
    );
    assert.equal(c.status, 'expiring');
    assert.equal(c.expiring.length, 1);
  });

  it('parseIsoDate rechaza basura', () => {
    assert.equal(parseIsoDate('no-fecha'), null);
    assert.ok(parseIsoDate('2026-12-31'));
  });

  it('docsBlockMessage lista documentos vencidos', () => {
    const msg = docsBlockMessage({
      expired: [{ label: 'Licencia de conducir' }],
    });
    assert.match(msg, /Licencia/i);
    assert.match(msg, /WhatsApp/i);
  });

  it('docsBlockMessage indica bloqueo de cuenta', () => {
    const msg = docsBlockMessage({
      expired: [{ label: 'Licencia de conducir' }],
    });
    assert.match(msg, /bloqueada/i);
  });
});
