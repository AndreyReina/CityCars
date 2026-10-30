/**
 * Coordina registro, bcrypt, regeneración y persistencia de sesión, ingreso y cierre.
 * Capa: Controlador.
 * Relación: bcryptjs, ../modelos/Usuario.js, ../servicios/reglas.js
 */
import bcrypt from 'bcryptjs';
import { Usuario } from '../modelos/Usuario.js';
import { validarCredenciales, validarTexto, exigir } from '../servicios/reglas.js';
const regenerate = (solicitud) =>
  new Promise((resolve, reject) =>
    solicitud.session.regenerate((e) => (e ? reject(e) : resolve())),
  );
const save = (solicitud) =>
  new Promise((resolve, reject) => solicitud.session.save((e) => (e ? reject(e) : resolve())));
export class ControladorAutenticacion {
  /** Valida credenciales y rol público, genera hash bcrypt coste 12 y renueva la sesión después de persistir el usuario. */
  static async registrar(solicitud, respuesta) {
    const { email, password } = validarCredenciales(solicitud.body, true);
    const name = validarTexto(solicitud.body.name, 'Nombre', 2, 100);
    const password_hash = await bcrypt.hash(password, 12);
    const usuario = await Usuario.crear({ email, name, password_hash, role: solicitud.body.role });
    await regenerate(solicitud);
    solicitud.session.userId = usuario.id;
    await save(solicitud);
    respuesta.status(201).json(usuario);
  }
  /** Compara bcrypt sin revelar si existe el correo. Renueva el identificador de sesión para evitar fijación y devuelve datos públicos. */
  static async ingresar(solicitud, respuesta) {
    const { email, password } = validarCredenciales(solicitud.body);
    const usuario = await Usuario.buscarPorCorreo(email);
    exigir(
      usuario && (await bcrypt.compare(password, usuario.password_hash)),
      401,
      'Correo o contraseña incorrectos.',
    );
    await regenerate(solicitud);
    solicitud.session.userId = usuario.id;
    await save(solicitud);
    respuesta.json({
      id: usuario.id,
      name: usuario.name,
      email: usuario.email,
      role: usuario.role,
    });
  }
  /** Destruye la sesión persistida y elimina la cookie de autenticación. */
  static async salir(solicitud, respuesta) {
    await new Promise((resolve, reject) =>
      solicitud.session.destroy((e) => (e ? reject(e) : resolve())),
    );
    respuesta.clearCookie('citycars.sid', { path: '/' }).json({ ok: true });
  }
  static async actual(solicitud, respuesta) {
    respuesta.json(solicitud.user || null);
  }
}
