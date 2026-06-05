import {
  Card,
  CardBody,
  CardHeader,
  Grid,
  H1,
  H2,
  Link,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  UsageBar,
  useHostTheme,
} from "cursor/canvas";

const VERSION = "0.0.98";
const PROD = "https://uber-truck-production.up.railway.app";
const REPO = "https://github.com/abustossalinas-ship-it/uber-truck";

const FASES = [
  { label: "Fase 2 — MVP digital núcleo", pct: 92 },
  { label: "Fase 2.10 — Multas y billetera", pct: 40 },
  { label: "Fase 2.11 — Cubik Saldo + fees 10/5", pct: 15 },
  { label: "Push FCM (backend + token)", pct: 70 },
  { label: "Proyecto total (→ M5 mar 2027)", pct: 44 },
];

const HITOS = [
  { id: "M3", name: "MVP digital producción", plan: "25-oct-2026", estado: "Hecho (adelantado)", tone: "positive" as const },
  { id: "M1", name: "Descubrimiento + legal", plan: "28-jun-2026", estado: "En curso", tone: "neutral" as const },
  { id: "M2", name: "20 viajes piloto corredor", plan: "09-ago-2026", estado: "Pendiente — P0", tone: "neutral" as const },
  { id: "M4", name: "100 viajes digitales", plan: "31-ene-2027", estado: "Pendiente", tone: "neutral" as const },
];

const FEATURES = [
  { name: "Emparejar + sugerencias", ok: true },
  { name: "Cancelación + multas sugeridas", ok: true },
  { name: "Chat ruta + anti-teléfono + Llamar", ok: true },
  { name: "Incidentes drawer + Maps/Waze", ok: true },
  { name: "Perfil Cuenta shell tipo Uber", ok: true },
  { name: "GPS + mapa vivo + ETA", ok: true },
  { name: "Mis viajes + calificación mutua ★", ok: true },
  { name: "Billetera multi-cuenta bancaria", ok: true },
  { name: "Cubik app Android (Capacitor)", ok: true },
  { name: "Twilio Proxy (llamadas)", ok: false },
  { name: "Cubik Saldo + retención en ruta", ok: false },
  { name: "Checkout tarifas 10% / 5% por rol", ok: false },
  { name: "Push FCM (recepción en teléfono)", ok: false },
];

const PAGOS = [
  { item: "Fee embarcador", valor: "10%", nota: "Solo visible al embarcador" },
  { item: "Comisión transportista", valor: "5%", nota: "Solo visible al transportista" },
  { item: "Take rate efectivo", valor: "15%", nota: "Admin / GMV" },
  { item: "Publicar carga", valor: "20% saldo mín.", nota: "Del budget_max_clp" },
  { item: "Retención escrow", valor: "Al En ruta", nota: "Flete × 1,10 embarcador" },
  { item: "Tier sin cash", valor: "≥ $1M", nota: "Factura + saldo Cubik" },
  { item: "Checkout simple", valor: "< $1M", nota: "Flujo corto + resumen tarifas" },
];

export default function EstadoAvanceUberTruck() {
  const theme = useHostTheme();
  const segments = FASES.map((f, i) => ({
    label: f.label,
    value: f.pct,
    color: (["blue", "orange", "green", "gray", "purple"] as const)[i],
  }));

  return (
    <Stack gap={theme.spacing.lg} style={{ padding: theme.spacing.lg, maxWidth: 960 }}>
      <H1>Cubik — Estado de avance</H1>
      <Text color={theme.colors.textMuted}>
        Memoria técnica v3.9 · Versión app {VERSION} · 25 may 2026
      </Text>
      <Row gap={theme.spacing.md} wrap>
        <Link href={PROD}>Producción</Link>
        <Link href={REPO}>GitHub</Link>
        <Text>docs/Memoria-tecnica-Uber-Truck.html</Text>
      </Row>

      <Grid columns={3} gap={theme.spacing.md}>
        <Stat label="Versión deploy" value={VERSION} />
        <Stat label="MVP digital (Fase 2)" value="~92%" tone="positive" />
        <Stat label="Cubik Saldo (diseño)" value="15%" />
      </Grid>

      <Card>
        <CardHeader title="Avance por bloque" />
        <CardBody>
          <UsageBar segments={segments} showLabels />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Modelo pagos — cerrado (implementación próxima semana)" />
        <CardBody>
          <Table
            columns={[
              { key: "item", header: "Regla" },
              { key: "valor", header: "Valor", width: 120 },
              { key: "nota", header: "Nota" },
            ]}
            rows={PAGOS}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Hitos Gantt" />
        <CardBody>
          <Table
            columns={[
              { key: "id", header: "ID", width: 48 },
              { key: "name", header: "Hito" },
              { key: "plan", header: "Plan" },
              { key: "estado", header: "Estado real" },
            ]}
            rows={HITOS.map((h) => ({
              id: h.id,
              name: h.name,
              plan: h.plan,
              estado: h.estado,
              tone: h.tone,
            }))}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Funcionalidades MVP" />
        <CardBody>
          <Stack gap={theme.spacing.sm}>
            {FEATURES.map((f) => (
              <Row key={f.name} gap={theme.spacing.sm} style={{ alignItems: "center" }}>
                <Text weight="medium">{f.ok ? "✓" : "○"}</Text>
                <Text color={f.ok ? theme.colors.text : theme.colors.textMuted}>{f.name}</Text>
              </Row>
            ))}
          </Stack>
        </CardBody>
      </Card>

      <H2>Documentación</H2>
      <Text>
        Memoria v3.9 · Journey v2.8 · Canvas-Resumen HTML · Próxima semana: wallet + Twilio + checkout
      </Text>
    </Stack>
  );
}
