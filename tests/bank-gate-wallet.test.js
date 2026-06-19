'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { bankEnforced, fetchPaymentSetup } = require('../src/lib/bank-gate');

test('wallet sandbox pilot desactiva bank enforce', () => {
  const prevWallet = process.env.WALLET_ENABLED;
  const prevPay = process.env.PAYMENT_PROVIDER;
  const prevNode = process.env.NODE_ENV;
  process.env.WALLET_ENABLED = 'true';
  process.env.PAYMENT_PROVIDER = 'sandbox';
  process.env.NODE_ENV = 'production';
  try {
    assert.equal(bankEnforced(), false);
  } finally {
    if (prevWallet === undefined) delete process.env.WALLET_ENABLED;
    else process.env.WALLET_ENABLED = prevWallet;
    if (prevPay === undefined) delete process.env.PAYMENT_PROVIDER;
    else process.env.PAYMENT_PROVIDER = prevPay;
    if (prevNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
  }
});

test('fetchPaymentSetup permite operar en wallet sandbox pilot sin banco', async () => {
  const prevWallet = process.env.WALLET_ENABLED;
  const prevPay = process.env.PAYMENT_PROVIDER;
  process.env.WALLET_ENABLED = 'true';
  process.env.PAYMENT_PROVIDER = 'sandbox';
  try {
    const setup = await fetchPaymentSetup('user-test-1');
    assert.equal(setup.wallet_pilot, true);
    assert.equal(setup.can_operate, true);
  } finally {
    if (prevWallet === undefined) delete process.env.WALLET_ENABLED;
    else process.env.WALLET_ENABLED = prevWallet;
    if (prevPay === undefined) delete process.env.PAYMENT_PROVIDER;
    else process.env.PAYMENT_PROVIDER = prevPay;
  }
});
