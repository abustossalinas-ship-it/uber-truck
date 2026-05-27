'use strict';

const express = require('express');
const repo = require('../lib/repository');
const { optionalAuth } = require('../lib/optional-auth');
const { requireAuthIfDb } = require('../lib/require-auth');
const { validateRating, normalizeRole } = require('../lib/match-ratings');
const { buildRatingInsert } = require('../lib/rating-tags');
const { filterMatchesForUser } = require('../lib/access-scope');
const { mapDbError } = require('../lib/supabase-errors');

const router = express.Router({ mergeParams: true });
const { loadCatalog } = require('../lib/rating-tags');

router.get('/rating-tags/catalog', (_req, res) => {
  res.json({ ok: true, catalog: loadCatalog() });
});

async function actorOwnsMatch(user, match) {
  const rows = await filterMatchesForUser([match], user);
  return rows.length > 0;
}

router.post('/:id/rate', optionalAuth, requireAuthIfDb, async (req, res) => {
  try {
    const match = await repo.getById('matches', req.params.id);
    if (!match) return res.status(404).json({ ok: false, error: 'Viaje no encontrado' });
    if (match.status !== 'completed') {
      return res.status(409).json({ ok: false, error: 'Solo puedes calificar viajes completados' });
    }
    if (!(await actorOwnsMatch(req.user, match))) {
      return res.status(403).json({ ok: false, error: 'No participas en este viaje' });
    }
    const role = normalizeRole(req.user.role);
    if (!['shipper', 'carrier'].includes(role)) {
      return res.status(403).json({ ok: false, error: 'Rol no puede calificar' });
    }
    const errors = validateRating(role, req.body || {});
    if (errors.length) return res.status(400).json({ ok: false, errors, error: errors[0] });

    const existing = (await repo.list('match_ratings', { match_id: match.id })).find(
      (r) => r.rater_role === role
    );
    if (existing) {
      return res.status(409).json({ ok: false, error: 'Ya calificaste este viaje' });
    }

    const userId = req.user.sub || req.user.id;
    const rating = buildRatingInsert(role, req.body);
    const fullRow = {
      match_id: match.id,
      rater_role: role,
      rater_user_id: userId || null,
      stars: rating.stars,
      tags: rating.tags,
      tag_band: rating.tag_band,
      comment: rating.comment,
    };
    let row;
    let tagsDeferred = false;
    try {
      row = await repo.insert('match_ratings', fullRow);
    } catch (insertErr) {
      const msg = insertErr?.message || '';
      const missingTags =
        /tags|tag_band|PGRST204|PGRST205|schema cache/i.test(msg) ||
        insertErr?.code === '42703';
      if (!missingTags) throw insertErr;
      const { tags: _t, tag_band: _b, ...legacyRow } = fullRow;
      row = await repo.insert('match_ratings', legacyRow);
      tagsDeferred = true;
    }
    res.status(201).json({
      ok: true,
      data: row,
      tags_saved: !tagsDeferred,
      message: tagsDeferred
        ? 'Calificación guardada (estrellas y comentario). Para guardar también los chips, aplica SQL 013 y Reload schema en Supabase.'
        : 'Gracias. Tu calificación ayuda a la confianza en la red.',
    });
  } catch (e) {
    console.error(e);
    const mapped = mapDbError(e, 'guardar calificación');
    res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

module.exports = router;
