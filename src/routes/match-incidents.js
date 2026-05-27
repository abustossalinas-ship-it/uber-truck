'use strict';

const express = require('express');
const repo = require('../lib/repository');
const { optionalAuth } = require('../lib/optional-auth');
const { requireAuthIfDb } = require('../lib/require-auth');
const { normalizeRole } = require('../lib/match-cancel');
const { validateIncident, INCIDENT_TYPES } = require('../lib/cargo-trust');

const router = express.Router({ mergeParams: true });

async function actorMayReport(user, match) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const load = await repo.getById('load_requests', match.load_request_id);
  const offer = await repo.getById('capacity_offers', match.capacity_offer_id);
  if (user.role === 'shipper' && load?.shipper_user_id === user.sub) return true;
  if (user.role === 'carrier' && offer?.carrier_user_id === user.sub) return true;
  return false;
}

router.post('/:id/incidents', optionalAuth, requireAuthIfDb, async (req, res) => {
  try {
    const match = await repo.getById('matches', req.params.id);
    if (!match) return res.status(404).json({ ok: false, error: 'Emparejamiento no encontrado' });
    if (!['accepted', 'in_progress', 'proposed', 'completed'].includes(match.status)) {
      return res.status(409).json({ ok: false, error: 'No se puede reportar incidente en este estado' });
    }
    if (!(await actorMayReport(req.user, match))) {
      return res.status(403).json({ ok: false, error: 'No participas en este emparejamiento' });
    }
    const errors = validateIncident(req.body || {});
    if (errors.length) return res.status(400).json({ ok: false, errors });

    const load = await repo.getById('load_requests', match.load_request_id);
    const row = await repo.insert('match_incidents', {
      match_id: match.id,
      reporter_role: normalizeRole(req.user.role),
      reporter_user_id: req.user.sub,
      incident_type: req.body.incident_type,
      description: req.body.description.trim(),
      declared_value_clp_at_report: load?.declared_cargo_value_clp ?? null,
      status: 'open',
    });
    res.status(201).json({
      ok: true,
      data: row,
      message:
        'Incidente registrado. La plataforma conserva el antecedente; la resolución es entre las empresas y sus seguros.',
    });
  } catch (e) {
    console.error(e);
    const msg = e.message?.includes('match_incidents')
      ? 'Tabla de incidentes no disponible. Aplica migración 011 en Supabase.'
      : 'Error al registrar incidente';
    res.status(500).json({ ok: false, error: msg });
  }
});

router.get('/:id/incidents', optionalAuth, requireAuthIfDb, async (req, res) => {
  try {
    const match = await repo.getById('matches', req.params.id);
    if (!match) return res.status(404).json({ ok: false, error: 'Emparejamiento no encontrado' });
    if (!(await actorMayReport(req.user, match))) {
      return res.status(403).json({ ok: false, error: 'Sin acceso' });
    }
    const rows = await repo.list('match_incidents', { match_id: match.id });
    res.json({ ok: true, data: rows, incident_types: INCIDENT_TYPES });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Error al listar incidentes' });
  }
});

module.exports = router;
