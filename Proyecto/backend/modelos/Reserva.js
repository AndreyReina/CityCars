/**
 * Cotiza y confirma alquileres sin cruces; conserva precios históricos y controla cancelación/finalización.
 * Capa: Modelo / persistencia.
 * Relación: ../servicios/horariosAlquiler.js, ../configuracion/conexion.js, ./Vehiculo.js, ../servicios/reglas.js
 */
import { validarHorarios, validarRecogidaFutura } from '../servicios/horariosAlquiler.js';
import { pool, enTransaccion } from '../configuracion/conexion.js';
import { Vehiculo } from './Vehiculo.js';
import { validarFechas, cotizar, exigir, hoy } from '../servicios/reglas.js';
export class Reserva {
  /** Consulta reservas confirmadas, mantenimientos y vencimientos documentales. Devuelve true solo si el intervalo puede alquilarse; los horarios complementan la exclusión por días. */
  static async disponible(
    cliente,
    idVehiculo,
    inicio,
    fin,
    horaRecogida = null,
    horaDevolucion = null,
  ) {
    return !(
      await cliente.query(
        "SELECT id FROM reservations WHERE vehicle_id=$1 AND status='CONFIRMADA' AND ((start_date<$3 AND end_date>$2) OR (start_date+coalesce(start_time,'00:00'::time)<$3::date+coalesce($5::time,'00:00'::time) AND end_date+coalesce(end_time,'00:00'::time)>$2::date+coalesce($4::time,'00:00'::time))) UNION ALL SELECT id FROM maintenance WHERE vehicle_id=$1 AND status='PROGRAMADO' AND start_date<$3::date+coalesce($5::time,'00:00'::time) AND end_date>$2::date+coalesce($4::time,'00:00'::time) UNION ALL SELECT $1 WHERE vehicle_document_blocked($1,$3::date - CASE WHEN coalesce($5::time,'00:00'::time)>'00:00'::time THEN 0 ELSE 1 END)",
        [idVehiculo, inicio, fin, horaRecogida, horaDevolucion],
      )
    ).rowCount;
  }
  /** Valida fechas, horarios y publicación y devuelve la cotización. Esta consulta no bloquea el vehículo: la confirmación vuelve a verificar disponibilidad. */
  /**
   * @param {number} idVehiculo Publicación consultada.
   * @param {string} inicio Fecha ISO de recogida.
   * @param {string} fin Fecha ISO de devolución, posterior a inicio.
   * @param {string|undefined} horaRecogida HH:mm de Colombia; ambos horarios se omiten en clientes históricos.
   * @param {string|undefined} horaDevolucion HH:mm de Colombia.
   * @returns {Promise<object>} Días, tarifa, total y comisión; no confirma ni bloquea.
   */
  static async previsualizar(idVehiculo, inicio, fin, horaRecogida, horaDevolucion) {
    [horaRecogida, horaDevolucion] = validarHorarios(horaRecogida, horaDevolucion);
    const dias = validarFechas(inicio, fin);
    validarRecogidaFutura(inicio, horaRecogida);
    const v = await Vehiculo.obtener(idVehiculo);
    exigir(
      v &&
        v.status === 'APROBADO' &&
        !v.blocked &&
        !v.paused &&
        !v.archived &&
        (await Vehiculo.propietarioHabilitado(v.owner_id)),
      404,
      'Automóvil no disponible.',
    );
    exigir(
      await this.disponible(pool, idVehiculo, inicio, fin, horaRecogida, horaDevolucion),
      409,
      'El automóvil no está disponible para esas fechas.',
    );
    return cotizar(v.daily_price, dias);
  }
  /** Valida y persiste el nuevo registro. Los modelos devuelven la fila creada; los controladores traducen el resultado a una respuesta HTTP. */
  static async crear(
    usuario,
    {
      vehicleId: idVehiculo,
      start: inicio,
      end: fin,
      payment,
      expectedTotal,
      startTime: horaRecogida,
      endTime: horaDevolucion,
    },
  ) {
    const dias = validarFechas(inicio, fin);
    [horaRecogida, horaDevolucion] = validarHorarios(horaRecogida, horaDevolucion);
    validarRecogidaFutura(inicio, horaRecogida);
    exigir(
      ['APROBADO', 'RECHAZADO'].includes(payment),
      400,
      'Selecciona el resultado del pago simulado.',
    );
    return enTransaccion(async (cliente) => {
      // El bloqueo por vehículo serializa confirmaciones y mantenimiento; la cotización previa no garantiza disponibilidad.
      const v = await Vehiculo.obtener(idVehiculo, cliente, true);
      exigir(
        v &&
          v.status === 'APROBADO' &&
          !v.blocked &&
          !v.paused &&
          !v.archived &&
          (await Vehiculo.propietarioHabilitado(v.owner_id, cliente, true)),
        409,
        'La publicación ya no está disponible.',
      );
      exigir(
        await this.disponible(cliente, idVehiculo, inicio, fin, horaRecogida, horaDevolucion),
        409,
        'Las fechas acaban de ser reservadas. Elige otro período.',
      );
      const q = cotizar(v.daily_price, dias);
      exigir(
        Number.isFinite(Number(expectedTotal)) && Number(expectedTotal) === q.total,
        409,
        'La tarifa cambió. Consulta nuevamente el precio.',
      );
      exigir(
        payment === 'APROBADO',
        402,
        'Pago simulado rechazado. No se confirmó ninguna reserva.',
      );
      return (
        await cliente.query(
          'INSERT INTO reservations(vehicle_id,renter_id,start_date,end_date,daily_price,days,total,commission,start_time,end_time) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
          [
            idVehiculo,
            usuario.id,
            inicio,
            fin,
            q.daily_price,
            dias,
            q.total,
            q.commission,
            horaRecogida,
            horaDevolucion,
          ],
        )
      ).rows[0];
    });
  }
  static async listar(usuario) {
    const filter =
      usuario.role === 'ADMINISTRADOR'
        ? ''
        : usuario.role === 'PROPIETARIO'
          ? ' WHERE v.owner_id=$1'
          : ' WHERE r.renter_id=$1';
    return (
      await pool.query(
        'SELECT r.*,v.brand,v.model,v.city,v.image,v.owner_id,(SELECT rating FROM reviews WHERE reservation_id=r.id) AS review_rating FROM reservations r JOIN vehicles v ON v.id=r.vehicle_id' +
          filter +
          ' ORDER BY r.id DESC',
        filter ? [usuario.id] : [],
      )
    ).rows;
  }
  /** Bloquea la reserva y comprueba titularidad, estado y plazo. Cancelar libera disponibilidad; finalizar exige devolución de kilometraje si hubo entrega. */
  static async cambiarEstado(identificador, usuario, action) {
    return enTransaccion(async (cliente) => {
      const result = await cliente.query(
        'SELECT r.*,v.owner_id FROM reservations r JOIN vehicles v ON v.id=r.vehicle_id WHERE r.id=$1 FOR UPDATE OF r',
        [identificador],
      );
      const r = result.rows[0];
      exigir(r, 404, 'Reserva no encontrada.');
      if (action === 'cancel')
        exigir(
          usuario.role === 'ARRENDATARIO' && r.renter_id === usuario.id,
          403,
          'Solo el arrendatario titular puede cancelar.',
        );
      else
        exigir(
          usuario.role === 'PROPIETARIO' && r.owner_id === usuario.id,
          403,
          'Solo el propietario del automóvil puede finalizar.',
        );
      if (action === 'finish')
        exigir(
          await Vehiculo.propietarioHabilitado(usuario.id, cliente, true),
          403,
          'El propietario está suspendido.',
        );
      exigir(r.status === 'CONFIRMADA', 409, 'La reserva ya no está confirmada.');
      if (action === 'finish')
        exigir(
          r.delivery_km == null || r.return_km != null,
          409,
          'Registra el kilometraje de devolución antes de finalizar.',
        );
      if (action === 'cancel')
        exigir(
          !(await cliente.query('SELECT id FROM financial_entries WHERE reservation_id=$1', [r.id]))
            .rowCount,
          409,
          'Esta reserva tiene un cobro registrado; solicita su revisión a administración.',
        );
      exigir(
        action === 'cancel' ? hoy() < r.start_date : hoy() >= r.end_date,
        409,
        action === 'cancel'
          ? 'Solo puedes cancelar antes del inicio.'
          : 'El período contratado todavía no ha terminado.',
      );
      return (
        await cliente.query('UPDATE reservations SET status=$2 WHERE id=$1 RETURNING *', [
          identificador,
          action === 'cancel' ? 'CANCELADA' : 'FINALIZADA',
        ])
      ).rows[0];
    });
  }
}
