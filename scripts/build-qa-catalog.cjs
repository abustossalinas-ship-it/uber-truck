#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const AREA_RULES = [
  { id: 'welcome', label: 'Welcome / login', match: (s) => /welcome|login|auth-ui|prod-smoke/i.test(s) },
  { id: 'nav', label: 'Navegación app', match: (s) => /authed|inicio|emparejar|cuenta|actividad/i.test(s) },
  { id: 'board', label: 'Tablero / datos', match: (s) => /board|proximity|notification|demo|seed/i.test(s) },
  {
    id: 'compliance',
    label: 'Docs / WhatsApp / OCR',
    match: (s) =>
      /carrier-documents|carrier-onboarding|chile-document|whatsapp-bot|whatsapp-cloud/i.test(s),
  },
  { id: 'android', label: 'Android / APK', match: (s) => /android|bundle|apk/i.test(s) },
  { id: 'prod', label: 'Smoke producción', match: (s) => /prod-smoke|prod\b/i.test(s) },
  { id: 'landing', label: 'Landing / marca', match: (s) => /landing|design-system|logo-brand|prospectos/i.test(s) },
];

function readFile(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function readJson(rel) {
  try {
    return JSON.parse(readFile(rel));
  } catch {
    return null;
  }
}

function classifyArea(suite, file, group) {
  const hay = `${suite} ${file} ${group || ''}`;
  for (const rule of AREA_RULES) {
    if (rule.match(hay)) return rule;
  }
  return { id: 'other', label: 'Otros' };
}

function parseNodeTests(src, file) {
  const suite = path.basename(file, '.test.js');
  const cases = [];
  for (const m of src.matchAll(/(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/g)) {
    const area = classifyArea(suite, file, m[1]);
    cases.push({ name: m[1], optional: false, area: area.id, area_label: area.label });
  }
  return { file, suite, kind: 'unit', cases };
}

function parsePlaywrightTests(src, file) {
  const suite = path.basename(file, '.spec.js');
  let currentDescribe = suite;
  let describeSkipped = false;
  let skipNextTest = false;
  const cases = [];

  for (const line of src.split('\n')) {
    if (/test\.describe\.skip/.test(line)) {
      describeSkipped = true;
      continue;
    }
    if (/test\.skip\s*\(/.test(line) && !/test\.skip\s*\(\s*['"`]/.test(line)) {
      skipNextTest = true;
      continue;
    }
    const dm = line.match(/test\.describe\s*\(\s*['"`]([^'"`]+)['"`]/);
    if (dm) {
      currentDescribe = dm[1];
      describeSkipped = false;
      continue;
    }
    const tm = line.match(/test(?:\.skip)?\s*\(\s*['"`]([^'"`]+)['"`]/);
    if (tm) {
      const optional = describeSkipped || skipNextTest || /test\.skip/.test(line);
      skipNextTest = false;
      const area = classifyArea(suite, file, `${currentDescribe} ${tm[1]}`);
      cases.push({
        name: tm[1],
        group: currentDescribe,
        optional,
        area: area.id,
        area_label: area.label,
      });
    }
  }
  return { file, suite, kind: 'e2e', cases };
}

function listFiles(dir, ext) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith(ext))
    .sort()
    .map((f) => `${dir}/${f}`);
}

function tally(cases, key) {
  const map = new Map();
  for (const c of cases) {
    const k = c[key];
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function parseLastRun(raw) {
  if (!raw) return null;
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let flaky = 0;

  function walkSuites(suites) {
    for (const suite of suites || []) {
      walkSuites(suite.suites);
      for (const spec of suite.specs || []) {
        for (const test of spec.tests || []) {
          for (const result of test.results || []) {
            if (result.status === 'passed') passed += 1;
            else if (result.status === 'failed') failed += 1;
            else if (result.status === 'skipped') skipped += 1;
            else if (result.status === 'flaky') flaky += 1;
          }
        }
      }
    }
  }

  if (Array.isArray(raw.suites)) walkSuites(raw.suites);
  if (!passed && !failed && !skipped && raw.stats) {
    passed = raw.stats.expected || 0;
    failed = raw.stats.unexpected || 0;
    skipped = raw.stats.skipped || 0;
    flaky = raw.stats.flaky || 0;
  }
  const total = passed + failed + skipped + flaky;
  if (!total) return null;
  return { passed, failed, skipped, flaky, total };
}

const unitFiles = listFiles('tests', '.test.js');
const e2eFiles = listFiles('e2e', '.spec.js');

const unit = unitFiles.map((f) => parseNodeTests(readFile(f), f));
const e2e = e2eFiles.map((f) => parsePlaywrightTests(readFile(f), f));

const allCases = [
  ...unit.flatMap((s) => s.cases.map((c) => ({ ...c, kind: 'unit', suite: s.suite, file: s.file }))),
  ...e2e.flatMap((s) => s.cases.map((c) => ({ ...c, kind: 'e2e', suite: s.suite, file: s.file }))),
];

const pkg = JSON.parse(readFile('package.json'));
const qaScripts = Object.entries(pkg.scripts || {})
  .filter(([k]) => k.startsWith('test') || k.startsWith('qa'))
  .map(([name, cmd]) => ({ name, cmd }));

const reportPath = path.join(root, 'playwright-report', 'index.html');
const lastRunRaw = readJson('public/qa-last-run.json');
const lastRun = parseLastRun(lastRunRaw);

const areaLabels = Object.fromEntries(AREA_RULES.map((r) => [r.id, r.label]));
areaLabels.other = 'Otros';

const catalog = {
  generated_at: new Date().toISOString(),
  version: pkg.version,
  counts: {
    unit: unit.reduce((n, s) => n + s.cases.length, 0),
    e2e: e2e.reduce((n, s) => n + s.cases.length, 0),
    e2e_optional: allCases.filter((c) => c.kind === 'e2e' && c.optional).length,
    required: allCases.filter((c) => !c.optional).length,
    optional: allCases.filter((c) => c.optional).length,
    total: allCases.length,
  },
  charts: {
    by_kind: [
      { label: 'Unitarios (Node)', value: unit.reduce((n, s) => n + s.cases.length, 0) },
      { label: 'E2E (Playwright)', value: e2e.reduce((n, s) => n + s.cases.length, 0) },
    ],
    by_coverage: [
      { label: 'Obligatorios (CI)', value: allCases.filter((c) => !c.optional).length },
      { label: 'Opcionales (.env / Supabase)', value: allCases.filter((c) => c.optional).length },
    ],
    by_area: tally(allCases, 'area').map(({ label, value }) => ({
      label: areaLabels[label] || label,
      value,
    })),
    by_suite: [...unit, ...e2e].map((s) => ({
      label: s.suite,
      value: s.cases.length,
      kind: s.kind,
    })),
    last_run: lastRun
      ? [
          { label: 'Pasaron', value: lastRun.passed },
          { label: 'Fallaron', value: lastRun.failed },
          { label: 'Omitidos', value: lastRun.skipped },
          ...(lastRun.flaky ? [{ label: 'Inestables', value: lastRun.flaky }] : []),
        ].filter((x) => x.value > 0)
      : null,
  },
  stacks: {
    web_e2e: {
      name: 'Playwright',
      role: 'UI web + app móvil simulada (Pixel 5)',
      when: 'Welcome, login, tabs, emparejar, smoke Railway',
      cmd: 'npm run test:e2e',
    },
    unit: {
      name: 'Node test runner',
      role: 'Lógica pura, OCR documentos, compliance C3a, bot WhatsApp, auth, notificaciones, GPS',
      when: 'Regresiones rápidas sin abrir navegador',
      cmd: 'npm run test:unit',
    },
    android_native: {
      name: 'JUnit / Espresso / MockK',
      role: 'Código nativo Kotlin/Java del shell Android',
      when: 'Solo si agregas plugins o Activities propias (hoy Cubik es WebView Capacitor)',
      cmd: 'Android Studio → app/src/test (aún no configurado)',
      status: 'optional_future',
    },
  },
  scripts: qaScripts,
  unit,
  e2e,
  report_available: fs.existsSync(reportPath),
  last_run_at: lastRunRaw?.stats?.startTime || lastRunRaw?.config?.metadata?.actualWorkers ? lastRunRaw?.stats?.startTime : null,
};

const out = path.join(root, 'public', 'qa-catalog.json');
fs.writeFileSync(out, JSON.stringify(catalog, null, 2), 'utf8');
console.log(
  `QA catalog → ${path.relative(root, out)} (${catalog.counts.total} tests, ${catalog.counts.optional} opcionales)`
);
