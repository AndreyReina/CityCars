/**
 * Aplica el esquema SQL aditivo a la conexión configurada; no ejecuta automáticamente migraciones de datos históricas.
 * Capa: Herramientas de desarrollo.
 * Relación: node:fs/promises, ../backend/configuracion/conexion.js
 */
import fs from 'node:fs/promises';
import { pool } from '../backend/configuracion/conexion.js';
await pool.query(await fs.readFile(new URL('../base_datos/esquema.sql', import.meta.url), 'utf8'));
await pool.end();
console.log('Esquema PostgreSQL preparado.');
