/**
 * Consulta disponibilidad, verifica propietario e imágenes y persiste publicaciones con bloqueo transaccional.
 * Capa: Modelo / persistencia.
 * Relación: ../servicios/horariosAlquiler.js, ../servicios/imagenesVehiculo.js, ../configuracion/conexion.js, ../servicios/reglas.js
 */
import { validarHorarios, validarRecogidaFutura } from '../servicios/horariosAlquiler.js';
import { validarPropiedadImagenes } from '../servicios/imagenesVehiculo.js';
import { pool, enTransaccion } from '../configuracion/conexion.js';
import { exigir, hoy } from '../servicios/reglas.js';
export class Vehiculo {
  static async listar({
    city = '',
    start: inicio = '',
    end: fin = '',
    startTime: horaRecogida,
    endTime: horaDevolucion,
    ownerId: idPropietario = null,
    admin = false,
  } = {}) {
    const times = validarHorarios(horaRecogida, horaDevolucion);
    if (inicio && fin) validarRecogidaFutura(inicio, times[0]);
    const values = [];
    const clauses = [];
    const add = (v) => {
      values.push(v);
      return '$' + values.length;
    };
    if (idPropietario) clauses.push('v.owner_id=' + add(idPropietario));
    else if (!admin)
      clauses.push(
        "v.status='APROBADO' AND NOT v.blocked AND NOT u.suspended AND NOT v.paused AND NOT v.archived AND NOT vehicle_document_blocked(v.id,current_date)",
      );
    if (!idPropietario && !admin) {
      const through = fin
        ? add(fin) + (times[1] && times[1] !== '00:00' ? '::date' : '::date - 1')
        : 'current_date';
      clauses.push('NOT vehicle_document_blocked(v.id,' + through + ')');
      const first = inicio ? add(inicio) + '::date' : 'current_date',
        last = fin
          ? add(fin) + '::date' + (times[1] ? '+' + add(times[1]) + '::time' : '')
          : 'current_date + 1';
      clauses.push(
        "NOT EXISTS(SELECT 1 FROM maintenance m WHERE m.vehicle_id=v.id AND m.status='PROGRAMADO' AND m.start_date<" +
          last +
          ' AND m.end_date>' +
          first +
          ')',
      );
    }
    if (city)
      clauses.push('lower(unaccent(trim(v.city)))=lower(unaccent(trim(' + add(city) + ')))');
    if (inicio && fin)
      clauses.push(
        "NOT EXISTS(SELECT 1 FROM reservations r WHERE r.vehicle_id=v.id AND r.status='CONFIRMADA' AND r.start_date<" +
          add(fin) +
          '::date AND r.end_date>' +
          add(inicio) +
          '::date)',
      );
    if (inicio && fin && times[0] !== null)
      clauses.push(
        "NOT EXISTS(SELECT 1 FROM reservations r WHERE r.vehicle_id=v.id AND r.status='CONFIRMADA' AND r.start_date+coalesce(r.start_time,'00:00'::time)<" +
          add(fin) +
          '::date+' +
          add(times[1]) +
          "::time AND r.end_date+coalesce(r.end_time,'00:00'::time)>" +
          add(inicio) +
          '::date+' +
          add(times[0]) +
          '::time)',
      );
    return (
      await pool.query(
        (admin
          ? 'SELECT v.*,u.name AS owner_name,u.email AS owner_email,u.suspended AS owner_suspended FROM vehicles v JOIN users u ON u.id=v.owner_id'
          : 'SELECT v.*,(SELECT round(avg(rv.rating),1) FROM reviews rv JOIN reservations rr ON rr.id=rv.reservation_id WHERE rr.vehicle_id=v.id) AS rating,(SELECT count(*)::int FROM reviews rv JOIN reservations rr ON rr.id=rv.reservation_id WHERE rr.vehicle_id=v.id) AS review_count FROM vehicles v JOIN users u ON u.id=v.owner_id') +
          (clauses.length ? ' WHERE ' + clauses.join(' AND ') : '') +
          ' ORDER BY v.id DESC',
        values,
      )
    ).rows;
  }
  static async ciudades({
    start: inicio = '',
    end: fin = '',
    startTime: horaRecogida,
    endTime: horaDevolucion,
  } = {}) {
    // Reutiliza exactamente la disponibilidad y los estados del catálogo.
    const vehicles = await this.listar({
      start: inicio,
      end: fin,
      startTime: horaRecogida,
      endTime: horaDevolucion,
    });
    const unique = new Map();
    for (const { city } of vehicles) {
      const label = city.trim();
      const key = label.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
      if (!unique.has(key)) unique.set(key, label);
    }
    return [...unique.values()].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }
  static async obtener(identificador, cliente = pool, lock = false) {
    return (
      await cliente.query('SELECT * FROM vehicles WHERE id=$1' + (lock ? ' FOR UPDATE' : ''), [
        identificador,
      ])
    ).rows[0];
  }
  /** Consulta la suspensión del propietario; con bloqueo mantiene estable su autorización durante la operación transaccional. */
  static async propietarioHabilitado(idPropietario, cliente = pool, lock = false) {
    const owner = (
      await cliente.query('SELECT suspended FROM users WHERE id=$1' + (lock ? ' FOR SHARE' : ''), [
        idPropietario,
      ])
    ).rows[0];
    return owner && !owner.suspended;
  }
  /** Valida y persiste el nuevo registro. Los modelos devuelven la fila creada; los controladores traducen el resultado a una respuesta HTTP. */
  static async crear(idPropietario, v) {
    return enTransaccion(async (cliente) => {
      await validarPropiedadImagenes(cliente, idPropietario, v);
      exigir(
        await this.propietarioHabilitado(idPropietario, cliente, true),
        403,
        'El propietario está suspendido.',
      );
      return (
        await cliente.query(
          'INSERT INTO vehicles(owner_id,brand,model,year,city,daily_price,description,image,mileage,features,conditions,photos,rtm_required,photo_categories) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *',
          [
            idPropietario,
            v.brand,
            v.model,
            v.year,
            v.city,
            v.daily_price,
            v.description,
            v.image,
            v.mileage ?? null,
            v.features,
            v.conditions,
            JSON.stringify(v.photos),
            v.rtm_required,
            JSON.stringify(v.photo_categories),
          ],
        )
      ).rows[0];
    });
  }
  /** Actualiza un registro autorizado conservando su historia. Vehiculo impide cambios con reservas vigentes y devuelve la publicación a aprobación. */
  static async actualizar(identificador, usuario, v, deactivate = false) {
    return enTransaccion(async (cliente) => {
      const old = await this.obtener(identificador, cliente, true);
      exigir(old, 404, 'Automóvil no encontrado.');
      exigir(old.owner_id === usuario.id, 403, 'Solo puedes gestionar tus automóviles.');
      exigir(
        await this.propietarioHabilitado(usuario.id, cliente, true),
        403,
        'El propietario está suspendido.',
      );
      exigir(!old.blocked, 403, 'Esta publicación está suspendida por administración.');
      exigir(!old.archived, 409, 'La publicación está archivada.');
      if (v) await validarPropiedadImagenes(cliente, usuario.id, v);
      if (v)
        exigir(
          v.mileage === undefined || v.mileage >= old.mileage,
          409,
          'El kilometraje no puede disminuir.',
        );
      const busy = await cliente.query(
        "SELECT id FROM reservations WHERE vehicle_id=$1 AND status='CONFIRMADA' AND end_date>$2",
        [identificador, hoy()],
      );
      exigir(
        !busy.rowCount,
        409,
        'No puedes editar ni desactivar mientras existan reservas confirmadas vigentes o futuras.',
      );
      if (deactivate)
        return (
          await cliente.query("UPDATE vehicles SET status='INACTIVO' WHERE id=$1 RETURNING *", [
            identificador,
          ])
        ).rows[0];
      return (
        await cliente.query(
          "UPDATE vehicles SET brand=$2,model=$3,year=$4,city=$5,daily_price=$6,description=$7,image=$8,mileage=$9,features=$10,conditions=$11,photos=$12,rtm_required=$13,photo_categories=$14,status='PENDIENTE_APROBACION' WHERE id=$1 RETURNING *",
          [
            identificador,
            v.brand,
            v.model,
            v.year,
            v.city,
            v.daily_price,
            v.description,
            v.image,
            v.mileage ?? old.mileage,
            v.features,
            v.conditions,
            JSON.stringify(v.photos),
            v.rtm_required,
            JSON.stringify(v.photo_categories),
          ],
        )
      ).rows[0];
    });
  }
  /** Acepta decisiones sobre publicaciones pendientes. La ruta administrativa utiliza Administracion para conservar auditoría. */
  static async revisar(identificador, status) {
    return enTransaccion(async (cliente) => {
      const v = await this.obtener(identificador, cliente, true);
      exigir(v, 404, 'Automóvil no encontrado.');
      exigir(v.status === 'PENDIENTE_APROBACION', 409, 'Solo se revisan publicaciones pendientes.');
      return (
        await cliente.query('UPDATE vehicles SET status=$2 WHERE id=$1 RETURNING *', [
          identificador,
          status,
        ])
      ).rows[0];
    });
  }
}
