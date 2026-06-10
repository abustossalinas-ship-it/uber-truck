const path = require('path');
const fs = require('fs');
const express = require('express');
const pkg = require('../package.json');

function readDeployManifest() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'public', 'deploy.json'), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function versionParts(v) {
  return String(v || '')
    .split('.')
    .map((n) => Number(n) || 0);
}

/** true si la versión del servidor va detrás del manifest empaquetado */
function serverBehindManifest(serverVer, manifestVer) {
  const s = versionParts(serverVer);
  const m = versionParts(manifestVer);
  for (let i = 0; i < Math.max(s.length, m.length); i++) {
    if ((s[i] || 0) < (m[i] || 0)) return true;
    if ((s[i] || 0) > (m[i] || 0)) return false;
  }
  return false;
}

const app = express();

const CORS_ORIGINS = new Set([
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
  'ionic://localhost',
  'https://uber-truck-production.up.railway.app',
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (
    origin &&
    (CORS_ORIGINS.has(origin) ||
      /^https:\/\/[a-z0-9-]+\.up\.railway\.app$/i.test(origin))
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json({ limit: '3mb' }));

const publicDir = path.join(__dirname, '..', 'public');
app.get('/probar', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(publicDir, 'probar.html'));
});
app.get('/qa-lab', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(publicDir, 'qa-lab.html'));
});
if (process.env.NODE_ENV !== 'production') {
  app.use('/qa-report', express.static(path.join(__dirname, '..', 'playwright-report')));
}
app.get('/', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(publicDir, 'index.html'));
});
app.use(express.static(publicDir));
app.use('/docs', express.static(path.join(__dirname, '..', 'docs')));

const supabaseService = require('./services/supabase');
const googleMaps = require('./services/google-maps');
const fcmService = require('./services/fcm');
const { paymentConfig } = require('./lib/payment-config');
const repo = require('./lib/repository');

app.get('/health', async (_req, res) => {
  const supabaseReady = supabaseService.isConfigured();
  let supabaseOk = false;
  let supabaseError = null;
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || null;
  let ratingsTableOk = null;
  let ratingsTableError = null;
  let ratingsTagsOk = null;
  let ratingsTagsError = null;
  if (supabaseReady) {
    try {
      const sb = supabaseService.getClient();
      const { error } = await sb.from('load_requests').select('id').limit(1);
      supabaseOk = !error;
      if (error) supabaseError = error.message;
      const { error: rErr } = await sb.from('match_ratings').select('id').limit(1);
      ratingsTableOk = !rErr;
      if (rErr) ratingsTableError = rErr.message;
      const { error: tErr } = await sb.from('match_ratings').select('id, tags, tag_band').limit(1);
      ratingsTagsOk = !tErr;
      if (tErr) ratingsTagsError = tErr.message;
    } catch (e) {
      supabaseOk = false;
      supabaseError = e.message;
      ratingsTableOk = false;
      ratingsTableError = e.message;
      ratingsTagsOk = false;
      ratingsTagsError = e.message;
    }
  }
  const manifest = readDeployManifest();
  const railwaySha = process.env.RAILWAY_GIT_COMMIT_SHA || '';
  res.json({
    ok: true,
    service: 'uber-truck',
    version: pkg.version,
    build: railwaySha.slice(0, 7) || process.env.GIT_COMMIT || 'local',
    ui: 'match-cancel-v2',
    features: [
      'cancel-reasons-modal',
      'penalty-by-phase',
      'mutual-in-cancel-modal',
      'chat',
      'notifications',
      'cargo-trust-declaration',
      'match-incidents',
      'mis-viajes',
      'trip-ratings',
      'board-reputation',
      'kyc-curated-marketplace',
      'trip-events-realtime',
      'gps-tracking',
      'live-trip-map',
      'live-trip-eta-trail',
      'google-maps-navigation',
      'carrier-available',
      'password-reset',
      'buscando-camiones',
      'load-timing-eta',
      'proposal-compare-ranking',
      'penalty-block-overdue',
      'support-cases-moderator',
      'admin-ops-dashboard',
    ],
    deploy_manifest: manifest,
    railway: {
      git_commit_sha: railwaySha || null,
      git_branch: process.env.RAILWAY_GIT_BRANCH || null,
      replica: process.env.RAILWAY_REPLICA_ID || null,
    },
    hint: (() => {
      if (!manifest) return null;
      const shaShort = railwaySha.slice(0, 7);
      const manifestSha = manifest.git_sha?.slice(0, 7);
      if (shaShort && manifestSha && shaShort !== manifestSha) {
        return `Commit en Railway (${shaShort}) distinto al manifest (${manifestSha}). Redeploy o actualiza public/deploy.json.`;
      }
      if (manifest.version && serverBehindManifest(pkg.version, manifest.version)) {
        return 'Deploy desactualizado: el servidor va detrás del manifest. Haz Deploy del último commit en Railway.';
      }
      if (manifest.version && pkg.version !== manifest.version && !serverBehindManifest(pkg.version, manifest.version)) {
        return 'Manifest en repo desactualizado (el servidor ya es más nuevo). Actualiza public/deploy.json en el próximo commit.';
      }
      return null;
    })(),
    storage: repo.backend(),
    supabase: {
      project_ref: projectRef || 'ljinhegtywixtbzjgjfn',
      url_set: Boolean(supabaseUrl),
      configured: supabaseReady,
      connected: supabaseOk,
      match_ratings_table: ratingsTableOk,
      match_ratings_tags_column: ratingsTagsOk,
      ...(supabaseError && !supabaseOk ? { error: supabaseError } : {}),
      ...(ratingsTableError && ratingsTableOk === false
        ? { match_ratings_error: ratingsTableError }
        : {}),
      ...(ratingsTagsError && ratingsTagsOk === false
        ? { match_ratings_tags_error: ratingsTagsError }
        : {}),
      ...(ratingsTableOk && ratingsTagsOk === false
        ? {
            fix:
              'Ejecuta supabase/migrations/013_rating_tags.sql y Supabase → Settings → API → Reload schema.',
          }
        : {}),
    },
    maps: { configured: googleMaps.isConfigured(), interactive: googleMaps.interactiveMapsAvailable() },
    fcm: fcmService.statusPayload(),
    payment: paymentConfig(),
  });
});

app.get('/api', (_req, res) => {
  res.json({
    name: 'Uber Truck API',
    version: '0.0.1',
    endpoints: {
      auth: '/api/auth',
      load_requests: '/api/load-requests',
      capacity_offers: '/api/capacity-offers',
      matches: '/api/matches',
      match_suggestions: '/api/load-requests/:id/match-suggestions',
      demo_seed: 'POST /api/demo/seed',
    },
  });
});

app.use('/api/maps', require('./routes/maps'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/demo', require('./routes/demo'));
app.use('/api/load-requests', require('./routes/load-requests'));
app.use('/api/capacity-offers', require('./routes/capacity-offers'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/comms', require('./routes/match-comms'));
app.use('/api/account', require('./routes/account'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/post-mvp', require('./routes/post-mvp'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/carrier', require('./routes/carrier'));
app.use('/api/realtime', require('./routes/realtime'));
app.use('/api/support', require('./routes/support'));

module.exports = app;
