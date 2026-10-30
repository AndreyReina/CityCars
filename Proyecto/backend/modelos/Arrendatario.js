/** Consulta y actualiza datos privados del arrendatario. Capa: Modelo. */
import { pool } from '../configuracion/conexion.js';
import { validarId, exigir, validarTexto } from '../servicios/reglas.js';
import { Vehiculo } from './Vehiculo.js';
export class Arrendatario {
  static async cuenta(usuario, parametros = {}, datos = {}) {
    const [favorites, notifications] = await Promise.all([
      pool.query('SELECT vehicle_id FROM renter_favorites WHERE renter_id=$1', [usuario.id]),
      pool.query(
        'SELECT n.*,v.brand,v.model FROM renter_notifications n JOIN reservations r ON r.id=n.reservation_id JOIN vehicles v ON v.id=r.vehicle_id WHERE n.renter_id=$1 ORDER BY n.id DESC LIMIT 100',
        [usuario.id],
      ),
    ]);
    return {
      favorites: favorites.rows.map((r) => r.vehicle_id),
      notifications: notifications.rows,
    };
  }
  static async cambiarFavorito(usuario, parametros = {}, datos = {}) {
    const idVehiculo = validarId(parametros.id);
    exigir(typeof datos.favorite === 'boolean', 400, 'Selecciona una acción válida.');
    if (datos.favorite) {
      const vehicles = await Vehiculo.listar();
      exigir(
        vehicles.some((v) => v.id === idVehiculo),
        404,
        'El vehículo no está disponible.',
      );
      await pool.query(
        'INSERT INTO renter_favorites(renter_id,vehicle_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [usuario.id, idVehiculo],
      );
    } else
      await pool.query('DELETE FROM renter_favorites WHERE renter_id=$1 AND vehicle_id=$2', [
        usuario.id,
        idVehiculo,
      ]);
    return { ok: true };
  }
  static async leerNotificacion(usuario, parametros = {}, datos = {}) {
    const result = await pool.query(
      'UPDATE renter_notifications SET read_at=coalesce(read_at,now()) WHERE id=$1 AND renter_id=$2 RETURNING id',
      [validarId(parametros.id), usuario.id],
    );
    exigir(result.rowCount, 404, 'Notificación no encontrada.');
    return { ok: true };
  }
  static async actualizarPerfil(usuario, parametros = {}, datos = {}) {
    const name = validarTexto(datos.name, 'Nombre', 2, 100);
    await pool.query('UPDATE users SET name=$1 WHERE id=$2', [name, usuario.id]);
    return { ...usuario, name };
  }
}
