/**
 * Cubik — shell móvil (4 fases): bienvenida, bottom nav, Capacitor nativo.
 */
const AppShell = {
  tab: 'home',
  deep: null,
  _accountPanelOpen: null,
  _splashHidden: false,
  _pushPendingToken: null,
  _pushListenersBound: false,

  isNative() {
    return Boolean(window.Capacitor?.isNativePlatform?.());
  },

  isAppPath() {
    const path = (location.pathname || '/').replace(/\/$/, '') || '/';
    return path === '/app';
  },

  isAppMode() {
    if (this.isNative()) return true;
    if (this.isAppPath()) return true;
    if (localStorage.getItem('cubik_force_app') === '1') return true;
    if (new URLSearchParams(location.search).get('app') === '1') return true;
    return (
      window.matchMedia('(display-mode: standalone)').matches &&
      window.innerWidth < 900
    );
  },

  isExplicitAppMode() {
    if (this.isNative()) return true;
    if (this.isAppPath()) return true;
    if (localStorage.getItem('cubik_force_app') === '1') return true;
    return new URLSearchParams(location.search).get('app') === '1';
  },

  init() {
    if (!this.isAppMode()) return;
    document.documentElement.classList.add('cubik-app-root');
    document.body.classList.add('cubik-app');
    if (this.isExplicitAppMode()) {
      document.body.classList.add('cubik-app-strict');
    }
    if (this.isAppPath()) {
      document.body.classList.add('cubik-app-route');
    }
    const gate = document.getElementById('app-gate');
    if (gate) gate.hidden = false;
    this.mountAuthInGate();
    this.hideNativeSplash();
    this.bindWelcome();
    this.bindBottomNav();
    this.bindTopBar();
    this.bindOptionsGrid();
    this.bindAccount();
    this.bindAuthHooks();
    this.bindBackButton();
    this.initPullToRefresh();
    this.initNativePlugins();
    this.showBuildVersion();
    this.syncAuthState();
    document.addEventListener('DOMContentLoaded', () => {
      this.mountAuthInGate();
      this.syncAuthState();
    });
  },

  mountAuthInGate() {
    if (!document.body.classList.contains('cubik-app')) return;
    const gate = document.getElementById('app-gate');
    if (!gate || gate.dataset.authMounted === '1') return;
    ['auth-panel', 'change-password-panel'].forEach((id) => {
      const el = document.getElementById(id);
      if (el && !gate.contains(el)) gate.appendChild(el);
    });
    gate.dataset.authMounted = '1';
  },

  openChangePassword() {
    if (typeof Auth === 'undefined' || !Auth.user) return;
    if (document.body.classList.contains('cubik-app')) {
      if (this.tab !== 'account') this.setTab('account');
      else this.renderAccount();
      this._accountPanelOpen = 'password';
      this.applyAccountPanel();
      return;
    }
    this.mountAuthInGate();
    const panel = document.getElementById('change-password-panel');
    if (!panel) return;
    const gate = document.getElementById('app-gate');
    if (gate?.contains(panel) && gate.hidden) {
      document.body.appendChild(panel);
    }
    document.getElementById('auth-panel')?.setAttribute('hidden', '');
    panel.hidden = false;
    panel.removeAttribute('hidden');
    document.body.classList.add('app-change-pw-open');
    panel.querySelector('[name="current_password"]')?.focus();
  },

  closeChangePassword() {
    if (
      document.body.classList.contains('cubik-app') &&
      this._accountPanelOpen === 'password'
    ) {
      this.closeAccountPanel();
      return;
    }
    const panel = document.getElementById('change-password-panel');
    panel?.setAttribute('hidden', '');
    document.body.classList.remove('app-change-pw-open');
    document.getElementById('form-change-password')?.reset();
    document.getElementById('change-password-error')?.setAttribute('hidden', '');
  },

  initNativePlugins() {
    if (!this.isNative()) return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.runNativeSetup());
    } else {
      this.runNativeSetup();
    }
  },

  showBuildVersion() {
    const el = document.getElementById('app-build-version');
    if (!el) return;
    fetch('/deploy.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        el.textContent = j?.version ? `App v${j.version}` : '';
      })
      .catch(() => {
        el.textContent = '';
      });
  },

  hideNativeSplash() {
    if (this._splashHidden) return;
    const Cap = window.Capacitor;
    if (!Cap?.Plugins?.SplashScreen) {
      if (this.isNative()) setTimeout(() => this.hideNativeSplash(), 50);
      return;
    }
    this._splashHidden = true;
    Cap.Plugins.SplashScreen.hide?.().catch(() => {});
  },

  async runNativeSetup() {
    const Cap = window.Capacitor;
    if (!Cap?.Plugins) {
      setTimeout(() => this.runNativeSetup(), 80);
      return;
    }
    this.hideNativeSplash();
    try {
      const StatusBar = Cap.Plugins.StatusBar;
      if (StatusBar) {
        await StatusBar.setBackgroundColor?.({ color: '#0f172a' });
        await StatusBar.setStyle?.({ style: 'DARK' });
      }
    } catch (_) {}
    try {
      Cap.Plugins.App?.addListener?.('backButton', ({ canGoBack }) => {
        if (this.deep) {
          this.exitDeep();
          return;
        }
        const authPanel = document.getElementById('auth-panel');
        if (authPanel && authPanel.hidden === false) {
          if (typeof handleAuthBackNavigation === 'function' && handleAuthBackNavigation()) {
            return;
          }
          return;
        }
        const changePw = document.getElementById('change-password-panel');
        if (changePw && !changePw.hidden && !changePw.hasAttribute('hidden')) {
          this.closeChangePassword();
          return;
        }
        if (!canGoBack) Cap.Plugins.App?.exitApp?.();
      });
    } catch (_) {}
    setTimeout(() => this.setupPushNotifications(), 1500);
    setTimeout(() => this.setupCarrierGps(), 800);
  },

  async setupCarrierGps() {
    if (!this.isNative()) return;
    const user = typeof Auth !== 'undefined' ? Auth.user : null;
    if (!user || user.role !== 'carrier') return;
    if (typeof requestGpsPermission === 'function') {
      const ok = await requestGpsPermission();
      if (!ok) {
        alert(
          'Cubik necesita ubicación «Permitir siempre» para actualizar el mapa en ruta y compartir tu posición con el embarcador.'
        );
      }
    }
    if (typeof refreshCarrierPresencePanel === 'function') {
      refreshCarrierPresencePanel().catch(() => {});
    }
  },

  async sendPushTokenToServer(token) {
    if (!token) return;
    if (typeof Auth === 'undefined' || !Auth.token) {
      this._pushPendingToken = token;
      return;
    }
    try {
      await fetch('/api/devices/push-token', {
        method: 'POST',
        headers: typeof apiHeaders === 'function' ? apiHeaders() : Auth.headers(),
        body: JSON.stringify({ token, platform: 'android' }),
      });
    } catch (_) {}
  },

  registerPushAfterAuth() {
    if (this._pushPendingToken) {
      const t = this._pushPendingToken;
      this._pushPendingToken = null;
      this.sendPushTokenToServer(t);
    }
    if (!this.isNative()) return;
    const Push = window.Capacitor?.Plugins?.PushNotifications;
    Push?.register?.().catch(() => {});
  },

  handlePushTap(notification) {
    const data = notification?.data || {};
    if (data.match_id) {
      this.setTab('activity');
      document.getElementById('btn-notifications')?.click();
    }
  },

  async setupPushNotifications() {
    if (!this.isNative()) return;
    const Push = window.Capacitor?.Plugins?.PushNotifications;
    if (!Push) return;
    try {
      const perm = await Push.checkPermissions?.();
      if (perm?.receive === 'prompt') await Push.requestPermissions?.();
      if (!this._pushListenersBound) {
        this._pushListenersBound = true;
        await Push.addListener?.('registration', (ev) => {
          this.sendPushTokenToServer(ev?.value);
        });
        await Push.addListener?.('registrationError', (err) => {
          console.warn('Push registration error', err);
        });
        await Push.addListener?.('pushNotificationReceived', (ev) => {
          if (ev?.notification?.title) {
            window.dispatchEvent(new CustomEvent('cubik-push', { detail: ev.notification }));
          }
        });
        await Push.addListener?.('pushNotificationActionPerformed', (ev) => {
          this.handlePushTap(ev?.notification);
        });
      }
      await Push.register?.();
      if (typeof Auth !== 'undefined' && Auth.token) this.registerPushAfterAuth();
    } catch (e) {
      console.warn('Push setup', e);
    }
  },

  /** @deprecated use setupPushNotifications */
  async initPushStub() {
    return this.setupPushNotifications();
  },

  bindWelcome() {
    if (typeof showWelcomeRoleStep === 'function') showWelcomeRoleStep();
  },

  bindBottomNav() {
    document.querySelectorAll('.app-nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.appTab;
        if (tab) this.setTab(tab);
      });
    });
  },

  bindTopBar() {
    document.getElementById('app-top-back')?.addEventListener('click', () => this.exitDeep());
    document.getElementById('app-top-notif')?.addEventListener('click', () => {
      this.openNotifications();
    });
  },

  scrollAppToElement(el, offset = 8) {
    if (!el) return;
    const scroll = document.getElementById('app-scroll');
    if (!scroll) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const top =
      scroll.scrollTop +
      el.getBoundingClientRect().top -
      scroll.getBoundingClientRect().top -
      offset;
    scroll.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  },

  openNotifications() {
    this._accountPanelOpen = 'notifications';
    if (this.tab !== 'account') this.setTab('account');
    else {
      this.renderAccount();
      this.applyAccountPanel();
    }
  },

  async openAccountPenalties() {
    this._accountPanelOpen = 'penalties';
    if (this.tab !== 'account') this.setTab('account');
    else {
      this.renderAccount();
      await this.applyAccountPanel();
    }
  },

  async openAccountKyc() {
    this._accountPanelOpen = 'kyc';
    if (this.tab !== 'account') this.setTab('account');
    else {
      this.renderAccount();
      await this.applyAccountPanel();
    }
  },

  closeAccountPanel() {
    this._accountPanelOpen = null;
    this.applyAccountPanel();
  },

  async toggleAccountPanel(action) {
    this._accountPanelOpen = this._accountPanelOpen === action ? null : action;
    await this.applyAccountPanel();
  },

  async applyAccountPanel() {
    const open = this._accountPanelOpen;
    const actions = ['kyc', 'password', 'penalties', 'notifications', 'help'];

    actions.forEach((action) => {
      const slot = document.getElementById(`app-panel-slot-${action}`);
      const btn = document.querySelector(`[data-profile-action="${action}"]`);
      const isOpen = open === action;
      if (slot) {
        slot.hidden = !isOpen;
        if (isOpen) slot.removeAttribute('hidden');
        else slot.setAttribute('hidden', '');
      }
      if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    document.body.classList.toggle('app-account-panel-open', Boolean(open));

    if (open !== 'kyc') {
      document.getElementById('kyc-banner')?.setAttribute('hidden', '');
      document.getElementById('carrier-docs-panel')?.setAttribute('hidden', '');
    }
    if (open !== 'penalties') {
      document.getElementById('account-penalties-panel')?.setAttribute('hidden', '');
    }
    if (open !== 'notifications') {
      document.getElementById('notif-panel')?.setAttribute('hidden', '');
    }
    if (open !== 'password') {
      const pw = document.getElementById('change-password-panel');
      if (pw?.closest('.app-profile-panel-slot')) {
        pw.setAttribute('hidden', '');
        document.getElementById('form-change-password')?.reset();
        document.getElementById('change-password-error')?.setAttribute('hidden', '');
      }
      document.body.classList.remove('app-change-pw-open');
    }

    if (open === 'kyc') {
      if (typeof renderKycBanner === 'function') await renderKycBanner();
      this.mountPanelInSlot('kyc-banner', 'app-panel-slot-kyc');
      this.mountPanelInSlot('carrier-docs-panel', 'app-panel-slot-kyc');
    }

    if (open === 'password') {
      const panel = document.getElementById('change-password-panel');
      if (panel) {
        this.mountPanelInSlot('change-password-panel', 'app-panel-slot-password');
        panel.hidden = false;
        panel.removeAttribute('hidden');
        document.body.classList.remove('app-change-pw-open');
        panel.querySelector('[name="current_password"]')?.focus();
      }
    }

    if (open === 'penalties') {
      if (typeof Penalties !== 'undefined') await Penalties.refresh();
      this.mountPanelInSlot('account-penalties-panel', 'app-panel-slot-penalties');
      const panel = document.getElementById('account-penalties-panel');
      if (panel) {
        panel.hidden = false;
        panel.removeAttribute('hidden');
      }
    }

    if (open === 'notifications') {
      this.mountPanelInSlot('notif-panel', 'app-panel-slot-notifications');
      if (typeof Comms !== 'undefined') await Comms.openNotifPanel();
    }

    if (open === 'help') {
      const slot = document.getElementById('app-panel-slot-help');
      if (slot) {
        slot.innerHTML = `
          <div class="app-help-inline card">
            <p class="muted">Durante un viaje en ruta puedes usar el chat, reportar incidentes o revisar multas y saldo en esta cuenta.</p>
            <ul class="app-help-list">
              <li><strong>Incidente:</strong> botón «Reportar incidente» en el viaje activo.</li>
              <li><strong>Multas y saldo:</strong> sección Pagos arriba.</li>
              <li><strong>Documentación:</strong> transportistas revisan el checklist KYC.</li>
            </ul>
            <button type="button" class="tab tab-sm" data-app-tab-link="activity">Ver actividad</button>
          </div>`;
        slot.querySelector('[data-app-tab-link]')?.addEventListener('click', () => {
          this.setTab('activity');
        });
      }
    }

    if (open) {
      const slot = document.getElementById(`app-panel-slot-${open}`);
      if (slot) requestAnimationFrame(() => this.scrollAppToElement(slot, 12));
    }
  },

  bindOptionsGrid() {
    document.querySelectorAll('[data-app-action]').forEach((el) => {
      el.addEventListener('click', () => {
        const action = el.dataset.appAction;
        if (action) this.openAction(action);
      });
    });
    document.querySelectorAll('[data-app-quick]').forEach((el) => {
      el.addEventListener('click', () => {
        const action = el.dataset.appQuick;
        if (action === 'trips') this.setTab('activity');
        else if (action) this.openAction(action);
      });
    });
    document.querySelectorAll('[data-app-tab-link]').forEach((el) => {
      el.addEventListener('click', () => {
        const tab = el.dataset.appTabLink;
        if (tab) this.setTab(tab);
      });
    });
  },

  bindAccount() {
    document.getElementById('app-btn-logout')?.addEventListener('click', () => {
      document.getElementById('btn-auth')?.click();
    });
  },

  bindAuthHooks() {
    const wrapRender = () => {
      if (typeof Auth === 'undefined' || !Auth.render) return;
      const orig = Auth.render.bind(Auth);
      Auth.render = () => {
        orig();
        this.syncAuthState();
      };
    };
    if (typeof Auth !== 'undefined') wrapRender();
    else document.addEventListener('DOMContentLoaded', wrapRender);
  },

  bindBackButton() {
    const origShowTab = window.showTab;
    if (typeof origShowTab === 'function') {
      window.showTab = (name) => {
        origShowTab(name);
        if (document.body.classList.contains('cubik-app') && this.deep) {
          this.updateTopTitle();
        }
      };
    }
  },

  syncAuthState() {
    if (!document.body.classList.contains('cubik-app')) return;
    const user = typeof Auth !== 'undefined' ? Auth.user : null;
    document.body.classList.toggle('app-authed', Boolean(user));
    const gate = document.getElementById('app-gate');
    const chrome = document.getElementById('app-chrome');
    if (gate) gate.hidden = Boolean(user);
    if (chrome) chrome.hidden = !user;
    if (user && !this._docsSessionCheckDone && typeof refreshAuthProfile === 'function') {
      this._docsSessionCheckDone = true;
      refreshAuthProfile().catch(() => {});
    }
    if (user) {
      this.renderHome();
      this.renderAccount();
      if (typeof RatingTags !== 'undefined' && !RatingTags.catalog) {
        RatingTags.loadCatalog().catch(() => {});
      }
      if (typeof refreshBoard === 'function') {
        refreshBoard().catch(() => {});
      }
      if (user.role === 'carrier') this.setupCarrierGps();
      if (!this.deep) this.setTab(this.tab || 'home');
    } else {
      this._docsSessionCheckDone = false;
      this.deep = null;
      document.body.classList.remove('app-deep', 'app-main-visible');
      const authPanel = document.getElementById('auth-panel');
      const authError = document.getElementById('auth-error');
      const authOpenWithError =
        authPanel &&
        !authPanel.hidden &&
        authError &&
        !authError.hidden &&
        authError.textContent.trim();
      const authPanelOpen =
        authPanel && !authPanel.hidden && !authPanel.hasAttribute('hidden');
      if (authPanelOpen) {
        const welcome = document.getElementById('app-welcome');
        if (welcome) {
          welcome.hidden = true;
          welcome.setAttribute('hidden', '');
        }
      } else if (!authOpenWithError) {
        authPanel?.setAttribute('hidden', '');
        const welcome = document.getElementById('app-welcome');
        if (welcome) {
          welcome.hidden = false;
          welcome.removeAttribute('hidden');
        }
      } else if (authOpenWithError) {
        document.getElementById('app-welcome')?.setAttribute('hidden', '');
        const welcome = document.getElementById('app-welcome');
        if (welcome) welcome.hidden = true;
      }
      this.restorePanelsHome();
    }
  },

  restorePanelsHome() {
    const anchor = document.getElementById('app-panels-home-anchor');
    if (!anchor) return;
    const ids = [
      'account-penalties-panel',
      'kyc-banner',
      'carrier-docs-panel',
      'change-password-panel',
      'notif-panel',
      'admin-hub-nav',
      'admin-kyc-panel',
      'admin-ops-panel',
    ];
    let after = anchor;
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (
        el.parentElement?.id?.startsWith('app-account') ||
        el.parentElement?.id?.startsWith('app-panel-slot') ||
        el.parentElement?.id === 'app-account-admin-slot'
      ) {
        after.insertAdjacentElement('afterend', el);
        after = el;
      }
    });
    this.mountAuthInGate();
  },

  mountPanelInSlot(elementId, slotId) {
    const el = document.getElementById(elementId);
    const slot = document.getElementById(slotId);
    if (el && slot && !slot.contains(el)) slot.appendChild(el);
  },

  setTab(tab) {
    const prev = this.tab;
    this.tab = tab;
    if (prev === 'account' && tab !== 'account') {
      this._accountPanelOpen = null;
      this.restorePanelsHome();
    }
    if (this.deep) this.exitDeep(false);
    document.body.dataset.appTab = tab;
    document.querySelectorAll('.app-nav-item').forEach((b) => {
      b.classList.toggle('active', b.dataset.appTab === tab);
    });
    document.querySelectorAll('.app-view').forEach((v) => {
      v.classList.remove('active');
      v.hidden = true;
    });
    const view = document.getElementById(`app-view-${tab}`);
    if (view) {
      view.classList.add('active');
      view.hidden = false;
    }

    const titles = {
      home: 'Inicio',
      options: 'Opciones',
      activity: 'Actividad',
      account: 'Cuenta',
    };
    const titleEl = document.getElementById('app-top-title');
    if (titleEl) titleEl.textContent = titles[tab] || 'Cubik';

    document.body.classList.remove('app-main-visible');
    if (tab === 'activity') {
      document.body.classList.add('app-main-visible');
      const actView = document.getElementById('app-view-activity');
      if (actView) {
        actView.classList.add('active', 'app-view-pass-through');
        actView.hidden = false;
      }
      if (typeof showTab === 'function') showTab('trips');
    } else {
      const actView = document.getElementById('app-view-activity');
      if (actView) actView.classList.remove('app-view-pass-through');
    }
    if (tab === 'home') this.renderHome();
    if (tab === 'account') {
      (async () => {
        if (typeof refreshAuthProfile === 'function') await refreshAuthProfile();
        this.renderAccount();
        if (typeof refreshAdminHubNav === 'function') refreshAdminHubNav();
        if (typeof refreshAdminKycPanel === 'function') refreshAdminKycPanel();
        if (typeof refreshAdminOpsPanel === 'function') refreshAdminOpsPanel();
        if (typeof renderKycBanner === 'function') await renderKycBanner();
        if (typeof Penalties !== 'undefined') await Penalties.refresh();
        await this.applyAccountPanel();
      })();
    }
  },

  openAction(action) {
    const user = typeof Auth !== 'undefined' ? Auth.user : null;
    const roleKey =
      user && typeof normalizeAppRole === 'function'
        ? normalizeAppRole(user.role)
        : user?.role;
    const superAdmin =
      user && typeof isCubikSuperAdmin === 'function' && isCubikSuperAdmin(user);
    if (!superAdmin) {
      if (roleKey === 'shipper' && action === 'carrier') return;
      if (roleKey === 'carrier' && action === 'shipper') return;
      if (roleKey === 'admin' && (action === 'shipper' || action === 'carrier')) return;
    }

    const map = {
      shipper: { tab: 'shipper', title: 'Publicar carga' },
      carrier: { tab: 'carrier', title: 'Ofertar ruta' },
      board: { tab: 'board', title: 'Emparejar' },
      trips: { tab: 'trips', title: 'Mis viajes' },
      notifications: { tab: null, title: 'Notificaciones' },
      help: { tab: null, title: 'Ayuda' },
    };
    const cfg = map[action];
    if (!cfg) return;
    if (action === 'notifications') {
      document.getElementById('btn-notifications')?.click();
      return;
    }
    if (action === 'help') {
      this._accountPanelOpen = 'help';
      this.setTab('account');
      return;
    }
    this.deep = cfg.tab;
    if (typeof MapsUI !== 'undefined' && MapsUI.closeAllSuggestions) {
      MapsUI.closeAllSuggestions();
    }
    document.body.classList.add('app-deep', 'app-main-visible');
    if (typeof showTab === 'function') showTab(cfg.tab);
    const titleEl = document.getElementById('app-top-title');
    if (titleEl) titleEl.textContent = cfg.title;
    document.querySelectorAll('.app-view').forEach((v) => v.classList.remove('active'));
    const mainEl = document.querySelector('main');
    if (mainEl) mainEl.scrollTop = 0;
    window.scrollTo(0, 0);
  },

  exitDeep(resetTab = true) {
    this.deep = null;
    document.body.classList.remove('app-deep', 'app-main-visible');
    if (resetTab) this.setTab(this.tab || 'home');
  },

  updateTopTitle() {
    /* noop — titles set in openAction */
  },

  renderHome() {
    const user = typeof Auth !== 'undefined' ? Auth.user : null;
    if (!user) return;
    const greet = document.getElementById('app-home-greeting');
    const sub = document.getElementById('app-home-sub');
    const roleKey =
      typeof normalizeAppRole === 'function' ? normalizeAppRole(user.role) : user.role;
    const roleText =
      typeof roleLabel === 'function' ? roleLabel(user.role) : user.role;
    if (greet) {
      greet.textContent = `Hola, ${user.full_name || user.name || user.email}`;
    }
    if (sub) {
      sub.textContent = `${roleText}${user.company_name ? ` · ${user.company_name}` : ''}`;
    }
    if (typeof applyAppShellRole === 'function') applyAppShellRole(user);
    const quickBoard = document.getElementById('app-quick-board');
    if (quickBoard) quickBoard.hidden = false;
    const activeSlot = document.getElementById('app-home-active-slot');
    if (activeSlot) {
      const banner = document.getElementById('active-trip-banner');
      if (banner && !banner.hidden) {
        activeSlot.innerHTML = '';
        activeSlot.appendChild(banner);
        banner.hidden = false;
      } else {
        let hint = 'Sin viaje activo. Usa Opciones para emparejar.';
        if (roleKey === 'shipper') {
          hint = 'Sin viaje activo. Publica una carga o ve a Emparejar.';
        } else if (roleKey === 'carrier') {
          hint = 'Sin viaje activo. Oferta una ruta o ve a Emparejar.';
        }
        activeSlot.innerHTML = `<p class="muted">${hint}</p>`;
      }
    }
  },

  renderAccount() {
    const user = typeof Auth !== 'undefined' ? Auth.user : null;
    const hero = document.getElementById('app-profile-hero');
    const quick = document.getElementById('app-profile-quick');
    const sections = document.getElementById('app-profile-sections');
    if (!user || !hero) return;
    const role =
      typeof roleLabel === 'function' ? roleLabel(user.role) : user.role;
    const initial = (user.full_name || user.name || user.email || '?').charAt(0).toUpperCase();
    const truckLabel =
      user.role === 'carrier' && user.default_truck_type_id && typeof LoadCapacityUI !== 'undefined'
        ? LoadCapacityUI.truckById(user.default_truck_type_id)?.label || user.default_truck_type_id
        : null;
    hero.innerHTML = `
      <div class="app-profile-avatar" aria-hidden="true">${initial}</div>
      <div class="app-profile-ident">
        <p class="app-profile-name">${user.full_name || user.name || '—'}</p>
        <p class="app-profile-email">${user.email || ''}</p>
        <p class="app-profile-meta">${role}${user.company_name ? ` · ${user.company_name}` : ''}</p>
        ${truckLabel ? `<p class="app-profile-meta">Camión: <strong>${truckLabel}</strong></p>` : ''}
      </div>`;
    if (quick) {
      const tiles =
        user.role === 'carrier'
          ? [
              { action: 'trips', icon: '📋', label: 'Mis viajes' },
              { action: 'board', icon: '⚡', label: 'Emparejar' },
              { action: 'carrier', icon: '🚛', label: 'Ofertar' },
            ]
          : [
              { action: 'trips', icon: '📋', label: 'Mis viajes' },
              { action: 'board', icon: '⚡', label: 'Emparejar' },
              { action: 'shipper', icon: '📦', label: 'Publicar' },
            ];
      quick.innerHTML = tiles
        .map(
          (t) =>
            `<button type="button" class="app-profile-tile" data-app-quick="${t.action}">
          <span class="app-profile-tile-icon">${t.icon}</span>
          <span>${t.label}</span>
        </button>`
        )
        .join('');
      quick.querySelectorAll('[data-app-quick]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const a = btn.dataset.appQuick;
          if (a === 'trips') this.setTab('activity');
          else this.openAction(a);
        });
      });
    }
    if (sections) {
      const kycMeta =
        typeof accountKycRowMeta === 'function'
          ? accountKycRowMeta(user)
          : user.kyc_status || 'pending';
      const chevron =
        '<svg class="app-profile-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';
      const accordionRow = (action, label, metaHtml = '') => `
        <div class="app-profile-accordion-item">
          <button type="button" class="app-profile-row" data-profile-action="${action}" aria-expanded="false" aria-controls="app-panel-slot-${action}">
            <span>${label}</span>
            <span class="app-profile-row-end">${metaHtml}${chevron}</span>
          </button>
          <div id="app-panel-slot-${action}" class="app-profile-panel-slot" data-profile-panel="${action}" hidden></div>
        </div>`;
      sections.innerHTML = `
        <section class="app-account-group">
          <h3 class="app-account-group-title">Perfil</h3>
          <div class="app-profile-accordion">
            ${accordionRow('kyc', 'Verificación KYC', `<span class="app-profile-row-meta">${kycMeta}</span>`)}
          </div>
        </section>
        <section class="app-account-group">
          <h3 class="app-account-group-title">Seguridad</h3>
          <div class="app-profile-accordion">
            ${accordionRow('password', 'Cambiar contraseña')}
          </div>
        </section>
        <section class="app-account-group">
          <h3 class="app-account-group-title">Pagos</h3>
          <div class="app-profile-accordion">
            ${accordionRow('penalties', 'Multas y billetera')}
          </div>
        </section>
        <section class="app-account-group">
          <h3 class="app-account-group-title">Notificaciones</h3>
          <div class="app-profile-accordion">
            ${accordionRow('notifications', 'Centro de notificaciones')}
          </div>
        </section>
        <section class="app-account-group">
          <h3 class="app-account-group-title">Ayuda</h3>
          <div class="app-profile-accordion">
            ${accordionRow('help', 'Ayuda con un viaje')}
          </div>
        </section>`;
      sections.querySelectorAll('[data-profile-action]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.toggleAccountPanel(btn.dataset.profileAction);
        });
      });
    }
    const adminSlot = document.getElementById('app-account-admin-slot');
    if (adminSlot) {
      if (user.role === 'admin') {
        adminSlot.hidden = false;
        this.mountPanelInSlot('admin-hub-nav', 'app-account-admin-slot');
        this.mountPanelInSlot('admin-kyc-panel', 'app-account-admin-slot');
        this.mountPanelInSlot('admin-ops-panel', 'app-account-admin-slot');
      } else {
        adminSlot.hidden = true;
      }
    }
    const notifSrc = document.getElementById('notif-count');
    const notifDst = document.getElementById('app-notif-count');
    if (notifSrc && notifDst) {
      notifDst.textContent = notifSrc.textContent;
      notifDst.hidden = notifSrc.hidden;
    }
  },

  initPullToRefresh() {
    const scroll = document.getElementById('app-scroll');
    const indicator = document.getElementById('app-ptr-indicator');
    if (!scroll || !indicator) return;
    let startY = 0;
    let pulling = false;
    scroll.addEventListener(
      'touchstart',
      (e) => {
        if (this.tab !== 'activity' || scroll.scrollTop > 0) return;
        startY = e.touches[0].clientY;
        pulling = true;
      },
      { passive: true }
    );
    scroll.addEventListener(
      'touchmove',
      (e) => {
        if (!pulling || this.tab !== 'activity') return;
        const dy = e.touches[0].clientY - startY;
        if (dy > 50 && scroll.scrollTop <= 0) indicator.classList.add('visible');
        else indicator.classList.remove('visible');
      },
      { passive: true }
    );
    scroll.addEventListener(
      'touchend',
      async () => {
        if (!pulling) return;
        pulling = false;
        if (indicator.classList.contains('visible')) {
          indicator.textContent = 'Actualizando…';
          if (typeof refreshBoard === 'function') await refreshBoard();
          if (typeof Comms !== 'undefined') Comms.refreshBell?.();
          indicator.textContent = 'Suelta para actualizar';
        }
        indicator.classList.remove('visible');
      },
      { passive: true }
    );
  },
};

AppShell.init();
window.AppShell = AppShell;
