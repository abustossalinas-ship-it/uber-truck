'use strict';

const supabase = require('../services/supabase');
const {
  evaluateDocumentCompliance,
  docsBlockMessage,
  syncUserDocumentCompliance,
} = require('./carrier-documents');

function kycEnforced() {
  if (!supabase.isConfigured()) return false;
  if (process.env.KYC_ENFORCE === 'false') return false;
  if (process.env.KYC_ENFORCE === 'true') return true;
  return process.env.NODE_ENV === 'production';
}

async function fetchOperatorGate(userId) {
  if (!userId || !supabase.isConfigured()) {
    return { kyc_status: 'approved', docs_compliance_status: 'unknown', compliance: null };
  }
  const sb = supabase.getClient();
  const { data, error } = await sb
    .from('users')
    .select(
      'kyc_status, role, doc_ci_expires_at, doc_license_expires_at, doc_insurance_expires_at, doc_soap_expires_at, docs_compliance_status'
    )
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { kyc_status: 'pending', docs_compliance_status: 'unknown', compliance: null };
  const compliance =
    data.role === 'carrier' ? evaluateDocumentCompliance(data) : null;
  return {
    kyc_status: data.kyc_status || 'pending',
    docs_compliance_status: data.docs_compliance_status || compliance?.status || 'unknown',
    compliance,
  };
}

async function fetchKycStatus(userId) {
  const gate = await fetchOperatorGate(userId);
  return gate.kyc_status;
}

function kycBlockMessage(status, compliance) {
  if (compliance?.status === 'expired') {
    return docsBlockMessage(compliance);
  }
  if (status === 'rejected') {
    return 'Tu cuenta no fue aprobada para operar en el piloto. Contacta a soporte.';
  }
  return 'Tu cuenta está en revisión. Un administrador debe aprobarla antes de publicar o emparejar.';
}

/** Impide login app si transportista tiene documentación legal vencida. */
async function assertCarrierLoginAllowed(user) {
  if (!user?.id || user.role !== 'carrier' || !supabase.isConfigured()) return;
  const gate = await fetchOperatorGate(user.id);
  if (gate.compliance?.status === 'expired') {
    const err = new Error(docsBlockMessage(gate.compliance));
    err.status = 403;
    err.code = 'docs_expired';
    err.docs_blocked = true;
    err.docs_compliance_status = 'expired';
    throw err;
  }
}

/** Bloquea operaciones de marketplace si KYC no está aprobado o docs vencidos. */
async function requireApprovedOperator(req, res, next) {
  if (!kycEnforced()) return next();
  if (!req.user?.sub) return next();
  if (req.user.role === 'admin') return next();
  try {
    const gate = await fetchOperatorGate(req.user.sub);
    req.user.kyc_status = gate.kyc_status;
    req.user.docs_compliance_status = gate.docs_compliance_status;
    req.user.document_compliance = gate.compliance;

    if (gate.compliance?.status === 'expired') {
      return res.status(403).json({
        ok: false,
        error: docsBlockMessage(gate.compliance),
        kyc_status: gate.kyc_status,
        docs_compliance_status: 'expired',
        docs_blocked: true,
      });
    }

    if (gate.kyc_status === 'approved') return next();
    return res.status(403).json({
      ok: false,
      error: kycBlockMessage(gate.kyc_status, gate.compliance),
      kyc_status: gate.kyc_status,
      docs_compliance_status: gate.docs_compliance_status,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'No se pudo verificar el estado de la cuenta' });
  }
}

module.exports = {
  kycEnforced,
  fetchKycStatus,
  fetchOperatorGate,
  kycBlockMessage,
  assertCarrierLoginAllowed,
  requireApprovedOperator,
  syncUserDocumentCompliance,
};
