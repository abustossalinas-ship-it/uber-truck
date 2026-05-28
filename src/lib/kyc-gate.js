'use strict';

const supabase = require('../services/supabase');

function kycEnforced() {
  if (!supabase.isConfigured()) return false;
  if (process.env.KYC_ENFORCE === 'false') return false;
  if (process.env.KYC_ENFORCE === 'true') return true;
  return process.env.NODE_ENV === 'production';
}

async function fetchKycStatus(userId) {
  if (!userId || !supabase.isConfigured()) return 'approved';
  const sb = supabase.getClient();
  const { data, error } = await sb
    .from('users')
    .select('kyc_status')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.kyc_status || 'pending';
}

function kycBlockMessage(status) {
  if (status === 'rejected') {
    return 'Tu cuenta no fue aprobada para operar en el piloto. Contacta a soporte.';
  }
  return 'Tu cuenta está en revisión. Un administrador debe aprobarla antes de publicar o emparejar.';
}

/** Bloquea operaciones de marketplace si KYC no está aprobado (admin y demo sin JWT exentos). */
async function requireApprovedOperator(req, res, next) {
  if (!kycEnforced()) return next();
  if (!req.user?.sub) return next();
  if (req.user.role === 'admin') return next();
  try {
    const status = await fetchKycStatus(req.user.sub);
    req.user.kyc_status = status;
    if (status === 'approved') return next();
    return res.status(403).json({
      ok: false,
      error: kycBlockMessage(status),
      kyc_status: status,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'No se pudo verificar el estado de la cuenta' });
  }
}

module.exports = {
  kycEnforced,
  fetchKycStatus,
  kycBlockMessage,
  requireApprovedOperator,
};
