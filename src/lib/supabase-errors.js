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
        'Tabla match_ratings no existe. Ejecuta migración 012 en Supabase.',
    };
  }
  if (code === '23505' && /match_ratings/i.test(msg)) {
    return { status: 409, error: 'Ya calificaste este viaje.' };
  }
  if (
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    /schema cache/i.test(msg) ||
    /Could not find the .* column/i.test(msg)
  ) {
    return {
      status: 503,
      error:
        'La API aún no ve las columnas tags/tag_band. En SQL Editor ejecuta: NOTIFY pgrst, \'reload schema\'; y espera 1 minuto.',
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
