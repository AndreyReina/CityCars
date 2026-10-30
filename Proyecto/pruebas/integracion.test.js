/**
 * Verifica el recorrido HTTP con PostgreSQL temporal, permisos, concurrencia y reglas de flota.
 * Capa: Pruebas.
 * Relación: node:test, node:assert/strict, node:fs/promises, pg, bcryptjs, node:crypto
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
test('M01–M06: recorrido HTTP real con PostgreSQL aislado', async (t) => {
  const original = process.env.DATABASE_URL;
  assert.ok(original, 'Configura DATABASE_URL');
  const name = 'citycars_test_' + crypto.randomBytes(5).toString('hex');
  const url = new URL(original);
  url.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  await admin.query('CREATE DATABASE ' + name);
  url.pathname = '/' + name;
  process.env.DATABASE_URL = url.toString();
  const { pool } = await import('../backend/configuracion/conexion.js');
  const { crearAplicacion } = await import('../backend/aplicacion.js');
  const { hoy } = await import('../backend/servicios/reglas.js');
  let server;
  try {
    await pool.query(await fs.readFile(new URL('../base_datos/esquema.sql', import.meta.url), 'utf8'));
    server = crearAplicacion().listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    const cliente = () => {
      let cookie = '';
      return async (path, method = 'GET', body, extra = {}) => {
        const r = await fetch(base + '/api' + path, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-CityCars': '1',
            ...(cookie ? { Cookie: cookie } : {}),
            ...extra,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const sc = r.headers.get('set-cookie');
        if (sc) cookie = sc.split(';')[0];
        return { status: r.status, data: r.headers.get('content-type')?.includes('application/json')?await r.json():Buffer.from(await r.arrayBuffer()) };
      };
    };
    const visitor = cliente(),
      owner = cliente(),
      other = cliente(),
      renter = cliente(),
      renter2 = cliente(),
      manager = cliente();
    const password = 'Demo-' + crypto.randomBytes(12).toString('hex');
    const register = async (c, email, role) => {
      const r = await c('/auth/register', 'POST', {
        name: 'Usuario de prueba',
        email,
        password,
        role,
      });
      assert.equal(r.status, 201, JSON.stringify(r.data));
      return r.data;
    };
    const ownerUser = await register(owner, 'owner@test.co', 'PROPIETARIO');
    await register(other, 'other@test.co', 'PROPIETARIO');
    const renterUser = await register(renter, 'renter@test.co', 'ARRENDATARIO');
    await register(renter2, 'renter2@test.co', 'ARRENDATARIO');
    await pool.query(
      "INSERT INTO users(name,email,password_hash,role) VALUES('Administracion','admin@test.co',$1,'ADMINISTRADOR')",
      [await bcrypt.hash(password, 12)],
    );
    assert.equal(
      (await manager('/auth/login', 'POST', { email: 'admin@test.co', password })).status,
      200,
    );
    const day = (n) => new Date(Date.parse(hoy()) + n * 86400000).toISOString().slice(0, 10);
    const data = {
      brand: 'Honda',
      model: 'Civic',
      year: 2024,
      city: 'Bogotá',
      daily_price: 180000,
      description: 'Automóvil del recorrido de prueba.',
      image: '/imagenes/autos/honda_civic_hatchback.webp',
    };
    let vehiculo, reservation;
    await t.test('Registro, sesiones, propiedad y moderación', async () => {
      assert.equal(
        (
          await visitor('/auth/register', 'POST', {
            name: 'Intruso',
            email: 'intruso@test.co',
            password,
            role: 'ADMINISTRADOR',
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await visitor('/auth/register', 'POST', {
            name: 'Duplicado',
            email: 'OWNER@test.co',
            password,
            role: 'PROPIETARIO',
          })
        ).status,
        409,
      );
      assert.equal(
        (await visitor('/auth/login', 'POST', { email: 'owner@test.co', password: 'incorrecta' }))
          .status,
        401,
      );
      assert.equal((await visitor('/owner/vehicles', 'POST', data)).status, 401);
      assert.equal((await renter('/owner/vehicles', 'POST', data)).status, 403);
      let r = await owner('/owner/vehicles', 'POST', data);
      assert.equal(r.status, 201);
      vehiculo = r.data;
      assert.equal((await visitor('/vehicles')).data.length, 0);
      assert.equal((await visitor('/vehicles/' + vehiculo.id)).status, 404);
      assert.equal((await other('/owner/vehicles/' + vehiculo.id, 'PUT', data)).status, 403);
      assert.equal(
        (await owner('/admin/vehicles/' + vehiculo.id + '/review', 'POST', { status: 'APROBADO' }))
          .status,
        403,
      );
      assert.equal(
        (await manager('/admin/vehicles/' + vehiculo.id + '/review', 'POST', { status: 'APROBADO' }))
          .status,
        200,
      );
      assert.equal((await visitor('/vehicles?city=Bogot%C3%A1')).data.length, 1);
      assert.equal((await visitor('/vehicles?city=BOGOTA')).data.length, 1);
      assert.equal((await visitor('/vehicles?city=Cali')).data.length, 0);
      assert.equal((await owner('/auth/me')).data.id, ownerUser.id);
      const stored = await pool.query('SELECT password_hash FROM users WHERE id=$1', [
        ownerUser.id,
      ]);
      assert.notEqual(stored.rows[0].password_hash, password);
    });
    const booking = () => ({
      vehicleId: vehiculo.id,
      start: day(2),
      end: day(4),
      payment: 'APROBADO',
      expectedTotal: 360000,
    });
    await t.test('Fechas, presupuesto, pago rechazado y permisos', async () => {
      assert.equal(
        (await visitor('/vehicles/' + vehiculo.id + '/quote?start=' + day(2) + '&end=' + day(4)))
          .data.total,
        360000,
      );
      assert.equal((await visitor('/vehicles?start=2026-02-30&end=2026-03-04')).status, 400);
      assert.equal(
        (await renter('/reservations', 'POST', { ...booking(), start: day(-1) })).status,
        400,
      );
      assert.equal((await visitor('/reservations', 'POST', booking())).status, 401);
      assert.equal((await owner('/reservations', 'POST', booking())).status, 403);
      assert.equal(
        (await renter('/reservations', 'POST', { ...booking(), payment: 'RECHAZADO' })).status,
        402,
      );
      assert.equal((await renter('/reservations')).data.length, 0);
      assert.equal(
        (await renter('/reservations', 'POST', { ...booking(), expectedTotal: 1 })).status,
        409,
      );
      assert.equal(
        (await renter('/reservations', 'POST', booking(), { Origin: 'https://evil.example' }))
          .status,
        403,
      );
    });
    await t.test('Dos confirmaciones concurrentes: exactamente una reserva', async () => {
      const results = await Promise.all([
        renter('/reservations', 'POST', booking()),
        renter2('/reservations', 'POST', booking()),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
      reservation = results.find((r) => r.status === 201).data;
      assert.equal((await visitor('/vehicles?start=' + day(2) + '&end=' + day(4))).data.length, 0);
      assert.equal((await visitor('/vehicles?start=' + day(4) + '&end=' + day(5))).data.length, 1);
      assert.equal((await owner('/reservations')).data.length, 1);
      assert.equal((await other('/reservations')).data.length, 0);
      assert.equal((await manager('/reservations')).data.length, 1);
      assert.equal(
        (await owner('/owner/vehicles/' + vehiculo.id, 'PUT', { ...data, daily_price: 200000 }))
          .status,
        409,
      );
      assert.equal(
        (await owner('/owner/vehicles/' + vehiculo.id + '/deactivate', 'POST', {})).status,
        409,
      );
      assert.equal(
        (await owner('/reservations/' + reservation.id + '/finish', 'POST', {})).status,
        409,
      );
      await assert.rejects(
        pool.query(
          'INSERT INTO reservations(vehicle_id,renter_id,start_date,end_date,daily_price,days,total,commission) VALUES($1,$2,$3,$4,180000,2,360000,36000)',
          [vehiculo.id, renterUser.id, day(2), day(4)],
        ),
        (e) => e.code === '23P01',
      );
    });
    await t.test('Cancelación por titular libera fechas; edición conserva histórico', async () => {
      const winner = reservation.renter_id === renterUser.id ? renter : renter2;
      const loser = winner === renter ? renter2 : renter;
      assert.equal(
        (await loser('/reservations/' + reservation.id + '/cancel', 'POST', {})).status,
        403,
      );
      assert.equal(
        (await winner('/reservations/' + reservation.id + '/cancel', 'POST', {})).status,
        200,
      );
      assert.equal((await visitor('/vehicles?start=' + day(2) + '&end=' + day(4))).data.length, 1);
      assert.equal(
        (await owner('/owner/vehicles/' + vehiculo.id, 'PUT', { ...data, daily_price: 200000 })).data
          .status,
        'PENDIENTE_APROBACION',
      );
      assert.equal((await visitor('/vehicles')).data.length, 0);
      assert.equal(
        (
          await manager('/admin/vehicles/' + vehiculo.id + '/review', 'POST', {
            status: 'RECHAZADO',
          })
        ).status,
        200,
      );
      assert.equal(
        (await owner('/owner/vehicles/' + vehiculo.id, 'PUT', { ...data, daily_price: 200000 }))
          .status,
        200,
      );
      assert.equal(
        (await manager('/admin/vehicles/' + vehiculo.id + '/review', 'POST', { status: 'APROBADO' }))
          .status,
        200,
      );
      assert.equal(Number((await winner('/reservations')).data[0].total), 360000);
    });
    await t.test('Cancelación fuera de plazo y finalización por propietario', async () => {
      const historic = (
        await pool.query(
          'INSERT INTO reservations(vehicle_id,renter_id,start_date,end_date,daily_price,days,total,commission) VALUES($1,$2,$3,$4,180000,2,360000,36000) RETURNING id',
          [vehiculo.id, renterUser.id, day(-2), day(0)],
        )
      ).rows[0].id;
      assert.equal((await renter('/reservations/' + historic + '/cancel', 'POST', {})).status, 409);
      assert.equal((await other('/reservations/' + historic + '/finish', 'POST', {})).status, 403);
      assert.equal(
        (await owner('/reservations/' + historic + '/finish', 'POST', {})).data.status,
        'FINALIZADA',
      );
      assert.equal(
        (await owner('/owner/vehicles/' + vehiculo.id + '/deactivate', 'POST', {})).data.status,
        'INACTIVO',
      );
      assert.equal((await visitor('/vehicles')).data.length, 0);
      assert.equal((await owner('/auth/logout', 'POST', {})).status, 200);
      assert.equal((await owner('/owner/vehicles')).status, 401);
    });

    await t.test('Ciudades dinámicas, únicas y disponibles según fechas', async () => {
      const ids = [];
      for (const [city, status] of [
        ['Bogotá', 'APROBADO'],
        ['bogota', 'APROBADO'],
        ['Cali', 'APROBADO'],
        ['Medellín', 'APROBADO'],
        ['Pasto', 'INACTIVO'],
        ['Cúcuta', 'PENDIENTE_APROBACION'],
        ['Manizales', 'RECHAZADO'],
      ]) {
        const result = await pool.query(
          'INSERT INTO vehicles(owner_id,brand,model,year,city,daily_price,description,image,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
          [
            ownerUser.id,
            'Honda',
            'Filtros',
            2024,
            city,
            180000,
            'Vehículo para verificar filtros.',
            data.image,
            status,
          ],
        );
        ids.push(result.rows[0].id);
      }
      const normalize = (value) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
      assert.deepEqual((await visitor('/vehicle-cities')).data.map(normalize), [
        'bogota',
        'cali',
        'medellin',
      ]);
      assert.equal((await visitor('/vehicles?city=BOGOTA')).data.length, 2);
      assert.equal((await visitor('/vehicles?city=medellin')).data.length, 1);
      assert.equal((await visitor('/vehicle-cities?start=invalid&end=invalid')).status, 400);
      assert.equal((await visitor('/vehicle-cities?start=' + day(2))).status, 400);
      for (const idVehiculo of ids.slice(0, 2))
        await pool.query(
          'INSERT INTO reservations(vehicle_id,renter_id,start_date,end_date,daily_price,days,total,commission) VALUES($1,$2,$3,$4,180000,2,360000,36000)',
          [idVehiculo, renterUser.id, day(2), day(4)],
        );
      assert.deepEqual(
        (await visitor('/vehicle-cities?start=' + day(2) + '&end=' + day(4))).data.map(normalize),
        ['cali', 'medellin'],
      );
      assert.deepEqual(
        (await visitor('/vehicle-cities?start=' + day(4) + '&end=' + day(5))).data.map(normalize),
        ['bogota', 'cali', 'medellin'],
      );
      await pool.query("UPDATE reservations SET status='CANCELADA' WHERE vehicle_id=$1", [ids[0]]);
      assert.deepEqual(
        (await visitor('/vehicle-cities?start=' + day(2) + '&end=' + day(4))).data.map(normalize),
        ['bogota', 'cali', 'medellin'],
      );
      assert.equal(
        (await pool.query('SELECT city FROM vehicles WHERE id=$1', [ids[0]])).rows[0].city,
        'Bogotá',
      );
    });

    await t.test('Administración: restricciones reversibles y sesiones existentes', async () => {
      assert.equal((await visitor('/admin/overview')).status, 401);
      assert.equal((await renter('/admin/overview')).status, 403);
      assert.equal((await other('/admin/overview')).status, 403);
      await owner('/auth/login', 'POST', { email: 'owner@test.co', password });
      const published = (await visitor('/vehicles')).data[0];
      const restrictPath = '/admin/vehicles/' + published.id + '/restriction';
      assert.equal(
        (await renter(restrictPath, 'POST', { restricted: true, reason: 'Motivo de control' }))
          .status,
        403,
      );
      assert.equal(
        (await manager(restrictPath, 'POST', { restricted: 'true', reason: 'Motivo de control' }))
          .status,
        400,
      );
      assert.equal(
        (await manager(restrictPath, 'POST', { restricted: true, reason: 'x' })).status,
        400,
      );
      assert.equal(
        (await manager(restrictPath, 'POST', { restricted: true, reason: 'Revisión de seguridad' }))
          .status,
        200,
      );
      assert.equal((await visitor('/vehicles/' + published.id)).status, 404);
      assert.equal(
        (await visitor('/vehicles/' + published.id + '/quote?start=' + day(10) + '&end=' + day(12)))
          .status,
        404,
      );
      assert.equal(
        (
          await renter('/reservations', 'POST', {
            ...booking(),
            vehicleId: published.id,
            start: day(10),
            end: day(12),
          })
        ).status,
        409,
      );
      assert.equal((await owner('/owner/vehicles/' + published.id, 'PUT', data)).status, 403);
      assert.equal((await manager('/vehicles/' + published.id)).status, 200);
      const before = (await manager('/reservations')).data.map((r) => [r.id, r.status]);
      const ownerPath = '/admin/owners/' + ownerUser.id + '/restriction';
      assert.equal(
        (
          await manager(ownerPath, 'POST', {
            restricted: true,
            reason: 'Verificación de documentos',
          })
        ).status,
        200,
      );
      assert.equal((await owner('/auth/me')).data.suspended, true);
      assert.equal((await owner('/owner/vehicles', 'POST', data)).status, 403);
      assert.equal(
        (await owner('/owner/vehicles/' + vehiculo.id + '/deactivate', 'POST', {})).status,
        403,
      );
      assert.equal((await owner('/reservations')).status, 200);
      assert.equal((await visitor('/vehicles')).data.length, 0);
      const unblocked = (await manager('/admin/vehicles')).data.find(
        (v) => v.status === 'APROBADO' && !v.blocked,
      );
      assert.equal(
        (await visitor('/vehicles/' + unblocked.id + '/quote?start=' + day(10) + '&end=' + day(12)))
          .status,
        404,
      );
      assert.equal(
        (
          await renter('/reservations', 'POST', {
            ...booking(),
            vehicleId: unblocked.id,
            start: day(10),
            end: day(12),
          })
        ).status,
        409,
      );
      assert.deepEqual((await visitor('/vehicle-cities')).data, []);
      assert.deepEqual(
        (await manager('/reservations')).data.map((r) => [r.id, r.status]),
        before,
      );
      const overview = (await manager('/admin/overview')).data;
      assert.equal(overview.users.suspended_owners, 1);
      assert.equal(
        overview.vehicles.find((v) => v.id === published.id).owner_email,
        'owner@test.co',
      );
      assert.equal('password_hash' in overview.owners[0], false);
      assert.equal(
        (
          await manager('/admin/owners/' + renterUser.id + '/restriction', 'POST', {
            restricted: true,
            reason: 'No es propietario',
          })
        ).status,
        404,
      );
      assert.equal(
        (
          await manager(ownerPath, 'POST', {
            restricted: false,
            reason: 'Documentación verificada',
          })
        ).status,
        200,
      );
      assert.equal(
        (await visitor('/vehicles/' + published.id)).status,
        404,
        'La reactivación del dueño no quita el bloqueo individual',
      );
      assert.equal(
        (await manager(restrictPath, 'POST', { restricted: false, reason: 'Revisión completada' }))
          .status,
        200,
      );
      assert.equal((await visitor('/vehicles/' + published.id)).status, 200);
      assert.equal(
        (await visitor('/vehicles/' + vehiculo.id)).status,
        404,
        'Un vehículo inactivo no se reactiva por accidente',
      );
      assert.equal((await owner('/owner/vehicles', 'POST', data)).status, 201);
    });
    await t.test('Indicadores, finanzas simuladas e incidencias con auditoría', async () => {
      const overview = await manager('/admin/overview');
      assert.equal(overview.status, 200);
      assert.equal(overview.data.months.length, 6);
      assert.equal(overview.data.reservations.length, (await manager('/reservations')).data.length);
      assert.equal(overview.data.users.total, 5);
      const totals = (
        await pool.query(
          "SELECT coalesce(sum(total),0) AS total,coalesce(sum(commission),0) AS commission FROM reservations WHERE status='FINALIZADA'",
        )
      ).rows[0];
      assert.equal(overview.data.finance.completed_total, totals.total);
      assert.equal(overview.data.finance.completed_commission, totals.commission);
      const body = {
        title: 'Documentación por verificar',
        description: 'Revisar los documentos del propietario antes de cerrar.',
        priority: 'ALTA',
        ownerId: ownerUser.id,
        vehicleId: vehiculo.id,
      };
      assert.equal((await other('/admin/incidents', 'POST', body)).status, 403);
      assert.equal(
        (await manager('/admin/incidents', 'POST', { ...body, vehicleId: 999999 })).status,
        404,
      );
      const created = await manager('/admin/incidents', 'POST', body);
      assert.equal(created.status, 201, JSON.stringify(created.data));
      assert.equal(created.data.status, 'ABIERTA');
      assert.equal(
        (
          await manager('/admin/incidents/' + created.data.id, 'PUT', {
            status: 'RESUELTA',
            resolution: '',
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await manager('/admin/incidents/' + created.data.id, 'PUT', {
            status: 'EN_REVISION',
            resolution: 'Documentos solicitados al propietario.',
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await manager('/admin/incidents/' + created.data.id, 'PUT', {
            status: 'RESUELTA',
            resolution: 'Documentos verificados correctamente.',
          })
        ).status,
        200,
      );
      const result = (await manager('/admin/overview')).data;
      assert.equal(result.incidents.find((i) => i.id === created.data.id).status, 'RESUELTA');
      assert.equal(
        result.actions.filter(
          (a) => a.entity_type === 'INCIDENCIA' && a.entity_id === created.data.id,
        ).length,
        3,
      );
      assert.ok(
        result.actions.some((a) => a.action === 'SUSPENDER' && a.entity_type === 'PROPIETARIO'),
      );
    });

    await t.test('Flota: propiedad, pausa, documentos y mantenimiento sin conflictos', async () => {
      const created = await owner('/owner/vehicles', 'POST', {
        ...data,
        mileage: 1000,
        features: 'Automático',
        conditions: 'Sin fumar',
        photos: [data.image],
        rtm_required: true,
      });
      assert.equal(created.status, 201, JSON.stringify(created.data));
      const vid = created.data.id;
      assert.equal(
        (await manager('/admin/vehicles/' + vid + '/review', 'POST', { status: 'APROBADO' }))
          .status,
        200,
      );
      assert.equal(
        (
          await other('/owner/documents', 'POST', {
            vehicleId: vid,
            kind: 'SOAT',
            expiresOn: day(50),
          })
        ).status,
        404,
      );
      assert.equal((await renter('/owner/overview')).status, 403);
      assert.equal(
        (await other('/owner/overview')).data.vehicles.some((v) => v.id === vid),
        false,
      );
      const booking = await renter('/reservations', 'POST', {
        vehicleId: vid,
        start: day(5),
        end: day(7),
        payment: 'APROBADO',
        expectedTotal: 360000,
      });
      assert.equal(booking.status, 201);
      assert.equal(
        (await owner('/owner/vehicles/' + vid + '/state', 'POST', { action: 'PAUSAR' })).status,
        200,
      );
      assert.equal(
        (await visitor('/vehicles')).data.some((v) => v.id === vid),
        false,
      );
      assert.equal(
        (await owner('/owner/overview')).data.reservations.find((r) => r.id === booking.data.id)
          .status,
        'CONFIRMADA',
      );
      assert.equal(
        (await owner('/owner/vehicles/' + vid + '/state', 'POST', { action: 'ARCHIVAR' })).status,
        409,
      );
      assert.equal(
        (await owner('/owner/vehicles/' + vid + '/state', 'POST', { action: 'REACTIVAR' })).status,
        200,
      );
      const maintenance = {
        vehicleId: vid,
        kind: 'Preventivo',
        description: 'Cambio de aceite y filtros',
        dueDate: day(5),
        start: day(5),
        end: day(6),
        dueKm: 2000,
      };
      assert.equal((await owner('/owner/maintenance', 'POST', maintenance)).status, 409);
      const scheduled = await owner('/owner/maintenance', 'POST', {
        ...maintenance,
        start: day(10),
        end: day(12),
      });
      assert.equal(scheduled.status, 200, JSON.stringify(scheduled.data));
      assert.equal(
        (await visitor('/vehicles/' + vid + '/quote?start=' + day(10) + '&end=' + day(11))).status,
        409,
      );
      assert.equal(
        (await visitor('/vehicles?start=' + day(10) + '&end=' + day(11))).data.some(
          (v) => v.id === vid,
        ),
        false,
      );
      assert.equal(
        (await other('/owner/maintenance/' + scheduled.data.id, 'PUT', { status: 'CANCELADO' }))
          .status,
        404,
      );
      assert.equal(
        (await owner('/owner/maintenance/' + scheduled.data.id, 'PUT', { status: 'CANCELADO' }))
          .status,
        200,
      );
      assert.equal(
        (
          await owner('/owner/documents', 'POST', {
            vehicleId: vid,
            kind: 'SOAT',
            expiresOn: day(-1),
          })
        ).status,
        200,
      );
      assert.equal(
        (await visitor('/vehicles')).data.some((v) => v.id === vid),
        false,
      );
      assert.equal(
        (await visitor('/vehicles/' + vid + '/quote?start=' + day(20) + '&end=' + day(21))).status,
        409,
      );
      assert.equal(
        (
          await owner('/owner/documents', 'POST', {
            vehicleId: vid,
            kind: 'SOAT',
            expiresOn: day(30),
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await owner('/owner/documents', 'POST', {
            vehicleId: vid,
            kind: 'RTM',
            expiresOn: day(15),
          })
        ).status,
        200,
      );
      assert.equal(
        (await visitor('/vehicles/' + vid + '/quote?start=' + day(20) + '&end=' + day(21))).status,
        409,
      );
      assert.equal(
        (await visitor('/vehicles/' + vid + '/quote?start=' + day(13) + '&end=' + day(14))).status,
        200,
      );
      const overview = (await owner('/owner/overview')).data;
      assert.equal(
        overview.documents.filter((d) => d.vehicle_id === vid && d.kind === 'SOAT').length,
        2,
      );
      assert.ok(overview.events.some((e) => e.vehicle_id === vid && e.module === 'documentos'));
      assert.equal(
        (await manager('/admin/overview')).data.documents.some((d) => d.vehicle_id === vid),
        true,
      );
    });
    await t.test('Flota: adjuntos privados, casos y respuestas administrativas', async () => {
      const v = (await owner('/owner/vehicles', 'POST', data)).data;
      const content = Buffer.from('%PDF-1.4\n test fixture').toString('base64');
      const uploaded = await owner('/files', 'POST', {
        name: 'comprobante.pdf',
        mime: 'application/pdf',
        content,
      });
      assert.equal(uploaded.status, 201);
      const fid = uploaded.data.id;
      assert.equal((await other('/files/' + fid)).status, 404);
      assert.equal(
        (
          await owner('/files', 'POST', {
            name: 'false.pdf',
            mime: 'application/pdf',
            content: Buffer.from('<script>').toString('base64'),
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await other('/owner/documents', 'POST', {
            vehicleId: v.id,
            kind: 'SOAT',
            expiresOn: day(30),
            fileId: fid,
          })
        ).status,
        404,
      );
      const incident = await owner('/owner/incidents', 'POST', {
        vehicleId: v.id,
        kind: 'DANO',
        title: 'Daño de prueba',
        description: 'Descripción del daño reportado',
        priority: 'MEDIA',
        fileId: fid,
      });
      assert.equal(incident.status, 200, JSON.stringify(incident.data));
      const iid = incident.data.id;
      assert.equal(
        (await other('/incidents/' + iid + '/messages', 'POST', { body: 'Intento de acceso' }))
          .status,
        404,
      );
      assert.equal(
        (
          await owner('/incidents/' + iid + '/messages', 'POST', {
            body: 'Información adicional',
            fileId: fid,
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await owner('/admin/incidents/' + iid, 'PUT', {
            status: 'RESUELTA',
            resolution: 'Intento de resolver',
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await manager('/admin/incidents/' + iid, 'PUT', {
            status: 'PENDIENTE_INFO',
            resolution: 'Adjunta detalles adicionales del vehículo.',
          })
        ).status,
        200,
      );
      const info = (await owner('/owner/overview')).data;
      assert.equal(info.incidents.find((i) => i.id === iid).status, 'PENDIENTE_INFO');
      assert.equal(info.messages.filter((m) => m.incident_id === iid).length, 2);
      assert.equal(
        (await owner('/owner/vehicles/' + v.id + '/state', 'POST', { action: 'ARCHIVAR' })).status,
        409,
      );
      await manager('/admin/incidents/' + iid, 'PUT', {
        status: 'CERRADA',
        resolution: 'Caso cerrado y documentado.',
      });
      assert.equal(
        (await owner('/owner/vehicles/' + v.id + '/state', 'POST', { action: 'ARCHIVAR' })).status,
        200,
      );
      assert.equal((await owner('/owner/vehicles/' + v.id, 'PUT', data)).status, 409);
    });
    await t.test(
      'Flota: kilometraje monotónico, reseña única y contabilidad sin pagos ficticios',
      async () => {
        const v = (await owner('/owner/vehicles', 'POST', { ...data, mileage: 1000 })).data;
        await manager('/admin/vehicles/' + v.id + '/review', 'POST', { status: 'APROBADO' });
        const booking = await renter('/reservations', 'POST', {
          vehicleId: v.id,
          start: day(0),
          end: day(1),
          payment: 'APROBADO',
          expectedTotal: 180000,
        });
        assert.equal(booking.status, 201);
        const rid = booking.data.id;
        assert.equal((await owner('/owner/overview')).data.entries.length, 0);
        assert.equal(
          (
            await other('/owner/reservations/' + rid + '/odometer', 'POST', {
              phase: 'ENTREGA',
              mileage: 1000,
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await owner('/owner/reservations/' + rid + '/odometer', 'POST', {
              phase: 'ENTREGA',
              mileage: 999,
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await owner('/owner/reservations/' + rid + '/odometer', 'POST', {
              phase: 'ENTREGA',
              mileage: 1000,
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await owner('/owner/reservations/' + rid + '/odometer', 'POST', {
              phase: 'ENTREGA',
              mileage: 1001,
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await owner('/owner/reservations/' + rid + '/odometer', 'POST', {
              phase: 'DEVOLUCION',
              mileage: 1100,
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await renter('/reservations/' + rid + '/review', 'POST', {
              rating: 5,
              comment: 'Muy buen vehículo',
            })
          ).status,
          409,
        );
        await pool.query('UPDATE reservations SET start_date=$2,end_date=$3 WHERE id=$1', [
          rid,
          day(-1),
          day(0),
        ]);
        assert.equal((await owner('/reservations/' + rid + '/finish', 'POST', {})).status, 200);
        assert.equal(
          (
            await renter2('/reservations/' + rid + '/review', 'POST', {
              rating: 5,
              comment: 'Muy buen vehículo',
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await renter('/reservations/' + rid + '/review', 'POST', {
              rating: 5,
              comment: 'Muy buen vehículo',
              recommendation: 'Mejorar la limpieza',
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await renter('/reservations/' + rid + '/review', 'POST', {
              rating: 3,
              comment: 'Otra opinión',
            })
          ).status,
          409,
        );
        const entry = {
          reservationId: rid,
          kind: 'COBRO',
          amount: 180000,
          reference: 'BANK-TEST-001',
          paidOn: day(0),
        };
        assert.equal((await owner('/admin/financial-entries', 'POST', entry)).status, 403);
        assert.equal(
          (await manager('/admin/financial-entries', 'POST', { ...entry, kind: 'DESEMBOLSO' }))
            .status,
          409,
        );
        assert.equal((await manager('/admin/financial-entries', 'POST', entry)).status, 200);
        assert.equal(
          (
            await manager('/admin/financial-entries', 'POST', {
              ...entry,
              reference: 'OVER-TEST-001',
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await manager('/admin/financial-entries', 'POST', {
              ...entry,
              kind: 'DESEMBOLSO',
              amount: 162000,
              reference: 'BANK-TEST-002',
            })
          ).status,
          200,
        );
        const info = (await owner('/owner/overview')).data;
        assert.equal(info.vehicles.find((x) => x.id === v.id).mileage, 1100);
        assert.equal(info.reviews.find((x) => x.reservation_id === rid).rating, 5);
        assert.equal(info.entries.filter((e) => e.reservation_id === rid).length, 2);
        assert.equal((await other('/owner/overview')).data.entries.length, 0);
      },
    );

    await t.test(
      'Flota: concurrencia de mantenimiento y reserva, y suspensión de operaciones',
      async () => {
        const v = (await owner('/owner/vehicles', 'POST', data)).data;
        await manager('/admin/vehicles/' + v.id + '/review', 'POST', { status: 'APROBADO' });
        const results = await Promise.all([
          owner('/owner/maintenance', 'POST', {
            vehicleId: v.id,
            kind: 'Preventivo',
            description: 'Servicio programado concurrente',
            dueDate: day(40),
            start: day(40),
            end: day(42),
          }),
          renter('/reservations', 'POST', {
            vehicleId: v.id,
            start: day(40),
            end: day(42),
            payment: 'APROBADO',
            expectedTotal: 360000,
          }),
        ]);
        assert.equal(
          results.filter((r) => r.status === 200 || r.status === 201).length,
          1,
          JSON.stringify(results),
        );
        assert.equal(results.filter((r) => r.status === 409).length, 1);
        await manager('/admin/owners/' + ownerUser.id + '/restriction', 'POST', {
          restricted: true,
          reason: 'Prueba de suspensión de flota',
        });
        assert.equal((await owner('/owner/overview')).status, 200);
        assert.equal(
          (
            await owner('/owner/documents', 'POST', {
              vehicleId: v.id,
              kind: 'SOAT',
              expiresOn: day(90),
            })
          ).status,
          403,
        );
        assert.equal(
          (await owner('/owner/vehicles/' + v.id + '/state', 'POST', { action: 'PAUSAR' })).status,
          403,
        );
        await manager('/admin/owners/' + ownerUser.id + '/restriction', 'POST', {
          restricted: false,
          reason: 'Fin de la prueba de restricción',
        });
      },
    );

    await t.test('Imágenes: validación, privacidad, categorías y eliminación independiente',async()=>{
      const sharp=(await import('sharp')).default;
      const png=await sharp({create:{width:20,height:16,channels:3,background:'#ccc'}}).png().toBuffer();
      const upload=await owner('/vehicle-images','POST',{mime:'image/png',content:png.toString('base64')});
      assert.equal(upload.status,201,JSON.stringify(upload.data));const url=upload.data.url;
      assert.equal((await visitor(url.replace('/api',''))).status,404);
      assert.equal((await other(url.replace('/api',''))).status,404);
      assert.equal((await owner(url.replace('/api',''))).status,200);
      assert.equal((await renter('/vehicle-images','POST',{mime:'image/png',content:png.toString('base64')})).status,403);
      assert.equal((await owner('/vehicle-images','POST',{mime:'image/png',content:Buffer.from('not an image').toString('base64')})).status,400);
      assert.equal((await other('/owner/vehicles','POST',{...data,image:url})).status,400);
      const second=(await owner('/vehicle-images','POST',{mime:'image/png',content:png.toString('base64')})).data.url;
      const created=await owner('/owner/vehicles','POST',{...data,image:url,photos:[url,second],photo_categories:{[url]:'INTERIOR',[second]:'EXTERIOR'}});
      assert.equal(created.status,201,JSON.stringify(created.data));const vid=created.data.id;
      await manager('/admin/vehicles/'+vid+'/review','POST',{status:'APROBADO'});
      assert.equal((await visitor(url.replace('/api',''))).status,200);
      const edit=await owner('/owner/vehicles/'+vid,'PUT',{...data,image:'',photos:[second],photo_categories:{[second]:'EXTERIOR'}});
      assert.equal(edit.status,200,JSON.stringify(edit.data));assert.equal(edit.data.image,'');assert.deepEqual(edit.data.photos,[second]);assert.equal(edit.data.status,'PENDIENTE_APROBACION');
      assert.equal((await visitor(url.replace('/api',''))).status,404);
      assert.equal((await owner(url.replace('/api',''))).status,200);
    });
    await t.test('Desarchivar conserva aprobación, pausa y sanciones',async()=>{
      const v=(await owner('/owner/vehicles','POST',data)).data;
      await manager('/admin/vehicles/'+v.id+'/review','POST',{status:'APROBADO'});
      assert.equal((await owner('/owner/vehicles/'+v.id+'/state','POST',{action:'ARCHIVAR'})).status,200);
      assert.equal((await other('/owner/vehicles/'+v.id+'/state','POST',{action:'DESARCHIVAR'})).status,404);
      const restored=await owner('/owner/vehicles/'+v.id+'/state','POST',{action:'DESARCHIVAR'});
      assert.equal(restored.status,200);assert.equal(restored.data.archived,false);assert.equal(restored.data.paused,true);assert.equal(restored.data.status,'APROBADO');
      assert.equal((await visitor('/vehicles')).data.some(x=>x.id===v.id),false);
      assert.equal((await owner('/owner/vehicles/'+v.id+'/state','POST',{action:'REACTIVAR'})).status,200);
      await owner('/owner/vehicles/'+v.id+'/state','POST',{action:'ARCHIVAR'});
      await manager('/admin/vehicles/'+v.id+'/restriction','POST',{restricted:true,reason:'Restricción de prueba'});
      const blocked=await owner('/owner/vehicles/'+v.id+'/state','POST',{action:'DESARCHIVAR'});
      assert.equal(blocked.data.blocked,true);
      assert.equal((await owner('/owner/vehicles/'+v.id+'/state','POST',{action:'REACTIVAR'})).status,409);
    });
    await t.test(
      'Arrendatario: favoritos privados, perfil y avisos con horarios coherentes',
      async () => {
        const v = (await owner('/owner/vehicles', 'POST', data)).data;
        await manager('/admin/vehicles/' + v.id + '/review', 'POST', { status: 'APROBADO' });
        assert.equal(
          (await renter('/renter/favorites/' + v.id, 'PUT', { favorite: true })).status,
          200,
        );
        assert.ok((await renter('/renter/account')).data.favorites.includes(v.id));
        assert.ok(!(await renter2('/renter/account')).data.favorites.includes(v.id));
        assert.equal((await owner('/renter/account')).status, 403);
        const p = await renter('/renter/profile', 'PUT', {
          name: 'Nombre actualizado',
          role: 'ADMINISTRADOR',
        });
        assert.equal(p.data.role, 'ARRENDATARIO');
        assert.equal((await renter('/auth/me')).data.name, 'Nombre actualizado');
        const body = {
          vehicleId: v.id,
          start: day(110),
          end: day(111),
          startTime: '09:00',
          endTime: '18:00',
          payment: 'APROBADO',
          expectedTotal: 180000,
        };
        assert.equal(
          (await renter('/reservations', 'POST', { ...body, startTime: '25:00' })).status,
          400,
        );
        const booking = await renter('/reservations', 'POST', body);
        assert.equal(booking.status, 201, JSON.stringify(booking.data));
        assert.equal(booking.data.start_time, '09:00:00');
        const continuar =
          '/vehicles/' +
          v.id +
          '/quote?start=' +
          day(111) +
          '&end=' +
          day(112) +
          '&startTime=09:00&endTime=09:00';
        assert.equal((await renter(continuar)).status, 409);
        assert.ok(
          !(
            await renter(
              '/vehicles?start=' + day(111) + '&end=' + day(112) + '&startTime=09:00&endTime=09:00',
            )
          ).data.some((x) => x.id === v.id),
        );
        assert.equal(
          (
            await renter(
              '/vehicles/' +
                v.id +
                '/quote?start=' +
                day(111) +
                '&end=' +
                day(112) +
                '&startTime=18:00&endTime=18:00',
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await owner('/owner/maintenance', 'POST', {
              vehicleId: v.id,
              kind: 'PREVENTIVO',
              description: 'Revisión de prueba',
              dueDate: day(111),
              start: day(111),
              end: day(112),
            })
          ).status,
          409,
        );
        const n = (await renter('/renter/account')).data.notifications.find(
          (n) => n.reservation_id === booking.data.id,
        );
        assert.ok(n);
        assert.equal((await renter2('/renter/notifications/' + n.id, 'PUT', {})).status, 404);
        assert.equal((await renter('/renter/notifications/' + n.id, 'PUT', {})).status, 200);
        assert.ok(
          (await renter('/renter/account')).data.notifications.find((x) => x.id === n.id).read_at,
        );
        await renter('/reservations/' + booking.data.id + '/cancel', 'POST', {});
        await pool.query(
          "INSERT INTO maintenance(vehicle_id,kind,description,due_date,start_date,end_date,status) VALUES($1,'PREVENTIVO','Revisión', $2,$2,$3,'PROGRAMADO')",
          [v.id, day(111), day(112)],
        );
        assert.equal(
          (
            await renter(
              '/vehicles/' +
                v.id +
                '/quote?start=' +
                day(110) +
                '&end=' +
                day(111) +
                '&startTime=09:00&endTime=18:00',
            )
          ).status,
          409,
        );
        assert.ok(
          !(
            await renter(
              '/vehicles?start=' + day(110) + '&end=' + day(111) + '&startTime=09:00&endTime=18:00',
            )
          ).data.some((x) => x.id === v.id),
        );

        assert.ok(
          (await renter('/renter/account')).data.notifications.some(
            (x) => x.reservation_id === booking.data.id && x.status === 'CANCELADA',
          ),
        );
        assert.equal(
          (await renter('/renter/favorites/' + v.id, 'PUT', { favorite: false })).status,
          200,
        );
      },
    );
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await pool.end();
    await admin.query('DROP DATABASE ' + name + ' WITH (FORCE)');
    await admin.end();
    process.env.DATABASE_URL = original;
  }
});
