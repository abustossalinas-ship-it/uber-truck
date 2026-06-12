'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  handleInbound,
  detectRoleFromText,
  resetSessionsForTests,
} = require('../src/lib/whatsapp-bot');
const { parseWebhookMessages } = require('../src/services/whatsapp-cloud');

describe('whatsapp-bot', () => {
  beforeEach(() => resetSessionsForTests());

  it('detecta rol transportista desde texto wa.me', () => {
    assert.equal(
      detectRoleFromText('Te ayudo a encontrar nuevas oportunidades de carga'),
      'carrier'
    );
  });

  it('detecta rol empresa desde texto wa.me', () => {
    assert.equal(detectRoleFromText('Te ayudo a mover tu carga'), 'shipper');
  });

  it('primer mensaje envía bienvenida y menú', () => {
    const { replies, skipped } = handleInbound({
      from: '56912345678',
      text: 'Hola',
      messageId: 'm1',
    });
    assert.equal(skipped, false);
    assert.ok(replies.length >= 2);
    assert.match(replies[0], /Bienvenido a Cubik/i);
    assert.match(replies[1], /1️⃣/);
  });

  it('opción 1 responde FAQ', () => {
    handleInbound({ from: '56911111111', text: 'empresa logística', messageId: 'm2' });
    const { replies } = handleInbound({ from: '56911111111', text: '1', messageId: 'm3' });
    assert.match(replies[0], /Publicar una carga|Encontrar cargas/i);
  });

  it('humano escala a agente', () => {
    handleInbound({ from: '56922222222', text: 'hola', messageId: 'm4' });
    const { replies } = handleInbound({ from: '56922222222', text: 'humano', messageId: 'm5' });
    assert.match(replies[0], /ejecutivo|soporte/i);
  });

  it('deduplica por message id', () => {
    const first = handleInbound({ from: '56933333333', text: 'hola', messageId: 'dup-1' });
    const second = handleInbound({ from: '56933333333', text: 'hola', messageId: 'dup-1' });
    assert.equal(first.skipped, false);
    assert.equal(second.skipped, true);
  });
});

describe('whatsapp-cloud parse', () => {
  it('parsea mensaje de texto del webhook', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: '123' },
                messages: [
                  {
                    from: '56987654321',
                    id: 'wamid.x',
                    type: 'text',
                    text: { body: 'Hola Cubik' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const msgs = parseWebhookMessages(payload);
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].from, '56987654321');
    assert.equal(msgs[0].text, 'Hola Cubik');
    assert.equal(msgs[0].phoneNumberId, '123');
  });
});
