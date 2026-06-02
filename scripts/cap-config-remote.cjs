/** Restaura capacitor.config.json con URL remota (desarrollo / demo web en APK). */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const remote = path.join(root, 'capacitor.config.json');
const backup = path.join(root, 'capacitor.config.remote.json');

if (!fs.existsSync(backup)) {
  fs.copyFileSync(remote, backup);
  console.log('Backup remoto guardado en capacitor.config.remote.json');
} else {
  fs.copyFileSync(backup, remote);
  console.log('capacitor.config.json → modo remoto (Railway URL)');
}
