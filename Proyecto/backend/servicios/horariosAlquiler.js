/**
 * Valida formato HH:mm y recogida futura en Colombia; admite reservas históricas sin horario.
 * Capa: Servicios de reglas.
 * Relación: ./reglas.js
 */
import { exigir } from './reglas.js';
/** Acepta ambos horarios HH:mm o ambos omitidos para clientes históricos. Devuelve el par validado o lanza ErrorHttp. */
export function validarHorarios(horaRecogida, horaDevolucion) {
  if (horaRecogida === undefined && horaDevolucion === undefined) return [null, null];
  exigir(
    [horaRecogida, horaDevolucion].every(
      (t) => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t),
    ),
    400,
    'Selecciona horas válidas de recogida y devolución.',
  );
  return [horaRecogida, horaDevolucion];
}

/** Compara la fecha y hora de Colombia con el instante actual; no modifica reservas históricas sin horario. */
export function validarRecogidaFutura(inicio, horaRecogida, now = Date.now()) {
  if (!inicio || horaRecogida == null) return;
  exigir(
    Date.parse(inicio + 'T' + horaRecogida + ':00-05:00') > now,
    400,
    'Selecciona una hora de recogida futura (hora de Colombia).',
  );
}
