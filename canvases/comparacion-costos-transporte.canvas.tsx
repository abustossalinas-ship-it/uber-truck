import {
  BarChart,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Grid,
  H1,
  H2,
  Stack,
  Stat,
  Table,
  Text,
  useHostTheme,
} from "cursor/canvas";

/** Coeficientes calibrados may 2026 — src/lib/match-price.js */
const RATES = { base: 80_000, km: 450, kg: 22 };
const RATES_OLD = { base: 120_000, km: 750, kg: 45 };

function cubikTrip(km: number, kg: number, rates = RATES, urgent = false) {
  let base = rates.base + km * rates.km + kg * rates.kg;
  if (urgent) base = Math.round(base * 1.18);
  const min = Math.floor((base * 0.82) / 1000) * 1000;
  const max = Math.ceil((base * 1.25) / 1000) * 1000;
  return { base, min, max, perKm: base / Math.max(km, 1), perKg: base / Math.max(kg, 1) };
}

function clp(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

const CUBIK_FORMULA = [
  ["Base fija", "$80.000", "BUDGET_BASE_CLP (antes $120.000)"],
  ["Distancia", "$450 / km", "BUDGET_RATE_KM_CLP (antes $750)"],
  ["Peso", "$22 / kg", "BUDGET_RATE_KG_CLP (antes $45)"],
  ["Urgente", "× 1,18", "BUDGET_URGENT_MULT"],
  ["Rango publicado", "82% – 125%", "min / max del flete sugerido"],
];

const CUBIK_FEES = [
  ["Embarcador", "10%", "Servicio Cubik sobre agreed_price_clp"],
  ["Transportista", "5%", "Comisión sobre agreed_price_clp"],
  ["Take rate Cubik", "15%", "GMV flete (piloto simulado v0.0.105)"],
  ["Precio real", "agreed_price_clp", "Negociado en match; la fórmula no bloquea"],
];

const SCENARIOS = [
  { label: "San Bernardo → Concón (~144 km, 8 t)", km: 144, kg: 8000 },
  { label: "Renca → La Serena (~463 km, 10 t)", km: 463, kg: 10000 },
  { label: "Calera de Tango → Peñalolén (~30 km, 2 t)", km: 30, kg: 2000 },
  { label: "Viaje app (ej. acordado $570.000, 463 km, 12 t)", km: 463, kg: 12000, agreed: 570_000 },
];

const scenarioRows = SCENARIOS.map((s) => {
  const c = cubikTrip(s.km, s.kg);
  const old = cubikTrip(s.km, s.kg, RATES_OLD);
  const flete = s.agreed ?? c.base;
  return {
    label: s.label,
    flete: clp(flete),
    nuevo: clp(c.base),
    anterior: clp(old.base),
    clpKg: clp((s.agreed ?? c.base) / s.kg),
    shipperPaga: clp(flete * 1.1),
    carrierNeto: clp(flete * 0.95),
  };
});

/** Informe PDF ene–abr 2026 — costo logístico por kilo de mercadería (no flete camión spot) */
const INFORME_RESUMEN = [
  ["Total recepción", "4.921.215 kg", "$98.635.831", "$20 / kg"],
  ["Solo kg con costo > 0 (sin «Recepción»)", "~3.475.000 kg", "$98.635.831", "~$28 / kg"],
  ["Salida a despensas (4 centros)", "1.000.072 kg", "$22.830.005", "~$23 / kg"],
  ["Agrícola (familia)", "2.534.742 kg", "$63.729.274", "$25 / kg"],
  ["Líquidos", "955.375 kg", "$16.490.842", "$17 / kg"],
  ["Lácteos", "592.868 kg", "$7.485.184", "$13 / kg"],
];

const INFORME_TRANSPORTISTAS = [
  ["Soc. Transportes Nazar", "929.914 kg", "$32.733.917", "$35 / kg"],
  ["Inversiones Racs", "876.888 kg", "$23.494.169", "$27 / kg"],
  ["Del Carmen Limitada", "742.203 kg", "$15.684.201", "$21 / kg"],
  ["Patricio Meneses", "391.969 kg", "$7.318.499", "$19 / kg"],
];

const GAP_ROWS = SCENARIOS.filter((s) => !s.agreed).map((s) => {
  const c = cubikTrip(s.km, s.kg);
  const informeRef = 25;
  const ratio = c.perKg / informeRef;
  return {
    caso: s.label.split(" (")[0],
    cubikKg: Math.round(c.perKg),
    informeKg: informeRef,
    ratio: `${ratio.toFixed(1)}×`,
  };
});

export default function ComparacionCostosTransporte() {
  const theme = useHostTheme();

  const barData = [
    { label: "Informe agrícola ($/kg)", value: 25 },
    { label: "Informe Nazar ($/kg)", value: 35 },
    { label: "Cubik SB–Concón ($/kg)", value: Math.round(cubikTrip(144, 8000).perKg) },
    { label: "Cubik Renca–Serena 12 t ($/kg)", value: Math.round(cubikTrip(463, 12000).perKg) },
    { label: "Viaje $570k / 12 t ($/kg)", value: Math.round(570_000 / 12000) },
  ];

  return (
    <Stack gap={theme.spacing.lg} style={{ padding: theme.spacing.lg, maxWidth: 980 }}>
      <H1>Cubik vs informe transporte (ene–abr 2026)</H1>
      <Text color={theme.colors.textMuted}>
        Fuente Cubik: src/lib/match-price.js + payment-simulation.js · Fuente informe: Informes.pdf (recepción +
        despensas)
      </Text>

      <Callout tone="warning">
        No es la misma unidad: el informe mide costo por kilo de mercadería movida en red propia/contratos
        masivos (incluye tramos a $0 «Recepción»). Cubik sugiere flete spot por viaje (km + peso) + comisión 10/5.
      </Callout>

      <Grid columns={3} gap={theme.spacing.md}>
        <Stat label="Informe blended" value="$20/kg" tone="neutral" />
        <Stat label="Cubik ~463 km / 12 t" value={`$${Math.round(cubikTrip(463, 12000).perKg)}/kg`} tone="neutral" />
        <Stat label="Brecha vs informe" value="~1,9–2,5×" tone="warning" />
      </Grid>

      <H2>1. Tabla de referencia Cubik (flete sugerido)</H2>
      <Card>
        <CardBody>
          <Table
            columns={[
              { key: "c", header: "Componente" },
              { key: "v", header: "Valor", width: 120 },
              { key: "n", header: "Notas" },
            ]}
            rows={CUBIK_FORMULA.map(([c, v, n]) => ({ c, v, n }))}
          />
          <Text color={theme.colors.textMuted} style={{ marginTop: theme.spacing.sm }}>
            Código: base = 120.000 + km×750 + kg×45 → rango min/max. No hay tabla SQL de tarifas; el precio final es
            agreed_price_clp en matches.
          </Text>
        </CardBody>
      </Card>

      <H2>2. Comisiones Cubik (sobre flete acordado)</H2>
      <Card>
        <CardBody>
          <Table
            columns={[
              { key: "r", header: "Rol" },
              { key: "p", header: "%", width: 80 },
              { key: "d", header: "Descripción" },
            ]}
            rows={CUBIK_FEES.map(([r, p, d]) => ({ r, p, d }))}
          />
        </CardBody>
      </Card>

      <H2>3. Escenarios Cubik (fórmula vs viaje real)</H2>
      <Card>
        <CardBody>
          <Table
            columns={[
              { key: "label", header: "Ruta / caso" },
              { key: "nuevo", header: "Sugerido nuevo", width: 110 },
              { key: "anterior", header: "Antes", width: 100 },
              { key: "flete", header: "Flete ref.", width: 100 },
              { key: "clpKg", header: "$/kg", width: 72 },
              { key: "shipperPaga", header: "Embarcador (+10%)", width: 110 },
              { key: "carrierNeto", header: "Transportista neto", width: 110 },
            ]}
            rows={scenarioRows}
          />
        </CardBody>
      </Card>

      <H2>4. Informe PDF — costo por kilo (ene–abr 2026)</H2>
      <Card>
        <CardHeader title="Totales y familias" />
        <CardBody>
          <Table
            columns={[
              { key: "0", header: "Concepto" },
              { key: "1", header: "Kg" },
              { key: "2", header: "Costo ($)" },
              { key: "3", header: "$/kg", width: 72 },
            ]}
            rows={INFORME_RESUMEN.map(([a, b, c, d]) => ({ "0": a, "1": b, "2": c, "3": d }))}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Principales transportistas en el informe" />
        <CardBody>
          <Table
            columns={[
              { key: "0", header: "Transporte" },
              { key: "1", header: "Kg" },
              { key: "2", header: "Costo ($)" },
              { key: "3", header: "$/kg", width: 72 },
            ]}
            rows={INFORME_TRANSPORTISTAS.map(([a, b, c, d]) => ({ "0": a, "1": b, "2": c, "3": d }))}
          />
        </CardBody>
      </Card>

      <H2>5. Comparación $/kg (referencia informe agrícola $25)</H2>
      <Card>
        <CardBody>
          <BarChart
            horizontal
            categories={barData.map((d) => d.label)}
            series={[{ name: "CLP/kg", data: barData.map((d) => d.value) }]}
            height={220}
          />
          <Text color={theme.colors.textMuted} style={{ marginTop: theme.spacing.sm }}>
            Eje Y: CLP por kilo · Informe ene–abr 2026 vs escenarios Cubik
          </Text>
          <Table
            columns={[
              { key: "caso", header: "Caso Cubik" },
              { key: "cubikKg", header: "$/kg Cubik", width: 90 },
              { key: "informeKg", header: "Ref. informe", width: 90 },
              { key: "ratio", header: "Factor", width: 64 },
            ]}
            rows={GAP_ROWS}
          />
        </CardBody>
      </Card>

      <Callout tone="info">
        Coeficientes calibrados may 2026: 80k + 450/km + 22/kg. Renca–Serena 463 km / 12 t ≈ $552k (cerca del
        $570k acordado). Sigue ~2× el $/kg del informe masivo (unidades distintas). Ajuste fino vía variables
        BUDGET_* en Railway.
      </Callout>
    </Stack>
  );
}
