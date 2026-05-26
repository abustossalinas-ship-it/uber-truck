'use strict';

const repo = require('./repository');

const DEMO_LOADS = [
  {
    company_name: 'Carozzi (demo)',
    origin_city: 'San Bernardo',
    origin_commune: 'San Bernardo',
    origin_region: 'RM',
    destination_city: 'Valparaíso',
    destination_commune: 'Valparaíso',
    destination_region: 'V',
    volume_m3: 4,
    pallets: 2,
    cargo_type: 'Alimentos no perecibles',
    urgency: 'urgent',
    status: 'published',
    notes: 'Pedido extra del mes — demo',
    distance_km: 118,
    distance_duration_min: 95,
  },
  {
    company_name: 'Distribuidora Norte (demo)',
    origin_city: 'Santiago',
    origin_commune: 'Santiago',
    origin_region: 'RM',
    destination_city: 'San Bernardo',
    destination_commune: 'San Bernardo',
    destination_region: 'RM',
    volume_m3: 2.4,
    pallets: 2,
    cargo_type: 'Retail',
    urgency: 'normal',
    status: 'published',
    notes: 'Retiro urgente en planta — demo',
    distance_km: 28,
    distance_duration_min: 45,
  },
];

const DEMO_OFFERS = [
  {
    carrier_name: 'Transportes Ruta Sur (demo)',
    origin_city: 'Santiago',
    origin_commune: 'Santiago',
    origin_region: 'RM',
    destination_city: 'Valparaíso',
    destination_commune: 'Valparaíso',
    destination_region: 'V',
    free_volume_m3: 10,
    max_weight_kg: 5000,
    cargo_types: 'Alimentos, retail',
    status: 'published',
    notes: 'Retorno con cubicación libre — demo',
    distance_km: 118,
    distance_duration_min: 95,
  },
  {
    carrier_name: 'Flota Central (demo)',
    origin_city: 'San Bernardo',
    origin_commune: 'San Bernardo',
    origin_region: 'RM',
    destination_city: 'Santiago',
    destination_commune: 'Santiago',
    destination_region: 'RM',
    free_volume_m3: 6,
    max_weight_kg: 3500,
    cargo_types: 'Carga general',
    status: 'published',
    notes: 'Espacio en ruta matinal — demo',
    distance_km: 28,
    distance_duration_min: 40,
  },
];

async function seedDemo() {
  const loads = [];
  const offers = [];
  for (const row of DEMO_LOADS) {
    loads.push(await repo.insert('load_requests', row));
  }
  for (const row of DEMO_OFFERS) {
    offers.push(await repo.insert('capacity_offers', row));
  }
  return { loads, offers };
}

module.exports = { seedDemo, DEMO_LOADS, DEMO_OFFERS };
