/**
 * Accede a usuarios con SQL parametrizado; distingue consulta de autenticación de respuesta pública sin hash.
 * Capa: Modelo / persistencia.
 * Relación: ../configuracion/conexion.js
 */
import { pool } from '../configuracion/conexion.js';
export class Usuario {
  /** Devuelve el usuario para autenticarlo, incluido su hash. Este resultado no debe enviarse directamente al navegador. */
  static async buscarPorCorreo(email) {
    return (await pool.query('SELECT * FROM users WHERE email=$1', [email])).rows[0];
  }
  /** Devuelve únicamente datos de identidad y suspensión; excluye el hash de contraseña de la sesión pública. */
  static async buscarPorId(identificador) {
    return (
      await pool.query(
        'SELECT id,name,email,role,suspended,suspension_reason FROM users WHERE id=$1',
        [identificador],
      )
    ).rows[0];
  }
  /** Valida y persiste el nuevo registro. Los modelos devuelven la fila creada; los controladores traducen el resultado a una respuesta HTTP. */
  static async crear({ name, email, password_hash, role }) {
    return (
      await pool.query(
        'INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,name,email,role',
        [name, email, password_hash, role],
      )
    ).rows[0];
  }
}
