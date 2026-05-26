'use strict';

const fs = require('fs');
const path = require('path');
const HTMLtoDOCX = require('html-to-docx');

async function exportOne(htmlRel, outRel, meta = {}) {
  const root = path.join(__dirname, '..');
  const htmlPath = path.join(root, htmlRel);
  const outPath = path.join(root, outRel);
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`HTML no encontrado: ${htmlPath}`);
  }
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html.replace(/<style>[\s\S]*?<\/style>/gi, '');
  const buf = await HTMLtoDOCX(html, null, {
    title: meta.title || path.basename(outRel, '.docx'),
    description: meta.description || 'Uber Truck — documentación',
    lang: 'es-CL',
    font: 'Calibri',
    table: { row: { cantSplit: false } },
  });
  fs.writeFileSync(outPath, buf);
  return outPath;
}

module.exports = { exportOne };

if (require.main === module) {
  const htmlRel = process.argv[2];
  const outRel = process.argv[3];
  if (!htmlRel || !outRel) {
    console.error('Usage: node export-html-docx.cjs <html-path> <out-path>');
    process.exit(1);
  }
  exportOne(htmlRel, outRel)
    .then((p) => console.log('OK:', p))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
