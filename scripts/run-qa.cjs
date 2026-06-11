#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const playwrightCli = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js');
const withProd = process.argv.includes('--prod');

function runNode(label, scriptPath, extraArgs = [], extraEnv = {}) {
  console.log(`\n=== ${label} ===\n`);
  const r = spawnSync(process.execPath, [scriptPath, ...extraArgs], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
  if (r.status !== 0) {
    process.exit(r.status == null ? 1 : r.status);
  }
}

function runPlaywright(label, configFile) {
  console.log(`\n=== ${label} ===\n`);
  const args = [playwrightCli, 'test'];
  if (configFile) args.push(`--config=${configFile}`);
  const r = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env },
  });
  if (r.status !== 0) {
    process.exit(r.status == null ? 1 : r.status);
  }
}

runNode('Unit tests (Node)', path.join(root, 'scripts', 'run-unit-tests.cjs'));
runPlaywright('E2E app local (Playwright)');
spawnSync(process.execPath, [path.join(root, 'scripts', 'build-qa-catalog.cjs')], {
  cwd: root,
  stdio: 'inherit',
});

if (withProd) {
  runPlaywright('E2E prod Railway (Playwright)', 'playwright.prod.config.js');
}

console.log('\nQA automatizado OK\n');
