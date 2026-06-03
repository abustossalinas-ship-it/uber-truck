'use strict';

/** Bancos e instituciones financieras habituales en Chile (transferencias). */
const CHILE_BANKS = [
  'BancoEstado',
  'Banco de Chile',
  'Banco Santander-Chile',
  'Banco de Crédito e Inversiones (BCI)',
  'Scotiabank Chile',
  'Itaú Chile',
  'Banco Security',
  'Banco Falabella',
  'Banco Ripley',
  'Banco Consorcio',
  'Banco BICE',
  'Banco Internacional',
  'HSBC Bank (Chile)',
  'Banco do Brasil (Chile)',
  'Coopeuch',
  'Mercado Pago',
  'Tenpo',
  'Mach',
  'Prepago Los Héroes',
];

function normalizeBankName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function isValidChileBank(name) {
  const n = normalizeBankName(name).toLowerCase();
  if (!n) return false;
  return CHILE_BANKS.some((b) => b.toLowerCase() === n);
}

module.exports = { CHILE_BANKS, normalizeBankName, isValidChileBank };
