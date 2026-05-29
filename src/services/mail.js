'use strict';

function isConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function publicAppUrl(fallback) {
  const base = (process.env.APP_PUBLIC_URL || fallback || '').replace(/\/$/, '');
  return base || 'http://localhost:3001';
}

async function sendPasswordResetEmail({ to, fullName, resetUrl }) {
  const from = process.env.EMAIL_FROM || 'Uber Truck <onboarding@resend.dev>';
  const key = process.env.RESEND_API_KEY?.trim();
  const subject = 'Restablecer contraseña — Uber Truck';
  const greeting = fullName ? `Hola ${fullName},` : 'Hola,';
  const html = `
    <p>${greeting}</p>
    <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>Uber Truck</strong>.</p>
    <p><a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#f26522;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Crear nueva contraseña</a></p>
    <p>O copia este enlace en el navegador:<br><a href="${resetUrl}">${resetUrl}</a></p>
    <p>El enlace vence en <strong>1 hora</strong>. Si no pediste este cambio, ignora este correo.</p>
    <p style="color:#666;font-size:12px;">Uber Truck — Inteligencia en movimiento</p>
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
    const err = new Error(body.message || body.error || 'No se pudo enviar el correo');
    err.status = 502;
    throw err;
  }
  return { ok: true, id: body.id };
}

module.exports = { isConfigured, publicAppUrl, sendPasswordResetEmail };
