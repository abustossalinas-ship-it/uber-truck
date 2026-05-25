const path = require('path');
const express = require('express');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const supabaseService = require('./services/supabase');
const googleMaps = require('./services/google-maps');
const repo = require('./lib/repository');

app.get('/health', async (_req, res) => {
  const supabaseReady = supabaseService.isConfigured();
  let supabaseOk = false;
  if (supabaseReady) {
    try {
      const sb = supabaseService.getClient();
      const { error } = await sb.from('load_requests').select('id').limit(1);
      supabaseOk = !error;
    } catch {
      supabaseOk = false;
    }
  }
  res.json({
    ok: true,
    service: 'uber-truck',
    storage: repo.backend(),
    supabase: {
      project_ref: 'ljinhegtywixtbzjgjfn',
      configured: supabaseReady,
      connected: supabaseOk,
    },
    maps: { configured: googleMaps.isConfigured() },
  });
});

app.get('/api', (_req, res) => {
  res.json({
    name: 'Uber Truck API',
    version: '0.0.1',
    endpoints: {
      load_requests: '/api/load-requests',
      capacity_offers: '/api/capacity-offers',
      matches: '/api/matches',
    },
  });
});

app.use('/api/maps', require('./routes/maps'));
app.use('/api/load-requests', require('./routes/load-requests'));
app.use('/api/capacity-offers', require('./routes/capacity-offers'));
app.use('/api/matches', require('./routes/matches'));

module.exports = app;
