'use strict';

const express = require('express');
const whatsappCloud = require('../services/whatsapp-cloud');
const whatsappBot = require('../lib/whatsapp-bot');

const router = express.Router();

router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const { verifyToken, enabled } = whatsappCloud.config();

  if (mode === 'subscribe' && token && token === verifyToken) {
    console.info('[whatsapp] Webhook verificado con Meta');
    return res.status(200).send(challenge);
  }

  if (!enabled) {
    return res.status(503).json({ ok: false, error: 'WhatsApp Cloud desactivado' });
  }

  return res.sendStatus(403);
});

router.post('/webhook', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));

  if (!whatsappCloud.verifyWebhookSignature(rawBody, signature)) {
    console.warn('[whatsapp] Firma webhook inválida');
    return res.sendStatus(403);
  }

  res.sendStatus(200);

  if (!whatsappCloud.isConfigured()) {
    return;
  }

  const expectedPhoneId = whatsappCloud.config().phoneNumberId;
  const messages = whatsappCloud.parseWebhookMessages(req.body);

  for (const msg of messages) {
    if (expectedPhoneId && msg.phoneNumberId && msg.phoneNumberId !== expectedPhoneId) {
      continue;
    }
    try {
      const { replies, skipped } = whatsappBot.handleInbound(msg);
      if (skipped || !replies.length) continue;
      for (const text of replies) {
        await whatsappCloud.sendText(msg.from, text);
      }
    } catch (e) {
      console.error('[whatsapp] Error procesando mensaje', msg.from, e.message || e, e.details || '');
    }
  }
});

router.get('/status', (_req, res) => {
  res.json({ ok: true, whatsapp: whatsappCloud.statusPayload() });
});

module.exports = router;
