const path = require('path');
const express = require('express');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
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
  if (supabaseReady) {
    try {
      const sb = supabaseService.getClient();
      const { error } = await sb.from('load_requests').select('id').limit(1);
      supabaseOk = !error;
      if (error) supabaseError = error.message;
    } catch (e) {
      supabaseOk = false;
      supabaseError = e.message;
    }
  }
  res.json({
    ok: true,
    service: 'uber-truck',
    storage: repo.backend(),
    supabase: {
      project_ref: projectRef || 'ljinhegtywixtbzjgjfn',
      url_set: Boolean(supabaseUrl),
      configured: supabaseReady,
      connected: supabaseOk,
      ...(supabaseError && !supabaseOk ? { error: supabaseError } : {}),
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

module.exports = app;
