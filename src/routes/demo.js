'use strict';

const express = require('express');
const { seedDemo } = require('../lib/demo-seed');

const router = express.Router();

router.post('/seed', async (req, res) => {
  const key = process.env.DEMO_SEED_KEY;
  const provided = req.headers['x-demo-seed-key'] || req.query.key;
  if (key && provided !== key) {
    return res.status(403).json({ ok: false, error: 'Clave demo inválida' });
  }
  if (!key && process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      ok: false,
      error: 'Define DEMO_SEED_KEY en Railway para cargar datos demo en producción',
    });
  }
  try {
    const data = await seedDemo();
    res.json({
      ok: true,
      message: 'Datos demo creados',
      loads: data.loads.length,
      offers: data.offers.length,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message || 'Error al sembrar demo' });
  }
});

module.exports = router;
