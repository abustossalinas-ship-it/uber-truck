/**
 * Genera iconos launcher + splash Android desde public/brand/logo-cubik-mark.png
 * Logo horizontal oficial: public/brand/logo-cubik-official-light.png
 * Uso: node scripts/generate-android-icons.cjs
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const MARK = path.join(__dirname, '..', 'public', 'brand', 'logo-cubik-mark.png');
const FULL = path.join(__dirname, '..', 'public', 'brand', 'logo-cubik-official-light.png');
const RES = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const BG = { r: 244, g: 247, b: 251, alpha: 1 };

const LAUNCHER = {
  'mipmap-mdpi': { icon: 48, fg: 108 },
  'mipmap-hdpi': { icon: 72, fg: 162 },
  'mipmap-xhdpi': { icon: 96, fg: 216 },
  'mipmap-xxhdpi': { icon: 144, fg: 324 },
  'mipmap-xxxhdpi': { icon: 192, fg: 432 },
};

const SPLASH_PORT = {
  'drawable-port-mdpi': [320, 480],
  'drawable-port-hdpi': [480, 800],
  'drawable-port-xhdpi': [720, 1280],
  'drawable-port-xxhdpi': [960, 1600],
  'drawable-port-xxxhdpi': [1280, 1920],
};

const SPLASH_LAND = {
  'drawable-land-mdpi': [480, 320],
  'drawable-land-hdpi': [800, 480],
  'drawable-land-xhdpi': [1280, 720],
  'drawable-land-xxhdpi': [1600, 960],
  'drawable-land-xxxhdpi': [1920, 1280],
};

async function loadMark() {
  return sharp(MARK).ensureAlpha().png().toBuffer();
}

async function loadFull() {
  return sharp(FULL).ensureAlpha().png().toBuffer();
}

async function splashIcon(mark, size = 432) {
  const inner = Math.round(size * 0.5);
  return sharp(mark)
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

async function iconOnBg(mark, size, pad = 0.12) {
  const inner = Math.round(size * (1 - pad * 2));
  const resized = await sharp(mark)
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

async function foregroundOnly(mark, size) {
  const inner = Math.round(size * 0.62);
  return sharp(mark)
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

async function splashComposite(fullBrand, width, height) {
  const logoMaxW = Math.round(Math.min(width, height) * 0.62);
  const logo = await sharp(fullBrand)
    .resize(logoMaxW, null, { fit: 'inside' })
    .png()
    .toBuffer();
  return sharp({
    create: { width, height, channels: 4, background: BG },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function writeSplashSet(fullBrand, sizes) {
  for (const [folder, [width, height]] of Object.entries(sizes)) {
    const dir = path.join(RES, folder);
    fs.mkdirSync(dir, { recursive: true });
    const png = await splashComposite(fullBrand, width, height);
    await sharp(png).toFile(path.join(dir, 'splash.png'));
    console.log('wrote', folder, 'splash.png');
  }
}

async function main() {
  if (!fs.existsSync(MARK)) {
    console.error('Missing mark:', MARK);
    process.exit(1);
  }
  if (!fs.existsSync(FULL)) {
    console.error('Missing full logo:', FULL);
    process.exit(1);
  }

  const mark = await loadMark();
  const fullBrand = await loadFull();

  const markPath = path.join(__dirname, '..', 'public', 'brand', 'logo-mark.png');
  await sharp(mark)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(markPath);
  console.log('wrote public/brand/logo-mark.png');

  for (const [folder, { icon, fg }] of Object.entries(LAUNCHER)) {
    const dir = path.join(RES, folder);
    fs.mkdirSync(dir, { recursive: true });

    const launcher = await iconOnBg(mark, icon);
    const foreground = await foregroundOnly(mark, fg);

    await sharp(launcher).toFile(path.join(dir, 'ic_launcher.png'));
    await sharp(launcher).toFile(path.join(dir, 'ic_launcher_round.png'));
    await sharp(foreground).toFile(path.join(dir, 'ic_launcher_foreground.png'));
    console.log('wrote', folder);
  }

  const splashDir = path.join(RES, 'drawable');
  fs.mkdirSync(splashDir, { recursive: true });

  const splashLogo = await sharp(fullBrand)
    .resize(960, null, { fit: 'inside' })
    .png()
    .toBuffer();
  await sharp(splashLogo).toFile(path.join(splashDir, 'splash_logo.png'));
  console.log('wrote drawable/splash_logo.png');

  const splashIconPng = await splashIcon(mark, 432);
  await sharp(splashIconPng).toFile(path.join(splashDir, 'splash_icon.png'));
  console.log('wrote drawable/splash_icon.png');

  const splashPreview = await splashComposite(fullBrand, 1280, 1920);
  await writeSplashSet(fullBrand, SPLASH_PORT);
  await writeSplashSet(fullBrand, SPLASH_LAND);

  const splashBrandPath = path.join(__dirname, '..', 'public', 'brand', 'splash-brand.png');
  await sharp(splashPreview).toFile(splashBrandPath);
  console.log('wrote public/brand/splash-brand.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
