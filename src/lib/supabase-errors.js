'use strict';

/** Mensaje claro según error de Postgres / PostgREST (Supabase). */
function mapDbError(e, context) {
  const code = e?.code;
  const msg = e?.message || String(e);
  const ctx = context || 'operación';

  if (code === '42P01' || /relation ["']?match_ratings["']? does not exist/i.test(msg)) {
    return {
      status: 503,
      error:
        'La tabla match_ratings no está visible para la API. En Supabase: confirma migración 012 en el mismo proyecto que Railway (ref en /health), luego Settings → API → Reload schema (o espera 1–2 min).',
    };
  }
  if (code === '23505' && /match_ratings/i.test(msg)) {
    return { status: 409, error: 'Ya calificaste este viaje.' };
  }
  if (code === 'PGRST205' || /schema cache/i.test(msg)) {
    return {
      status: 503,
      error:
        'Supabase aún no actualizó el esquema tras el SQL 012. En el panel: Settings → API → Reload schema, espera un minuto y reintenta.',
    };
  }
  if (/match_ratings/i.test(msg) && /permission|policy|RLS/i.test(msg)) {
    return {
      status: 503,
      error: 'Sin permiso sobre match_ratings. El servidor debe usar SUPABASE_SERVICE_ROLE_KEY en Railway.',
    };
  }
  return {
    status: 500,
    error: `Error en ${ctx}: ${msg.slice(0, 200)}`,
  };
}

module.exports = { mapDbError };
