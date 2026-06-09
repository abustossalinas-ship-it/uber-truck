/** Instala Cubik debug en emulador/dispositivo conectado (sync bundle + installDebug). */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const isWin = process.platform === 'win32';
const gradlew = isWin ? 'gradlew.bat' : './gradlew';
const adb =
  process.env.ADB_PATH ||
  (isWin
    ? path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe')
    : 'adb');

function resolveJavaHome() {
  const buildScript = path.join(__dirname, 'build-android-apk.cjs');
  const src = fs.readFileSync(buildScript, 'utf8');
  const m = src.match(/function resolveJavaHome\(\)[\s\S]*?^}/m);
  if (!m) return process.env.JAVA_HOME;
  // Reuse build script logic
  return require('./build-android-apk.cjs').resolveJavaHome?.() || process.env.JAVA_HOME;
}

// build-android-apk doesn't export resolveJavaHome — inline minimal copy
function javaHomeHasBin(home) {
  if (!home) return false;
  const bin = path.join(home, 'bin', isWin ? 'java.exe' : 'java');
  return fs.existsSync(bin);
}

function findJavaHome() {
  if (javaHomeHasBin(process.env.JAVA_HOME)) return process.env.JAVA_HOME;
  const localProps = path.join(root, 'android', 'local.properties');
  if (fs.existsSync(localProps)) {
    const text = fs.readFileSync(localProps, 'utf8');
    const jdkMatch = text.match(/^org\.gradle\.java\.home=(.+)$/m);
    if (jdkMatch && javaHomeHasBin(jdkMatch[1].trim())) return jdkMatch[1].trim();
  }
  const pf = process.env.ProgramFiles || 'C:\\Program Files';
  const candidate = path.join(pf, 'Android', 'Android Studio', 'jbr');
  if (javaHomeHasBin(candidate)) return candidate;
  return null;
}

const mode = process.argv.includes('--remote') ? 'remote' : 'bundle';
const capSync = mode === 'remote' ? 'cap:sync:remote' : 'cap:sync:bundle';
const javaHome = findJavaHome();
if (!javaHome) {
  console.error('No se encontró Java/Android Studio.');
  process.exit(1);
}
const env = { ...process.env, JAVA_HOME: javaHome };

console.log(`Modo: ${mode}`);
console.log(`1/3 ${capSync}…`);
execSync(`npm run ${capSync}`, { cwd: root, stdio: 'inherit', env });

console.log('2/3 verify android bundle…');
execSync('node scripts/verify-android-bundle.cjs', { cwd: root, stdio: 'inherit' });

console.log('3/3 installDebug…');
execSync(`${gradlew} installDebug`, {
  cwd: path.join(root, 'android'),
  stdio: 'inherit',
  shell: isWin,
  env,
});

if (fs.existsSync(adb)) {
  console.log('Reiniciando app en dispositivo…');
  execSync(`"${adb}" shell am force-stop cl.cubik.logistics`, { stdio: 'inherit', shell: isWin });
  execSync(`"${adb}" shell am start -n cl.cubik.logistics/.MainActivity`, { stdio: 'inherit', shell: isWin });
  console.log('Listo. Prueba «Comenzar como Transportista» en el emulador.');
} else {
  console.log('ADB no encontrado; abre la app manualmente en el emulador.');
}
