/** Usa UI empaquetada en APK (sin server.url); API sigue en Railway vía api-base.js */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const remote = path.join(root, 'capacitor.config.json');
const bundle = path.join(root, 'capacitor.config.bundle.json');
const backup = path.join(root, 'capacitor.config.remote.json');

if (!fs.existsSync(backup) && fs.existsSync(remote)) {
  fs.copyFileSync(remote, backup);
}

fs.copyFileSync(bundle, remote);
console.log('capacitor.config.json → modo bundle (assets locales + API remota)');
