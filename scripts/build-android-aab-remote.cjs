/** AAB release remoto (UI desde Railway). Requiere firma release en android/app. */
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const isWin = process.platform === 'win32';
const gradlew = isWin ? 'gradlew.bat' : './gradlew';
const aabOut = path.join(
  root,
  'android',
  'app',
  'build',
  'outputs',
  'bundle',
  'release',
  'app-release.aab'
);
const destAab = path.join(os.homedir(), 'Downloads', 'cubik-android.aab');

const env = { ...process.env };

console.log('1/3 cap:sync:remote…');
execSync('npm run cap:sync:remote', { cwd: root, stdio: 'inherit', env });

console.log('2/3 verify android bundle…');
execSync('node scripts/verify-android-bundle.cjs', { cwd: root, stdio: 'inherit', env });

console.log('3/3 bundleRelease…');
try {
  execSync(`${gradlew} bundleRelease`, {
    cwd: path.join(root, 'android'),
    stdio: 'inherit',
    shell: isWin,
    env,
  });
} catch {
  console.error(
    '\nSi falla la firma release, configura signing en android/app/build.gradle o usa npm run android:apk:remote.'
  );
  process.exit(1);
}

if (!fs.existsSync(aabOut)) {
  console.error('No se encontró AAB en', aabOut);
  process.exit(1);
}

fs.mkdirSync(path.dirname(destAab), { recursive: true });
fs.copyFileSync(aabOut, destAab);
const mb = (fs.statSync(destAab).size / (1024 * 1024)).toFixed(1);
console.log(`Listo: ${destAab} (${mb} MB)`);
