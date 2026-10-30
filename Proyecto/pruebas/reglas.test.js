/**
 * Verifica fechas, importes, credenciales, publicaciones y moneda.
 * Capa: Pruebas.
 * Relación: node:test, node:assert/strict, ../backend/servicios/reglas.js, ../frontend/src/api.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarFechas, cotizar, validarCredenciales, validarVehiculo } from '../backend/servicios/reglas.js';
test('Fechas exclusivas, días reales y restricciones', () => {
  assert.equal(validarFechas('2026-10-27', '2026-10-29', '2026-10-25'), 2);
  for (const [s, e] of [
    ['2026-02-30', '2026-03-03'],
    ['no', '2026-10-29'],
    ['2026-10-29', '2026-10-29'],
    ['2026-10-24', '2026-10-28'],
  ])
    assert.throws(() => validarFechas(s, e, '2026-10-25'));
});
test('Precio histórico y comisión en centavos', () => {
  assert.deepEqual(cotizar('180000.00', 2), {
    days: 2,
    daily_price: 180000,
    total: 360000,
    commission: 36000,
  });
  assert.equal(cotizar('100.05', 3).commission, 30.02);
});
test('No se registra administrador y bcrypt no trunca contraseñas', () => {
  assert.throws(() =>
    validarCredenciales({ email: 'admin@test.co', password: 'pass123456', role: 'ADMINISTRADOR' }, true),
  );
  assert.throws(() => validarCredenciales({ email: 'a@b.co', password: 'á'.repeat(40) }));
});
test('Se rechazan imágenes con protocolos ejecutables y precios negativos', () => {
  const v = {
    brand: 'Honda',
    model: 'Civic',
    year: 2024,
    city: 'Bogotá',
    daily_price: 180000,
    description: 'Automóvil para pruebas.',
    image: 'javascript:alert(1)',
  };
  assert.throws(() => validarVehiculo(v));
  assert.throws(() =>
    validarVehiculo({ ...v, image: '/imagenes/autos/honda_civic_hatchback.webp', daily_price: -1 }),
  );
});

// La vista no debe ocultar centavos que sí conserva PostgreSQL.
test('El formato de moneda conserva centavos', async () => {
  const { money } = await import('../frontend/src/api.js');
  assert.match(money(180000.5), /180\.000,5/);
});
