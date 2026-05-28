'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const docx = process.argv[2];
if (!docx) {
  console.error('Usage: node read-docx-text.cjs <file.docx>');
  process.exit(1);
}
const out = path.join(__dirname, '..', '.tmp-docx-read');
const zipCopy = path.join(__dirname, '..', '.tmp-docx-read.zip');
try {
  fs.rmSync(out, { recursive: true, force: true });
} catch (_) {}
try {
  fs.unlinkSync(zipCopy);
} catch (_) {}
fs.copyFileSync(docx, zipCopy);
fs.mkdirSync(out, { recursive: true });
const dest = out.replace(/'/g, "''");
const src = zipCopy.replace(/'/g, "''");
execSync(
  `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${src}' -DestinationPath '${dest}' -Force"`,
  { stdio: 'inherit' }
);
const xml = fs.readFileSync(path.join(out, 'word', 'document.xml'), 'utf8');
const text = xml
  .replace(/<w:tab[^/]*\/>/g, '\t')
  .replace(/<\/w:p>/g, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&')
  .replace(/\n{3,}/g, '\n\n')
  .trim();
console.log(text);
