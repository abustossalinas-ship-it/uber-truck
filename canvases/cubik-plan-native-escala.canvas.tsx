import {
  BarChart,
  Callout,
  Card,
  CardBody,
  CardHeader,
  CollapsibleSection,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  TodoList,
  TodoListCard,
  useHostTheme,
} from "cursor/canvas";

/** Plan piloto → escala · Cubik · jun 2026 · presentación comercial jueves */

type CheckRow = {
  criterio: string;
  hibrido: string;
  nativoLite: string;
  escala: string;
  umbral: string;
};

const CHECKLIST: CheckRow[] = [
  {
    criterio: "GPS en background (app cerrada / pantalla apagada)",
    hibrido: "Frágil — app en primer plano",
    nativoLite: "Plugin Capacitor + servicio Android",
    escala: "Módulo nativo Kotlin + iOS",
    umbral: "Obligatorio desde piloto serio",
  },
  {
    criterio: "Push confiable (oferta, entrega, chat)",
    hibrido: "FCM vía Capacitor — OK piloto",
    nativoLite: "FCM + canales Android",
    escala: "Push + acciones en notificación",
    umbral: "OK híbrido hasta 50 transportistas",
  },
  {
    criterio: "Demo comercial en producción",
    hibrido: "Web ?app=1 + APK remoto Railway",
    nativoLite: "APK bundle firmado + distribución interna",
    escala: "Play Store / TestFlight + MDM opcional",
    umbral: "Jueves: híbrido suficiente",
  },
  {
    criterio: "Usuarios concurrentes en mapa en vivo",
    hibrido: "≤15 camiones simultáneos",
    nativoLite: "25–50 camiones",
    escala: "200+ — SSE + Maps optimizado",
    umbral: "Revisar arquitectura en 50 camiones",
  },
  {
    criterio: "Offline / mala señal en ruta",
    hibrido: "Limitado (solo cache web)",
    nativoLite: "Cola GPS local + sync",
    escala: "Offline-first en tracking",
    umbral: "Nativo lite en piloto RM",
  },
  {
    criterio: "Tiempo de deploy UI (cambios frecuentes)",
    hibrido: "Horas (Railway / APK remoto)",
    nativoLite: "Días (bundle + store interno)",
    escala: "Remoto para hotfix + bundle mensual",
    umbral: "Mantener remoto en piloto",
  },
  {
    criterio: "KYC, multas, pagos piloto",
    hibrido: "Ya en Supabase + web",
    nativoLite: "Misma API — sin rewrite",
    escala: "Pasarela real + conciliación",
    umbral: "Backend primero, no nativo",
  },
  {
    criterio: "QA automatizado",
    hibrido: "Playwright + unit (actual)",
    nativoLite: "+ verify bundle Android",
    escala: "+ JUnit módulo GPS + load tests",
    umbral: "Laboratorio QA listo",
  },
  {
    criterio: "Costo dev mensual (equipo)",
    hibrido: "1 dev full-stack",
    nativoLite: "+0,5 mobile (Capacitor profundo)",
    escala: "+1 mobile nativo o agencia",
    umbral: "Decidir en semana 8 piloto",
  },
  {
    criterio: "Percepción cliente «app pro»",
    hibrido: "Buena en demo controlada",
    nativoLite: "Icono, splash, APK dedicado",
    escala: "Store listing + SLA soporte",
    umbral: "APK bundle antes de piloto pagado",
  },
];

/** Gantt simplificado — semanas desde 9 jun 2026 */
const GANTT_WEEKS = [
  "S1\n9–13 jun",
  "S2",
  "S3",
  "S4",
  "S5",
  "S6",
  "S7",
  "S8",
  "S9",
  "S10",
  "S11",
  "S12",
  "S13",
  "S14",
  "S15",
  "S16",
];

/** Duración en semanas por fase (índice inicio 0-based en categorías) */
const PHASES = [
  { name: "Prep demo jueves", start: 0, weeks: 1, tone: "info" as const },
  { name: "Piloto 25/50 — onboarding", start: 1, weeks: 4, tone: "warning" as const },
  { name: "Onboarding rubros + docs (C3a–c)", start: 1, weeks: 4, tone: "warning" as const },
  { name: "Piloto operación + KPIs M2", start: 5, weeks: 8, tone: "success" as const },
  { name: "Nativo lite (GPS background)", start: 3, weeks: 6, tone: "danger" as const },
  { name: "Rubros + matching producto (O3)", start: 5, weeks: 5, tone: "neutral" as const },
  { name: "Prep escala 50+/200", start: 10, weeks: 6, tone: "neutral" as const },
];

/** Construye serie apilada por semana para Gantt */
function ganttSeries() {
  const demo = GANTT_WEEKS.map((_, i) => (i === 0 ? 1 : 0));
  const pilotoOn = GANTT_WEEKS.map((_, i) => (i >= 1 && i <= 4 ? 1 : 0));
  const rubrosDocs = GANTT_WEEKS.map((_, i) => (i >= 1 && i <= 4 ? 1 : 0));
  const pilotoOp = GANTT_WEEKS.map((_, i) => (i >= 5 && i <= 12 ? 1 : 0));
  const nativo = GANTT_WEEKS.map((_, i) => (i >= 3 && i <= 8 ? 1 : 0));
  const rubrosProducto = GANTT_WEEKS.map((_, i) => (i >= 5 && i <= 9 ? 1 : 0));
  const escala = GANTT_WEEKS.map((_, i) => (i >= 10 ? 1 : 0));
  return [
    { name: "Demo jueves", data: demo, tone: "info" as const },
    { name: "Onboarding piloto", data: pilotoOn, tone: "warning" as const },
    { name: "Rubros + docs (manual)", data: rubrosDocs, tone: "warning" as const },
    { name: "Operación piloto", data: pilotoOp, tone: "success" as const },
    { name: "Nativo lite (paralelo)", data: nativo, tone: "danger" as const },
    { name: "Matching rubros (O3)", data: rubrosProducto, tone: "neutral" as const },
    { name: "Prep escala", data: escala, tone: "neutral" as const },
  ];
}

const COST_ROWS = [
  {
    rubro: "Railway (API + web)",
    piloto: "USD 20–40 / mes",
    escala: "USD 80–250 / mes",
    nota: "Escala con CPU/RAM y replicas",
  },
  {
    rubro: "Supabase (DB + auth)",
    piloto: "USD 0–25 / mes",
    escala: "USD 75–599 / mes",
    nota: "Pro → Team según filas y realtime",
  },
  {
    rubro: "Google Maps (JS + Directions + Distance)",
    piloto: "USD 50–150 / mes",
    escala: "USD 400–1.200 / mes",
    nota: "200 camiones × polling GPS ≈ principal variable",
  },
  {
    rubro: "Firebase FCM (push)",
    piloto: "USD 0",
    escala: "USD 0–50 / mes",
    nota: "Free tier suele alcanzar piloto",
  },
  {
    rubro: "Dominio + certificados + firma APK",
    piloto: "USD 30–100 one-time",
    escala: "USD 100–300 / año",
    nota: "Play Console USD 25 one-time",
  },
  {
    rubro: "Soporte / moderación piloto",
    piloto: "USD 200–500 / mes",
    escala: "USD 800–2.000 / mes",
    nota: "Part-time → dedicado",
  },
  {
    rubro: "Desarrollo (opcional externo)",
    piloto: "USD 0 si interno",
    escala: "USD 3.000–8.000 / mes",
    nota: "1 mobile nativo part-time en escala",
  },
];

const COST_CHART_PILOTO = 320;
const COST_CHART_ESCALA = 2100;

const DECISION_RULES = [
  "Jueves: mostrar web prod + APK remoto. No prometer app 100 % nativa aún.",
  "Cerrar piloto 25 embarcadores + 50 transportistas con híbrido + APK bundle firmado.",
  "Onboarding por rubro: 10 camiones/rubro (construcción + retail) — ver ONBOARDING-PILOTO-RUBROS.md.",
  "Plan B Cornershop: 1–2 empresas ancla por rubro si liquidez orgánica baja; retirar al ≥5 ofertas/semana por rubro.",
  "Disparador nativo: >30 % quejas GPS o >40 camiones simultáneos en mapa.",
  "Escala 200 camiones: presupuestar Maps + Railway antes de marketing masivo.",
  "No reescribir UI entera: módulo nativo solo tracking + push + background.",
];

const TAREAS_JUEVES = [
  { id: "t1", label: "Verificar prod: login welcome + Emparejar (web ?app=1)", status: "pending" as const },
  { id: "t2", label: "APK remoto instalado en 1 celular demo (android:install:remote)", status: "pending" as const },
  { id: "t3", label: "Cuenta demo embarcador + transportista con 1 viaje ejemplo", status: "pending" as const },
  { id: "t4", label: "Laboratorio QA abierto (npm run qa:lab) — mostrar gráficos si preguntan QA", status: "pending" as const },
  { id: "t5", label: "Pitch: híbrido hoy → nativo lite en 6 sem → escala con costos claros", status: "pending" as const },
  { id: "t6", label: "One-pager: 25 empresas / 50 camiones / timeline 16 semanas", status: "pending" as const },
];

const TAREAS_PILOTO = [
  { id: "p1", label: "Checklist CI + licencia + seguro A/B/C + rubro (WhatsApp + admin)", status: "pending" as const },
  { id: "p2", label: "10 camiones/rubro: construcción + retail/alimentos en RM–V", status: "pending" as const },
  { id: "p3", label: "1–2 empresas ancla plan B por rubro (Cornershop)", status: "pending" as const },
  { id: "p4", label: "Discurso captación transportista (viaje de vuelta, no reemplazar clientes)", status: "pending" as const },
  { id: "p5", label: "Discurso captación embarcador (costo marginal, camiones verificados)", status: "pending" as const },
  { id: "p6", label: "APK bundle v0.0.x firmado + link descarga testers", status: "pending" as const },
  { id: "p7", label: "Plugin GPS background (Capacitor) — spike 1 semana", status: "pending" as const },
  { id: "p8", label: "Monitoreo: Railway logs + checklist 20 viajes M2 corredor RM", status: "pending" as const },
  { id: "p9", label: "Acuerdo SLA soporte (WhatsApp agente Cubik piloto)", status: "pending" as const },
];

const TAREAS_ESCALA = [
  { id: "e1", label: "Auditoría costo Maps con 200 camiones simulados", status: "pending" as const },
  { id: "e2", label: "Supabase: índices matches + RLS review + backup policy", status: "pending" as const },
  { id: "e3", label: "Decisión go/no-go rewrite nativo (semana 12)", status: "pending" as const },
  { id: "e4", label: "Play Store closed testing o MDM para flota", status: "pending" as const },
  { id: "e5", label: "Contratar o asignar 0,5–1 FTE mobile si GPS nativo confirmado", status: "pending" as const },
];

export default function CubikPlanNativeEscala() {
  const theme = useHostTheme();

  return (
    <Stack gap={24} style={{ maxWidth: 960, margin: "0 auto", padding: "8px 4px 40px" }}>
      <Stack gap={8}>
        <H1>Plan Cubik — demo, piloto y escala</H1>
        <Text tone="secondary">
          Checklist nativo vs híbrido · Gantt 16 semanas · costos piloto (25 empresas / 50
          transportistas) vs escala (50+ / 200 camiones)
        </Text>
        <Row gap={8} wrap>
          <Pill tone="info">Presentación: jueves</Pill>
          <Pill tone="warning">Piloto: 25 + 50</Pill>
          <Pill tone="warning">10 camiones/rubro</Pill>
          <Pill tone="success">Escala: 50+ / 200</Pill>
        </Row>
      </Stack>

      <Grid columns={4} gap={12}>
        <Stat value="Jueves" label="Demo híbrida prod" tone="info" />
        <Stat value="16 sem" label="Horizonte plan" tone="neutral" />
        <Stat value="~USD 320" label="Infra piloto / mes" tone="warning" />
        <Stat value="~USD 2.100" label="Infra escala / mes" tone="danger" />
      </Grid>

      <Callout tone="info" title="Mensaje clave para el jueves">
        Hoy Cubik es producto real en producción (web + APK). Para 25 empresas y 50
        transportistas basta el stack híbrido actual más APK dedicado y GPS mejorado. La app
        100 % nativa se justifica al escalar a 200 camiones o si el piloto exige tracking con
        app cerrada.
      </Callout>

      <Card>
        <CardHeader title="Checklist — ¿cuándo conviene nativo?" />
        <CardBody padding={0}>
          <Table
            columns={[
              { key: "criterio", label: "Criterio", width: "22%" },
              { key: "hibrido", label: "Híbrido (ahora)" },
              { key: "nativoLite", label: "Nativo lite (piloto)" },
              { key: "escala", label: "Escala 200" },
              { key: "umbral", label: "Umbral decisión", width: "18%" },
            ]}
            rows={CHECKLIST}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Gantt — 16 semanas desde 9 jun 2026" />
        <CardBody>
          <Text size="small" tone="tertiary" style={{ marginBottom: 12 }}>
            Eje X: semanas · Barras apiladas = fases en paralelo · Fuente: plan interno Cubik
          </Text>
          <BarChart
            categories={GANTT_WEEKS}
            series={ganttSeries()}
            stacked
            height={220}
          />
          <Divider />
          <Stack gap={6}>
            {PHASES.map((p) => (
              <Row key={p.name} gap={8} align="center">
                <Pill tone={p.tone}>{p.name}</Pill>
                <Text size="small" tone="secondary">
                  Semana {p.start + 1} → {p.start + p.weeks} ({p.weeks} sem)
                </Text>
              </Row>
            ))}
          </Stack>
        </CardBody>
      </Card>

      <Grid columns={2} gap={16}>
        <Card>
          <CardHeader title="Costo infra mensual estimado" />
          <CardBody>
            <BarChart
              categories={["Piloto\n25+50", "Escala\n50+/200"]}
              series={[
                {
                  name: "USD / mes (infra + soporte ligero)",
                  data: [COST_CHART_PILOTO, COST_CHART_ESCALA],
                  tone: "warning",
                },
              ]}
              height={180}
            />
            <Text size="small" tone="tertiary" style={{ marginTop: 8 }}>
              Piloto ≈ USD 320/mes · Escala ≈ USD 2.100/mes (Maps domina). Sin sueldo dev.
            </Text>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Reglas de decisión" />
          <CardBody>
            <Stack gap={10}>
              {DECISION_RULES.map((r, i) => (
                <Text key={i} size="small">
                  {i + 1}. {r}
                </Text>
              ))}
            </Stack>
          </CardBody>
        </Card>
      </Grid>

      <CollapsibleSection title="Detalle costos por rubro" defaultOpen={false}>
        <Table
          columns={[
            { key: "rubro", label: "Rubro", width: "28%" },
            { key: "piloto", label: "Piloto 25/50" },
            { key: "escala", label: "Escala 50+/200" },
            { key: "nota", label: "Nota" },
          ]}
          rows={COST_ROWS}
        />
      </CollapsibleSection>

      <Divider />

      <H2>Tareas</H2>

      <TodoListCard title="Antes del jueves (demo comercial)" items={TAREAS_JUEVES} />
      <TodoListCard title="Piloto — 25 empresas + 50 transportistas (sem 2–12)" items={TAREAS_PILOTO} />
      <TodoListCard title="Pre-escala — 50+ empresas + 200 camiones (sem 10+)" items={TAREAS_ESCALA} />

      <Callout tone="warning" title="Qué mostrar como «versión nativa» el jueves">
        Instala en el teléfono el APK (modo remoto = siempre última prod). Explica: «Es nuestra
        app Android; la UI se actualiza desde la nube como Uber Eats early days». Para contratos
        piloto entrega APK bundle firmado con marca Cubik en semana 2–3.
      </Callout>

      <Text size="small" tone="tertiary" style={{ textAlign: "center" }}>
        Cubik · plan comercial jun 2026 · infra en USD · desarrollo interno asumido en piloto
      </Text>
    </Stack>
  );
}
