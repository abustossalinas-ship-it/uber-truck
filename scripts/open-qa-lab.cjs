#!/usr/bin/env node
'use strict';

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const root = path.join(__dirname, '..');
const port = Number(process.env.PORT || process.env.QA_PORT || 3001);
const healthUrl = `http://127.0.0.1:${port}/health`;
const labUrl = `http://127.0.0.1:${port}/qa-lab`;

spawnSync(process.execPath, [path.join(__dirname, 'build-qa-catalog.cjs')], {
  cwd: root,
  stdio: 'inherit',
});

function ping() {
  return new Promise((resolve) => {
    const req = http.get(healthUrl, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function openBrowser(target) {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', target], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(cmd, [target], { detached: true, stdio: 'ignore' }).unref();
}

function startServerBackground() {
  const serverJs = path.join(root, 'src', 'server.js');
  const child = spawn(process.execPath, [serverJs], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: process.env.NODE_ENV || 'development',
    },
  });
  child.unref();
  return child.pid;
}

async function waitForServer(maxMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    if (await ping()) return true;
    await sleep(400);
  }
  return false;
}

(async () => {
  let startedByUs = false;
  let up = await ping();

  if (!up) {
    console.log(`\nIniciando servidor en puerto ${port}…`);
    const pid = startServerBackground();
    startedByUs = true;
    console.log(`Servidor en segundo plano (pid ${pid}). Esperando /health…`);
    up = await waitForServer();
    if (!up) {
      console.error(`No respondió en ${port}. Revisa .env o ejecuta: npm run dev`);
      process.exit(1);
    }
    console.log('Servidor listo.\n');
  }

  const reportIndex = path.join(root, 'playwright-report', 'index.html');
  if (fs.existsSync(reportIndex)) {
    console.log('Reporte Playwright:   http://127.0.0.1:' + port + '/qa-report/');
  }

  console.log('Abriendo laboratorio QA:', labUrl);
  if (startedByUs) {
    console.log('(El servidor sigue corriendo en segundo plano. Cierra esa ventana de Node o reinicia el PC para liberar el puerto.)\n');
  }
  openBrowser(labUrl);
})();
