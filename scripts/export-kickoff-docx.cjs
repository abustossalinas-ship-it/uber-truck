'use strict';

const fs = require('fs');
const path = require('path');
const HTMLtoDOCX = require('html-to-docx');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'docs', 'Kickoff-Uber-Truck.html');
const outPath = path.join(root, 'docs', 'Kickoff-Uber-Truck.docx');

async function main() {
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html.replace(/<style>[\s\S]*?<\/style>/gi, '');
  const buf = await HTMLtoDOCX(html, null, {
    title: 'Kickoff — Uber Truck',
    lang: 'es-CL',
    font: 'Calibri',
  });
  fs.writeFileSync(outPath, buf);
  console.log('OK:', outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
