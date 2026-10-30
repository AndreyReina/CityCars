/** Valida importes, kilometraje y fechas sin acceder a PostgreSQL.
 * Capa: Servicio. Extracción del módulo de flota; conserva reglas y transacciones. */
import { exigir } from './reglas.js';
export const num = (v, label, max = 10000000) => {
  const n = Number(v);
  exigir(
    v !== '' && v != null && Number.isFinite(n) && n >= 0 && n <= max,
    400,
    label + ' inválido.',
  );
  return n;
};
export const km = (v) => {
  const n = num(v, 'Kilometraje');
  exigir(Number.isInteger(n), 400, 'Usa kilómetros enteros.');
  return n;
};
export const day = (v) => {
  exigir(
    typeof v === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      Number.isFinite(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    400,
    'Fecha inválida.',
  );
  return v;
};
