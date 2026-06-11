/**
 * Genera logos Cubik PNG con fondo transparente.
 * - Nav oscuro: lámina oficial (texto blanco)
 * - Demo / app: PNG maestro del usuario (texto navy, tipografía correcta)
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'brand');
const LIGHT_MASTER_NAME =
  'c__Users_Ariel_Bustos_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-8ca6dc51-f879-4356-9532-c38ab50f7f2f.png';

function assetDirs() {
  return [
    path.join(ROOT, 'assets'),
    path.join(ROOT, '..', 'c-Users-Ariel-Bustos-cursor-projects-uber-truck', 'assets'),
  ];
}

function findSheetSource() {
  const hits = [];
  for (const dir of assetDirs()) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!/ChatGPT_Image_10_jun_2026/i.test(f)) continue;
      hits.push({ full: path.join(dir, f), mtime: fs.statSync(path.join(dir, f)).mtimeMs });
    }
  }
  if (!hits.length) return null;
  hits.sort((a, b) => b.mtime - a.mtime);
  return hits[0].full;
}

function findLightMasterSource() {
  for (const dir of assetDirs()) {
    const exact = path.join(dir, LIGHT_MASTER_NAME);
    if (fs.existsSync(exact)) return exact;
    if (!fs.existsSync(dir)) continue;
    const hits = fs
      .readdirSync(dir)
      .filter((f) => /^c__Users_.*image-.*\.png$/i.test(f) && !/ChatGPT_Image/i.test(f))
      .map((f) => ({ full: path.join(dir, f), mtime: fs.statSync(path.join(dir, f)).mtimeMs }));
    if (hits.length) {
      hits.sort((a, b) => b.mtime - a.mtime);
      return hits[0].full;
    }
  }
  return null;
}

function isDarkBackgroundPixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;
  if (max <= 42 && sat <= 28) return true;
  if (max <= 58 && sat <= 10) return true;
  return false;
}

function isLightBackgroundPixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;
  if (max >= 200 && sat <= 18) return true;
  if (max >= 175 && sat <= 12) return true;
  return false;
}

function floodFillBackground(rgba, width, height, isBackground) {
  const visited = new Uint8Array(width * height);
  const queue = [];

  for (let x = 0; x < width; x++) {
    queue.push([x, 0], [x, height - 1]);
  }
  for (let y = 0; y < height; y++) {
    queue.push([0, y], [width - 1, y]);
  }

  while (queue.length) {
    const [x, y] = queue.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const idx = y * width + x;
    if (visited[idx]) continue;
    const i = idx * 4;
    if (!isBackground(rgba[i], rgba[i + 1], rgba[i + 2])) continue;
    visited[idx] = 1;
    rgba[i + 3] = 0;
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return rgba;
}

async function processBuffer(data, info, outName, resize, { lightBg = false } = {}) {
  let rgba = Buffer.from(data);
  const isBackground = lightBg ? isLightBackgroundPixel : isDarkBackgroundPixel;
  rgba = floodFillBackground(rgba, info.width, info.height, isBackground);

  let pipeline = sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 1 })
    .ensureAlpha();

  if (resize) {
    pipeline = pipeline.resize({
      ...resize,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }

  const dest = path.join(OUT_DIR, outName);
  await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(dest);
  const meta = await sharp(dest).metadata();
  console.log(`✓ ${outName} → ${meta.width}x${meta.height} (alpha: ${meta.hasAlpha})`);
}

async function processCrop(src, crop, outName, resize, opts) {
  const { data, info } = await sharp(src)
    .extract(crop)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  await processBuffer(data, info, outName, resize, opts);
}

async function processFull(src, outName, resize, opts) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  await processBuffer(data, info, outName, resize, opts);
}

const SHEET_CROPS = {
  navWhite: { left: 173, top: 222, width: 331, height: 109 },
  mark: { left: 504, top: 904, width: 76, height: 83 },
};

async function main() {
  const sheet = findSheetSource();
  const lightMaster = findLightMasterSource();

  if (!sheet) {
    console.error('No se encontró lámina maestra (nav blanco).');
    process.exit(1);
  }
  if (!lightMaster) {
    console.error('No se encontró PNG maestro para demo/app (logo navy).');
    process.exit(1);
  }

  console.log('Lámina nav:', sheet);
  console.log('Maestro demo/app:', lightMaster);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const navResize = { width: 360, fit: 'inside' };
  const officialResize = { width: 720, fit: 'inside' };
  const markResize = {
    width: 256,
    height: 256,
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  };

  await processCrop(sheet, SHEET_CROPS.navWhite, 'logo-cubik-nav.png', navResize);
  await processFull(lightMaster, 'logo-cubik-nav-light.png', navResize, { lightBg: true });
  await processCrop(sheet, SHEET_CROPS.navWhite, 'logo-cubik-official.png', officialResize);
  await processCrop(sheet, SHEET_CROPS.mark, 'logo-mark.png', markResize);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
