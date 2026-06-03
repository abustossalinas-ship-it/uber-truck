/**
 * Genera el valor para Railway (FCM_SERVICE_ACCOUNT_B64 recomendado).
 *
 * Uso:
 *   node scripts/encode-fcm-service-account.cjs ruta/al-firebase-adminsdk.json
 *
 * Copia la línea BASE64=... en Railway → Variables → FCM_SERVICE_ACCOUNT_B64
 */
const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) {
  console.error('Uso: node scripts/encode-fcm-service-account.cjs <firebase-service-account.json>');
  process.exit(1);
}

const abs = path.resolve(file);
const raw = fs.readFileSync(abs, 'utf8');
let parsed;
try {
  parsed = JSON.parse(raw);
} catch (e) {
  console.error('El archivo no es JSON válido:', e.message);
  process.exit(1);
}

if (parsed.client_info || parsed.project_info) {
  console.error(
    'Este archivo parece google-services.json (Android). Necesitas el JSON de Service Account:'
  );
  console.error('Firebase Console → Project settings → Service accounts → Generate new private key');
  process.exit(1);
}

if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
  console.error('Falta client_email, private_key o project_id (service account de Firebase).');
  process.exit(1);
}

const oneLine = JSON.stringify(parsed);
const b64 = Buffer.from(oneLine, 'utf8').toString('base64');

console.log('\n--- Railway (recomendado) ---');
console.log('Variable: FCM_SERVICE_ACCOUNT_B64');
console.log('Valor (una sola línea, sin comillas):');
console.log(b64);
console.log('\n--- Alternativa ---');
console.log('Variable: FCM_SERVICE_ACCOUNT_JSON');
console.log('Valor (JSON en una línea):');
console.log(oneLine);
console.log('\nBorra la otra variable si usas solo una. Luego Redeploy en Railway.\n');
