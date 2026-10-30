/**
 * Verifica PostgreSQL, escucha en loopback y cierra servidor y pool al recibir señales.
 * Capa: Infraestructura.
 * Relación: ./aplicacion.js, ./configuracion/conexion.js
 */
import { crearAplicacion } from './aplicacion.js';
import { pool } from './configuracion/conexion.js';
await pool.query('SELECT 1');
const server = crearAplicacion().listen(Number(process.env.PORT || 3000), '127.0.0.1', () =>
  console.log('CityCars API: http://127.0.0.1:' + (process.env.PORT || 3000)),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(async () => {
      await pool.end();
      process.exit(0);
    }),
  );
