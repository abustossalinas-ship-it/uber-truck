'use strict';

const fcm = require('../services/fcm');
const mail = require('../services/mail');
const { paymentConfig } = require('./payment-config');

/**
 * Estado server-side de los 8 ítems Post-MVP (orden memoria v4.3).
 * @param {{ fcm_tokens?: number }} ctx
 */
function buildPostMvpStatus(ctx = {}) {
  const payment = paymentConfig();
  const oauthConfigured =
    Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()) &&
    Boolean(process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim());
  const appleConfigured = Boolean(process.env.APPLE_CLIENT_ID?.trim());
  const resendOk = mail.isConfigured();
  const twilioProxy = process.env.TWILIO_MATCH_PROXY_NUMBER?.trim() || '';
  const fcmOk = fcm.isConfigured();
  const tokenCount = ctx.fcm_tokens ?? 0;

  const walletProdReady = payment.provider_mode === 'mercadopago';
  const walletPilot = payment.provider_mode === 'sandbox' || payment.sandbox_in_production;

  return {
    updated: '2026-06-12',
    software: '0.0.128',
    items: [
      {
        id: 'oauth',
        order: 1,
        title: 'Login Gmail / Apple',
        phase: 'post_pilot',
        status: 'deferred',
        server_ready: oauthConfigured || appleConfigured,
        blocking_demo: false,
        summary: oauthConfigured
          ? 'Google OAuth parcial en env'
          : 'Fuera de alcance inmediato — bloque E',
        env: {
          GOOGLE_OAUTH_CLIENT_ID: Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()),
          APPLE_CLIENT_ID: Boolean(process.env.APPLE_CLIENT_ID?.trim()),
        },
        validate: [
          'Confirmar con negocio: no prometer en demo',
          'Tras M2: crear credenciales OAuth + SQL provider',
        ],
      },
      {
        id: 'password_reset',
        order: 2,
        title: 'Recuperar contraseña',
        phase: 'post_pilot',
        status: resendOk ? 'validated' : 'blocked_env',
        server_ready: resendOk,
        blocking_demo: false,
        validated_at: resendOk ? '2026-06-12' : undefined,
        summary: resendOk
          ? 'Cerrado jun 2026 — getcubik.cl verificado en Resend (sandbox_sender: false en /health)'
          : 'UI lista; falta RESEND_API_KEY + EMAIL_FROM en Railway',
        env: { RESEND_API_KEY: resendOk, EMAIL_FROM: Boolean(process.env.EMAIL_FROM?.trim()) },
        validate: [
          '✓ ¿Olvidaste tu contraseña? → correo Resend → enlace 1 h',
          'Pendiente post-piloto: MFA (complejidad 8+ activa v0.0.128)',
        ],
      },
      {
        id: 'wallet_prod',
        order: 3,
        title: 'Pago en app (prod)',
        phase: 'pilot_p0',
        status: walletProdReady ? 'ready_to_validate' : 'in_progress',
        server_ready: walletProdReady,
        blocking_demo: false,
        summary: walletProdReady
          ? 'Mercado Pago configurado'
          : walletPilot
            ? 'Piloto simulado activo; wallet real pendiente'
            : 'Pasarela no configurada',
        env: {
          PAYMENT_PROVIDER: payment.provider_mode,
          MERCADOPAGO_ACCESS_TOKEN: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()),
        },
        validate: [
          'Definir MP prod o transferencia + ledger',
          'Migración wallet + saldo usuario',
          'Retención al «En ruta» (U7)',
        ],
      },
      {
        id: 'trip_contact',
        order: 4,
        title: 'Contacto en viaje',
        phase: 'pilot_p0',
        status: 'validated',
        server_ready: true,
        blocking_demo: false,
        validated_at: '2026-06-12',
        summary:
          'Piloto: chat in-app + WhatsApp comercial Cubik. Twilio Proxy opcional (voz PSTN enmascarada).',
        env: {
          in_app_chat: true,
          whatsapp_cloud: Boolean(process.env.WHATSAPP_CLOUD_ENABLED),
          twilio_proxy: Boolean(twilioProxy),
        },
        validate: [
          '✓ Chat in-app en viaje aceptado/en ruta (canal principal piloto)',
          '✓ WhatsApp Cubik para captación y soporte — WHATSAPP-META-CLOUD.md',
          twilioProxy
            ? 'Twilio configurado — probar botón Llamar'
            : 'Twilio opcional P1 — no requerido si coordinan por chat',
        ],
      },
      {
        id: 'twilio_proxy',
        order: 4.5,
        title: 'Voz enmascarada (Twilio, opcional)',
        phase: 'pilot_p1',
        status: twilioProxy ? 'ready_to_validate' : 'deferred',
        server_ready: Boolean(twilioProxy),
        blocking_demo: false,
        summary: twilioProxy
          ? `Proxy ${twilioProxy.slice(0, 6)}… configurado`
          : 'Opcional — piloto OK con chat in-app; activar si exigen llamada PSTN tipo Uber',
        env: {
          TWILIO_MATCH_PROXY_NUMBER: Boolean(twilioProxy),
          TWILIO_ACCOUNT_SID: Boolean(process.env.TWILIO_ACCOUNT_SID?.trim()),
        },
        validate: [
          'Viaje aceptado/en ruta → botón Llamar → tel: proxy sin números reales',
          'No confundir con WhatsApp — Meta no ofrece proxy de voz equivalente',
        ],
      },
      {
        id: 'push_fcm',
        order: 5,
        title: 'Push móvil (FCM)',
        phase: 'pilot_p0',
        status: fcmOk ? 'validated' : 'blocked_env',
        server_ready: fcmOk,
        blocking_demo: false,
        validated_at: '2026-06-10',
        summary: fcmOk
          ? 'Validado 10 jun 2026 — 3 push en segundo plano (acciones de viaje)'
          : 'Falta FCM_SERVICE_ACCOUNT_B64 en Railway',
        env: { ...fcm.statusPayload(), device_tokens: tokenCount },
        validate: [
          '✓ APK Android + login + permiso notificaciones',
          '✓ App en segundo plano — 3 notificaciones push de acciones (10 jun 2026)',
        ],
      },
      {
        id: 'gps_background',
        order: 6,
        title: 'GPS background (app cerrada)',
        phase: 'pilot_p1',
        status: 'deferred',
        server_ready: false,
        blocking_demo: false,
        summary: 'Spike Capacitor sem 4–9 si piloto lo exige',
        validate: [
          'Medir quejas GPS en primeras 2 semanas piloto',
          'Si >30%: spike plugin background geolocation',
        ],
      },
      {
        id: 'ios_native',
        order: 7,
        title: 'App iOS nativa',
        phase: 'post_scale',
        status: 'deferred',
        server_ready: false,
        blocking_demo: false,
        summary: 'Hoy PWA vía /probar',
        validate: ['No acción hasta escala o TestFlight acordado'],
      },
      {
        id: 'escrow_en_route',
        order: 8,
        title: 'Escrow checkout en ruta',
        phase: 'pilot_p0',
        status: walletProdReady ? 'blocked_deps' : 'blocked_deps',
        server_ready: false,
        blocking_demo: false,
        summary: 'Diseño cerrado; depende de wallet prod (ítem 3)',
        blocked_by: ['wallet_prod'],
        validate: [
          'Completar wallet prod primero',
          'Retención al «Marcar en ruta» + ledger',
        ],
      },
    ],
  };
}

module.exports = { buildPostMvpStatus };
