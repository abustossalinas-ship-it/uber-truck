'use strict';

const fs = require('fs');
const path = require('path');
const { exportOne } = require('./export-html-docx.cjs');

const downloadsDir = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'Proyecto Uber Truck'
);

async function main() {
  fs.mkdirSync(downloadsDir, { recursive: true });
  const outPath = await exportOne(
    'docs/Memoria-tecnica-Uber-Truck.html',
    'docs/Memoria-tecnica-Uber-Truck.docx',
    { title: 'Memoria técnica Uber Truck', description: 'Memoria técnica Uber Truck' }
  );
  const dest = path.join(downloadsDir, 'Memoria-tecnica-Uber-Truck.docx');
  fs.copyFileSync(outPath, dest);
  console.log('OK repo:', outPath);
  console.log('OK copy:', dest);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
