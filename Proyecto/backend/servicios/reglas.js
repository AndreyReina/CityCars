/**
 * Centraliza errores HTTP, validaciones de entrada, fechas, credenciales, publicaciones y cálculo monetario.
 * Capa: Servicios de reglas.
 * Relación: Consumido por su página, script de ejecución o proceso de compilación.
 */
export class ErrorHttp extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}
export function exigir(condicion, status, mensaje) {
  if (!condicion) throw new ErrorHttp(status, mensaje);
}
export function hoy() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
/** Exige fechas ISO reales, inicio no pasado y devolución posterior. Devuelve días de calendario del intervalo [inicio, fin). */
export function validarFechas(inicio, fin, current = hoy()) {
  const valid = (value) =>
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  exigir(valid(inicio) && valid(fin), 400, 'Ingresa fechas válidas.');
  exigir(
    inicio >= current && fin > inicio,
    400,
    'El inicio no puede estar en el pasado y la devolución debe ser posterior.',
  );
  const dias = (Date.parse(fin) - Date.parse(inicio)) / 86400000;
  exigir(dias >= 1, 400, 'El período debe ser de al menos un día.');
  return dias;
}
/** Valida tipo y longitud, elimina espacios extremos y devuelve el texto aceptado; lanza ErrorHttp ante una entrada inválida. */
export function validarTexto(value, label, min = 1, max = 200) {
  exigir(
    typeof value === 'string' && value.trim().length >= min && value.trim().length <= max,
    400,
    label + ' no es válido.',
  );
  return value.trim();
}
/** Convierte un identificador decimal positivo y seguro a número; rechaza valores ambiguos o fuera de rango. */
export function validarId(value) {
  exigir(
    /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0,
    400,
    'Identificador inválido.',
  );
  return Number(value);
}
/** Normaliza correo y valida contraseña sin truncamiento bcrypt; en registro restringe los roles a propietario o arrendatario. */
export function validarCredenciales(body, registering = false) {
  const email = validarTexto(body.email, 'Correo', 5, 254).toLowerCase();
  exigir(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 400, 'Correo no válido.');
  exigir(
    typeof body.password === 'string' &&
      body.password.length >= 8 &&
      Buffer.byteLength(body.password, 'utf8') <= 72,
    400,
    'La contraseña debe tener al menos 8 caracteres y como máximo 72 bytes.',
  );
  if (registering)
    exigir(
      ['ARRENDATARIO', 'PROPIETARIO'].includes(body.role),
      400,
      'Selecciona un rol permitido.',
    );
  return { email, password: body.password };
}
/** Valida y normaliza el contrato de publicación, tarifas, fotos y categorías. Conserva las claves HTTP/SQL existentes. */
export function validarVehiculo(body) {
  const brand = validarTexto(body.brand, 'Marca', 1, 60),
    model = validarTexto(body.model, 'Modelo', 1, 80),
    city = validarTexto(body.city, 'Ciudad', 2, 80),
    description = validarTexto(body.description, 'Descripción', 10, 2000);
  const year = Number(body.year),
    tarifa = Number(body.daily_price);
  exigir(
    Number.isInteger(year) && year >= 1950 && year <= new Date().getFullYear() + 1,
    400,
    'Año no válido.',
  );
  exigir(
    Number.isFinite(tarifa) &&
      tarifa > 0 &&
      tarifa <= 10000000 &&
      Math.abs(Math.round(tarifa * 100) - tarifa * 100) < 0.000001,
    400,
    'Tarifa no válida (máximo dos decimales).',
  );
  const image = validarTexto(body.image ?? '', 'Imagen principal', 0, 500);
  exigir(
    !image ||
      /^\/api\/vehicle-images\/[1-9]\d*$/.test(image) ||
      (/^\/imagenes\/[a-zA-Z0-9_ /.-]+\.(webp|png|jpe?g|svg)$/.test(image) &&
        !image.includes('..')) ||
      /^https:\/\/[^\s]+$/i.test(image),
    400,
    'Usa una imagen local o una URL HTTPS.',
  );
  const mileage = body.mileage === undefined ? undefined : Number(body.mileage);
  exigir(
    mileage === undefined || (Number.isInteger(mileage) && mileage >= 0 && mileage <= 10000000),
    400,
    'Kilometraje inválido.',
  );
  const photos = body.photos || [];
  exigir(
    Array.isArray(photos) &&
      photos.length <= 10 &&
      photos.every(
        (p) =>
          typeof p === 'string' &&
          p.length <= 500 &&
          (/^\/api\/vehicle-images\/[1-9]\d*$/.test(p) ||
            /^https:\/\/[^\s]+$/i.test(p) ||
            (/^\/imagenes\/[a-zA-Z0-9_ /.-]+\.(webp|png|jpe?g|svg)$/.test(p) && !p.includes('..'))),
      ),
    400,
    'Fotografías inválidas (máximo 10 URLs HTTPS o rutas locales).',
  );
  exigir(
    body.rtm_required === undefined || typeof body.rtm_required === 'boolean',
    400,
    'Exigibilidad inválida.',
  );
  const categories = body.photo_categories ?? {};
  exigir(
    categories && typeof categories === 'object' && !Array.isArray(categories),
    400,
    'Categorías inválidas.',
  );
  exigir(
    Object.keys(categories).length <= 10 &&
      Object.entries(categories).every(
        ([url, category]) => photos.includes(url) && ['INTERIOR', 'EXTERIOR'].includes(category),
      ),
    400,
    'Categorías de fotografías inválidas.',
  );
  return {
    photo_categories: categories,
    brand,
    model,
    year,
    city,
    daily_price: tarifa,
    description,
    image,
    mileage,
    photos,
    features: body.features ? validarTexto(body.features, 'Características', 1, 2000) : '',
    conditions: body.conditions ? validarTexto(body.conditions, 'Condiciones', 1, 2000) : '',
    rtm_required: body.rtm_required === true,
  };
}
/** Calcula total y comisión del 10 % usando centavos para limitar errores binarios; devuelve una tarifa histórica lista para persistir. */
export function cotizar(tarifa, dias) {
  const cents = Math.round(Number(tarifa) * 100);
  const total = cents * dias;
  return {
    days: dias,
    daily_price: cents / 100,
    total: total / 100,
    commission: Math.round(total * 0.1) / 100,
  };
}
