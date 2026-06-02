/**
 * Cubik — shell móvil (4 fases): bienvenida, bottom nav, Capacitor nativo.
 */
const AppShell = {
  tab: 'home',
  deep: null,
  _splashHidden: false,

  isNative() {
    return Boolean(window.Capacitor?.isNativePlatform?.());
  },

  isAppMode() {
    if (this.isNative()) return true;
    if (localStorage.getItem('cubik_force_app') === '1') return true;
    if (new URLSearchParams(location.search).get('app') === '1') return true;
    return (
      window.matchMedia('(display-mode: standalone)').matches &&
      window.innerWidth < 900
    );
  },

  isExplicitAppMode() {
    if (this.isNative()) return true;
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
    const gate = document.getElementById('app-gate');
    if (gate) gate.hidden = false;
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
    this.syncAuthState();
    document.addEventListener('DOMContentLoaded', () => this.syncAuthState());
  },

  initNativePlugins() {
    if (!this.isNative()) return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.runNativeSetup());
    } else {
      this.runNativeSetup();
    }
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
        await StatusBar.setBackgroundColor?.({ color: '#0f2744' });
        await StatusBar.setStyle?.({ style: 'DARK' });
      }
    } catch (_) {}
    try {
      Cap.Plugins.App?.addListener?.('backButton', ({ canGoBack }) => {
        if (this.deep) {
          this.exitDeep();
          return;
        }
        if (document.getElementById('auth-panel')?.hidden === false) {
          if (typeof closeAuthPanel === 'function') closeAuthPanel();
          else document.getElementById('auth-panel').hidden = true;
          return;
        }
        if (!canGoBack) Cap.Plugins.App?.exitApp?.();
      });
    } catch (_) {}
    setTimeout(() => this.initPushStub(), 8000);
  },

  async initPushStub() {
    const Push = window.Capacitor?.Plugins?.PushNotifications;
    if (!Push) return;
    try {
      const perm = await Push.checkPermissions?.();
      if (perm?.receive === 'prompt') await Push.requestPermissions?.();
      await Push.addListener?.('registration', () => {});
      await Push.addListener?.('pushNotificationReceived', () => {});
      await Push.register?.();
    } catch (_) {
      /* FCM/google-services.json pendiente en Play */
    }
  },

  bindWelcome() {
    document.getElementById('btn-welcome-login')?.addEventListener('click', () => {
      if (typeof openAuthPanel === 'function') openAuthPanel(false);
    });
    document.getElementById('btn-welcome-register')?.addEventListener('click', () => {
      if (typeof openAuthPanel === 'function') openAuthPanel(true);
    });
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
      document.getElementById('btn-notifications')?.click();
    });
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
  },

  bindAccount() {
    document.getElementById('app-btn-logout')?.addEventListener('click', () => {
      document.getElementById('btn-auth')?.click();
    });
    document.getElementById('app-btn-change-pw')?.addEventListener('click', () => {
      document.getElementById('btn-change-password')?.click();
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
    if (user) {
      this.renderHome();
      this.renderAccount();
      if (!this.deep) this.setTab(this.tab || 'home');
    } else {
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
      if (!authOpenWithError) {
        authPanel?.setAttribute('hidden', '');
        const welcome = document.getElementById('app-welcome');
        if (welcome) welcome.hidden = false;
      } else {
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
      'admin-hub-nav',
      'admin-kyc-panel',
      'admin-ops-panel',
    ];
    let after = anchor;
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.parentElement?.id?.startsWith('app-account') || el.parentElement?.id === 'app-account-admin-slot') {
        after.insertAdjacentElement('afterend', el);
        after = el;
      }
    });
  },

  mountPanelInSlot(elementId, slotId) {
    const el = document.getElementById(elementId);
    const slot = document.getElementById(slotId);
    if (el && slot && !slot.contains(el)) slot.appendChild(el);
  },

  setTab(tab) {
    this.tab = tab;
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
      if (typeof showTab === 'function') showTab('trips');
    }
    if (tab === 'home') this.renderHome();
    if (tab === 'account') {
      this.renderAccount();
      if (typeof refreshAdminHubNav === 'function') refreshAdminHubNav();
      if (typeof refreshAdminKycPanel === 'function') refreshAdminKycPanel();
      if (typeof refreshAdminOpsPanel === 'function') refreshAdminOpsPanel();
    }
  },

  openAction(action) {
    const map = {
      shipper: { tab: 'shipper', title: 'Publicar carga' },
      carrier: { tab: 'carrier', title: 'Ofertar ruta' },
      board: { tab: 'board', title: 'Emparejar' },
      trips: { tab: 'trips', title: 'Mis viajes' },
      notifications: { tab: null, title: 'Notificaciones' },
    };
    const cfg = map[action];
    if (!cfg) return;
    if (action === 'notifications') {
      document.getElementById('btn-notifications')?.click();
      return;
    }
    this.deep = cfg.tab;
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
    const role =
      typeof roleLabel === 'function' ? roleLabel(user.role) : user.role;
    if (greet) {
      greet.textContent = `Hola, ${user.full_name || user.name || user.email}`;
    }
    if (sub) {
      sub.textContent = `${role}${user.company_name ? ` · ${user.company_name}` : ''}`;
    }
    const quickShipper = document.getElementById('app-quick-shipper');
    const quickCarrier = document.getElementById('app-quick-carrier');
    const quickBoard = document.getElementById('app-quick-board');
    if (quickShipper) quickShipper.hidden = user.role === 'carrier';
    if (quickCarrier) quickCarrier.hidden = user.role === 'shipper';
    if (quickBoard) quickBoard.hidden = false;
    const optShipper = document.getElementById('app-opt-shipper');
    const optCarrier = document.getElementById('app-opt-carrier');
    if (optShipper) optShipper.hidden = user.role === 'carrier';
    if (optCarrier) optCarrier.hidden = user.role === 'shipper';
    const activeSlot = document.getElementById('app-home-active-slot');
    if (activeSlot) {
      const banner = document.getElementById('active-trip-banner');
      if (banner && !banner.hidden) {
        activeSlot.innerHTML = '';
        activeSlot.appendChild(banner);
        banner.hidden = false;
      } else {
        activeSlot.innerHTML =
          '<p class="muted">Sin viaje activo. Usa Opciones para publicar o emparejar.</p>';
      }
    }
  },

  renderAccount() {
    const user = typeof Auth !== 'undefined' ? Auth.user : null;
    const el = document.getElementById('app-account-profile');
    if (!el || !user) return;
    const role =
      typeof roleLabel === 'function' ? roleLabel(user.role) : user.role;
    el.innerHTML = `
      <p><strong>${user.full_name || user.name || '—'}</strong></p>
      <p class="muted">${user.email}</p>
      <p class="muted">${role} · ${user.company_name || '—'}</p>
      <p class="muted">KYC: <strong>${user.kyc_status || 'pending'}</strong></p>
    `;
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
    this.mountPanelInSlot('account-penalties-panel', 'app-account-penalties-slot');
    this.mountPanelInSlot('kyc-banner', 'app-account-kyc-slot');
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
