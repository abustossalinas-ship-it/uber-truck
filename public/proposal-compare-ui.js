/** Panel comparar propuestas (embarcador) — ranking precio, tiempo, reputación, ajuste */

const ProposalCompare = {
  mode: 'balanced',
  loadId: null,

  headers() {
    return typeof apiHeaders === 'function' ? apiHeaders() : { 'Content-Type': 'application/json' };
  },

  formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  formatClp(n) {
    return `$${Number(n).toLocaleString('es-CL')}`;
  },

  async fetchRanking(loadId, mode) {
    const r = await fetch(
      `/api/load-requests/${encodeURIComponent(loadId)}/proposals/compare?mode=${encodeURIComponent(mode)}`,
      { headers: this.headers() }
    );
    return r.json();
  },

  renderRow(row, load) {
    const rep =
      row.reputation?.avg_stars != null
        ? `${Number(row.reputation.avg_stars).toFixed(1)} ★ (${row.reputation.rating_count || 0})`
        : 'Sin calificaciones';
    const budget = row.within_budget
      ? '<span class="pill pill-ok">En tu rango</span>'
      : '<span class="pill pill-warn">Fuera de rango</span>';
    const rec = row.recommended
      ? '<span class="pill pill-rec">Recomendado</span>'
      : `<span class="muted">#${row.rank}</span>`;
    return `
      <tr class="compare-row ${row.recommended ? 'compare-row-top' : ''}" data-match-id="${row.match_id}">
        <td>${rec}</td>
        <td><strong>${row.carrier_name}</strong><br><span class="muted">${rep}</span></td>
        <td><strong>${this.formatClp(row.carrier_offer_clp)}</strong><br>${budget}</td>
        <td>${this.formatDate(row.created_at)}<br><span class="muted">Ofertado</span></td>
        <td>${load.eta_total_min ? `~${load.eta_total_min} min` : '—'}</td>
        <td><span class="muted">P${row.breakdown.price} R${row.breakdown.reputation} T${row.breakdown.time} A${row.breakdown.fit}</span></td>
        <td class="compare-actions">
          <button type="button" class="btn-secondary btn-sm" data-action="accept_offer" data-id="${row.match_id}">Aceptar</button>
          <button type="button" class="btn-secondary btn-sm" data-action="chat" data-id="${row.match_id}" data-title="${row.carrier_name.replace(/"/g, '')}">Chat</button>
        </td>
      </tr>`;
  },

  async render(loadId) {
    const panel = document.getElementById('proposal-compare-panel');
    if (!panel) return;
    const role = typeof getActorRole === 'function' ? getActorRole() : 'shipper';
    if (role !== 'shipper' && typeof Auth !== 'undefined' && Auth.user?.role === 'carrier') {
      panel.hidden = true;
      return;
    }
    if (!loadId) {
      panel.hidden = true;
      return;
    }
    this.loadId = loadId;
    panel.hidden = false;
    panel.innerHTML = '<p class="muted">Comparando ofertas…</p>';
    const json = await this.fetchRanking(loadId, this.mode);
    if (!json.ok || !json.ranking?.data?.length) {
      panel.hidden = true;
      return;
    }
    if (json.ranking.proposal_count < 2) {
      panel.hidden = true;
      return;
    }
    const load = json.load;
    const sched =
      load.schedule_mode === 'scheduled' && load.scheduled_pickup_at
        ? ` · Retiro programado ${this.formatDate(load.scheduled_pickup_at)}`
        : '';
    const rows = json.ranking.data.map((r) => this.renderRow(r, load)).join('');
    panel.innerHTML = `
      <h3>Comparar ofertas de transportistas</h3>
      <p class="muted">Carga publicada ${this.formatDate(load.published_at)}${sched} · ${json.ranking.proposal_count} propuestas con precio</p>
      <div class="compare-mode-bar">
        <label for="compare-mode-select">Ordenar según</label>
        <select id="compare-mode-select">
          <option value="balanced" ${this.mode === 'balanced' ? 'selected' : ''}>Recomendado (equilibrio)</option>
          <option value="cheap" ${this.mode === 'cheap' ? 'selected' : ''}>Más barato</option>
          <option value="fast" ${this.mode === 'fast' ? 'selected' : ''}>Más rápido (respondió antes)</option>
          <option value="trusted" ${this.mode === 'trusted' ? 'selected' : ''}>Más confiable</option>
        </select>
      </div>
      <div class="compare-table-wrap">
        <table class="compare-table">
          <thead>
            <tr>
              <th></th><th>Transportista</th><th>Precio</th><th>Fecha oferta</th><th>ETA carga</th><th>Score</th><th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="muted compare-legend">Score: P=precio · R=reputación · T=rapidez al ofertar · A=ajuste ruta</p>`;
    document.getElementById('compare-mode-select')?.addEventListener('change', (e) => {
      this.mode = e.target.value;
      this.render(loadId);
    });
  },
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('match-load')?.addEventListener('change', (e) => {
    ProposalCompare.render(e.target.value);
  });
});

window.ProposalCompare = ProposalCompare;
