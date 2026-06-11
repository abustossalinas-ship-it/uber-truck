require('dotenv').config();
const app = require('./app');

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  const local = `http://localhost:${PORT}`;
  console.log(`Cubik dev → ${local}`);
  console.log(`  Transportistas: ${local}/transportistas`);
  console.log(`  Empresas:       ${local}/empresas`);
  console.log(`  App:            ${local}/app`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
