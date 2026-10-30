/**
 * Cliente HTTP JSON de la vista; envía la cabecera de origen acordada, presenta errores y formatea moneda y fecha.
 * Capa: Vista / presentación.
 * Relación: Consumido por su página, script de ejecución o proceso de compilación.
 */
export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch('/api' + path, {
      credentials: 'same-origin',
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-CityCars': '1', ...options.headers },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Intenta nuevamente.');
  }
  const data = await response.json().catch(() => {
    throw new Error('El servidor no está disponible.');
  });
  if (!response.ok) throw new Error(data.error || 'No fue posible completar la operación.');
  return data;
}
export const money = (value) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
