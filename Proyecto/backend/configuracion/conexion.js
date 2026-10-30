/**
 * Configura pg y fechas de Colombia; encapsula transacciones con commit, rollback y liberación de conexión.
 * Capa: Infraestructura.
 * Relación: pg
 */
import pg from 'pg';
pg.types.setTypeParser(1082, (value) => value);
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  options: '-c timezone=America/Bogota',
});
/** Ejecuta una operación con una conexión reservada. Confirma si termina correctamente, revierte ante cualquier error y siempre libera la conexión. */
/**
 * @param {(cliente: import("pg").PoolClient) => Promise<unknown>} operacion Trabajo con la conexión bloqueada para la transacción.
 * @returns {Promise<unknown>} Resultado de la operación tras COMMIT; propaga el error tras ROLLBACK.
 */
export async function enTransaccion(operacion) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const result = await operacion(cliente);
    await cliente.query('COMMIT');
    return result;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}
