#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const withProd = process.argv.includes('--prod');

function run(label, cmd, args, extraEnv = {}) {
  console.log(`\n=== ${label} ===\n`);
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
  if (r.status !== 0) {
    process.exit(r.status == null ? 1 : r.status);
  }
}

run('Unit tests (Node)', process.execPath, [path.join(root, 'scripts', 'run-unit-tests.cjs')]);
run('E2E app local (Playwright)', npmCmd, ['run', 'test:e2e']);

if (withProd) {
  run('E2E prod Railway (Playwright)', npmCmd, ['run', 'test:e2e:prod']);
}

console.log('\nQA automatizado OK\n');
