# Google Maps — Uber Truck

## Configuración

1. [Google Cloud Console](https://console.cloud.google.com/) → crear API key.
2. Habilitar APIs:
   - Places API
   - Distance Matrix API
   - Geocoding API (incluida con Places Details)
3. Restringir la key (recomendado): HTTP referrer `localhost:3001/*` y tu dominio Railway.
4. En `.env`:

```env
GOOGLE_MAPS_API_KEY=AIza...
```

5. Reiniciar `npm run dev` → `/health` debe mostrar `"maps": { "configured": true }`.

## Supabase

Ejecutar en SQL Editor (proyecto `ljinhegtywixtbzjgjfn`):

- `supabase/migrations/002_address_geo.sql`

Sin esta migración, Supabase ignora columnas nuevas o falla el insert (según versión).

## Uso en la app

| Función | Comportamiento |
|---------|----------------|
| Autocomplete | Escribe 3+ caracteres, elige dirección en Chile |
| Comuna / ciudad / región | Se rellenan al elegir (editables) |
| Distancia | Al tener origen y destino con coordenadas, calcula km y minutos |
| Cubicación | Presets en select (pallets, m³) |

## Endpoints API

- `GET /api/maps/status`
- `GET /api/maps/autocomplete?input=...`
- `GET /api/maps/place/:placeId`
- `POST /api/maps/distance` — body `{ origin: { lat, lng }, destination: { lat, lng } }`
- `GET /api/maps/cubicacion-presets`
