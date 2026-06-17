'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseChileanDocument,
  parseChileanDocDate,
  classifyDocumentType,
  extractRutCandidates,
} = require('../src/lib/chile-document-parser');

const SAMPLE_CI = `
REPUBLICA DE CHILE
CEDULA DE IDENTIDAD
APELLIDOS BUSTOS SALINAS
NOMBRES ARIEL GUILLERMO
NACIONALIDAD CHILENA
SEXO M
FECHA DE NACIMIENTO 03 FEB 1982
FECHA DE EMISION 06 JUN 2022
FECHA DE VENCIMIENTO 03 FEB 2032
RUN 15.363.398-3
NUMERO DOCUMENTO B5K.325.127
`;

const SAMPLE_LICENSE = `
REPUBLICA DE CHILE
LICENCIA DE CONDUCTOR
REGISTRO NACIONAL DE CONDUCTORES
APELLIDOS BUSTOS SALINAS
NOMBRES ARIEL GUILLERMO
RUN 15.363.398-3
CLASE B
FECHA DE VENCIMIENTO 15 DIC 2028
`;

describe('chile-document-parser', () => {
  it('parseChileanDocDate entiende DD MMM YYYY', () => {
    assert.equal(parseChileanDocDate('03 FEB 2032'), '2032-02-03');
    assert.equal(parseChileanDocDate('15 DIC 2028'), '2028-12-15');
  });

  it('extrae RUT desde texto OCR', () => {
    const ruts = extractRutCandidates(SAMPLE_CI);
    assert.ok(ruts.includes('15363398-3'));
  });

  it('clasifica cédula de identidad', () => {
    assert.equal(classifyDocumentType(SAMPLE_CI, null), 'ci');
    assert.equal(classifyDocumentType(SAMPLE_LICENSE, null), 'license');
  });

  it('parsea cédula con RUT, nombre y vencimiento', () => {
    const parsed = parseChileanDocument(SAMPLE_CI);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.docType, 'ci');
    assert.equal(parsed.rut, '15363398-3');
    assert.equal(parsed.expiresAt, '2032-02-03');
    assert.match(parsed.fullName || '', /ARIEL GUILLERMO/i);
    assert.match(parsed.fullName || '', /BUSTOS/i);
  });

  it('parsea licencia con clase y vencimiento', () => {
    const parsed = parseChileanDocument(SAMPLE_LICENSE);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.docType, 'license');
    assert.equal(parsed.expiresAt, '2028-12-15');
    assert.equal(parsed.licenseClass, 'B');
    assert.equal(parsed.rut, '15363398-3');
  });

  it('respeta hint licencia si OCR ambiguo', () => {
    const parsed = parseChileanDocument('RUN 15.363.398-3 FECHA DE VENCIMIENTO 15 DIC 2028', {
      hint: 'license',
    });
    assert.equal(parsed.docType, 'license');
  });
});
