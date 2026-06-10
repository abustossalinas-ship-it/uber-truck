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
      ? 'Con onboarding@resend.dev solo llega al email de tu cuenta Resend. Verifica dominio para otros destinatarios.'
      : null,
  };
}

function publicAppUrl(fallback) {
  const base = (process.env.APP_PUBLIC_URL || fallback || '').replace(/\/$/, '');
  return base || 'http://localhost:3001';
}

async function sendPasswordResetEmail({ to, fullName, resetUrl }) {
  const from = process.env.EMAIL_FROM || 'Cubik <onboarding@resend.dev>';
  const key = process.env.RESEND_API_KEY?.trim();
  const subject = 'Restablecer contraseña — Cubik';
  const greeting = fullName ? `Hola ${fullName},` : 'Hola,';
  const html = `
    <p>${greeting}</p>
    <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>Cubik</strong>.</p>
    <p><a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#f26522;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Crear nueva contraseña</a></p>
    <p>O copia este enlace en el navegador:<br><a href="${resetUrl}">${resetUrl}</a></p>
    <p>El enlace vence en <strong>1 hora</strong>. Si no pediste este cambio, ignora este correo.</p>
    <p style="color:#666;font-size:12px;">Cubik — Optimiza tus envíos</p>
  `;

  if (!key) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[mail:dev] Password reset email');
      console.log('  to:', to);
      console.log('  url:', resetUrl);
      return { ok: true, dev: true };
    }
    const err = new Error(
      'Correo no configurado. Agrega RESEND_API_KEY y EMAIL_FROM en Railway.'
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
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body.message || body.error || JSON.stringify(body) || 'No se pudo enviar el correo';
    console.error('[mail] Resend error', res.status, detail, { to, from });
    const err = new Error(detail);
    err.status = 502;
    err.resend = body;
    throw err;
  }
  console.log('[mail] Password reset sent', { to, id: body.id });
  return { ok: true, id: body.id };
}

module.exports = { isConfigured, publicAppUrl, sendPasswordResetEmail, statusPayload };
