/**
 * Verifica restauración de vistas, filtros, paginación y exportación CSV.
 * Capa: Pruebas.
 * Relación: node:test, node:assert/strict, ../frontend/src/componentes/administracion/presentacion.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  modules,
  rutaDesdeFragmento,
  vistasIniciales,
  filtrarRegistros,
  paginar,
  reservasCsv,
} from '../frontend/src/componentes/administracion/presentacion.js';

test('admin restores independent valid views and resolves unknown routes safely', () => {
  const views = vistasIniciales({
    publicaciones: { query: 'Bogota', page: 3, filter: 'APROBADO' },
    reservas: { page: -1, filter: 'UNKNOWN' },
    resumen: { tab: 'finanzas' },
  });
  assert.equal(views.publicaciones.page, 3);
  assert.equal(views.publicaciones.query, 'Bogota');
  assert.equal(views.reservas.page, 1);
  assert.equal(views.reservas.filter, '');
  assert.equal(views.resumen.tab, 'finanzas');
  for (const module of modules) assert.equal(rutaDesdeFragmento('#/' + module.id), module.id);
  assert.equal(rutaDesdeFragmento('#/missing'), 'resumen');
});

test('publication search combines accents, ownership and independent restrictions', () => {
  const data = {
    vehicles: [
      { id: 1, city: 'Bogotá', owner_name: 'José', blocked: true },
      { id: 2, city: 'BOGOTÁ', owner_name: 'José', owner_suspended: true },
      { id: 3, city: 'Bogotá', owner_name: 'José' },
      { id: 4, city: 'Cali', blocked: true },
    ],
  };
  const module = modules.find((m) => m.id === 'publicaciones');
  assert.deepEqual(
    filtrarRegistros(data, module, { query: 'bogota jose', filter: 'SUSPENDIDA' }).map((r) => r.id),
    [1, 2],
  );
});

test('pagination clamps after filtering and CSV exports all matching rows', () => {
  const rows = Array.from({ length: 19 }, (_, i) => ({
    id: i + 1,
    brand: 'Honda',
    model: 'Civic',
    owner_name: ' =FORMULA',
    renter_name: 'Ana "María"',
    status: 'CONFIRMADA',
    total: 100,
    commission: 10,
  }));
  assert.deepEqual(
    paginar(rows, 3).rows.map((r) => r.id),
    [17, 18, 19],
  );
  assert.equal(paginar(rows.slice(0, 2), 3).page, 1);
  assert.equal(paginar([], 2).start, 0);
  const csv = reservasCsv(rows);
  assert.equal(csv.split('\r\n').length, 20);
  assert.ok(csv.includes('"19";'));
  assert.ok(csv.includes('"\' =FORMULA"'));
  assert.ok(csv.includes('"Ana ""María"""'));
});
