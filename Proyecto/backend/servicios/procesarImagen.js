/** Comprueba y convierte fotos a WebP sin acceder a datos. Capa: Servicio. */
import sharp from 'sharp';
import { exigir } from './reglas.js';
export async function procesarImagen(datos) {
  const { content, mime } = datos;
  exigir(
    ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(mime),
    400,
    'Usa JPEG, PNG, WebP, GIF o AVIF.',
  );
  exigir(
    typeof content === 'string' &&
      content.length <= 11200000 &&
      /^[A-Za-z0-9+/]+={0,2}$/.test(content),
    400,
    'Imagen inválida.',
  );
  const bytes = Buffer.from(content, 'base64');
  exigir(bytes.length > 0 && bytes.length <= 8388608, 400, 'Máximo 8 MB por imagen.');
  let result;
  try {
    const input = sharp(bytes, { limitInputPixels: 24000000, failOn: 'warning' });
    const metadata = await input.metadata();
    exigir(
      ['jpeg', 'png', 'webp', 'gif', 'heif', 'avif'].includes(metadata.format),
      400,
      'Formato no admitido.',
    );
    result = await input
      .rotate()
      .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    exigir(
      false,
      400,
      'La imagen está dañada, tiene un formato no admitido o supera 24 megapíxeles.',
    );
  }
  exigir(
    result.length <= 3145728,
    400,
    'La imagen procesada supera 3 MB. Selecciona una imagen más pequeña.',
  );
  return result;
}
