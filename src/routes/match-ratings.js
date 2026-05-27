'use strict';

const express = require('express');
const repo = require('../lib/repository');
const supabaseService = require('../services/supabase');
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

    const sb = supabaseService.getClient();
    const { data: existing, error: existErr } = await sb
      .from('match_ratings')
      .select('id')
      .eq('match_id', match.id)
      .eq('rater_role', role)
      .maybeSingle();
    if (existErr) throw existErr;
    if (existing) {
      return res.status(409).json({ ok: false, error: 'Ya calificaste este viaje' });
    }

    const rating = buildRatingInsert(role, req.body);
    const baseRow = {
      match_id: match.id,
      rater_role: role,
      stars: rating.stars,
      comment: rating.comment,
    };
    const returnCols = 'id, match_id, rater_role, stars, comment, created_at';
    let inserted;
    let insErr;
    ({ data: inserted, error: insErr } = await sb
      .from('match_ratings')
      .insert(baseRow)
      .select(returnCols)
      .single());
    if (insErr && /rater_user_id|schema cache|PGRST204|PGRST205/i.test(insErr.message || '')) {
      ({ data: inserted, error: insErr } = await sb
        .from('match_ratings')
        .insert(baseRow)
        .select('id, stars, comment')
        .single());
    }
    if (insErr) throw insErr;

    let row = inserted;
    let tagsSaved = !(rating.tags && rating.tags.length);
    if (rating.tags?.length) {
      const { data: updated, error: upErr } = await sb
        .from('match_ratings')
        .update({
          tags: rating.tags,
          tag_band: rating.tag_band,
        })
        .eq('id', row.id)
        .select('id, stars, comment, tags, tag_band')
        .single();
      if (upErr) {
        console.error('match_ratings tags update:', upErr.message || upErr);
        tagsSaved = false;
      } else {
        row = updated;
        tagsSaved = true;
      }
    } else {
      tagsSaved = true;
    }
    res.status(201).json({
      ok: true,
      data: row,
      tags_saved: tagsSaved,
      message: tagsSaved
        ? 'Gracias. Tu calificación ayuda a la confianza en la red.'
        : 'Calificación guardada con estrellas y comentario. Los chips no se guardaron; recarga la página e intenta de nuevo o avisa soporte.',
    });
  } catch (e) {
    console.error(e);
    const mapped = mapDbError(e, 'guardar calificación');
    res.status(mapped.status).json({
      ok: false,
      error: mapped.error,
      detail: (e?.message || '').slice(0, 180),
    });
  }
});

module.exports = router;
