#!/usr/bin/env node
'use strict';

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const root = path.join(__dirname, '..');
const port = Number(process.env.PORT || process.env.QA_PORT || 3001);
const url = `http://127.0.0.1:${port}/qa-lab`;

spawnSync(process.execPath, [path.join(__dirname, 'build-qa-catalog.cjs')], {
  cwd: root,
  stdio: 'inherit',
});

function ping() {
  return new Promise((resolve) => {
    const req = http.get(`${url.replace('/qa-lab', '/health')}`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function openBrowser(target) {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', target], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(cmd, [target], { detached: true, stdio: 'ignore' }).unref();
}

(async () => {
  const up = await ping();
  if (!up) {
    console.log('\nServidor no detectado en puerto', port);
    console.log('En otra terminal:  npm run dev');
    console.log('Luego abre:           ' + url + '\n');
    process.exit(1);
  }

  const reportIndex = path.join(root, 'playwright-report', 'index.html');
  if (fs.existsSync(reportIndex)) {
    console.log('Reporte Playwright:   http://127.0.0.1:' + port + '/qa-report/');
  }

  console.log('Abriendo laboratorio QA:', url);
  openBrowser(url);
})();
