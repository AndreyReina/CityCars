/**
 * Verifica que cada referencia de imagen interna pertenezca al propietario antes de guardar.
 * Capa: Servicios de reglas.
 * Relación: ./reglas.js
 */
import { validarId, exigir } from './reglas.js';
import { Imagen } from '../modelos/Imagen.js';
/** Comprueba solo referencias internas /api/vehicle-images; cada imagen debe pertenecer al titular que publica. */
export async function validarPropiedadImagenes(cliente, idPropietario, vehiculo) {
  const urls = [vehiculo.image, ...vehiculo.photos];
  for (const url of new Set(urls)) {
    const match = url.match(/^\/api\/vehicle-images\/(\d+)$/);
    if (match)
      exigir(
        await Imagen.perteneceA(cliente, validarId(match[1]), idPropietario),
        400,
        'La imagen no pertenece a tu cuenta.',
      );
  }
}
