/**
 * Carga el usuario de sesión, autoriza roles y suspensiones y valida origen de operaciones mutables.
 * Capa: Intermediarios HTTP.
 * Relación: ../modelos/Usuario.js, ../servicios/reglas.js
 */
import { Usuario } from '../modelos/Usuario.js';
import { exigir } from '../servicios/reglas.js';
/** Resuelve la sesión persistida contra Usuario en cada solicitud para aplicar suspensiones vigentes. */
export async function cargarUsuarioActual(solicitud, respuesta, continuar) {
  solicitud.user = solicitud.session.userId
    ? await Usuario.buscarPorId(solicitud.session.userId)
    : null;
  continuar();
}
export const permitirRoles =
  (...roles) =>
  (solicitud, respuesta, continuar) => {
    exigir(solicitud.user, 401, 'Inicia sesión para continuar.');
    exigir(
      !solicitud.user.suspended || solicitud.method === 'GET',
      403,
      'Tu cuenta está suspendida. Puedes consultar tu información, pero no realizar operaciones.',
    );
    exigir(roles.includes(solicitud.user.role), 403, 'Tu rol no permite esta operación.');
    continuar();
  };
/** Exige JSON, origen admitido y cabecera X-CityCars en escrituras. Complementa, pero no sustituye, la autorización por rol. */
export function validarOrigen(solicitud, respuesta, continuar) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(solicitud.method)) {
    exigir(solicitud.is('application/json'), 415, 'Se requiere JSON.');
    const origin = solicitud.get('origin');
    const allowed = new Set([
      process.env.APP_ORIGIN || 'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://localhost:5173',
    ]);
    exigir(!origin || allowed.has(origin), 403, 'Origen no permitido.');
    exigir(solicitud.get('X-CityCars') === '1', 403, 'Solicitud no permitida.');
  }
  continuar();
}
