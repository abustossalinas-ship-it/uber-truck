'use strict';

const { execFileSync } = require('child_process');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const authUiPath = path.join(__dirname, '..', 'public', 'auth-ui.js');

test('auth-ui.js parsea sin errores (bloquea login en APK bundle)', () => {
  execFileSync(process.execPath, ['--check', authUiPath], { stdio: 'pipe' });
  const src = require('fs').readFileSync(authUiPath, 'utf8');
  assert.doesNotMatch(
    src,
    /querySelector\([^)]+\)\?\.[\w]+\s*=/,
    'asignación con ?. rompe todo auth-ui en WebView/APK'
  );
});
