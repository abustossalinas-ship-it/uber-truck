/** Pestañas y textos según rol: embarcador | transportista | admin */

const BOARD_COPY = {
  shipper: {
    loads: 'Mis cargas',
    offers: 'Ofertas de transportistas (mercado)',
    tabShipper: 'Publicar carga',
    tabCarrier: null,
  },
  carrier: {
    loads: 'Cargas disponibles (mercado)',
    offers: 'Mis ofertas',
    tabShipper: null,
    tabCarrier: 'Publicar oferta',
  },
  admin: {
    loads: 'Todas las cargas',
    offers: 'Todas las ofertas',
    tabShipper: 'Cargas (admin)',
    tabCarrier: 'Ofertas (admin)',
  },
  guest: {
    loads: 'Cargas publicadas',
    offers: 'Ofertas publicadas',
    tabShipper: 'Necesito mover carga',
    tabCarrier: 'Tengo espacio en ruta',
  },
};

function applyRoleUi() {
  const user = typeof Auth !== 'undefined' ? Auth.user : null;
  const role = user?.role || 'guest';
  const copy = BOARD_COPY[role] || BOARD_COPY.guest;

  const tabShipper = document.getElementById('tab-shipper');
  const tabCarrier = document.getElementById('tab-carrier');
  if (tabShipper) {
    tabShipper.hidden = role === 'carrier';
    if (copy.tabShipper) tabShipper.textContent = copy.tabShipper;
  }
  if (tabCarrier) {
    tabCarrier.hidden = role === 'shipper';
    if (copy.tabCarrier) tabCarrier.textContent = copy.tabCarrier;
  }

  const loadsTitle = document.getElementById('board-loads-title');
  const offersTitle = document.getElementById('board-offers-title');
  if (loadsTitle) loadsTitle.textContent = copy.loads;
  if (offersTitle) offersTitle.textContent = copy.offers;

  const panelShipper = document.getElementById('panel-shipper');
  const panelCarrier = document.getElementById('panel-carrier');
  if (panelShipper) panelShipper.hidden = role === 'carrier';
  if (panelCarrier) panelCarrier.hidden = role === 'shipper';

  prefillOrgFields(role, user);
  if (typeof updateMatchPriceStep === 'function') updateMatchPriceStep();

  const activeTab = document.querySelector('nav .tab.active[data-tab]');
  if (role === 'shipper' && activeTab?.dataset.tab === 'carrier') showTab('shipper');
  if (role === 'carrier' && activeTab?.dataset.tab === 'shipper') showTab('carrier');
}

function prefillOrgFields(role, user) {
  const loadForm = document.getElementById('form-load');
  const offerForm = document.getElementById('form-offer');
  const companyInput = loadForm?.querySelector('[name="company_name"]');
  const carrierInput = offerForm?.querySelector('[name="carrier_name"]');
  const org = user?.company_name || user?.name;

  if (companyInput) {
    if (role === 'shipper' && org) {
      companyInput.value = org;
      companyInput.readOnly = true;
      companyInput.title = 'Nombre de tu empresa en la cuenta';
    } else {
      companyInput.readOnly = false;
      companyInput.removeAttribute('title');
    }
  }
  if (carrierInput) {
    if (role === 'carrier' && org) {
      carrierInput.value = org;
      carrierInput.readOnly = true;
      carrierInput.title = 'Nombre de tu flota en la cuenta';
    } else {
      carrierInput.readOnly = false;
      carrierInput.removeAttribute('title');
    }
  }
}

window.applyRoleUi = applyRoleUi;
window.prefillOrgFields = prefillOrgFields;

document.addEventListener('DOMContentLoaded', () => {
  if (typeof Auth !== 'undefined') applyRoleUi();
});
