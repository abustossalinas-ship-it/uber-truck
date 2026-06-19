'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  handleInbound,
  detectRoleFromText,
  resetSessionsForTests,
  getSession,
} = require('../src/lib/whatsapp-bot');
const { parseWebhookMessages } = require('../src/services/whatsapp-cloud');

const mockLookup = async (query) => {
  if (String(query).includes('@')) {
    return {
      found: true,
      user: {
        email: query,
        full_name: 'Juan Test',
        kyc_status: 'pending',
        role: 'carrier',
      },
    };
  }
  return { found: false, reason: 'not_found' };
};

describe('whatsapp-bot', () => {
  beforeEach(() => resetSessionsForTests());

  it('detecta rol transportista desde texto wa.me', () => {
    assert.equal(
      detectRoleFromText('Te ayudo a encontrar nuevas oportunidades de carga'),
      'carrier'
    );
  });

  it('detecta rol empresa desde texto wa.me', () => {
    assert.equal(
      detectRoleFromText('Hola Cubik, soy empresa. Quiero publicar cargas y encontrar transportistas.'),
      'shipper'
    );
  });

  it('primer mensaje envía bienvenida y menú en un solo texto', async () => {
    const { replies, skipped } = await handleInbound({
      from: '56912345678',
      text: 'Hola',
      messageId: 'm1',
    });
    assert.equal(skipped, false);
    assert.equal(replies.length, 1);
    assert.match(replies[0], /Bienvenido a Cubik/i);
    assert.match(replies[0], /1️⃣/);
    assert.doesNotMatch(replies[0], /¿En qué te puedo ayudar\?[\s\S]*¿En qué te ayudo\?/);
  });

  it('opción 1 responde FAQ', async () => {
    await handleInbound({ from: '56911111111', text: 'empresa logística', messageId: 'm2' });
    const { replies } = await handleInbound({ from: '56911111111', text: '1', messageId: 'm3' });
    assert.match(replies[0], /Publicar una carga|Encontrar cargas/i);
  });

  it('humano escala a agente', async () => {
    await handleInbound({ from: '56922222222', text: 'hola', messageId: 'm4' });
    const { replies } = await handleInbound({
      from: '56922222222',
      text: 'humano',
      messageId: 'm5',
    });
    assert.match(replies[0], /ejecutivo|soporte/i);
  });

  it('documentos con rol transportista pide identidad', async () => {
    await handleInbound({ from: '56944444444', text: 'soy transportista', messageId: 'm6' });
    const { replies } = await handleInbound(
      {
        from: '56944444444',
        text: 'documentos',
        messageId: 'm7',
      },
      { lookupCarrierIdentity: mockLookup }
    );
    assert.match(replies[0], /RUT|email|nombre/i);
  });

  it('primer mensaje documentos pide rol (no menú empresa)', async () => {
    const { replies } = await handleInbound({
      from: '56966666666',
      text: 'documentos',
      messageId: 'm-docs-1',
    });
    assert.match(replies[0], /transportista|empresa/i);
    assert.doesNotMatch(replies[0], /Publicar una carga/i);
  });

  it('documentos luego soy transportista pide RUT', async () => {
    await handleInbound({ from: '56977777777', text: 'documentos', messageId: 'm-docs-2' });
    const { replies } = await handleInbound(
      {
        from: '56977777777',
        text: 'soy transportista',
        messageId: 'm-docs-3',
      },
      { lookupCarrierIdentity: mockLookup }
    );
    assert.match(replies[0], /RUT|email|nombre/i);
  });

  it('lookup por email responde cuenta pendiente', async () => {
    await handleInbound(
      { from: '56988888888', text: 'documentos', messageId: 'm8' },
      { lookupCarrierIdentity: mockLookup }
    );
    await handleInbound({ from: '56988888888', text: 'soy transportista', messageId: 'm9' }, {
      lookupCarrierIdentity: mockLookup,
    });
    const { replies } = await handleInbound(
      { from: '56988888888', text: 'test@getcubik.cl', messageId: 'm10' },
      { lookupCarrierIdentity: mockLookup }
    );
    assert.match(replies[0], /pendiente|Cédula/i);
  });

  it('opción 6 transportista pide identidad', async () => {
    await handleInbound({ from: '56955555555', text: 'transportista', messageId: 'm8' });
    const { replies } = await handleInbound(
      { from: '56955555555', text: '6', messageId: 'm9' },
      { lookupCarrierIdentity: mockLookup }
    );
    assert.match(replies[0], /RUT|email|Validación/i);
  });

  it('deduplica por message id', async () => {
    const first = await handleInbound({ from: '56933333333', text: 'hola', messageId: 'dup-1' });
    const second = await handleInbound({ from: '56933333333', text: 'hola', messageId: 'dup-1' });
    assert.equal(first.skipped, false);
    assert.equal(second.skipped, true);
  });

  it('documentos luego nombre no cae en menu empresa', async () => {
    await handleInbound({ from: '56999999991', text: 'documentos', messageId: 'trap-1' });
    const { replies } = await handleInbound(
      { from: '56999999991', text: 'juan bastidas', messageId: 'trap-2' },
      { lookupCarrierIdentity: mockLookup }
    );
    assert.doesNotMatch(replies.join(' '), /Publicar una carga/i);
    assert.match(replies.join(' '), /transportista|RUT|volver/i);
  });

  it('atrapado en menu empresa vuelve con soy transportista', async () => {
    await handleInbound({ from: '56999999992', text: 'hola', messageId: 'trap-3' });
    const { replies } = await handleInbound(
      { from: '56999999992', text: 'soy trasnportista', messageId: 'trap-4' },
      { lookupCarrierIdentity: mockLookup }
    );
    assert.match(replies[0], /RUT|email|Validación/i);
  });

  it('volver reinicia flujo documentos', async () => {
    await handleInbound({ from: '56999999993', text: 'hola', messageId: 'trap-5' });
    const { replies } = await handleInbound({
      from: '56999999993',
      text: 'volver',
      messageId: 'trap-6',
    });
    assert.match(replies[0], /transportista|empresa/i);
  });

  it('imagen sin identidad pide RUT primero', async () => {
    const { replies } = await handleInbound({
      from: '56988888880',
      text: '',
      mediaType: 'image',
      mediaId: 'img-1',
      messageId: 'media-1',
    });
    assert.match(replies[0], /documentos|RUT|email/i);
  });

  it('imagen tras identidad confirma recepcion manual', async () => {
    await handleInbound(
      { from: '56988888881', text: 'documentos', messageId: 'media-2' },
      { lookupCarrierIdentity: mockLookup }
    );
    await handleInbound({ from: '56988888881', text: 'soy transportista', messageId: 'media-3' }, {
      lookupCarrierIdentity: mockLookup,
    });
    await handleInbound(
      { from: '56988888881', text: 'test@getcubik.cl', messageId: 'media-4' },
      { lookupCarrierIdentity: mockLookup }
    );
    await handleInbound({ from: '56988888881', text: 'licencia', messageId: 'media-5' });
    const { replies } = await handleInbound({
      from: '56988888881',
      text: '',
      mediaType: 'image',
      mediaId: 'img-2',
      messageId: 'media-6',
    });
    assert.match(replies[0], /Recibimos/i);
    assert.match(replies[0], /manual|roadmap|agente|Leyendo documento/i);
  });

  it('licencia con cuenta vinculada pide foto sin reiniciar identidad', async () => {
    const phone = '56988888882';
    const approvedUser = {
      id: 'u1',
      email: 'juan@test.com',
      full_name: 'Juan Bastidas',
      kyc_status: 'approved',
      role: 'carrier',
    };
    const lookup = async () => ({ found: true, user: approvedUser });
    const session = getSession(phone);
    session.linkedUser = approvedUser;
    session.role = 'carrier';
    session.welcomed = true;
    const { replies } = await handleInbound(
      { from: phone, text: 'licencia', messageId: 'loop-2' },
      { lookupCarrierIdentity: lookup }
    );
    assert.match(replies[0], /anverso.*licencia|fecha de control/i);
    assert.doesNotMatch(replies[0], /Indica tu RUT/i);
    assert.equal(session.uploadTarget, 'license');
    assert.ok(session.linkedUser);
  });

  it('actualizar licencia con typo no reinicia flujo', async () => {
    const phone = '56988888883';
    const approvedUser = {
      id: 'u2',
      email: 'ab@test.com',
      full_name: 'Juan Bastidas',
      kyc_status: 'approved',
      role: 'carrier',
    };
    const lookup = async () => ({ found: true, user: approvedUser });
    const session = getSession(phone);
    session.linkedUser = approvedUser;
    session.role = 'carrier';
    session.welcomed = true;
    const { replies } = await handleInbound(
      { from: phone, text: 'Actuali,ar licencia', messageId: 'loop-4' },
      { lookupCarrierIdentity: lookup }
    );
    assert.match(replies[0], /licencia/i);
    assert.doesNotMatch(replies[0], /Indica tu RUT/i);
  });

  it('pendientes lista documentacion faltante', async () => {
    const phone = '56988888884';
    const user = {
      id: 'u3',
      email: 'test@getcubik.cl',
      full_name: 'Juan Bastidas',
      kyc_status: 'pending',
      role: 'carrier',
      doc_ci_expires_at: '2032-02-03',
      doc_license_expires_at: '2030-02-03',
    };
    const lookup = async () => ({ found: true, user });
    await handleInbound({ from: phone, text: 'documentos', messageId: 'p-1' }, { lookupCarrierIdentity: lookup });
    await handleInbound({ from: phone, text: 'soy transportista', messageId: 'p-2' }, { lookupCarrierIdentity: lookup });
    await handleInbound({ from: phone, text: 'test@getcubik.cl', messageId: 'p-3' }, { lookupCarrierIdentity: lookup });
    const { replies } = await handleInbound(
      { from: phone, text: 'pendientes', messageId: 'p-4' },
      { lookupCarrierIdentity: lookup }
    );
    assert.match(replies[0], /SOAP/i);
    assert.match(replies[0], /Rubro/i);
    assert.match(replies[0], /7\/7/i);
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

  it('parsea mensaje de imagen del webhook', () => {
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
                    id: 'wamid.img',
                    type: 'image',
                    image: { id: 'media-id-1', caption: 'mi licencia' },
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
    assert.equal(msgs[0].mediaType, 'image');
    assert.equal(msgs[0].mediaId, 'media-id-1');
    assert.match(msgs[0].caption, /licencia/i);
  });
});
