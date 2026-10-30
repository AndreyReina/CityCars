/** Consulta y persiste la flota, archivos, incidencias y movimientos.
 * Capa: Modelo. Extracción del módulo de flota; conserva reglas y transacciones. */
import { pool, enTransaccion } from '../configuracion/conexion.js';
import { validarId, validarTexto, exigir, hoy } from '../servicios/reglas.js';
import { num, km, day } from '../servicios/reglasFlota.js';
import { validarAdjunto } from '../servicios/archivos.js';
import { Vehiculo } from './Vehiculo.js';
const optionalId = (v) => (v ? validarId(v) : null);
/** Bloquea el vehículo y verifica titularidad y suspensión antes de ejecutar una operación de flota. */
async function owned(c, usuario, vid) {
  const v = await Vehiculo.obtener(validarId(vid), c, true);
  exigir(v && v.owner_id === usuario.id, 404, 'Vehículo no encontrado.');
  exigir(
    await Vehiculo.propietarioHabilitado(usuario.id, c, true),
    403,
    'El propietario está suspendido.',
  );
  return v;
}
/** Valida que el adjunto exista y pertenezca al autor; devuelve null cuando no se proporcionó archivo. */
async function file(c, idPropietario, fid) {
  if (!fid) return null;
  exigir(
    (
      await c.query('SELECT id FROM fleet_files WHERE id=$1 AND owner_id=$2', [
        validarId(fid),
        idPropietario,
      ])
    ).rowCount,
    404,
    'Adjunto no encontrado.',
  );
  return validarId(fid);
}

export class Flota {
  static async resumen(usuario, parametros = {}, datos = {}) {
    const uid = usuario.id;
    const result = await enTransaccion(async (c) => {
      await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const q = async (sql) => (await c.query(sql, [uid])).rows;
      const vehicles = await q(
        'SELECT v.*, vehicle_document_blocked(v.id,current_date) AS document_blocked FROM vehicles v WHERE owner_id=$1 ORDER BY id DESC',
      );
      const reservations = await q(
        `SELECT r.*,u.name AS renter_name,v.brand,v.model FROM reservations r JOIN vehicles v ON v.id=r.vehicle_id JOIN users u ON u.id=r.renter_id WHERE v.owner_id=$1 ORDER BY r.id DESC`,
      );
      const documents = await q(
        'SELECT d.* FROM vehicle_documents d JOIN vehicles v ON v.id=d.vehicle_id WHERE v.owner_id=$1 ORDER BY d.id DESC',
      );
      const maintenance = await q(
        'SELECT m.* FROM maintenance m JOIN vehicles v ON v.id=m.vehicle_id WHERE v.owner_id=$1 ORDER BY m.due_date DESC,m.id DESC',
      );
      const reviews = await q(
        'SELECT x.*,r.vehicle_id,u.name AS renter_name FROM reviews x JOIN reservations r ON r.id=x.reservation_id JOIN vehicles v ON v.id=r.vehicle_id JOIN users u ON u.id=r.renter_id WHERE v.owner_id=$1 ORDER BY x.id DESC',
      );
      const entries = await q(
        'SELECT e.*,r.vehicle_id FROM financial_entries e JOIN reservations r ON r.id=e.reservation_id JOIN vehicles v ON v.id=r.vehicle_id WHERE v.owner_id=$1 ORDER BY e.paid_on DESC,e.id DESC',
      );
      const incidents = await q('SELECT * FROM incidents WHERE owner_id=$1 ORDER BY id DESC');
      const messages = await q(
        'SELECT m.*,u.name AS author_name,u.role AS author_role FROM incident_messages m JOIN incidents i ON i.id=m.incident_id JOIN users u ON u.id=m.author_id WHERE i.owner_id=$1 ORDER BY m.id',
      );
      const events = await q('SELECT * FROM fleet_events WHERE owner_id=$1 ORDER BY id DESC');
      return {
        vehicles,
        reservations,
        documents,
        maintenance,
        reviews,
        entries,
        incidents,
        messages,
        events,
        today: hoy(),
      };
    });
    return result;
  }
  static async leerEvento(usuario, parametros = {}, datos = {}) {
    const r = await pool.query(
      'UPDATE fleet_events SET read_at=now() WHERE id=$1 AND owner_id=$2 RETURNING id',
      [validarId(parametros.id), usuario.id],
    );
    exigir(r.rowCount, 404, 'Notificación no encontrada.');
    return { ok: true };
  }
  static async cambiarEstadoVehiculo(usuario, parametros = {}, datos = {}) {
    return enTransaccion(async (c) => {
      const v = await owned(c, usuario, parametros.id),
        action = datos.action;
      exigir(
        ['PAUSAR', 'REACTIVAR', 'ARCHIVAR', 'DESARCHIVAR'].includes(action),
        400,
        'Acción inválida.',
      );
      if (action === 'DESARCHIVAR') {
        exigir(v.archived, 409, 'La publicación no está archivada.');
        return (
          await c.query('UPDATE vehicles SET archived=false,paused=true WHERE id=$1 RETURNING *', [
            v.id,
          ])
        ).rows[0];
      }
      exigir(!v.archived, 409, 'La publicación está archivada.');
      if (action === 'ARCHIVAR') {
        const pending = await c.query(
          `SELECT 1 FROM reservations WHERE vehicle_id=$1 AND status='CONFIRMADA' UNION ALL SELECT 1 FROM incidents WHERE vehicle_id=$1 AND status NOT IN ('RESUELTA','CERRADA') UNION ALL SELECT 1 FROM maintenance WHERE vehicle_id=$1 AND status='PROGRAMADO'`,
          [v.id],
        );
        exigir(
          !pending.rowCount,
          409,
          'Resuelve las reservas, mantenimientos y casos pendientes antes de archivar.',
        );
        const debt = await c.query(
          `SELECT r.id FROM reservations r WHERE r.vehicle_id=$1 AND EXISTS(SELECT 1 FROM financial_entries e WHERE e.reservation_id=r.id AND e.kind='COBRO') AND coalesce((SELECT sum(amount) FROM financial_entries WHERE reservation_id=r.id AND kind='DESEMBOLSO'),0)<r.total-r.commission`,
          [v.id],
        );
        exigir(!debt.rowCount, 409, 'Existen desembolsos pendientes.');
      } else if (action === 'REACTIVAR') {
        exigir(
          v.status === 'APROBADO' && !v.blocked,
          409,
          'La publicación debe estar aprobada y sin sanciones.',
        );
        const conflict = await c.query(
          `SELECT 1 WHERE vehicle_document_blocked($1,current_date) OR EXISTS(SELECT 1 FROM maintenance WHERE vehicle_id=$1 AND status='PROGRAMADO' AND start_date<=current_date AND end_date>current_date)`,
          [v.id],
        );
        exigir(
          !conflict.rowCount,
          409,
          'Revisa los documentos vencidos o el mantenimiento actual.',
        );
      }
      return (
        await c.query('UPDATE vehicles SET paused=$2,archived=$3 WHERE id=$1 RETURNING *', [
          v.id,
          action !== 'REACTIVAR',
          action === 'ARCHIVAR',
        ])
      ).rows[0];
    });
  }
  static async registrarDocumento(usuario, parametros = {}, datos = {}) {
    return enTransaccion(async (c) => {
      const b = datos,
        v = await owned(c, usuario, b.vehicleId);
      exigir(['SOAT', 'RTM'].includes(b.kind), 400, 'Documento inválido.');
      const fid = await file(c, usuario.id, b.fileId);
      return (
        await c.query(
          'INSERT INTO vehicle_documents(vehicle_id,kind,expires_on,file_id) VALUES($1,$2,$3,$4) RETURNING *',
          [v.id, b.kind, day(b.expiresOn), fid],
        )
      ).rows[0];
    });
  }
  static async registrarMantenimiento(usuario, parametros = {}, datos = {}) {
    return enTransaccion(async (c) => {
      const b = datos,
        v = await owned(c, usuario, b.vehicleId);
      const inicio = b.start ? day(b.start) : null,
        fin = b.end ? day(b.end) : null;
      exigir(
        (!inicio && !fin) || (inicio && fin && fin > inicio),
        400,
        'El bloqueo necesita inicio y fin posterior.',
      );
      if (inicio) {
        exigir(inicio >= hoy(), 400, 'El bloqueo no puede comenzar en el pasado.');
        exigir(
          !(
            await c.query(
              "SELECT id FROM reservations WHERE vehicle_id=$1 AND status='CONFIRMADA' AND start_date+coalesce(start_time,'00:00'::time)<$3::date AND end_date+coalesce(end_time,'00:00'::time)>$2::date",
              [v.id, inicio, fin],
            )
          ).rowCount,
          409,
          'El mantenimiento coincide con una reserva confirmada.',
        );
      }
      exigir(!v.archived, 409, 'El vehículo está archivado.');
      exigir(
        b.status === undefined || ['PROGRAMADO', 'COMPLETADO'].includes(b.status),
        400,
        'Estado inválido.',
      );
      const status = b.status === 'COMPLETADO' ? 'COMPLETADO' : 'PROGRAMADO';
      const done = status === 'COMPLETADO' ? day(b.completedDate) : null;
      if (done) exigir(done <= hoy(), 400, 'La fecha realizada no puede ser futura.');
      const mileage = b.mileage == null || b.mileage === '' ? null : km(b.mileage);
      const cost = num(b.cost ?? 0, 'Costo', 1000000000);
      exigir(
        Math.abs(cost * 100 - Math.round(cost * 100)) < 0.00001,
        400,
        'Usa dos decimales como máximo.',
      );
      return (
        await c.query(
          `INSERT INTO maintenance(vehicle_id,kind,description,due_date,due_km,start_date,end_date,status,completed_date,mileage,cost,file_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
          [
            v.id,
            validarTexto(b.kind, 'Tipo', 2, 80),
            validarTexto(b.description, 'Descripción', 5, 2000),
            day(b.dueDate),
            b.dueKm == null || b.dueKm === '' ? null : km(b.dueKm),
            inicio,
            fin,
            status,
            done,
            mileage,
            cost,
            await file(c, usuario.id, b.fileId),
          ],
        )
      ).rows[0];
    });
  }
  static async cerrarMantenimiento(usuario, parametros = {}, datos = {}) {
    return enTransaccion(async (c) => {
      const before = (
        await c.query('SELECT * FROM maintenance WHERE id=$1', [validarId(parametros.id)])
      ).rows[0];
      exigir(before, 404, 'Mantenimiento no encontrado.');
      await owned(c, usuario, before.vehicle_id);
      const m = (await c.query('SELECT * FROM maintenance WHERE id=$1 FOR UPDATE', [before.id]))
        .rows[0];
      exigir(m.status === 'PROGRAMADO', 409, 'El mantenimiento ya se cerró.');
      const b = datos;
      exigir(['COMPLETADO', 'CANCELADO'].includes(b.status), 400, 'Estado inválido.');
      const completed = b.status === 'COMPLETADO';
      const d = completed ? day(b.completedDate) : null;
      if (d) exigir(d <= hoy(), 400, 'La fecha no puede ser futura.');
      return (
        await c.query(
          'UPDATE maintenance SET status=$2,completed_date=$3,mileage=$4,cost=$5,file_id=coalesce($6,file_id) WHERE id=$1 RETURNING *',
          [
            m.id,
            b.status,
            d,
            completed ? km(b.mileage) : null,
            completed ? num(b.cost, 'Costo', 1000000000) : 0,
            await file(c, usuario.id, b.fileId),
          ],
        )
      ).rows[0];
    });
  }
  static async registrarKilometraje(usuario, parametros = {}, datos = {}) {
    return enTransaccion(async (c) => {
      const r0 = (
        await c.query('SELECT * FROM reservations WHERE id=$1', [validarId(parametros.id)])
      ).rows[0];
      exigir(r0, 404, 'Reserva no encontrada.');
      const v = await owned(c, usuario, r0.vehicle_id);
      const r = (await c.query('SELECT * FROM reservations WHERE id=$1 FOR UPDATE', [r0.id]))
        .rows[0];
      exigir(r.status === 'CONFIRMADA', 409, 'La reserva debe estar confirmada.');
      exigir(hoy() >= r.start_date, 409, 'El alquiler aún no comienza.');
      const n = km(datos.mileage),
        returning = datos.phase === 'DEVOLUCION';
      exigir(['ENTREGA', 'DEVOLUCION'].includes(datos.phase), 400, 'Operación inválida.');
      exigir(n >= v.mileage, 409, 'El kilometraje no puede disminuir respecto del vehículo.');
      if (returning)
        exigir(
          r.delivery_km != null && r.return_km == null && n >= r.delivery_km,
          409,
          'Registra primero la entrega; la devolución no puede repetirse ni disminuir.',
        );
      else {
        exigir(
          r.delivery_km == null && hoy() < r.end_date,
          409,
          'Entrega ya registrada o período terminado.',
        );
        exigir(
          !(
            await c.query(
              "SELECT id FROM reservations WHERE vehicle_id=$1 AND id<>$2 AND delivery_km IS NOT NULL AND return_km IS NULL AND status='CONFIRMADA'",
              [v.id, r.id],
            )
          ).rowCount,
          409,
          'Hay otro alquiler sin devolución.',
        );
      }
      const field = returning ? 'return_km' : 'delivery_km',
        stamp = returning ? 'returned_at' : 'delivered_at';
      await c.query(`UPDATE reservations SET ${field}=$2,${stamp}=now() WHERE id=$1`, [r.id, n]);
      await c.query('UPDATE vehicles SET mileage=$2 WHERE id=$1', [v.id, n]);
      return { ok: true };
    });
  }
  static async crearResena(usuario, parametros = {}, datos = {}) {
    return enTransaccion(async (c) => {
      const r = (
        await c.query('SELECT * FROM reservations WHERE id=$1 AND renter_id=$2 FOR UPDATE', [
          validarId(parametros.id),
          usuario.id,
        ])
      ).rows[0];
      exigir(r, 404, 'Reserva no encontrada.');
      exigir(r.status === 'FINALIZADA', 409, 'Solo puedes valorar alquileres finalizados.');
      exigir(
        !(await c.query('SELECT id FROM reviews WHERE reservation_id=$1', [r.id])).rowCount,
        409,
        'Ya valoraste este alquiler.',
      );
      const rating = Number(datos.rating);
      exigir(Number.isInteger(rating) && rating >= 1 && rating <= 5, 400, 'Califica de 1 a 5.');
      return (
        await c.query(
          'INSERT INTO reviews(reservation_id,rating,comment,recommendation) VALUES($1,$2,$3,$4) RETURNING *',
          [
            r.id,
            rating,
            validarTexto(datos.comment, 'Comentario', 5, 2000),
            datos.recommendation ? validarTexto(datos.recommendation, 'Sugerencia', 1, 1000) : '',
          ],
        )
      ).rows[0];
    });
  }
  static async crearIncidencia(usuario, parametros = {}, datos = {}) {
    return enTransaccion(async (c) => {
      const b = datos,
        vid = optionalId(b.vehicleId),
        rid = optionalId(b.reservationId);
      if (vid) await owned(c, usuario, vid);
      if (rid)
        exigir(
          (
            await c.query(
              'SELECT r.id FROM reservations r JOIN vehicles v ON v.id=r.vehicle_id WHERE r.id=$1 AND v.owner_id=$2 AND r.vehicle_id=$3',
              [rid, usuario.id, vid],
            )
          ).rowCount,
          404,
          'La reserva no corresponde al vehículo.',
        );
      const kinds = [
        'RESERVA',
        'ARRENDATARIO',
        'DANO',
        'ACCIDENTE',
        'INCUMPLIMIENTO',
        'TECNICO',
        'QUEJA',
        'RECLAMACION',
        'GENERAL',
      ];
      exigir(kinds.includes(b.kind), 400, 'Tipo inválido.');
      exigir(['BAJA', 'MEDIA', 'ALTA'].includes(b.priority), 400, 'Prioridad inválida.');
      return (
        await c.query(
          'INSERT INTO incidents(created_by,owner_id,vehicle_id,reservation_id,kind,title,description,priority,file_id) VALUES($1,$1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
          [
            usuario.id,
            vid,
            rid,
            b.kind,
            validarTexto(b.title, 'Título', 5, 160),
            validarTexto(b.description, 'Descripción', 10, 4000),
            b.priority,
            await file(c, usuario.id, b.fileId),
          ],
        )
      ).rows[0];
    });
  }
  static async enviarMensaje(usuario, parametros = {}, datos = {}) {
    return enTransaccion(async (c) => {
      const i = (
        await c.query('SELECT * FROM incidents WHERE id=$1 FOR UPDATE', [validarId(parametros.id)])
      ).rows[0];
      exigir(
        i && (usuario.role === 'ADMINISTRADOR' || i.owner_id === usuario.id),
        404,
        'Caso no encontrado.',
      );
      exigir(
        !['RESUELTA', 'CERRADA'].includes(i.status),
        409,
        'Este caso está cerrado. Crea un nuevo reporte si es necesario.',
      );
      return (
        await c.query(
          'INSERT INTO incident_messages(incident_id,author_id,body,file_id) VALUES($1,$2,$3,$4) RETURNING *',
          [
            i.id,
            usuario.id,
            validarTexto(datos.body, 'Mensaje', 2, 4000),
            await file(c, usuario.id, datos.fileId),
          ],
        )
      ).rows[0];
    });
  }
  static async guardarArchivo(usuario, parametros = {}, datos = {}) {
    const { name, mime, content } = datos;
    const bytes = validarAdjunto(content, mime);
    const saved = await enTransaccion(async (c) => {
      await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [usuario.id]);
      const used = (
        await c.query(
          'SELECT coalesce(sum(octet_length(content)),0)::bigint AS size FROM fleet_files WHERE owner_id=$1',
          [usuario.id],
        )
      ).rows[0];
      exigir(
        Number(used.size) + bytes.length <= 104857600,
        400,
        'Has alcanzado el límite de 100 MB de adjuntos.',
      );
      return (
        await c.query(
          'INSERT INTO fleet_files(owner_id,name,mime,content) VALUES($1,$2,$3,$4) RETURNING id,name',
          [usuario.id, validarTexto(name, 'Nombre', 1, 180), mime, bytes],
        )
      ).rows[0];
    });
    return saved;
  }
  static async obtenerArchivo(usuario, parametros = {}, datos = {}) {
    const f = (
      await pool.query('SELECT * FROM fleet_files WHERE id=$1', [validarId(parametros.id)])
    ).rows[0];
    const shared =
      f &&
      usuario.role === 'PROPIETARIO' &&
      (
        await pool.query(
          'SELECT 1 FROM incident_messages m JOIN incidents i ON i.id=m.incident_id WHERE m.file_id=$1 AND i.owner_id=$2',
          [f.id, usuario.id],
        )
      ).rowCount;
    exigir(
      f && (usuario.role === 'ADMINISTRADOR' || f.owner_id === usuario.id || shared),
      404,
      'Adjunto no encontrado.',
    );
    return f;
  }
  static async registrarMovimiento(usuario, parametros = {}, datos = {}) {
    return enTransaccion(async (c) => {
      const b = datos,
        r = (
          await c.query('SELECT * FROM reservations WHERE id=$1 FOR UPDATE', [
            validarId(b.reservationId),
          ])
        ).rows[0];
      exigir(r, 404, 'Reserva no encontrada.');
      exigir(['COBRO', 'DESEMBOLSO'].includes(b.kind), 400, 'Tipo inválido.');
      exigir(r.status !== 'CANCELADA', 409, 'No registres pagos de reservas canceladas.');
      const amount = num(b.amount, 'Importe', 1000000000);
      exigir(
        amount > 0 && Math.abs(amount * 100 - Math.round(amount * 100)) < 0.00001,
        400,
        'Importe inválido.',
      );
      const entries = (
        await c.query(
          'SELECT kind,sum(amount) AS amount FROM financial_entries WHERE reservation_id=$1 GROUP BY kind',
          [r.id],
        )
      ).rows;
      const sum = (k) => Math.round(Number(entries.find((e) => e.kind === k)?.amount || 0) * 100);
      const cents = Math.round(amount * 100),
        total = Math.round(Number(r.total) * 100),
        commission = Math.round(Number(r.commission) * 100);
      if (b.kind === 'COBRO')
        exigir(sum('COBRO') + cents <= total, 409, 'El cobro excede el total del alquiler.');
      else
        exigir(
          r.status === 'FINALIZADA' &&
            sum('COBRO') === total &&
            sum('DESEMBOLSO') + cents <= total - commission,
          409,
          'El desembolso exige alquiler finalizado y cobro completo, y no puede exceder el neto.',
        );
      const paid = day(b.paidOn);
      exigir(paid <= hoy(), 400, 'El pago no puede estar en el futuro.');
      const reference = validarTexto(b.reference, 'Referencia comprobable', 5, 180);
      exigir(
        !(await c.query('SELECT id FROM financial_entries WHERE reference=$1', [reference]))
          .rowCount,
        409,
        'Referencia ya registrada.',
      );
      return (
        await c.query(
          'INSERT INTO financial_entries(reservation_id,kind,amount,reference,paid_on,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
          [r.id, b.kind, amount, reference, paid, usuario.id],
        )
      ).rows[0];
    });
  }
}
