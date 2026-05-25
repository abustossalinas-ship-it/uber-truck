'use strict';

const fs = require('fs');
const path = require('path');
const HTMLtoDOCX = require('html-to-docx');

const root = path.join(__dirname, '..');
const docsDir = path.join(root, 'docs');

const DOCS = [
  { html: 'Indice-Documentacion-Uber-Truck.html', docx: 'Indice-Documentacion-Uber-Truck.docx', title: 'Índice documentación' },
  { html: 'Kickoff-Uber-Truck.html', docx: 'Kickoff-Uber-Truck.docx', title: 'Kickoff Uber Truck' },
  { html: 'Journey-Usuario-Uber-Truck.html', docx: 'Journey-Usuario-Uber-Truck.docx', title: 'Journey de usuario' },
  { html: 'Memoria-tecnica-Uber-Truck.html', docx: 'Memoria-tecnica-Uber-Truck.docx', title: 'Memoria técnica' },
  { html: 'Gantt-Uber-Truck.html', docx: 'Gantt-Uber-Truck.docx', title: 'Plan Gantt' },
  { html: 'Modelo-Negocio-Uber-Truck.html', docx: 'Modelo-Negocio-Uber-Truck.docx', title: 'Modelo de negocio' },
];

const downloadsDocs = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'Proyecto Fintech IA'
);

async function exportOne(htmlName, docxName, title) {
  const htmlPath = path.join(docsDir, htmlName);
  const outRepo = path.join(docsDir, docxName);
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html.replace(/<style>[\s\S]*?<\/style>/gi, '');
  const buf = await HTMLtoDOCX(html, null, {
    title,
    lang: 'es-CL',
    font: 'Calibri',
    table: { row: { cantSplit: false } },
  });
  fs.writeFileSync(outRepo, buf);
  console.log('OK:', outRepo);
  if (fs.existsSync(downloadsDocs)) {
    try {
      fs.writeFileSync(path.join(downloadsDocs, docxName), buf);
    } catch (_) {
      /* optional mirror */
    }
  }
}

async function main() {
  for (const d of DOCS) {
    await exportOne(d.html, d.docx, d.title);
  }
  const informeSrc = path.join(process.env.USERPROFILE || '', 'Downloads', 'Informe_Evaluacion_Estrategica_Uber_Truck.docx');
  const informeDst = path.join(docsDir, 'Informe_Evaluacion_Estrategica_Uber_Truck.docx');
  if (fs.existsSync(informeSrc) && !fs.existsSync(informeDst)) {
    fs.copyFileSync(informeSrc, informeDst);
    console.log('Copiado informe origen →', informeDst);
  }
  console.log('\nListo. Carpeta:', docsDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
