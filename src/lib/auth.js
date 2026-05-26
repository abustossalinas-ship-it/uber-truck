'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../services/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'uber-truck-dev-change-me';
const JWT_EXPIRES = '7d';

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.full_name },
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

async function registerUser({ email, password, full_name, role, company_name }) {
  if (!supabase.isConfigured()) {
    const err = new Error('Registro requiere Supabase configurado');
    err.status = 503;
    throw err;
  }
  const hash = await bcrypt.hash(password, 10);
  const sb = supabase.getClient();
  const { data, error } = await sb
    .from('users')
    .insert({
      email: email.trim().toLowerCase(),
      full_name: full_name.trim(),
      role: role === 'carrier' ? 'carrier' : 'shipper',
      company_name: company_name?.trim() || null,
      password_hash: hash,
      kyc_status: 'pending',
    })
    .select('id, email, full_name, role, company_name')
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

async function loginUser({ email, password }) {
  if (!supabase.isConfigured()) {
    const err = new Error('Login requiere Supabase configurado');
    err.status = 503;
    throw err;
  }
  const sb = supabase.getClient();
  const { data, error } = await sb
    .from('users')
    .select('id, email, full_name, role, company_name, password_hash')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw error;
  if (!data?.password_hash) {
    const e = new Error('Credenciales inválidas');
    e.status = 401;
    throw e;
  }
  const ok = await bcrypt.compare(password, data.password_hash);
  if (!ok) {
    const e = new Error('Credenciales inválidas');
    e.status = 401;
    throw e;
  }
  const user = {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    role: data.role,
    company_name: data.company_name,
  };
  return { user, token: signToken(user) };
}

module.exports = {
  signToken,
  verifyToken,
  authMiddleware,
  registerUser,
  loginUser,
};
