'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const { test } = require('node:test');

const root = path.join(__dirname, '..');

test('android bundle auth-ui no está roto ni desactualizado', () => {
  const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'verify-android-bundle.cjs')], {
    cwd: root,
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || 'verify-android-bundle failed').trim());
  }
});
