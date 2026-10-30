/**
 * Funciones puras de estado, filtrado, métricas y exportación del panel; no accede a PostgreSQL.
 * Capa: Vista / presentación.
 * Relación: Consumido por su página, script de ejecución o proceso de compilación.
 */
export const normalize = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
/** Agrupa ciudades ignorando tildes y mayúsculas; ordena vehículos por valoración, cantidad de reseñas y tarifa sin inventar calificaciones. */
export function agruparCiudades(vehicles) {
  const groups = new Map();
  for (const v of vehicles) {
    const key = normalize(v.city);
    if (!groups.has(key)) groups.set(key, { city: v.city, vehicles: [] });
    groups.get(key).vehicles.push(v);
  }
  return [...groups.values()]
    .sort((a, b) => a.city.localeCompare(b.city, 'es'))
    .map((g) => ({
      ...g,
      vehicles: g.vehicles.sort(
        (a, b) =>
          Number(b.rating || 0) - Number(a.rating || 0) ||
          Number(b.review_count || 0) - Number(a.review_count || 0) ||
          Number(a.daily_price) - Number(b.daily_price) ||
          a.id - b.id,
      ),
    }));
}
/** Filtra confirmadas con recogida futura y devuelve la más próxima o null. Los registros sin hora se comparan desde medianoche de Colombia. */
export function proximaReserva(reservations, now = Date.now()) {
  return (
    reservations
      .filter(
        (r) =>
          r.status === 'CONFIRMADA' &&
          Date.parse(r.start_date + 'T' + (r.start_time || '00:00:00') + '-05:00') > now,
      )
      .sort((a, b) =>
        (a.start_date + (a.start_time || '00:00')).localeCompare(
          b.start_date + (b.start_time || '00:00'),
        ),
      )[0] || null
  );
}
export const formatearHorario = (date, time) =>
  new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(new Date(date + 'T12:00:00-05:00')) +
  ' · ' +
  (time ? time.slice(0, 5) : 'Hora por coordinar');
