/** Traduce solicitudes de flota a operaciones del modelo y respuestas HTTP.
 * Capa: Controlador. Extracción del módulo de flota; conserva reglas y transacciones. */
import { Flota } from '../modelos/Flota.js';
export class ControladorFlota {
  static async resumen(solicitud, respuesta) {
    respuesta.json(await Flota.resumen(solicitud.user, solicitud.params, solicitud.body));
  }
  static async leerEvento(solicitud, respuesta) {
    respuesta.json(await Flota.leerEvento(solicitud.user, solicitud.params, solicitud.body));
  }
  static async cambiarEstadoVehiculo(solicitud, respuesta) {
    respuesta.json(
      await Flota.cambiarEstadoVehiculo(solicitud.user, solicitud.params, solicitud.body),
    );
  }
  static async registrarDocumento(solicitud, respuesta) {
    respuesta.json(
      await Flota.registrarDocumento(solicitud.user, solicitud.params, solicitud.body),
    );
  }
  static async registrarMantenimiento(solicitud, respuesta) {
    respuesta.json(
      await Flota.registrarMantenimiento(solicitud.user, solicitud.params, solicitud.body),
    );
  }
  static async cerrarMantenimiento(solicitud, respuesta) {
    respuesta.json(
      await Flota.cerrarMantenimiento(solicitud.user, solicitud.params, solicitud.body),
    );
  }
  static async registrarKilometraje(solicitud, respuesta) {
    respuesta.json(
      await Flota.registrarKilometraje(solicitud.user, solicitud.params, solicitud.body),
    );
  }
  static async crearResena(solicitud, respuesta) {
    respuesta.json(await Flota.crearResena(solicitud.user, solicitud.params, solicitud.body));
  }
  static async crearIncidencia(solicitud, respuesta) {
    respuesta.json(await Flota.crearIncidencia(solicitud.user, solicitud.params, solicitud.body));
  }
  static async enviarMensaje(solicitud, respuesta) {
    respuesta.json(await Flota.enviarMensaje(solicitud.user, solicitud.params, solicitud.body));
  }
  static async guardarArchivo(solicitud, respuesta) {
    respuesta
      .status(201)
      .json(await Flota.guardarArchivo(solicitud.user, solicitud.params, solicitud.body));
  }
  static async obtenerArchivo(solicitud, respuesta) {
    const f = await Flota.obtenerArchivo(solicitud.user, solicitud.params, solicitud.body);
    respuesta
      .set('Cache-Control', 'private, no-store')
      .set('Content-Type', f.mime)
      .set('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent(f.name))
      .send(f.content);
  }
  static async registrarMovimiento(solicitud, respuesta) {
    respuesta.json(
      await Flota.registrarMovimiento(solicitud.user, solicitud.params, solicitud.body),
    );
  }
}
