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

/** Detecta dónde empieza el texto "Cubik" para recortar solo el cubo 3D */
async function detectCubeCropHeight() {
  const meta = await sharp(LOGO).metadata();
  const { data, info } = await sharp(LOGO).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const T = 32;
  for (let y = 380; y < info.height; y++) {
    let n = 0;
    let navy = 0;
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r <= T && g <= T && b <= T) continue;
      n++;
      if (r < 55 && g < 100 && b > 55) navy++;
    }
    if (n > 100 && navy / n > 0.72) {
      return Math.max(400, y - 14);
    }
  }
  return Math.round(meta.height * 0.505);
}

async function detectBrandTextTop() {
  const meta = await sharp(LOGO).metadata();
  const cropH = await detectCubeCropHeight();
  return Math.min(meta.height - 1, cropH + 8);
}

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

function stripBlackBackground(inputSharp) {
  return inputSharp.ensureAlpha().raw().toBuffer({ resolveWithObject: true }).then(({ data, info }) => {
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
  });
}

async function loadIsotipo() {
  const meta = await sharp(LOGO).metadata();
  const cropH = await detectCubeCropHeight();
  const cropped = sharp(LOGO).extract({
    left: 0,
    top: 0,
    width: meta.width,
    height: Math.min(cropH, meta.height),
  });
  const stripped = await stripBlackBackground(cropped);
  return sharp(stripped)
    .extend({
      bottom: 8,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function loadFullBrand() {
  return stripBlackBackground(sharp(LOGO));
}

async function loadBrandText() {
  const meta = await sharp(LOGO).metadata();
  const top = await detectBrandTextTop();
  const cropped = sharp(LOGO).extract({
    left: 0,
    top,
    width: meta.width,
    height: Math.max(1, meta.height - top),
  });
  return stripBlackBackground(cropped);
}

/** Android 12: icono visible en círculo ~240dp sobre lienzo 432dp → ~52% máx */
async function splashIcon(isotipo, size = 432) {
  const inner = Math.round(size * 0.5);
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

async function splashBranding(brandText, width = 960) {
  return sharp(brandText)
    .resize(width, null, { fit: 'inside' })
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

async function splashComposite(fullBrand, width, height) {
  const logoMaxW = Math.round(Math.min(width, height) * 0.68);
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
  if (!fs.existsSync(LOGO)) {
    console.error('Missing logo:', LOGO);
    process.exit(1);
  }

  const isotipo = await loadIsotipo();
  const fullBrand = await loadFullBrand();
  const brandText = await loadBrandText();
  const cropH = await detectCubeCropHeight();
  console.log('isotipo crop height px:', cropH);

  const markSize = 256;
  const mark = await sharp(isotipo)
    .resize(markSize, markSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const markPath = path.join(__dirname, '..', 'public', 'brand', 'logo-mark.png');
  await sharp(mark).toFile(markPath);
  console.log('wrote public/brand/logo-mark.png');

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

  const splashDir = path.join(RES, 'drawable');
  fs.mkdirSync(splashDir, { recursive: true });

  const splashLogo = await sharp(fullBrand)
    .resize(960, null, { fit: 'inside' })
    .png()
    .toBuffer();
  await sharp(splashLogo).toFile(path.join(splashDir, 'splash_logo.png'));
  console.log('wrote drawable/splash_logo.png');

  const splashIconPng = await splashIcon(isotipo, 432);
  await sharp(splashIconPng).toFile(path.join(splashDir, 'splash_icon.png'));
  console.log('wrote drawable/splash_icon.png');

  const splashBrandingPng = await splashBranding(brandText, 960);
  await sharp(splashBrandingPng).toFile(path.join(splashDir, 'splash_branding.png'));
  console.log('wrote drawable/splash_branding.png');

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
