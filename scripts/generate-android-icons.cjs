/**
 * Genera iconos launcher + splash Android desde public/brand/logo.png
 * Uso: node scripts/generate-android-icons.cjs
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const LOGO = path.join(__dirname, '..', 'public', 'brand', 'logo.png');
const RES = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const BG = { r: 244, g: 247, b: 251, alpha: 1 };

const LAUNCHER = {
  'mipmap-mdpi': { icon: 48, fg: 108 },
  'mipmap-hdpi': { icon: 72, fg: 162 },
  'mipmap-xhdpi': { icon: 96, fg: 216 },
  'mipmap-xxhdpi': { icon: 144, fg: 324 },
  'mipmap-xxxhdpi': { icon: 192, fg: 432 },
};

async function loadIsotipo() {
  const meta = await sharp(LOGO).metadata();
  const cropH = Math.max(1, Math.round(meta.height * 0.52));
  let img = sharp(LOGO).ensureAlpha().extract({
    left: 0,
    top: 0,
    width: meta.width,
    height: Math.min(cropH, meta.height),
  });

  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const threshold = 32;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r <= threshold && g <= threshold && b <= threshold) data[i + 3] = 0;
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 10 })
    .png()
    .toBuffer();
}

async function iconOnBg(isotipo, size, pad = 0.14) {
  const inner = Math.round(size * (1 - pad * 2));
  const resized = await sharp(isotipo)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: resized, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function foregroundOnly(isotipo, size) {
  const inner = Math.round(size * 0.62);
  return sharp(isotipo)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: Math.round((size - inner) / 2),
      bottom: Math.ceil((size - inner) / 2),
      left: Math.round((size - inner) / 2),
      right: Math.ceil((size - inner) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(LOGO)) {
    console.error('Missing logo:', LOGO);
    process.exit(1);
  }

  const isotipo = await loadIsotipo();

  for (const [folder, { icon, fg }] of Object.entries(LAUNCHER)) {
    const dir = path.join(RES, folder);
    fs.mkdirSync(dir, { recursive: true });

    const launcher = await iconOnBg(isotipo, icon);
    const foreground = await foregroundOnly(isotipo, fg);

    await sharp(launcher).toFile(path.join(dir, 'ic_launcher.png'));
    await sharp(launcher).toFile(path.join(dir, 'ic_launcher_round.png'));
    await sharp(foreground).toFile(path.join(dir, 'ic_launcher_foreground.png'));
    console.log('wrote', folder);
  }

  const splash = await iconOnBg(isotipo, 512, 0.1);
  const splashDir = path.join(RES, 'drawable');
  fs.mkdirSync(splashDir, { recursive: true });
  await sharp(splash).toFile(path.join(splashDir, 'splash.png'));
  console.log('wrote drawable/splash.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
