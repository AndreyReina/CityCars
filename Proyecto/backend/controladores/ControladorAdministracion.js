/**
 * Valida decisiones administrativas y delega indicadores, restricciones e incidencias.
 * Capa: Controlador.
 * Relación: ../modelos/Administracion.js, ../servicios/reglas.js
 */
import { Administracion } from '../modelos/Administracion.js';
import { validarId, validarTexto, exigir } from '../servicios/reglas.js';
export class ControladorAdministracion {
  /** Consulta los indicadores y registros dentro de una transacción de solo lectura REPEATABLE READ para mantener una fotografía consistente. */
  static async resumen(solicitud, respuesta) {
    respuesta.json(await Administracion.resumen());
  }
  /** Bloquea la fila del propietario o publicación, valida el cambio y registra la decisión administrativa con motivo. */
  static async restringir(solicitud, respuesta) {
    exigir(typeof solicitud.body.restricted === 'boolean', 400, 'Estado inválido.');
    respuesta.json(
      await Administracion.restringir(
        solicitud.user.id,
        solicitud.params.type === 'owners' ? 'PROPIETARIO' : 'PUBLICACION',
        validarId(solicitud.params.id),
        solicitud.body.restricted,
        validarTexto(solicitud.body.reason, 'Motivo', 5, 1000),
      ),
    );
  }
  /** Acepta decisiones sobre publicaciones pendientes. La ruta administrativa utiliza Administracion para conservar auditoría. */
  static async revisar(solicitud, respuesta) {
    exigir(['APROBADO', 'RECHAZADO'].includes(solicitud.body.status), 400, 'Decisión no válida.');
    respuesta.json(
      await Administracion.revisar(
        solicitud.user.id,
        validarId(solicitud.params.id),
        solicitud.body.status,
      ),
    );
  }
  static async crearIncidencia(solicitud, respuesta) {
    exigir(['BAJA', 'MEDIA', 'ALTA'].includes(solicitud.body.priority), 400, 'Prioridad inválida.');
    respuesta.status(201).json(
      await Administracion.crearIncidencia(solicitud.user.id, {
        title: validarTexto(solicitud.body.title, 'Título', 5, 160),
        description: validarTexto(solicitud.body.description, 'Descripción', 10, 4000),
        priority: solicitud.body.priority,
        vehicleId: solicitud.body.vehicleId ? validarId(solicitud.body.vehicleId) : null,
        ownerId: solicitud.body.ownerId ? validarId(solicitud.body.ownerId) : null,
      }),
    );
  }
  static async actualizarIncidencia(solicitud, respuesta) {
    exigir(
      ['ABIERTA', 'EN_REVISION', 'PENDIENTE_INFO', 'RESUELTA', 'CERRADA'].includes(
        solicitud.body.status,
      ),
      400,
      'Estado inválido.',
    );
    respuesta.json(
      await Administracion.actualizarIncidencia(
        solicitud.user.id,
        validarId(solicitud.params.id),
        solicitud.body.status,
        validarTexto(solicitud.body.resolution, 'Nota de seguimiento', 5, 4000),
      ),
    );
  }
}
