/**
 * Construye opciones de marcas, modelos y municipios; conserva valores históricos al editar.
 * Capa: Vista / presentación.
 * Relación: ./catalogo-vehiculos.json, ./catalogo-municipios.json
 */
import vehicles from './catalogo-vehiculos.json' with { type: 'json' };
import municipalities from './catalogo-municipios.json' with { type: 'json' };

export const normalize = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
const sort = (items) =>
  items.sort((a, b) =>
    a.label.localeCompare(b.label, 'es', { sensitivity: 'base', numeric: true }),
  );
const option = (value) => ({ value, label: value });
// Conserva el valor histórico en edición sin incorporarlo a publicaciones nuevas.
function preserve(items, value) {
  if (!value || items.some((o) => o.value === value)) return items;
  return sort([...items.filter((o) => normalize(o.value) !== normalize(value)), option(value)]);
}
/** Devuelve marcas ordenadas, conservando solo para edición el valor histórico de la publicación. */
export function opcionesMarcas(original = {}) {
  return preserve(sort(Object.keys(vehicles).map(option)), original.brand);
}
/** Devuelve únicamente modelos de la marca elegida; conserva el modelo histórico solo cuando coincide la marca original. */
export function opcionesModelos(brand, original = {}) {
  const key = Object.keys(vehicles).find((b) => normalize(b) === normalize(brand));
  const items = sort((vehicles[key] || []).map(option));
  return normalize(brand) === normalize(original.brand) ? preserve(items, original.model) : items;
}
const counts = new Map();
for (const m of municipalities)
  counts.set(normalize(m.name), (counts.get(normalize(m.name)) || 0) + 1);
export const cities = sort(
  municipalities.map((m) => {
    // Conserva nombres de capitales y distingue municipios homónimos en el valor guardado.
    const name = m.code === '11001' ? 'Bogotá' : m.name;
    return {
      value: counts.get(normalize(m.name)) > 1 ? `${name} (${m.department})` : name,
      label: `${name} · ${m.department}`,
      code: m.code,
    };
  }),
);
export const opcionesCiudades = (original = {}) => preserve(cities, original.city);
/** Comprueba marca, modelo dependiente y municipio; devuelve un mensaje de error o cadena vacía. */
export function errorSeleccion(form, original = {}) {
  if (!opcionesMarcas(original).some((o) => o.value === form.brand))
    return 'Selecciona una marca de la lista.';
  if (!opcionesModelos(form.brand, original).some((o) => o.value === form.model))
    return 'Selecciona un modelo correspondiente a la marca.';
  if (!opcionesCiudades(original).some((o) => o.value === form.city))
    return 'Selecciona un municipio o ciudad de la lista.';
  return '';
}
