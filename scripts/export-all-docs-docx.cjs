'use strict';

const fs = require('fs');
const path = require('path');
const { exportOne } = require('./export-html-docx.cjs');

const downloadsDir = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'Proyecto Uber Truck'
);

/** Memoria = documento central; el resto son anexos. Sin duplicados (Gantt, roadmap, kickoff). */
const PACK = [
  { html: 'docs/Memoria-tecnica-Uber-Truck.html', out: 'docs/Memoria-tecnica-Uber-Truck.docx', copy: 'Memoria-tecnica-Uber-Truck.docx', title: 'Memoria técnica Uber Truck' },
  { html: 'docs/Indice-Documentacion-Uber-Truck.html', out: 'docs/Indice-Documentacion-Uber-Truck.docx', copy: 'Indice-Documentacion-Uber-Truck.docx', title: 'Índice documentación' },
  { html: 'docs/Modelo-Negocio-Uber-Truck.html', out: 'docs/Modelo-Negocio-Uber-Truck.docx', copy: 'Modelo-Negocio-Uber-Truck.docx', title: 'Modelo de negocio' },
  { html: 'docs/Journey-Usuario-Uber-Truck.html', out: 'docs/Journey-Usuario-Uber-Truck.docx', copy: 'Journey-Usuario-Uber-Truck.docx', title: 'Journey de usuario' },
  { html: 'docs/Canvas-Resumen-Uber-Truck.html', out: 'docs/Canvas-Resumen-Uber-Truck.docx', copy: 'Canvas-Resumen-Uber-Truck.docx', title: 'Resumen canvas' },
  { html: 'docs/Politica-Cancelacion-Uber-Truck.html', out: 'docs/Politica-Cancelacion-Uber-Truck.docx', copy: 'Politica-Cancelacion-Uber-Truck.docx', title: 'Política cancelación' },
  { html: 'docs/Multas-Cuenta-Uber-Truck.html', out: 'docs/Multas-Cuenta-Uber-Truck.docx', copy: 'Multas-Cuenta-Uber-Truck.docx', title: 'Multas y cuenta' },
  { html: 'docs/Sql-Supabase-Uber-Truck.html', out: 'docs/Sql-Supabase-Uber-Truck.docx', copy: 'Sql-Supabase-Uber-Truck.docx', title: 'SQL Supabase' },
];

async function main() {
  fs.mkdirSync(downloadsDir, { recursive: true });
  for (const item of PACK) {
    const outPath = await exportOne(item.html, item.out, {
      title: item.title,
      description: item.title,
    });
    const dest = path.join(downloadsDir, item.copy);
    fs.copyFileSync(outPath, dest);
    console.log('OK repo:', outPath);
    console.log('OK copy:', dest);
  }
  console.log('\nListo. Carpeta:', downloadsDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
