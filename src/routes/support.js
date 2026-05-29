'use strict';

const express = require('express');
const { authMiddleware } = require('../lib/auth');
const support = require('../lib/support-cases');
const { getOperatingStatus } = require('../lib/penalty-gate');

const router = express.Router();

router.get('/cases', authMiddleware, async (req, res) => {
  try {
    const rows = await support.listCasesForUser(req.user);
    res.json({ ok: true, data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al listar casos' });
  }
});

router.get('/operating-status', authMiddleware, async (req, res) => {
  try {
    const status = await getOperatingStatus(req.user);
    res.json({ ok: true, data: status });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al leer estado operativo' });
  }
});

router.post('/cases', authMiddleware, async (req, res) => {
  try {
    const { match_id, subject, message } = req.body || {};
    if (!match_id) return res.status(400).json({ ok: false, error: 'match_id requerido' });
    const result = await support.createCase({
      match_id,
      user: req.user,
      subject,
      initial_message: message,
      auto: false,
    });
    res.status(result.created ? 201 : 200).json({
      ok: true,
      data: result.case,
      created: result.created,
      message: result.created
        ? 'Caso abierto. Un moderador puede revisar los antecedentes.'
        : 'Ya hay un caso abierto para este emparejamiento.',
    });
  } catch (e) {
    const code = e.statusCode || 500;
    if (code !== 500) return res.status(code).json({ ok: false, error: e.message });
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al abrir caso' });
  }
});

router.get('/cases/:id/messages', authMiddleware, async (req, res) => {
  try {
    const data = await support.listMessages(req.params.id, req.user);
    const supportCase = await require('../lib/repository').getById('support_cases', req.params.id);
    res.json({ ok: true, data, case: supportCase });
  } catch (e) {
    const code = e.statusCode || 500;
    if (code !== 500) return res.status(code).json({ ok: false, error: e.message });
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al leer mensajes' });
  }
});

router.post('/cases/:id/messages', authMiddleware, async (req, res) => {
  try {
    const body = (req.body?.body || '').trim();
    if (!body) return res.status(400).json({ ok: false, error: 'Mensaje vacío' });
    const as_moderator = req.user.role === 'admin' && req.body?.as_moderator !== false;
    const msg = await support.addMessage({
      case_id: req.params.id,
      user: req.user,
      body,
      as_moderator,
    });
    res.status(201).json({ ok: true, data: msg });
  } catch (e) {
    const code = e.statusCode || 500;
    if (code !== 500) return res.status(code).json({ ok: false, error: e.message });
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al enviar mensaje' });
  }
});

router.patch('/cases/:id/status', authMiddleware, async (req, res) => {
  try {
    const status = req.body?.status;
    const row = await support.updateCaseStatus(req.params.id, req.user, status);
    res.json({ ok: true, data: row });
  } catch (e) {
    const code = e.statusCode || 500;
    if (code !== 500) return res.status(code).json({ ok: false, error: e.message });
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al actualizar caso' });
  }
});

module.exports = router;
