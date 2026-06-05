import {
  Card,
  CardBody,
  CardHeader,
  Grid,
  H1,
  H2,
  Link,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  UsageBar,
  useHostTheme,
} from "cursor/canvas";

const VERSION = "0.0.104";
const MEMORIA = "v4.0";
const FECHA = "5 jun 2026";
const PROD = "https://uber-truck-production.up.railway.app";
const REPO = "https://github.com/abustossalinas-ship-it/uber-truck";

const FASES = [
  { label: "Fase 2 — MVP digital núcleo", pct: 94 },
  { label: "Fase 2.10 — Multas y billetera", pct: 40 },
  { label: "Fase 2.11 — Cubik Saldo piloto 10/5", pct: 78 },
  { label: "Cubik Saldo prod (wallet + escrow)", pct: 8 },
  { label: "Push FCM (backend + token)", pct: 70 },
  { label: "Proyecto total (→ M5 mar 2027)", pct: 48 },
];

const HITOS = [
  { id: "M3", name: "MVP digital producción", plan: "25-oct-2026", estado: "Hecho (adelantado)", tone: "positive" as const },
  { id: "M1", name: "Descubrimiento + legal", plan: "28-jun-2026", estado: "En curso", tone: "neutral" as const },
  { id: "M2", name: "20 viajes piloto corredor", plan: "09-ago-2026", estado: "Pendiente — P0", tone: "neutral" as const },
  { id: "M4", name: "100 viajes digitales", plan: "31-ene-2027", estado: "Pendiente", tone: "neutral" as const },
];

const RELEASES = [
  { ver: "0.0.104", foco: "Notif pago al día + campana rápida", commit: "7f09d15" },
  { ver: "0.0.103", foco: "Badge embarcador pagó + notif visible", commit: "551c832" },
  { ver: "0.0.102", foco: "Botón Pagar + drawer Cubik Saldo", commit: "96947cf" },
  { ver: "0.0.101", foco: "Perf primera carga Mis viajes", commit: "5258886" },
  { ver: "0.0.100", foco: "Cubik Saldo piloto UI + comisiones", commit: "a52f23d" },
];

const FEATURES = [
  { name: "Emparejar + sugerencias", ok: true },
  { name: "Cancelación + multas sugeridas", ok: true },
  { name: "Chat ruta + anti-teléfono + Llamar", ok: true },
  { name: "Incidentes drawer + Maps/Waze", ok: true },
  { name: "Perfil Cuenta shell tipo Uber", ok: true },
  { name: "GPS + mapa vivo + ETA", ok: true },
  { name: "Mis viajes + calificación mutua", ok: true },
  { name: "Billetera multi-cuenta bancaria", ok: true },
  { name: "Cubik app Android (Capacitor)", ok: true },
  { name: "Cubik Saldo piloto — Pagar + badges 10/5", ok: true },
  { name: "Notificación transportista (pilot_payment)", ok: true },
  { name: "Twilio Proxy (llamadas)", ok: false },
  { name: "Wallet real + retención al En ruta", ok: false },
  { name: "Push FCM (recepción en teléfono)", ok: false },
];

const PAGOS = [
  { item: "Fee embarcador", valor: "10%", nota: "Piloto activo en Mis viajes / Cuenta" },
  { item: "Comisión transportista", valor: "5%", nota: "Neto en gestión tras pago embarcador" },
  { item: "Take rate efectivo", valor: "15%", nota: "Admin / GMV" },
  { item: "Pago piloto", valor: "Post-completed", nota: "POST /api/matches/:id/pilot-pay · SQL 026" },
  { item: "Publicar carga (prod)", valor: "20% saldo mín.", nota: "Pendiente wallet real" },
  { item: "Retención escrow (prod)", valor: "Al En ruta", nota: "Pendiente wallet real" },
  { item: "Tier sin cash", valor: "≥ $1M", nota: "Factura + saldo Cubik" },
];

export default function EstadoAvanceUberTruck() {
  const theme = useHostTheme();
  const segments = FASES.map((f, i) => ({
    label: f.label,
    value: f.pct,
    color: (["blue", "orange", "green", "gray", "purple", "blue"] as const)[i],
  }));

  return (
    <Stack gap={theme.spacing.lg} style={{ padding: theme.spacing.lg, maxWidth: 960 }}>
      <H1>Cubik — Estado de avance</H1>
      <Text color={theme.colors.textMuted}>
        Memoria técnica {MEMORIA} · Versión app {VERSION} · {FECHA}
      </Text>
      <Row gap={theme.spacing.md} wrap>
        <Link href={PROD}>Producción</Link>
        <Link href={`${PROD}/docs/`}>Docs hub</Link>
        <Link href={REPO}>GitHub</Link>
      </Row>

      <Grid columns={3} gap={theme.spacing.md}>
        <Stat label="Versión deploy" value={VERSION} />
        <Stat label="MVP digital (Fase 2)" value="~94%" tone="positive" />
        <Stat label="Cubik Saldo piloto" value="78%" tone="positive" />
      </Grid>

      <Card>
        <CardHeader title="Avance por bloque" />
        <CardBody>
          <UsageBar segments={segments} showLabels />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Releases recientes (jun 2026)" />
        <CardBody>
          <Table
            columns={[
              { key: "ver", header: "Versión", width: 72 },
              { key: "foco", header: "Foco" },
              { key: "commit", header: "Commit", width: 88 },
            ]}
            rows={RELEASES}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Modelo pagos — piloto operativo · prod pendiente" />
        <CardBody>
          <Table
            columns={[
              { key: "item", header: "Regla" },
              { key: "valor", header: "Valor", width: 140 },
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
                <Pill tone={f.ok ? "positive" : "neutral"} size="sm">
                  {f.ok ? "Hecho" : "Pendiente"}
                </Pill>
                <Text color={f.ok ? theme.colors.text : theme.colors.textMuted}>{f.name}</Text>
              </Row>
            ))}
          </Stack>
        </CardBody>
      </Card>

      <H2>Documentación</H2>
      <Text>
        Memoria {MEMORIA} · Journey v2.9 · SQL RUN_026 · Siguiente: wallet real + Twilio + piloto M2
      </Text>
      <Text color={theme.colors.textMuted}>
        Fuente: docs/Memoria-tecnica-Uber-Truck.html · commits 96947cf → 7f09d15
      </Text>
    </Stack>
  );
}
