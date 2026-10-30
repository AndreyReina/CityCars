/**
 * Coordina cotización, creación, listado y transiciones de reservas con el modelo Reserva.
 * Capa: Controlador.
 * Relación: ../modelos/Reserva.js, ../servicios/reglas.js
 */
import { Reserva } from '../modelos/Reserva.js';
import { validarId } from '../servicios/reglas.js';
export class ControladorReservas {
  /** Valida fechas, horarios y publicación y devuelve la cotización. Esta consulta no bloquea el vehículo: la confirmación vuelve a verificar disponibilidad. */
  static async previsualizar(solicitud, respuesta) {
    respuesta.json(
      await Reserva.previsualizar(
        validarId(solicitud.params.id),
        solicitud.query.start,
        solicitud.query.end,
        solicitud.query.startTime,
        solicitud.query.endTime,
      ),
    );
  }
  /** Valida y persiste el nuevo registro. Los modelos devuelven la fila creada; los controladores traducen el resultado a una respuesta HTTP. */
  static async crear(solicitud, respuesta) {
    respuesta
      .status(201)
      .json(
        await Reserva.crear(solicitud.user, {
          ...solicitud.body,
          vehicleId: validarId(solicitud.body.vehicleId),
        }),
      );
  }
  static async listar(solicitud, respuesta) {
    respuesta.json(await Reserva.listar(solicitud.user));
  }
  static async cancelar(solicitud, respuesta) {
    respuesta.json(
      await Reserva.cambiarEstado(validarId(solicitud.params.id), solicitud.user, 'cancel'),
    );
  }
  static async finalizar(solicitud, respuesta) {
    respuesta.json(
      await Reserva.cambiarEstado(validarId(solicitud.params.id), solicitud.user, 'finish'),
    );
  }
}
