/**
 * Valida solicitudes HTTP de catálogo y publicaciones y delega persistencia a Vehiculo.
 * Capa: Controlador.
 * Relación: ../modelos/Vehiculo.js, ../servicios/reglas.js
 */
import { Vehiculo } from '../modelos/Vehiculo.js';
import {
  validarFechas,
  validarId,
  validarTexto,
  validarVehiculo,
  exigir,
} from '../servicios/reglas.js';
export class ControladorVehiculos {
  static async ciudades(solicitud, respuesta) {
    const {
      start: inicio = '',
      end: fin = '',
      startTime: horaRecogida,
      endTime: horaDevolucion,
    } = solicitud.query;
    if (inicio || fin) validarFechas(inicio, fin);
    respuesta.json(
      await Vehiculo.ciudades({
        start: inicio,
        end: fin,
        startTime: horaRecogida,
        endTime: horaDevolucion,
      }),
    );
  }
  static async catalogo(solicitud, respuesta) {
    const {
      city = '',
      start: inicio = '',
      end: fin = '',
      startTime: horaRecogida,
      endTime: horaDevolucion,
    } = solicitud.query;
    if (inicio || fin) validarFechas(inicio, fin);
    if (city) validarTexto(city, 'Ciudad', 1, 80);
    respuesta.json(
      await Vehiculo.listar({
        city,
        start: inicio,
        end: fin,
        startTime: horaRecogida,
        endTime: horaDevolucion,
      }),
    );
  }
  static async detalle(solicitud, respuesta) {
    const v = await Vehiculo.obtener(validarId(solicitud.params.id));
    exigir(
      v &&
        ((v.status === 'APROBADO' &&
          !v.blocked &&
          !v.paused &&
          !v.archived &&
          (await Vehiculo.propietarioHabilitado(v.owner_id))) ||
          solicitud.user?.id === v.owner_id ||
          solicitud.user?.role === 'ADMINISTRADOR'),
      404,
      'Automóvil no encontrado.',
    );
    respuesta.json(v);
  }
  static async propios(solicitud, respuesta) {
    respuesta.json(await Vehiculo.listar({ ownerId: solicitud.user.id }));
  }
  /** Valida y persiste el nuevo registro. Los modelos devuelven la fila creada; los controladores traducen el resultado a una respuesta HTTP. */
  static async crear(solicitud, respuesta) {
    respuesta
      .status(201)
      .json(await Vehiculo.crear(solicitud.user.id, validarVehiculo(solicitud.body)));
  }
  /** Actualiza un registro autorizado conservando su historia. Vehiculo impide cambios con reservas vigentes y devuelve la publicación a aprobación. */
  static async actualizar(solicitud, respuesta) {
    respuesta.json(
      await Vehiculo.actualizar(
        validarId(solicitud.params.id),
        solicitud.user,
        validarVehiculo(solicitud.body),
      ),
    );
  }
  static async desactivar(solicitud, respuesta) {
    respuesta.json(
      await Vehiculo.actualizar(validarId(solicitud.params.id), solicitud.user, null, true),
    );
  }
  static async todos(solicitud, respuesta) {
    respuesta.json(await Vehiculo.listar({ admin: true }));
  }
  /** Acepta decisiones sobre publicaciones pendientes. La ruta administrativa utiliza Administracion para conservar auditoría. */
  static async revisar(solicitud, respuesta) {
    exigir(['APROBADO', 'RECHAZADO'].includes(solicitud.body.status), 400, 'Decisión no válida.');
    respuesta.json(await Vehiculo.revisar(validarId(solicitud.params.id), solicitud.body.status));
  }
}
