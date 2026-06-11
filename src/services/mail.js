'use strict';

function isConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function statusPayload() {
  const from = process.env.EMAIL_FROM?.trim() || '';
  const sandboxFrom = /onboarding@resend\.dev/i.test(from) || !from;
  return {
    configured: isConfigured(),
    email_from_set: Boolean(from),
    email_from: from ? from.replace(/<[^>]+>/, '…').trim() : null,
    sandbox_sender: sandboxFrom,
    hint: sandboxFrom
      ? 'Con onboarding@resend.dev solo llega al email de tu cuenta Resend. Verifica getcubik.cl en Resend.'
      : null,
  };
}

function publicAppUrl(fallback) {
  const base = (process.env.APP_PUBLIC_URL || fallback || '').replace(/\/$/, '');
  return base || 'http://localhost:3001';
}

function formatUtc(isoDate) {
  const d = isoDate instanceof Date ? isoDate : new Date(isoDate);
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

async function sendHtmlEmail({ to, subject, html, logLabel }) {
  const from = process.env.EMAIL_FROM || 'Cubik <onboarding@resend.dev>';
  const key = process.env.RESEND_API_KEY?.trim();

  if (!key) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[mail:dev] ${logLabel || 'email'}`);
      console.log('  to:', to);
      console.log('  subject:', subject);
      return { ok: true, dev: true };
    }
    const err = new Error(
      'Correo no configurado. Agrega RESEND_API_KEY y EMAIL_FROM=Cubik <no_reply@getcubik.cl> en Railway.'
    );
    err.status = 503;
    throw err;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body.message || body.error || JSON.stringify(body) || 'No se pudo enviar el correo';
    console.error('[mail] Resend error', res.status, detail, { to, from, logLabel });
    const err = new Error(detail);
    err.status = 502;
    err.resend = body;
    throw err;
  }
  console.log(`[mail] ${logLabel || 'sent'}`, { to, id: body.id });
  return { ok: true, id: body.id };
}

async function sendPasswordResetEmail({ to, fullName, resetUrl }) {
  const greeting = fullName ? `Hola ${fullName},` : 'Hola,';
  const html = `
    <p>${greeting}</p>
    <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>Cubik</strong>.</p>
    <p><a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#f7941d;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Crear nueva contraseña</a></p>
    <p>O copia este enlace en el navegador:<br><a href="${resetUrl}">${resetUrl}</a></p>
    <p>El enlace vence en <strong>1 hora</strong>. Si no pediste este cambio, ignora este correo.</p>
    <p style="color:#666;font-size:12px;">Cubik — Optimiza tus envíos · getcubik.cl</p>
  `;
  return sendHtmlEmail({
    to,
    subject: 'Restablecer contraseña — Cubik',
    html,
    logLabel: 'Password reset',
  });
}

async function sendLoginOtpEmail({ to, fullName, code }) {
  const greeting = fullName ? `Hola ${fullName},` : 'Hola,';
  const html = `
    <p>${greeting}</p>
    <p>Tu código para verificar el inicio de sesión en <strong>Cubik</strong> es:</p>
    <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#0f2744;">${code}</p>
    <p>Válido por <strong>10 minutos</strong>. Si no intentaste ingresar, ignora este correo.</p>
    <p style="color:#666;font-size:12px;">Cubik — Optimiza tus envíos · getcubik.cl</p>
  `;
  const result = await sendHtmlEmail({
    to,
    subject: `${code} es tu código Cubik`,
    html,
    logLabel: 'Login OTP',
  });
  if (result.dev) result.dev_code = code;
  return result;
}

async function sendNewDeviceSignInEmail({
  to,
  fullName,
  resetUrl,
  signInAt,
  country,
  deviceType,
  surface,
  ip,
}) {
  const greeting = fullName ? `Hola ${fullName},` : 'Hola,';
  const when = formatUtc(signInAt || new Date());
  const html = `
    <div style="font-family:system-ui,sans-serif;color:#111;max-width:520px;">
      <h1 style="font-size:22px;margin:0 0 16px;">Nuevo inicio de sesión en Cubik</h1>
      <p>${greeting}</p>
      <p>Parece que tu cuenta de Cubik se usó para iniciar sesión en un dispositivo nuevo. Revisa los detalles:</p>
      <ul style="line-height:1.6;padding-left:20px;">
        <li><strong>Fecha y hora:</strong> ${when}</li>
        <li><strong>País:</strong> ${country || '—'}</li>
        <li><strong>Dispositivo:</strong> ${deviceType || '—'}</li>
        <li><strong>Superficie:</strong> ${surface || '—'}</li>
        <li><strong>IP:</strong> ${ip || '—'}</li>
      </ul>
      <p>Si no fuiste tú, restablece tu contraseña:</p>
      <p><a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#f7941d;color:#fff;text-decoration:none;border-radius:999px;font-weight:bold;">Restablecer contraseña</a></p>
      <p style="color:#666;font-size:12px;">Cubik — Optimiza tus envíos · getcubik.cl</p>
    </div>
  `;
  return sendHtmlEmail({
    to,
    subject: 'Nuevo inicio de sesión — Cubik',
    html,
    logLabel: 'New device sign-in',
  });
}

module.exports = {
  isConfigured,
  publicAppUrl,
  sendPasswordResetEmail,
  sendLoginOtpEmail,
  sendNewDeviceSignInEmail,
  statusPayload,
};
