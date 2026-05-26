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

const VERSION = "0.0.19";
const PROD = "https://uber-truck-production.up.railway.app";
const REPO = "https://github.com/abustossalinas-ship-it/uber-truck";

const FASES = [
  { label: "Fase 2 — MVP digital núcleo", pct: 75 },
  { label: "Fase 2.10 — Multas y cobros", pct: 25 },
  { label: "Fase 3 — Confianza / piloto", pct: 0 },
  { label: "Proyecto total (→ M5 mar 2027)", pct: 35 },
];

const HITOS = [
  { id: "M3", name: "MVP digital producción", plan: "25-oct-2026", estado: "Hecho (adelantado)", tone: "positive" as const },
  { id: "M1", name: "Descubrimiento + legal", plan: "28-jun-2026", estado: "En curso", tone: "neutral" as const },
  { id: "M2", name: "20 matches concierge", plan: "09-ago-2026", estado: "Pendiente", tone: "neutral" as const },
  { id: "M4", name: "100 viajes digitales", plan: "31-ene-2027", estado: "Pendiente", tone: "neutral" as const },
];

const FEATURES = [
  { name: "Emparejar + sugerencias", ok: true },
  { name: "Cancelación + multas sugeridas", ok: true },
  { name: "Acuerdo mutuo + notificaciones", ok: true },
  { name: "Chat", ok: true },
  { name: "Cuenta y multas (recuadro)", ok: true },
  { name: "Cobro automático / pasarela", ok: false },
  { name: "Mis cargas por usuario", ok: false },
];

export default function EstadoAvanceUberTruck() {
  const theme = useHostTheme();
  const segments = FASES.map((f, i) => ({
    label: f.label,
    value: f.pct,
    color: (["blue", "orange", "gray", "purple"] as const)[i],
  }));

  return (
    <Stack gap={theme.spacing.lg} style={{ padding: theme.spacing.lg, maxWidth: 960 }}>
      <H1>Uber Truck — Estado de avance</H1>
      <Text color={theme.colors.textMuted}>
        Memoria técnica §12 · Versión app {VERSION} · Mayo 2026
      </Text>
      <Row gap={theme.spacing.md} wrap>
        <Link href={PROD}>Producción</Link>
        <Link href={REPO}>GitHub</Link>
        <Text>docs/01-MEMORIA-TECNICA.md</Text>
      </Row>

      <Grid columns={3} gap={theme.spacing.md}>
        <Stat label="Versión deploy" value={VERSION} />
        <Stat label="MVP digital (Fase 2)" value="~75%" tone="positive" />
        <Stat label="Proyecto total → M5" value="~35%" />
      </Grid>

      <Card>
        <CardHeader title="Avance por bloque" />
        <CardBody>
          <UsageBar segments={segments} showLabels />
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
        Índice: docs/00-INDICE-DOCUMENTACION.md · SQL: docs/SQL-SUPABASE.md · Gantt HTML:
        docs/Gantt-Uber-Truck.html
      </Text>
    </Stack>
  );
}
