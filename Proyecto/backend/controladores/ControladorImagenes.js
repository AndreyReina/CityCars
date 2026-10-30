/** Coordina transformación, almacenamiento y descarga de fotografías. Capa: Controlador. */
import { Imagen } from '../modelos/Imagen.js';
import { procesarImagen } from '../servicios/procesarImagen.js';
export class ControladorImagenes {
  static async crear(solicitud, respuesta) {
    const bytes = await procesarImagen(solicitud.body);
    const row = await Imagen.guardar(solicitud.user.id, bytes);
    respuesta.status(201).json({ url: '/api/vehicle-images/' + row.id });
  }
  static async obtener(solicitud, respuesta) {
    const row = await Imagen.obtener(solicitud.params.id, solicitud.user);
    respuesta
      .set('Content-Type', 'image/webp')
      .set('Cache-Control', 'private, no-store')
      .send(row.content);
  }
}
