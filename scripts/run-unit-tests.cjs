#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testsDir = path.join(__dirname, '..', 'tests');

function collectTestFiles(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectTestFiles(full));
    else if (entry.name.endsWith('.test.js')) files.push(full);
  }
  return files;
}

const files = collectTestFiles(testsDir);
if (!files.length) {
  console.error('No hay archivos tests/**/*.test.js');
  process.exit(1);
}

const r = spawnSync(process.execPath, ['--test', ...files], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(r.status == null ? 1 : r.status);
