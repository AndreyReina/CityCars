/**
 * Inspección de solo lectura del esquema PostgreSQL para documentación.
 * Capa: herramienta de desarrollo. Lee catálogos pg_catalog, nunca filas de negocio.
 * Genera metadatos sin URL de conexión, credenciales ni contenido de sesiones.
 */
import fs from 'node:fs/promises';
import { pool } from '../backend/configuracion/conexion.js';
const consulta = async (sql) => (await pool.query(sql)).rows;
try {
  const tablas = await consulta(
    "SELECT tablename AS nombre FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  );
  const columnas =
    await consulta(`SELECT c.relname AS tabla,a.attname AS campo,format_type(a.atttypid,a.atttypmod) AS tipo,
    NOT a.attnotnull AS nulo,pg_get_expr(d.adbin,d.adrelid) AS defecto,a.attidentity AS identidad
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum`);
  const restricciones =
    await consulta(`SELECT c.relname AS tabla,k.conname AS nombre,k.contype AS tipo,
    pg_get_constraintdef(k.oid) AS definicion,COALESCE(t.relname,'') AS destino,
    (SELECT array_agg(a.attname::text ORDER BY v.ord) FROM unnest(k.conkey) WITH ORDINALITY v(num,ord) JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=v.num) AS campos
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_class t ON t.oid=k.confrelid
    WHERE n.nspname='public' ORDER BY c.relname,k.conname`);
  const indices = await consulta(
    "SELECT tablename AS tabla,indexname AS nombre,indexdef AS definicion FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname",
  );
  const disparadores = await consulta(
    `SELECT c.relname AS tabla,t.tgname AS nombre,pg_get_triggerdef(t.oid) AS definicion FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`,
  );
  const version = (await consulta("SELECT current_setting('server_version') AS version"))[0]
    .version;
  await fs.mkdir('documentacion/evidencias', { recursive: true });
  await fs.writeFile(
    'documentacion/evidencias/esquema_verificado.json',
    JSON.stringify(
      {
        fecha: '2026-10-29',
        fuente: 'pg_catalog de la instancia local; solo metadatos',
        version,
        tablas,
        columnas,
        restricciones,
        indices,
        disparadores,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    tablas.length +
      ' tablas y ' +
      columnas.length +
      ' columnas documentadas sin leer datos personales.',
  );
} finally {
  await pool.end();
}
