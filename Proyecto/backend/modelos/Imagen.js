/** Guarda fotos, aplica cuotas y consulta imágenes autorizadas. Capa: Modelo. */
import { pool, enTransaccion } from '../configuracion/conexion.js';
import { validarId, exigir } from '../servicios/reglas.js';
export class Imagen {
  static async guardar(idPropietario, result) {
    const row = await enTransaccion(async (c) => {
      await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [idPropietario]);
      const usage = (
        await c.query(
          'SELECT coalesce(sum(octet_length(content)),0) AS bytes FROM vehicle_images WHERE owner_id=$1',
          [idPropietario],
        )
      ).rows[0];
      exigir(
        Number(usage.bytes) + result.length <= 104857600,
        400,
        'Has alcanzado el límite de 100 MB de fotografías.',
      );
      return (
        await c.query('INSERT INTO vehicle_images(owner_id,content) VALUES($1,$2) RETURNING id', [
          idPropietario,
          result,
        ])
      ).rows[0];
    });
    return row;
  }
  static async obtener(identificador, usuario) {
    const imageId = validarId(identificador),
      url = '/api/vehicle-images/' + imageId;
    const row = (
      await pool.query(
        `SELECT i.content FROM vehicle_images i WHERE i.id=$1 AND (
 i.owner_id=$2 OR $3::boolean OR EXISTS(SELECT 1 FROM vehicles v JOIN users u ON u.id=v.owner_id
 WHERE (v.image=$4 OR v.photos @> jsonb_build_array($4::text)) AND v.status='APROBADO' AND NOT v.blocked AND NOT v.paused AND NOT v.archived AND NOT u.suspended))`,
        [imageId, usuario?.id || null, usuario?.role === 'ADMINISTRADOR', url],
      )
    ).rows[0];
    exigir(row, 404, 'Imagen no encontrada.');
    return row;
  }
  static async perteneceA(cliente, idImagen, idPropietario) {
    return (
      await cliente.query('SELECT id FROM vehicle_images WHERE id=$1 AND owner_id=$2', [
        idImagen,
        idPropietario,
      ])
    ).rowCount;
  }
}
