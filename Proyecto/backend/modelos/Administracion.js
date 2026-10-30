/**
 * Agrega indicadores en snapshot consistente y registra decisiones administrativas con auditoría.
 * Capa: Modelo / persistencia.
 * Relación: ../configuracion/conexion.js, ../servicios/reglas.js
 */
import { pool, enTransaccion } from '../configuracion/conexion.js';
import { exigir } from '../servicios/reglas.js';
export class Administracion {
  /** Inserta la decisión y su motivo dentro de la misma transacción que modifica el registro administrado. */
  static async auditar(cliente, idAdministrador, type, idEntidad, action, reason) {
    await cliente.query(
      'INSERT INTO admin_actions(admin_id,entity_type,entity_id,action,reason) VALUES($1,$2,$3,$4,$5)',
      [idAdministrador, type, idEntidad, action, reason],
    );
  }
  /** Consulta los indicadores y registros dentro de una transacción de solo lectura REPEATABLE READ para mantener una fotografía consistente. */
  static async resumen() {
    return enTransaccion(async (cliente) => {
      await cliente.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const query = async (sql) => (await cliente.query(sql)).rows;
      const users = (
        await query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE NOT suspended)::int AS enabled,
        count(*) FILTER (WHERE role='PROPIETARIO')::int AS owners,
        count(*) FILTER (WHERE role='PROPIETARIO' AND suspended)::int AS suspended_owners,
        count(*) FILTER (WHERE NOT suspended AND EXISTS (SELECT 1 FROM sessions s WHERE s.expire > now() AND s.sess->>'userId'=users.id::text))::int AS active_sessions FROM users`)
      )[0];
      const vehicles =
        await query(`SELECT v.*,u.name AS owner_name,u.email AS owner_email,u.suspended AS owner_suspended
        FROM vehicles v JOIN users u ON u.id=v.owner_id ORDER BY v.id DESC`);
      const owners =
        await query(`SELECT u.id,u.name,u.email,u.created_at,u.suspended,u.suspension_reason,
        (SELECT count(*)::int FROM vehicles v WHERE v.owner_id=u.id) AS vehicle_count,
        (SELECT count(*)::int FROM reservations r JOIN vehicles v ON v.id=r.vehicle_id WHERE v.owner_id=u.id AND r.status='CONFIRMADA') AS confirmed_count
        FROM users u WHERE u.role='PROPIETARIO' ORDER BY u.id DESC`);
      const reservations =
        await query(`SELECT r.*,v.brand,v.model,v.city,v.owner_id,u.name AS owner_name,u.email AS owner_email,
        t.name AS renter_name,t.email AS renter_email FROM reservations r JOIN vehicles v ON v.id=r.vehicle_id
        JOIN users u ON u.id=v.owner_id JOIN users t ON t.id=r.renter_id ORDER BY r.id DESC`);
      const finance = (
        await query(`SELECT
        coalesce(sum(total) FILTER (WHERE status='FINALIZADA'),0) AS completed_total,
        coalesce(sum(commission) FILTER (WHERE status='FINALIZADA'),0) AS completed_commission,
        coalesce(sum(total) FILTER (WHERE status='CONFIRMADA'),0) AS confirmed_total,
        coalesce(sum(commission) FILTER (WHERE status='CONFIRMADA'),0) AS confirmed_commission,
        coalesce(sum(total) FILTER (WHERE status='CANCELADA'),0) AS cancelled_total FROM reservations`)
      )[0];
      const months =
        await query(`SELECT to_char(m,'YYYY-MM') AS month, count(r.id)::int AS reservations,
        coalesce(sum(r.total) FILTER (WHERE r.status!='CANCELADA'),0) AS total,
        coalesce(sum(r.commission) FILTER (WHERE r.status!='CANCELADA'),0) AS commission
        FROM generate_series(date_trunc('month',now() AT TIME ZONE 'America/Bogota')-interval '5 months',
        date_trunc('month',now() AT TIME ZONE 'America/Bogota'),interval '1 month') m
        LEFT JOIN reservations r ON date_trunc('month',r.created_at AT TIME ZONE 'America/Bogota')=m
        GROUP BY m ORDER BY m`);
      const incidents = await query(
        `SELECT i.*,u.name AS author_name FROM incidents i JOIN users u ON u.id=i.created_by ORDER BY i.id DESC`,
      );
      const actions = await query(
        `SELECT a.*,u.name AS admin_name FROM admin_actions a JOIN users u ON u.id=a.admin_id ORDER BY a.id DESC LIMIT 100`,
      );
      const documents = await query('SELECT * FROM vehicle_documents ORDER BY id DESC');
      const messages = await query(
        'SELECT m.*,u.name AS author_name,u.role AS author_role FROM incident_messages m JOIN users u ON u.id=m.author_id ORDER BY m.id',
      );
      const entries = await query('SELECT * FROM financial_entries ORDER BY id DESC');
      return {
        users,
        vehicles,
        owners,
        reservations,
        finance,
        months,
        incidents,
        actions,
        documents,
        messages,
        entries,
      };
    });
  }
  /** Bloquea la fila del propietario o publicación, valida el cambio y registra la decisión administrativa con motivo. */
  static async restringir(idAdministrador, type, idEntidad, restricted, reason) {
    return enTransaccion(async (cliente) => {
      const owner = type === 'PROPIETARIO';
      const table = owner ? 'users' : 'vehicles';
      const record = (
        await cliente.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`, [idEntidad])
      ).rows[0];
      exigir(record && (!owner || record.role === 'PROPIETARIO'), 404, 'Registro no encontrado.');
      const field = owner ? 'suspended' : 'blocked';
      exigir(record[field] !== restricted, 409, 'El estado ya cambió. Actualiza el panel.');
      await cliente.query(
        `UPDATE ${table} SET ${field}=$2,${owner ? 'suspension_reason' : 'block_reason'}=$3 WHERE id=$1`,
        [idEntidad, restricted, restricted ? reason : ''],
      );
      await this.auditar(
        cliente,
        idAdministrador,
        type,
        idEntidad,
        restricted ? 'SUSPENDER' : 'REACTIVAR',
        reason,
      );
      return { ok: true };
    });
  }
  /** Acepta decisiones sobre publicaciones pendientes. La ruta administrativa utiliza Administracion para conservar auditoría. */
  static async revisar(idAdministrador, idVehiculo, status) {
    return enTransaccion(async (cliente) => {
      const v = (
        await cliente.query('SELECT status FROM vehicles WHERE id=$1 FOR UPDATE', [idVehiculo])
      ).rows[0];
      exigir(v, 404, 'Automóvil no encontrado.');
      exigir(v.status === 'PENDIENTE_APROBACION', 409, 'Solo se revisan publicaciones pendientes.');
      const result = (
        await cliente.query('UPDATE vehicles SET status=$2 WHERE id=$1 RETURNING *', [
          idVehiculo,
          status,
        ])
      ).rows[0];
      await this.auditar(
        cliente,
        idAdministrador,
        'PUBLICACION',
        idVehiculo,
        status,
        'Revisión de publicación',
      );
      return result;
    });
  }
  static async crearIncidencia(idAdministrador, data) {
    return enTransaccion(async (cliente) => {
      if (data.vehicleId)
        exigir(
          (await cliente.query('SELECT id FROM vehicles WHERE id=$1', [data.vehicleId])).rowCount,
          404,
          'Automóvil no encontrado.',
        );
      if (data.ownerId)
        exigir(
          (
            await cliente.query("SELECT id FROM users WHERE id=$1 AND role='PROPIETARIO'", [
              data.ownerId,
            ])
          ).rowCount,
          404,
          'Propietario no encontrado.',
        );
      if (data.vehicleId && data.ownerId)
        exigir(
          (
            await cliente.query('SELECT id FROM vehicles WHERE id=$1 AND owner_id=$2', [
              data.vehicleId,
              data.ownerId,
            ])
          ).rowCount,
          400,
          'El vehículo no pertenece a ese propietario.',
        );
      if (data.vehicleId && !data.ownerId)
        data.ownerId = (
          await cliente.query('SELECT owner_id FROM vehicles WHERE id=$1', [data.vehicleId])
        ).rows[0].owner_id;
      const incident = (
        await cliente.query(
          'INSERT INTO incidents(created_by,vehicle_id,owner_id,title,description,priority) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
          [
            idAdministrador,
            data.vehicleId,
            data.ownerId,
            data.title,
            data.description,
            data.priority,
          ],
        )
      ).rows[0];
      await this.auditar(cliente, idAdministrador, 'INCIDENCIA', incident.id, 'CREAR', data.title);
      return incident;
    });
  }
  static async actualizarIncidencia(idAdministrador, idIncidencia, status, resolution) {
    return enTransaccion(async (cliente) => {
      const result = await cliente.query(
        'UPDATE incidents SET status=$2,resolution=$3,updated_at=now() WHERE id=$1 RETURNING *',
        [idIncidencia, status, resolution],
      );
      exigir(result.rowCount, 404, 'Incidencia no encontrada.');
      await cliente.query(
        'INSERT INTO incident_messages(incident_id,author_id,body) VALUES($1,$2,$3)',
        [idIncidencia, idAdministrador, status + ': ' + resolution],
      );
      await this.auditar(cliente, idAdministrador, 'INCIDENCIA', idIncidencia, status, resolution);
      return result.rows[0];
    });
  }
}
