/**
 * Verifica integridad de catálogos, dependencia de modelos y valores históricos.
 * Capa: Pruebas.
 * Relación: node:test, node:assert/strict, ../frontend/src/datos/catalogoPublicacion.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  opcionesMarcas,
  opcionesModelos,
  opcionesCiudades,
  cities,
  errorSeleccion,
  normalize,
} from '../frontend/src/datos/catalogoPublicacion.js';

test('catálogos completos sin duplicados y municipios homónimos distinguibles', () => {
  const brands = opcionesMarcas();
  assert.ok(brands.length > 200);
  assert.equal(new Set(brands.map((o) => normalize(o.value))).size, brands.length);
  assert.equal(cities.length, 1122);
  assert.equal(new Set(cities.map((o) => o.value)).size, cities.length);
  assert.ok(cities.find((o) => o.code === '27493'));
  assert.ok(cities.filter((o) => o.label.startsWith('Armenia ·')).length > 1);
  assert.ok(cities.some((o) => normalize(o.label).includes('bogota')));
  assert.ok(cities.every((o) => o.value.length <= 80));
});

test('modelos dependientes de marca y búsqueda sin mayúsculas o tildes', () => {
  assert.deepEqual(opcionesModelos('toyota'), opcionesModelos('TOYOTA'));
  assert.ok(opcionesModelos('Toyota').some((o) => normalize(o.label) === 'corolla'));
  assert.ok(!opcionesModelos('Toyota').some((o) => normalize(o.label) === 'civic'));
  assert.deepEqual(opcionesModelos(''), []);
  assert.ok(opcionesMarcas().every((b) => opcionesModelos(b.value).length));
  assert.equal(
    errorSeleccion({ brand: 'TOYOTA', model: 'CIVIC', city: 'Bogotá' }),
    'Selecciona un modelo correspondiente a la marca.',
  );
  assert.equal(errorSeleccion({ brand: 'TOYOTA', model: 'COROLLA', city: 'Bogotá' }), '');
});

test('edición conserva denominaciones heredadas sin habilitarlas en otras marcas o publicaciones', () => {
  const old = { brand: 'Honda', model: 'Civic Hatchback', city: 'Bogota' };
  assert.equal(errorSeleccion(old, old), '');
  assert.equal(opcionesCiudades(old).filter((o) => normalize(o.value) === 'bogota').length, 1);
  assert.ok(opcionesModelos('Honda', old).some((o) => o.value === old.model));
  assert.ok(!opcionesModelos('Toyota', old).some((o) => o.value === old.model));
  const historical = {
    brand: 'Marca histórica',
    model: 'Modelo histórico',
    city: 'Ubicación histórica',
  };
  assert.equal(errorSeleccion(historical, historical), '');
  assert.ok(errorSeleccion(historical));
});
