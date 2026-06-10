#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function readFile(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function parseNodeTests(src, file) {
  const suite = path.basename(file, '.test.js');
  const cases = [];
  for (const m of src.matchAll(/test\s*\(\s*['"`]([^'"`]+)['"`]/g)) {
    cases.push({ name: m[1], optional: false });
  }
  return { file, suite, kind: 'unit', cases };
}

function parsePlaywrightTests(src, file) {
  const suite = path.basename(file, '.spec.js');
  const describes = [];
  let currentDescribe = suite;
  const lines = src.split('\n');
  const cases = [];

  for (const line of lines) {
    const dm = line.match(/test\.describe\s*\(\s*['"`]([^'"`]+)['"`]/);
    if (dm) currentDescribe = dm[1];
    const tm = line.match(/test(?:\.skip)?\s*\(\s*['"`]([^'"`]+)['"`]/);
    if (tm) {
      cases.push({
        name: tm[1],
        group: currentDescribe,
        optional: line.includes('test.skip'),
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

const unitFiles = listFiles('tests', '.test.js');
const e2eFiles = listFiles('e2e', '.spec.js');

const unit = unitFiles.map((f) => parseNodeTests(readFile(f), f));
const e2e = e2eFiles.map((f) => parsePlaywrightTests(readFile(f), f));

const pkg = JSON.parse(readFile('package.json'));
const qaScripts = Object.entries(pkg.scripts || {})
  .filter(([k]) => k.startsWith('test') || k.startsWith('qa'))
  .map(([name, cmd]) => ({ name, cmd }));

const reportPath = path.join(root, 'playwright-report', 'index.html');
const catalog = {
  generated_at: new Date().toISOString(),
  version: pkg.version,
  counts: {
    unit: unit.reduce((n, s) => n + s.cases.length, 0),
    e2e: e2e.reduce((n, s) => n + s.cases.length, 0),
    e2e_optional: e2e.reduce(
      (n, s) => n + s.cases.filter((c) => c.optional).length,
      0
    ),
  },
  scripts: qaScripts,
  unit,
  e2e,
  report_available: fs.existsSync(reportPath),
};

const out = path.join(root, 'public', 'qa-catalog.json');
fs.writeFileSync(out, JSON.stringify(catalog, null, 2), 'utf8');
console.log(`QA catalog → ${path.relative(root, out)} (${catalog.counts.unit} unit + ${catalog.counts.e2e} e2e)`);
