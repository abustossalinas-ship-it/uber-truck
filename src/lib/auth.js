'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../services/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'uber-truck-dev-change-me';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '30d';

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.full_name,
      company_name: user.company_name || null,
      kyc_status: user.kyc_status || 'pending',
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: 'No autenticado' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ ok: false, error: 'Sesión inválida' });
  req.user = payload;
  next();
}

async function registerUser({ email, password, full_name, role, company_name, phone, admin_key }) {
  if (!supabase.isConfigured()) {
    const err = new Error('Registro no disponible: la base de datos del servidor no está configurada');
    err.status = 503;
    throw err;
  }
  let resolvedRole = role === 'carrier' ? 'carrier' : 'shipper';
  if (role === 'admin') {
    const secret = process.env.ADMIN_REGISTER_KEY;
    if (!secret || admin_key !== secret) {
      const e = new Error('Registro administrador no autorizado');
      e.status = 403;
      throw e;
    }
    resolvedRole = 'admin';
  }
  if (!company_name?.trim()) {
    const e = new Error('Nombre de empresa requerido');
    e.status = 400;
    throw e;
  }
  const hash = await bcrypt.hash(password, 10);
  const sb = supabase.getClient();
  const { data, error } = await sb
    .from('users')
    .insert({
      email: email.trim().toLowerCase(),
      full_name: full_name.trim(),
      role: resolvedRole,
      company_name: company_name.trim(),
      phone: phone?.trim() || null,
      password_hash: hash,
      kyc_status: resolvedRole === 'admin' ? 'approved' : 'pending',
    })
    .select(
      'id, email, full_name, role, company_name, phone, kyc_status, is_available, last_lat, last_lng, location_updated_at, default_truck_type_id'
    )
    .single();
  if (error) {
    if (error.code === '23505') {
      const e = new Error('Email ya registrado');
      e.status = 409;
      throw e;
    }
    throw error;
  }
  return { user: data, token: signToken(data) };
}

async function validateLoginCredentials(email, password) {
  if (!supabase.isConfigured()) {
    const err = new Error('Login requiere Supabase configurado');
    err.status = 503;
    throw err;
  }
  const sb = supabase.getClient();
  const { data, error } = await sb
    .from('users')
    .select(
      'id, email, full_name, role, company_name, phone, password_hash, kyc_status, is_available, last_lat, last_lng, location_updated_at, default_truck_type_id'
    )
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const e = new Error('No existe una cuenta con ese email.');
    e.status = 401;
    e.code = 'email_not_found';
    throw e;
  }
  if (!data.password_hash) {
    const e = new Error('Esta cuenta no tiene contraseña. Usa «Recuperar contraseña».');
    e.status = 401;
    e.code = 'no_password';
    throw e;
  }
  const ok = await bcrypt.compare(password, data.password_hash);
  if (!ok) {
    const e = new Error('Contraseña incorrecta.');
    e.status = 401;
    e.code = 'wrong_password';
    throw e;
  }
  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    role: data.role,
    company_name: data.company_name,
    phone: data.phone,
    kyc_status: data.kyc_status || 'pending',
    is_available: Boolean(data.is_available),
    last_lat: data.last_lat ?? null,
    last_lng: data.last_lng ?? null,
    location_updated_at: data.location_updated_at || null,
    default_truck_type_id: data.default_truck_type_id || null,
  };
}

async function loginUser({ email, password }) {
  const user = await validateLoginCredentials(email, password);
  return { user, token: signToken(user) };
}

async function fetchUserById(userId) {
  if (!userId || !supabase.isConfigured()) return null;
  const sb = supabase.getClient();
  const { data, error } = await sb
    .from('users')
    .select(
      'id, email, full_name, role, company_name, phone, kyc_status, is_available, last_lat, last_lng, location_updated_at, default_truck_type_id'
    )
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function updateUserProfile(userId, fields) {
  if (!userId || !supabase.isConfigured()) {
    const err = new Error('Perfil requiere Supabase configurado');
    err.status = 503;
    throw err;
  }
  const patch = {};
  if (fields.default_truck_type_id !== undefined) {
    patch.default_truck_type_id = fields.default_truck_type_id || null;
  }
  if (!Object.keys(patch).length) {
    const err = new Error('Sin cambios para guardar');
    err.status = 400;
    throw err;
  }
  const sb = supabase.getClient();
  const { data, error } = await sb
    .from('users')
    .update(patch)
    .eq('id', userId)
    .select(
      'id, email, full_name, role, company_name, phone, kyc_status, is_available, last_lat, last_lng, location_updated_at, default_truck_type_id'
    )
    .single();
  if (error) throw error;
  return data;
}

module.exports = {
  signToken,
  verifyToken,
  authMiddleware,
  registerUser,
  validateLoginCredentials,
  loginUser,
  fetchUserById,
  updateUserProfile,
};
