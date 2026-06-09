#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

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

run('Unit tests (Node)', process.execPath, ['--test', 'tests/**/*.test.js']);
run('E2E app (Playwright)', npmCmd, ['run', 'test:e2e']);

console.log('\nQA automatizado OK\n');
