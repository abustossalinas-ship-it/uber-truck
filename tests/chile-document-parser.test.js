'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseChileanDocument,
  parseChileanDocDate,
  classifyDocumentType,
  extractRutCandidates,
  extractLicenseExpiryDate,
  namesMatch,
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

const SAMPLE_LICENSE_CONTROL = `
REPUBLICA DE CHILE
LICENCIA DE CONDUCTOR
APELLIDOS BUSTOS SALINAS
NOMBRES ARIEL GUILLERMO
N° LICENCIA 15.363.398-3
CLASE B
FECHA ULTIMO CONTROL 03/02/2020
FECHA DE CONTROL 03/02/2026
MUNICIPALIDAD CALERA DE TANGO
`;

const SAMPLE_LICENSE_COMMA = `
LICENCIA DE CONDUCTOR
REPUBLICA DE CHILE
N° DE LICENCIA 15,363,398-3
NOMBRES ARIEL GUILLERMO
APELLIDOS BUSTOS SALINAS
FECHA DE CONTROL 03/02/2030
15363398-3
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
    assert.match(parsed.fullName || '', /ARIEL GUILLERMO/i);
  });

  it('parsea licencia con fecha de control chilena', () => {
    const parsed = parseChileanDocument(SAMPLE_LICENSE_CONTROL);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.docType, 'license');
    assert.equal(parsed.expiresAt, '2026-02-03');
    assert.equal(extractLicenseExpiryDate(SAMPLE_LICENSE_CONTROL), '2026-02-03');
  });

  it('namesMatch tolera orden y acentos', () => {
    assert.equal(namesMatch('Juan Bastidas', 'JUAN BASTIDAS'), true);
    assert.equal(namesMatch('ARIEL GUILLERMO BUSTOS SALINAS', 'Ariel Guillermo Bustos Salinas'), true);
    assert.equal(namesMatch('Pedro Perez', 'Juan Bastidas'), false);
  });

  it('extrae RUT con comas desde N DE LICENCIA', () => {
    const ruts = extractRutCandidates(SAMPLE_LICENSE_COMMA);
    assert.ok(ruts.includes('15363398-3'));
    const parsed = parseChileanDocument(SAMPLE_LICENSE_COMMA, { hint: 'license' });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.rut, '15363398-3');
    assert.equal(parsed.expiresAt, '2030-02-03');
  });

  it('licencia sin RUT OCR usa fecha y nombre si cuenta ya tiene RUT', () => {
    const parsed = parseChileanDocument(
      'LICENCIA DE CONDUCTOR NOMBRES JUAN APELLIDOS BASTIDAS FECHA DE CONTROL 03/03/2020',
      { hint: 'license' }
    );
    assert.equal(parsed.ok, true);
    assert.equal(parsed.rut, null);
    assert.equal(parsed.expiresAt, '2020-03-03');
  });

  it('respeta hint licencia si OCR ambiguo', () => {
    const parsed = parseChileanDocument('RUN 15.363.398-3 FECHA DE VENCIMIENTO 15 DIC 2028', {
      hint: 'license',
    });
    assert.equal(parsed.docType, 'license');
  });
});
