/** Coordina la cuenta del arrendatario y sus respuestas HTTP. Capa: Controlador. */
import { Arrendatario } from '../modelos/Arrendatario.js';
export class ControladorArrendatario {
  static async cuenta(solicitud, respuesta) {
    respuesta.json(await Arrendatario.cuenta(solicitud.user, solicitud.params, solicitud.body));
  }
  static async cambiarFavorito(solicitud, respuesta) {
    respuesta.json(
      await Arrendatario.cambiarFavorito(solicitud.user, solicitud.params, solicitud.body),
    );
  }
  static async leerNotificacion(solicitud, respuesta) {
    respuesta.json(
      await Arrendatario.leerNotificacion(solicitud.user, solicitud.params, solicitud.body),
    );
  }
  static async actualizarPerfil(solicitud, respuesta) {
    respuesta.json(
      await Arrendatario.actualizarPerfil(solicitud.user, solicitud.params, solicitud.body),
    );
  }
}
