/**
 * Verifica alertas documentales, distribución financiera y métricas de uso.
 * Capa: Pruebas.
 * Relación: node:test, node:assert/strict, ../frontend/src/componentes/propietario/presentacion.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estadoDocumento,
  metrics,
  distribuirMovimientos,
  alerts,
  serieIngresos,
} from '../frontend/src/componentes/propietario/presentacion.js';
test('alertas documentales respetan cada umbral y mantienen vencidos', () => {
  const hoy = '2026-01-01';
  for (const [date, state] of [
    ['2026-02-01', 'VIGENTE'],
    ['2026-01-31', 'VENCE_EN_30_DIAS'],
    ['2026-01-16', 'VENCE_EN_15_DIAS'],
    ['2026-01-08', 'VENCE_EN_7_DIAS'],
    ['2026-01-01', 'VENCE_HOY'],
    ['2025-12-31', 'VENCIDO'],
  ])
    assert.equal(estadoDocumento({ expires_on: date }, hoy), state);
  assert.equal(estadoDocumento(null, hoy), 'SIN_REGISTRAR');
});
test('comisiones conservan centavos históricos con cobros parciales y períodos', () => {
  const data = {
    today: '2026-01-31',
    vehicles: [{ id: 1, created_at: '2026-01-01' }],
    reservations: [
      {
        id: 1,
        vehicle_id: 1,
        total: 0.05,
        commission: 0.01,
        start_date: '2026-01-01',
        end_date: '2026-01-02',
        status: 'FINALIZADA',
      },
    ],
    entries: [
      {
        id: 1,
        reservation_id: 1,
        vehicle_id: 1,
        kind: 'COBRO',
        amount: 0.02,
        paid_on: '2026-01-01',
      },
      {
        id: 2,
        reservation_id: 1,
        vehicle_id: 1,
        kind: 'COBRO',
        amount: 0.03,
        paid_on: '2026-02-01',
      },
    ],
    reviews: [],
  };
  assert.equal(
    distribuirMovimientos(data).reduce((s, e) => s + e.commission, 0),
    0.01,
  );
  assert.equal(metrics(data, { from: '2026-02-01', to: '2026-02-28' }).commission, 0.01);
  assert.equal(metrics(data, {}).net, 0.04);
  assert.equal(metrics(data, {}).pending, 0.04);
  assert.equal(serieIngresos(data.entries, 'MENSUAL').length, 2);
});
test('uso limita días al período e ignora cancelaciones sin fabricar kilometraje', () => {
  const data = {
    today: '2026-01-10',
    vehicles: [{ id: 1, created_at: '2026-01-01' }],
    reservations: [
      {
        id: 1,
        vehicle_id: 1,
        start_date: '2026-01-01',
        end_date: '2026-01-06',
        status: 'FINALIZADA',
        delivery_km: 100,
        return_km: 160,
        returned_at: '2026-01-06',
      },
      {
        id: 2,
        vehicle_id: 1,
        start_date: '2026-01-07',
        end_date: '2026-01-09',
        status: 'CANCELADA',
      },
    ],
    entries: [],
    reviews: [],
  };
  const m = metrics(data, { from: '2026-01-03', to: '2026-01-10' });
  assert.equal(m.days, 3);
  assert.equal(m.km, 60);
  assert.equal(m.gross, 0);
  assert.equal(m.rating, null);
  assert.equal(alerts({ ...data, documents: [], maintenance: [] }).length, 1);
});
