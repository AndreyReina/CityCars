/**
 * Funciones puras de estado, filtrado, métricas y exportación del panel; no accede a PostgreSQL.
 * Capa: Vista / presentación.
 * Relación: Consumido por su página, script de ejecución o proceso de compilación.
 */
export const modules = [
  ['resumen', 'Resumen', 'Tu actividad, prioridades y accesos rápidos.'],
  ['vehiculos', 'Mis vehículos', 'Publicaciones, disponibilidad e historial de tu flota.'],
  ['reservas', 'Reservas', 'Alquileres, entregas, devoluciones y arrendatarios.'],
  [
    'ganancias',
    'Ganancias',
    'Cobros y desembolsos registrados, separados de los importes contractuales.',
  ],
  ['resenas', 'Reseñas', 'Opiniones de arrendatarios con alquileres finalizados.'],
  ['kilometraje', 'Uso y kilometraje', 'Utilización e historial del odómetro por vehículo.'],
  ['mantenimientos', 'Mantenimientos', 'Planificación, bloqueos de disponibilidad y comprobantes.'],
  ['documentos', 'Documentos', 'SOAT, técnico-mecánica y renovaciones.'],
  ['incidencias', 'Centro de atención', 'Reportes, evidencias y comunicación con administración.'],
  ['flota', 'Composición de flota', 'Marcas, modelos y rendimiento de tus vehículos.'],
  ['notificaciones', 'Notificaciones', 'Novedades y recordatorios de tu operación.'],
].map(([id, name, description]) => ({ id, name, description }));
export const normalize = (v) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
export const options = (a) => a.map((v) => ({ value: v, label: v.replaceAll('_', ' ') }));
export const diferenciaDias = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export const sumarDias = (d, n = 1) =>
  new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);
export const estadoReserva = (r, today) =>
  r.status !== 'CONFIRMADA'
    ? r.status
    : r.start_date > today
      ? 'PROXIMA'
      : r.end_date <= today
        ? 'PENDIENTE_CIERRE'
        : 'ACTIVA';
export const estadoVehiculo = (v) =>
  v.archived ? 'ARCHIVADO' : v.blocked ? 'SUSPENDIDO' : v.paused ? 'PAUSADO' : v.status;
/** Calcula el nivel de alerta respecto de hoy: vencido, vence hoy, 7, 15 o 30 días, vigente o sin registrar. */
export function estadoDocumento(d, today) {
  if (!d?.expires_on) return 'SIN_REGISTRAR';
  const n = diferenciaDias(today, d.expires_on);
  return n < 0
    ? 'VENCIDO'
    : n === 0
      ? 'VENCE_HOY'
      : n <= 7
        ? 'VENCE_EN_7_DIAS'
        : n <= 15
          ? 'VENCE_EN_15_DIAS'
          : n <= 30
            ? 'VENCE_EN_30_DIAS'
            : 'VIGENTE';
}
/** Selecciona el último registro documental por tipo y vehículo; incluye RTM cuando el vehículo la requiere. */
export function documentosRecientes(data) {
  return data.vehicles.flatMap((v) =>
    ['SOAT', ...(v.rtm_required ? ['RTM'] : [])].map((kind) => ({
      ...data.documents.find((d) => d.vehicle_id === v.id && d.kind === kind),
      vehicle_id: v.id,
      kind,
    })),
  );
}
/** Combina estado registrado, fecha y kilometraje para indicar tareas vencidas o pendientes. */
export function estadoMantenimiento(m, data) {
  if (m.status !== 'PROGRAMADO') return m.status;
  const v = data.vehicles.find((v) => v.id === m.vehicle_id);
  return m.due_date < data.today ||
    (m.due_km != null && v?.mileage != null && v.mileage >= m.due_km)
    ? 'VENCIDO'
    : diferenciaDias(data.today, m.due_date) <= 30 ||
        (m.due_km != null && v?.mileage != null && m.due_km - v.mileage <= 500)
      ? 'PROXIMO'
      : 'PROGRAMADO';
}
/** Compone avisos operativos a partir de documentos, mantenimientos y estados de la flota. */
export function alerts(data) {
  return [
    ...documentosRecientes(data)
      .filter((d) => estadoDocumento(d, data.today) !== 'VIGENTE')
      .map((d) => ({
        key: 'd' + d.vehicle_id + d.kind,
        vehicle_id: d.vehicle_id,
        module: 'documentos',
        title: d.kind + ' · ' + estadoDocumento(d, data.today).replaceAll('_', ' '),
        description: d.expires_on
          ? 'Vence ' +
            d.expires_on +
            ' · ' +
            diferenciaDias(data.today, d.expires_on) +
            ' días restantes'
          : 'Registra la fecha de vencimiento.',
        date: d.expires_on || data.today,
      })),
    ...data.maintenance
      .filter((m) => ['PROXIMO', 'VENCIDO'].includes(estadoMantenimiento(m, data)))
      .map((m) => ({
        key: 'm' + m.id,
        vehicle_id: m.vehicle_id,
        module: 'mantenimientos',
        title: m.kind + ' · ' + estadoMantenimiento(m, data),
        description: 'Fecha ' + m.due_date + (m.due_km != null ? ' · ' + m.due_km + ' km' : ''),
        date: m.due_date,
      })),
  ];
}
export function filter(data, view, rows, dateField = 'created_at') {
  return rows.filter(
    (r) =>
      (!view.vehicle ||
        r.vehicle_id === Number(view.vehicle) ||
        (r.id === Number(view.vehicle) && view.source === 'vehicles')) &&
      (!view.from || String(r[dateField] || '').slice(0, 10) >= view.from) &&
      (!view.to || String(r[dateField] || '').slice(0, 10) <= view.to),
  );
}
/** Distribuye cobros y desembolsos registrados respetando comisión histórica y centavos; no genera pagos. */
export function distribuirMovimientos(data) {
  const sums = new Map();
  return [...data.entries]
    .sort((a, b) => a.id - b.id)
    .map((e) => {
      if (e.kind !== 'COBRO') return { ...e, commission: 0 };
      const r = data.reservations.find((r) => r.id === e.reservation_id),
        old = sums.get(e.reservation_id) || 0,
        next = old + Math.round(Number(e.amount) * 100);
      sums.set(e.reservation_id, next);
      const total = Math.round(Number(r?.total || 0) * 100),
        fee = Math.round(Number(r?.commission || 0) * 100);
      return {
        ...e,
        commission: total
          ? (Math.round((next * fee) / total) - Math.round((old * fee) / total)) / 100
          : 0,
      };
    });
}
/** Calcula indicadores del período filtrado. Separa importes contractuales de movimientos registrados y no inventa kilometraje. */
export function metrics(data, view) {
  const vehicles = data.vehicles.filter((v) => !view.vehicle || v.id === Number(view.vehicle));
  const ids = new Set(vehicles.map((v) => v.id));
  const reservations = data.reservations.filter(
    (r) =>
      ids.has(r.vehicle_id) &&
      (!view.from || r.end_date > view.from) &&
      (!view.to || r.start_date <= view.to),
  );
  const entries = distribuirMovimientos(data).filter(
    (e) =>
      ids.has(e.vehicle_id) &&
      (!view.from || e.paid_on >= view.from) &&
      (!view.to || e.paid_on <= view.to),
  );
  const cents = (rows) => rows.reduce((s, e) => s + Math.round(Number(e.amount) * 100), 0);
  const gross = cents(entries.filter((e) => e.kind === 'COBRO')) / 100,
    payouts = cents(entries.filter((e) => e.kind === 'DESEMBOLSO')) / 100;
  const commission = entries.reduce((n, e) => n + Math.round(e.commission * 100), 0) / 100,
    net = Math.round((gross - commission) * 100) / 100;
  const allPaid = data.entries.filter((e) => ids.has(e.vehicle_id));
  const pending =
    data.reservations
      .filter((r) => ids.has(r.vehicle_id) && r.status === 'FINALIZADA')
      .reduce((sum, r) => {
        const list = allPaid.filter((e) => e.reservation_id === r.id);
        return (
          sum +
          (cents(list.filter((e) => e.kind === 'COBRO')) === Math.round(Number(r.total) * 100)
            ? Math.max(
                0,
                Math.round((Number(r.total) - Number(r.commission)) * 100) -
                  cents(list.filter((e) => e.kind === 'DESEMBOLSO')),
              )
            : 0)
        );
      }, 0) / 100;
  const reviews = data.reviews.filter(
    (r) =>
      ids.has(r.vehicle_id) &&
      (!view.from || r.created_at.slice(0, 10) >= view.from) &&
      (!view.to || r.created_at.slice(0, 10) <= view.to),
  );
  const usage = vehicles.map((v) => {
    const rs = reservations.filter((r) => r.vehicle_id === v.id && r.status !== 'CANCELADA');
    const from = view.from || [v.created_at.slice(0, 10), ...rs.map((r) => r.start_date)].sort()[0];
    const to = [view.to || data.today, data.today].sort()[0];
    const duration = Math.max(1, diferenciaDias(from, sumarDias(to)));
    const days = rs.reduce(
      (n, r) =>
        n +
        Math.max(
          0,
          diferenciaDias([r.start_date, from].sort().at(-1), [r.end_date, sumarDias(to)].sort()[0]),
        ),
      0,
    );
    const km = rs
      .filter(
        (r) =>
          r.return_km != null &&
          (!view.from || r.returned_at?.slice(0, 10) >= view.from) &&
          (!view.to || r.returned_at?.slice(0, 10) <= view.to),
      )
      .reduce((n, r) => n + r.return_km - r.delivery_km, 0);
    return {
      ...v,
      days,
      km,
      occupancy: Math.min(100, Math.round((days / duration) * 100)),
      gross: cents(entries.filter((e) => e.vehicle_id === v.id && e.kind === 'COBRO')) / 100,
    };
  });
  return {
    vehicles,
    reservations,
    entries,
    gross,
    commission,
    net,
    payouts,
    pending,
    reviews,
    rating: reviews.length ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length : null,
    usage,
    km: usage.reduce((n, v) => n + v.km, 0),
    days: usage.reduce((n, v) => n + v.days, 0),
  };
}
/** Agrupa movimientos monetarios por período para la representación gráfica. */
export function serieIngresos(entries, group) {
  const map = new Map();
  for (const e of entries.filter((e) => e.kind === 'COBRO')) {
    let key = e.paid_on;
    if (group === 'MENSUAL') key = key.slice(0, 7);
    else if (group === 'ANUAL') key = key.slice(0, 4);
    else if (group === 'SEMANAL') {
      const d = new Date(key);
      key = sumarDias(key, -((d.getUTCDay() + 6) % 7));
    }
    map.set(key, (map.get(key) || 0) + Math.round(Number(e.amount) * 100));
  }
  return [...map]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, cents]) => ({ label, value: cents / 100 }));
}
/** Escapa valores para exportación CSV, incluidos caracteres que podrían iniciar fórmulas. */
export function csv(rows) {
  const cell = (v) =>
    '"' +
    String(v ?? '')
      .replace(/^(\s*[=+@-])/u, "'$1")
      .replaceAll('"', '""') +
    '"';
  return '\ufeff' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
}
/** Genera una descarga CSV local desde filas ya autorizadas; no consulta información adicional al servidor. */
export function download(name, rows) {
  const url = URL.createObjectURL(new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
