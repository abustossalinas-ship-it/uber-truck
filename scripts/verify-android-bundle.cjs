'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const bundledAuthUi = path.join(
  __dirname,
  '..',
  'android',
  'app',
  'src',
  'main',
  'assets',
  'public',
  'auth-ui.js'
);
const sourceAuthUi = path.join(__dirname, '..', 'public', 'auth-ui.js');

function checkSyntax(file) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}

function readDeployVersion(file) {
  try {
    const deployPath = path.join(path.dirname(file), 'deploy.json');
    return JSON.parse(fs.readFileSync(deployPath, 'utf8')).version;
  } catch {
    return null;
  }
}

console.log('Verificando auth-ui.js fuente…');
checkSyntax(sourceAuthUi);

if (!fs.existsSync(bundledAuthUi)) {
  console.warn('Aviso: no hay auth-ui embebido en android/ — ejecuta npm run cap:sync:bundle');
  process.exit(0);
}

console.log('Verificando auth-ui.js embebido en Android…');
try {
  checkSyntax(bundledAuthUi);
} catch (e) {
  console.error('\nERROR: el APK/emulador tiene auth-ui.js ROTO (sintaxis inválida).');
  console.error('Ejecuta: npm run cap:sync:bundle');
  console.error('O usa APK remoto: npm run android:apk:remote\n');
  throw e;
}

const srcVer = readDeployVersion(sourceAuthUi);
const bundledVer = readDeployVersion(bundledAuthUi);
if (srcVer && bundledVer && srcVer !== bundledVer) {
  console.warn(
    `Aviso: deploy.json public=${srcVer} pero android bundle=${bundledVer}. Corre cap:sync:bundle antes del APK.`
  );
}

console.log('Android bundle auth-ui OK');
