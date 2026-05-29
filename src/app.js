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

const app = express();

app.use(express.json());

const publicDir = path.join(__dirname, '..', 'public');
app.get('/', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(publicDir, 'index.html'));
});
app.use(express.static(publicDir));
app.use('/docs', express.static(path.join(__dirname, '..', 'docs')));

const supabaseService = require('./services/supabase');
const googleMaps = require('./services/google-maps');
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
      'carrier-available',
      'password-reset',
      'buscando-camiones',
      'load-timing-eta',
    ],
    deploy_manifest: manifest,
    railway: {
      git_commit_sha: railwaySha || null,
      git_branch: process.env.RAILWAY_GIT_BRANCH || null,
      replica: process.env.RAILWAY_REPLICA_ID || null,
    },
    hint:
      manifest && railwaySha && manifest.version && pkg.version !== manifest.version
        ? 'Deploy desactualizado: version en servidor distinta al manifest. Haz Deploy del ultimo commit en Railway.'
        : null,
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
    maps: { configured: googleMaps.isConfigured() },
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
app.use('/api/admin', require('./routes/admin'));
app.use('/api/carrier', require('./routes/carrier'));
app.use('/api/realtime', require('./routes/realtime'));

module.exports = app;
