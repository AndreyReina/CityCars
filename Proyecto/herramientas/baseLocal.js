/**
 * Inicia o detiene PostgreSQL aislado para Windows; conserva datos y genera configuración solo al inicializar.
 * Capa: Herramientas de desarrollo.
 * Relación: node:fs, node:path, node:crypto, node:child_process, pg
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
// PostgreSQL para Windows requiere rutas ASCII durante initdb (8.3 conserva la ubicación).
const short = spawnSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-Command',
    '(New-Object -ComObject Scripting.FileSystemObject).GetFolder((Get-Location).Path).ShortPath',
  ],
  { encoding: 'utf8', windowsHide: true },
);
const root = short.status === 0 ? short.stdout.trim() : process.cwd();
process.chdir(root);
const local = path.join(root, '.local'),
  bin = path.join(local, 'postgresql', 'pgsql', 'bin'),
  data = path.join(local, 'pgdata');
const run = (exe, args) => {
  const r = spawnSync(path.join(bin, exe + '.exe'), args, { stdio: 'inherit', windowsHide: true });
  if (r.status !== 0) throw new Error(exe + ' falló');
};
const action = process.argv[2] || 'start';
if (action === 'stop') {
  run('pg_ctl', ['-D', data, 'stop', '-m', 'fast']);
  process.exit(0);
}
fs.mkdirSync(local, { recursive: true });
if (!fs.existsSync(data)) {
  const password = crypto.randomBytes(24).toString('hex'),
    secret = crypto.randomBytes(48).toString('hex');
  const passwordFile = path.join(local, 'init-password');
  fs.writeFileSync(passwordFile, password);
  run('initdb', [
    '-D',
    data,
    '-U',
    'citycars',
    '--pwfile=' + passwordFile,
    '--auth=scram-sha-256',
    '--encoding=UTF8',
    '--locale=C',
  ]);
  fs.unlinkSync(passwordFile);
  fs.appendFileSync(
    path.join(data, 'postgresql.conf'),
    "\nlisten_addresses = '127.0.0.1'\nport = 55432\ntimezone = 'America/Bogota'\n",
  );
  fs.writeFileSync(
    '.env',
    'DATABASE_URL=postgresql://citycars:' +
      password +
      '@127.0.0.1:55432/citycars\nSESSION_SECRET=' +
      secret +
      '\nPORT=3000\nAPP_ORIGIN=http://127.0.0.1:3000\n',
    { flag: 'wx' },
  );
}
const status = spawnSync(path.join(bin, 'pg_ctl.exe'), ['-D', data, 'status'], {
  windowsHide: true,
  stdio: 'ignore',
});
if (status.status !== 0)
  run('pg_ctl', ['-D', data, '-l', path.join(local, 'postgres.log'), '-w', 'start']);
process.loadEnvFile();
const { default: pg } = await import('pg');
const admin = new pg.Client({
  connectionString: process.env.DATABASE_URL.replace(/\/citycars$/, '/postgres'),
});
await admin.connect();
if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname='citycars'")).rowCount)
  await admin.query('CREATE DATABASE citycars');
await admin.end();
console.log(
  'Instancia local disponible en 127.0.0.1:55432; secretos guardados en .env (ignorado).',
);
