'use strict';

const supabase = require('../services/supabase');
const { enrollCard, paymentProviderMode, providerLabel } = require('../services/payment-provider');

function toApiRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider,
    card_brand: row.card_brand,
    card_last4: row.card_last4,
    holder_name: row.holder_name,
    holder_rut: row.holder_rut,
    verified_at: row.verified_at,
    microcharge_clp: row.microcharge_clp,
    microcharge_status: row.microcharge_status,
    is_default: row.is_default,
  };
}

async function listPaymentMethods(userId) {
  if (!userId || !supabase.isConfigured()) return [];
  const sb = supabase.getClient();
  const { data, error } = await sb
    .from('user_payment_methods')
    .select(
      'id, provider, card_brand, card_last4, holder_name, holder_rut, verified_at, microcharge_clp, microcharge_status, is_default'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    if (error.message?.includes('user_payment_methods')) return [];
    throw error;
  }
  return (data || []).map(toApiRow);
}

async function hasVerifiedCard(userId) {
  const rows = await listPaymentMethods(userId);
  return rows.length > 0;
}

async function savePaymentMethod(userId, enrolled) {
  const sb = supabase.getClient();
  await sb.from('user_payment_methods').update({ is_default: false }).eq('user_id', userId);
  const { data, error } = await sb
    .from('user_payment_methods')
    .insert({
      user_id: userId,
      provider: enrolled.provider,
      provider_token: enrolled.provider_token,
      card_brand: enrolled.card_brand,
      card_last4: enrolled.card_last4,
      holder_name: enrolled.holder_name,
      holder_rut: enrolled.holder_rut,
      verified_at: new Date().toISOString(),
      microcharge_clp: enrolled.microcharge_clp,
      microcharge_status: enrolled.microcharge_status,
      is_default: true,
    })
    .select(
      'id, provider, card_brand, card_last4, holder_name, holder_rut, verified_at, microcharge_clp, microcharge_status, is_default'
    )
    .single();
  if (error) throw error;
  return toApiRow(data);
}

async function enrollPaymentMethod(userId, email, payload) {
  if (!supabase.isConfigured()) {
    throw Object.assign(new Error('Pasarela requiere Supabase configurado'), { status: 503 });
  }
  const enrolled = await enrollCard(userId, email, payload);
  const saved = await savePaymentMethod(userId, enrolled);
  return { method: saved, message: enrolled.message };
}

async function deletePaymentMethod(userId, methodId) {
  const sb = supabase.getClient();
  const { data, error } = await sb
    .from('user_payment_methods')
    .delete()
    .eq('id', methodId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error('Medio de pago no encontrado'), { status: 404 });
  return { ok: true };
}

function paymentMethodsSummary(methods) {
  return {
    count: methods.length,
    verified: methods.length > 0,
    default: methods.find((m) => m.is_default) || methods[0] || null,
    provider_mode: paymentProviderMode(),
    provider_label: providerLabel(paymentProviderMode()),
  };
}

module.exports = {
  listPaymentMethods,
  hasVerifiedCard,
  enrollPaymentMethod,
  deletePaymentMethod,
  paymentMethodsSummary,
};
