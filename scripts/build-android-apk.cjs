/** Genera APK debug y lo copia a la carpeta Descargas del usuario. */
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const isWin = process.platform === 'win32';
const gradlew = isWin ? 'gradlew.bat' : './gradlew';
const apkOut = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const destDir = path.join(os.homedir(), 'Downloads');
const destApk = path.join(destDir, 'cubik-android.apk');

function javaHomeHasBin(home) {
  if (!home) return false;
  const bin = path.join(home, 'bin', isWin ? 'java.exe' : 'java');
  return fs.existsSync(bin);
}

function resolveJavaHome() {
  if (javaHomeHasBin(process.env.JAVA_HOME)) return process.env.JAVA_HOME;

  const localProps = path.join(root, 'android', 'local.properties');
  if (fs.existsSync(localProps)) {
    const text = fs.readFileSync(localProps, 'utf8');
    const jdkMatch = text.match(/^org\.gradle\.java\.home=(.+)$/m);
    if (jdkMatch) {
      const fromProps = jdkMatch[1].trim().replace(/\\/g, path.sep);
      if (javaHomeHasBin(fromProps)) return fromProps;
    }
  }

  const candidates = [];
  if (isWin) {
    const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const local = process.env.LOCALAPPDATA || '';
    candidates.push(
      path.join(pf, 'Android', 'Android Studio', 'jbr'),
      path.join(pf, 'Android', 'Android Studio', 'jre'),
      path.join(pf86, 'Android', 'Android Studio', 'jbr'),
      path.join(local, 'Programs', 'Android Studio', 'jbr')
    );
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
      '/Applications/Android Studio.app/Contents/jre/Contents/Home'
    );
  } else {
    candidates.push('/opt/android-studio/jbr', '/usr/lib/jvm/default-java');
  }

  for (const home of candidates) {
    if (javaHomeHasBin(home)) return home;
  }
  return null;
}

const javaHome = resolveJavaHome();
if (!javaHome) {
  console.error(
    'No se encontró Java. Instala Android Studio o define JAVA_HOME apuntando al JDK (carpeta jbr).'
  );
  process.exit(1);
}

const env = { ...process.env, JAVA_HOME: javaHome };
console.log('JAVA_HOME →', javaHome);

console.log('1/3 cap:sync:bundle…');
execSync('npm run cap:sync:bundle', { cwd: root, stdio: 'inherit', env });

console.log('2/3 assembleDebug…');
execSync(`${gradlew} assembleDebug`, {
  cwd: path.join(root, 'android'),
  stdio: 'inherit',
  shell: isWin,
  env,
});

if (!fs.existsSync(apkOut)) {
  console.error('No se encontró APK en', apkOut);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(apkOut, destApk);
const mb = (fs.statSync(destApk).size / (1024 * 1024)).toFixed(1);
console.log(`3/3 Listo: ${destApk} (${mb} MB)`);
console.log('Envíalo por WhatsApp o arrástralo al emulador para instalar.');
