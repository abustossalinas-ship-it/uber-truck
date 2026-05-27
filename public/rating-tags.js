/** Catálogo y reglas de chips — sincronizado con src/lib/rating-tags.js + rating-tags-catalog.json */

window.RatingTags = {
  catalog: null,
  selected: new Set(),

  async loadCatalog() {
    if (this.catalog) return this.catalog;
    const res = await fetch('/rating-tags-catalog.json');
    this.catalog = await res.json();
    return this.catalog;
  },

  tagBand(stars) {
    const n = Number(stars);
    if (n <= 2) return 'low';
    if (n === 3) return 'mid';
    return 'high';
  },

  tagsForRole(role, stars) {
    const r = role === 'carrier' ? 'carrier' : 'shipper';
    const set = this.catalog?.[r];
    if (!set) return [];
    return Number(stars) >= 4 ? set.positive : set.negative;
  },

  labelFor(role, tagId) {
    const r = role === 'carrier' ? 'carrier' : 'shipper';
    const set = this.catalog?.[r];
    if (!set) return tagId;
    const found = [...set.negative, ...set.positive].find((t) => t.id === tagId);
    return found?.label || tagId;
  },

  clearSelected() {
    this.selected.clear();
  },

  validate(role, stars, comment) {
    const errors = [];
    const n = Number(stars);
    if (n <= 3 && this.selected.size < 1) {
      errors.push('Selecciona al menos una opción.');
    }
    if (n <= 2 && (comment || '').trim().length < 20) {
      errors.push('Cuéntanos qué salió mal (mínimo 20 caracteres).');
    }
    return errors;
  },

  selectedIds() {
    return [...this.selected];
  },
};
