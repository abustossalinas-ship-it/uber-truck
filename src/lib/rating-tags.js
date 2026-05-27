'use strict';

const path = require('path');
const fs = require('fs');

let catalogCache;

function loadCatalog() {
  if (catalogCache) return catalogCache;
  const file = path.join(__dirname, '..', '..', 'public', 'rating-tags-catalog.json');
  catalogCache = JSON.parse(fs.readFileSync(file, 'utf8'));
  return catalogCache;
}

function tagBandForStars(stars) {
  const n = Number(stars);
  if (n <= 2) return 'low';
  if (n === 3) return 'mid';
  return 'high';
}

function getTagsForRating(raterRole, stars) {
  const catalog = loadCatalog();
  const role = raterRole === 'carrier' ? 'carrier' : 'shipper';
  const set = catalog[role];
  if (!set) return [];
  return Number(stars) >= 4 ? set.positive : set.negative;
}

function normalizeTagIds(raterRole, stars, tags) {
  const allowed = new Set(getTagsForRating(raterRole, stars).map((t) => t.id));
  const list = Array.isArray(tags) ? tags : [];
  return list
    .map((t) => String(t).trim())
    .filter((id) => id && allowed.has(id));
}

function validateRatingPayload(raterRole, body) {
  const errors = [];
  const stars = Number(body?.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    errors.push('stars: indica una calificación de 1 a 5');
    return errors;
  }

  const tags = normalizeTagIds(raterRole, stars, body?.tags);
  const comment = (body?.comment || '').trim();

  if (stars <= 3 && tags.length < 1) {
    errors.push('tags: selecciona al menos una opción');
  }

  if (stars <= 2 && comment.length < 20) {
    errors.push('comment: cuéntanos qué salió mal (mínimo 20 caracteres)');
  }

  if (comment.length > 500) {
    errors.push('comment: máximo 500 caracteres');
  }

  return errors;
}

function buildRatingInsert(raterRole, body) {
  const stars = Number(body.stars);
  const tags = normalizeTagIds(raterRole, stars, body?.tags);
  return {
    stars,
    tags,
    tag_band: tagBandForStars(stars),
    comment: body.comment?.trim() || null,
  };
}

function labelForTagId(raterRole, tagId) {
  const catalog = loadCatalog();
  const role = raterRole === 'carrier' ? 'carrier' : 'shipper';
  const all = [...(catalog[role]?.negative || []), ...(catalog[role]?.positive || [])];
  return all.find((t) => t.id === tagId)?.label || tagId;
}

module.exports = {
  loadCatalog,
  tagBandForStars,
  getTagsForRating,
  normalizeTagIds,
  validateRatingPayload,
  buildRatingInsert,
  labelForTagId,
};
