/** Valida formato, contenido y tamaño de adjuntos.
 * Capa: Servicio. Extracción del módulo de flota; conserva reglas y transacciones. */
import { exigir } from './reglas.js';
export function validarAdjunto(content, mime) {
  exigir(
    ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(mime),
    400,
    'Adjunta PDF, PNG, JPEG o WebP.',
  );
  exigir(
    typeof content === 'string' && /^[A-Za-z0-9+/]*={0,2}$/.test(content),
    400,
    'Archivo inválido.',
  );
  const bytes = Buffer.from(content, 'base64');
  exigir(bytes.length > 0 && bytes.length <= 3145728, 400, 'Máximo 3 MB por archivo.');
  const valid =
    mime === 'application/pdf'
      ? bytes.subarray(0, 5).toString() === '%PDF-'
      : mime === 'image/png'
        ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : mime === 'image/jpeg'
          ? bytes[0] === 255 && bytes[1] === 216
          : bytes.subarray(0, 4).toString() === 'RIFF' &&
            bytes.subarray(8, 12).toString() === 'WEBP';
  exigir(valid, 400, 'El contenido no coincide con el tipo de archivo.');

  return bytes;
}
