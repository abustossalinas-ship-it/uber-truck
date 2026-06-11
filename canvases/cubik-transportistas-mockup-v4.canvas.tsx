import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Stack,
  Stat,
  Text,
  useHostTheme,
} from 'cursor/canvas';

const palette = {
  ink: '#0F172A',
  petrol: '#164E63',
  teal: '#06B6D4',
  surface: '#F8FAFC',
  success: '#10B981',
  muted: '#94A3B8',
};

function MiniMap() {
  return (
    <svg viewBox="0 0 200 120" width="100%" height="88" aria-hidden>
      <rect width="200" height="120" fill={palette.ink} />
      <path
        d="M 72 95 C 78 78, 86 62, 94 48 C 102 34, 108 24, 118 14"
        stroke={palette.teal}
        strokeWidth="2.5"
        fill="none"
        strokeDasharray="4 3"
      />
      <circle cx="72" cy="95" r="3" fill={palette.teal} />
      <circle cx="118" cy="14" r="3" fill={palette.success} />
      <g transform="translate(88 52)">
        <rect x="0" y="0" width="14" height="7" rx="1" fill={palette.teal} />
        <circle cx="3" cy="9" r="2" fill={palette.ink} stroke={palette.teal} />
        <circle cx="11" cy="9" r="2" fill={palette.ink} stroke={palette.teal} />
      </g>
    </svg>
  );
}

export default function CubikTransportistasMockupV4() {
  const theme = useHostTheme();

  return (
    <Stack gap={20}>
      <Stack gap={6}>
        <Pill tone="accent">Opción elegida · Mockup v4</Pill>
        <H1>Landing transportistas — fiel al mockup</H1>
        <Text color={theme.textSecondary}>
          Petróleo + turquesa · logo CUBIK · iconos línea · mapa Chile con camión animado · hero con foto nocturna.
        </Text>
      </Stack>

      <Grid columns={2} gap={12}>
        <Card>
          <CardHeader title="Paleta" />
          <CardBody>
            <Row gap={8} wrap>
              {Object.entries(palette).map(([name, hex]) => (
                <Stack key={name} gap={4} style={{ minWidth: 72 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: hex, border: `1px solid ${theme.border}` }} />
                  <Text size="sm" weight="semibold">{name}</Text>
                  <Text size="sm" color={theme.textSecondary}>{hex}</Text>
                </Stack>
              ))}
            </Row>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Implementado en código" />
          <CardBody>
            <Stack gap={6}>
              <Text>• /brand/logo-cubik-wordmark.svg + logo 3D PNG</Text>
              <Text>• /brand/landing/map-chile-control.svg (camión animateMotion)</Text>
              <Text>• /brand/landing/icons-sprite.svg (Lucide-style)</Text>
              <Text>• /brand/landing/hero-truck-night.jpg</Text>
              <Text>• landing-v3.css + transportistas.html v0.0.133</Text>
            </Stack>
          </CardBody>
        </Card>
      </Grid>

      <Card variant="filled">
        <CardHeader title="Vista hero (wireframe)" trailing={<Pill tone="accent">Transportistas</Pill>} />
        <CardBody>
          <div style={{ background: palette.ink, borderRadius: 12, padding: 16, border: `1px solid ${theme.border}` }}>
            <Row gap={16} align="start" wrap>
              <Stack gap={8} style={{ flex: 1, minWidth: 220 }}>
                <Text size="sm" style={{ color: palette.teal, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Plataforma para transportistas
                </Text>
                <H3 style={{ color: '#fff', margin: 0 }}>
                  Encuentra cargas todos los días y aumenta la rentabilidad de tu camión
                </H3>
                <Row gap={8} wrap>
                  <Button variant="primary">Encontrar cargas →</Button>
                  <Button variant="secondary">Ver cómo funciona</Button>
                </Row>
              </Stack>
              <div style={{ flex: 1, minWidth: 240, background: 'rgba(10,18,32,0.85)', borderRadius: 12, padding: 12, border: `1px solid ${palette.teal}44` }}>
                <Text size="sm" weight="semibold" style={{ color: '#fff' }}>Resumen de tu operación</Text>
                <Grid columns={2} gap={6} style={{ marginTop: 8 }}>
                  <Stat label="Viajes" value="12" tone="accent" />
                  <Stat label="Cargas" value="8" tone="accent" />
                  <Stat label="Ingresos" value="$12.4M" tone="accent" />
                  <Stat label="Rating" value="4.8★" tone="accent" />
                </Grid>
                <div style={{ marginTop: 8 }}><MiniMap /></div>
              </div>
            </Row>
          </div>
        </CardBody>
      </Card>

      <Grid columns={4} gap={10}>
        <Stat label="Transportistas" value="+500" tone="default" />
        <Stat label="Viajes/mes" value="+5.000" tone="default" />
        <Stat label="Trazabilidad" value="98%" tone="positive" />
        <Stat label="Soporte" value="24/7" tone="default" />
      </Grid>

      <Card>
        <CardHeader title="Control tower — mapa con movimiento" />
        <CardBody>
          <Row gap={16} wrap>
            <Stack gap={6} style={{ flex: 1, minWidth: 200 }}>
              <H3>Operación inteligente en tiempo real</H3>
              <Text color={theme.textSecondary}>Camión SVG recorre ruta Concepción → Santiago con ruta turquesa pulsante.</Text>
            </Stack>
            <div style={{ flex: 1.2, minWidth: 260, position: 'relative', borderRadius: 12, overflow: 'hidden', border: `1px solid ${palette.teal}33` }}>
              <MiniMap />
              <div style={{ position: 'absolute', right: 12, bottom: 12, background: palette.ink, border: `1px solid ${palette.teal}44`, borderRadius: 10, padding: 10, maxWidth: 160 }}>
                <Text size="sm" weight="semibold" style={{ color: '#fff' }}>Viaje en curso</Text>
                <Text size="sm" color={theme.textSecondary}>Concepción → Santiago</Text>
                <Pill tone="positive" size="sm">En tránsito</Pill>
                <Text size="sm" style={{ color: palette.teal, marginTop: 6 }}>78 km/h · ETA 14:30</Text>
              </div>
            </div>
          </Row>
        </CardBody>
      </Card>
    </Stack>
  );
}
