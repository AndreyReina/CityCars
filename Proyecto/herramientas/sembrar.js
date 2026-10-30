/**
 * Crea cuentas y publicaciones iniciales sin reiniciar contraseñas; secretos aleatorios solo en .local.
 * Capa: Herramientas de desarrollo.
 * Relación: node:fs, node:crypto, bcryptjs, ../backend/configuracion/conexion.js
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../backend/configuracion/conexion.js';
const file = '.local/demo-accounts.json';
fs.mkdirSync('.local', { recursive: true });
const accounts = fs.existsSync(file)
  ? JSON.parse(fs.readFileSync(file, 'utf8'))
  : [
      {
        name: 'Administración Demo',
        email: 'admin@citycars.test',
        role: 'ADMINISTRADOR',
        password: crypto.randomBytes(12).toString('base64url'),
      },
      {
        name: 'Propietario Demo',
        email: 'propietario@citycars.test',
        role: 'PROPIETARIO',
        password: crypto.randomBytes(12).toString('base64url'),
      },
      {
        name: 'Arrendatario Demo',
        email: 'arrendatario@citycars.test',
        role: 'ARRENDATARIO',
        password: crypto.randomBytes(12).toString('base64url'),
      },
    ];
fs.writeFileSync(file, JSON.stringify(accounts, null, 2));
for (const a of accounts)
  await pool.query(
    'INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING',
    [a.name, a.email, await bcrypt.hash(a.password, 12), a.role],
  );
const owner = (await pool.query("SELECT id FROM users WHERE email='propietario@citycars.test'"))
  .rows[0];
if (!(await pool.query('SELECT id FROM vehicles WHERE owner_id=$1', [owner.id])).rowCount) {
  const rows = [
    ['Honda', 'Civic Hatchback', 2024, 'Bogotá', 180000, 'honda_civic_hatchback'],
    ['Mazda', 'CX5', 2023, 'Medellín', 220000, 'mazda_cx5'],
    ['BMW', 'M3 Sedan', 2024, 'Cali', 350000, 'bmw_m3_sedan'],
  ];
  for (const [brand, model, year, city, tarifa, img] of rows)
    await pool.query(
      "INSERT INTO vehicles(owner_id,brand,model,year,city,daily_price,description,image,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'APROBADO')",
      [
        owner.id,
        brand,
        model,
        year,
        city,
        tarifa,
        'Consulta la tarifa diaria y elige las fechas que mejor se ajusten a tu próximo viaje.',
        '/imagenes/autos/' + img + '.webp',
      ],
    );
}
await pool.end();
console.log(
  'Datos de demostración preparados. Credenciales únicamente en .local/demo-accounts.json.',
);
