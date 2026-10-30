/**
 * Verifica agrupación por ciudad, próxima reserva y horarios.
 * Capa: Pruebas.
 * Relación: node:test, node:assert/strict, ../frontend/src/componentes/arrendatario/presentacion.js, ../backend/servicios/horariosAlquiler.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { agruparCiudades, proximaReserva } from '../frontend/src/componentes/arrendatario/presentacion.js';
import { validarHorarios, validarRecogidaFutura } from '../backend/servicios/horariosAlquiler.js';
test('inicio agrupa ciudades sin tildes y prioriza valoraciones reales', () => {
  const groups = agruparCiudades([
    { id: 1, city: 'Bogotá', rating: null, daily_price: 30 },
    { id: 2, city: 'BOGOTA', rating: 4.5, review_count: 2, daily_price: 50 },
    { id: 3, city: 'Cali', rating: null, daily_price: 20 },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].vehicles[0].id, 2);
});
test('banner solo presenta la confirmada futura más próxima, incluyendo hora de Colombia', () => {
  const r = [
    { id: 1, status: 'CONFIRMADA', start_date: '2026-10-28', start_time: '09:00:00' },
    { id: 2, status: 'CONFIRMADA', start_date: '2026-10-28', start_time: '14:00:00' },
    { id: 3, status: 'CANCELADA', start_date: '2026-10-28', start_time: '13:00:00' },
  ];
  assert.equal(proximaReserva(r, Date.parse('2026-10-28T12:00:00-05:00')).id, 2);
  assert.equal(proximaReserva(r, Date.parse('2026-10-29T12:00:00-05:00')), null);
  assert.equal(proximaReserva([]), null);
});
test('horarios opcionales históricos y validación estricta', () => {
  assert.deepEqual(validarHorarios(), [null, null]);
  assert.deepEqual(validarHorarios('09:00', '18:30'), ['09:00', '18:30']);
  assert.throws(() => validarHorarios('25:00', '18:00'));
  assert.throws(() => validarHorarios('09:00', undefined));
});

test('recogida valida el instante futuro en Colombia sin alterar reservas históricas', () => {
  const now = Date.parse('2026-10-29T12:00:00-05:00');
  assert.throws(() => validarRecogidaFutura('2026-10-29', '11:00', now));
  assert.doesNotThrow(() => validarRecogidaFutura('2026-10-29', '13:00', now));
  assert.doesNotThrow(() => validarRecogidaFutura('2026-10-29', null, now));
});
