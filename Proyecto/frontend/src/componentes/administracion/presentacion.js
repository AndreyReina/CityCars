/**
 * Funciones puras de estado, filtrado, métricas y exportación del panel; no accede a PostgreSQL.
 * Capa: Vista / presentación.
 * Relación: Consumido por su página, script de ejecución o proceso de compilación.
 */
export const modules = [
  { id: 'resumen', name: 'Resumen', description: 'Indicadores y prioridades de la plataforma.' },
  {
    id: 'publicaciones',
    name: 'Publicaciones',
    description: 'Revisa y controla las publicaciones de vehículos.',
    source: 'vehicles',
    states: ['PENDIENTE_APROBACION', 'APROBADO', 'RECHAZADO', 'INACTIVO', 'SUSPENDIDA'],
  },
  {
    id: 'propietarios',
    name: 'Propietarios',
    description: 'Consulta las cuentas y sus vehículos asociados.',
    source: 'owners',
    states: ['HABILITADO', 'SUSPENDIDO'],
  },
  {
    id: 'reservas',
    name: 'Reservas',
    description: 'Consulta operaciones y exporta reportes filtrados.',
    source: 'reservations',
    states: ['CONFIRMADA', 'FINALIZADA', 'CANCELADA'],
  },
  {
    id: 'incidencias',
    name: 'Incidencias',
    description: 'Registra casos y da seguimiento a su resolución.',
    source: 'incidents',
    states: ['ABIERTA', 'EN_REVISION', 'PENDIENTE_INFO', 'RESUELTA', 'CERRADA'],
  },
  {
    id: 'actividad',
    name: 'Actividad',
    description: 'Últimas 100 acciones administrativas y sus responsables.',
    source: 'actions',
    states: [],
  },
];
export const rutaDesdeFragmento = (hash) =>
  modules.some((m) => hash === '#/' + m.id) ? hash.slice(2) : 'resumen';
export const label = (value) => String(value).replaceAll('_', ' ');
export const options = (values) => values.map((value) => ({ value, label: label(value) }));
export const date = (value) =>
  new Date(value).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
export const normalize = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
/** Restaura vistas persistidas con valores por defecto independientes para impedir contaminación entre módulos. */
export function vistasIniciales(saved = {}) {
  return Object.fromEntries(
    modules.map((m) => {
      const v = saved[m.id] || {};
      return [
        m.id,
        {
          query: typeof v.query === 'string' ? v.query : '',
          filter: (m.states || []).includes(v.filter) ? v.filter : '',
          page: Number.isInteger(v.page) && v.page > 0 ? v.page : 1,
          tab: ['operacion', 'finanzas', 'evolucion'].includes(v.tab) ? v.tab : 'operacion',
        },
      ];
    }),
  );
}
/** Combina texto normalizado, filtros del módulo y estado operativo sin alterar los registros originales. */
export function filtrarRegistros(data, module, view) {
  return (data[module.source] || []).filter((r) => {
    const fields =
      module.id === 'publicaciones'
        ? [r.id, r.brand, r.model, r.city, r.owner_name, r.owner_email]
        : module.id === 'propietarios'
          ? [r.id, r.name, r.email]
          : module.id === 'reservas'
            ? [
                r.id,
                r.brand,
                r.model,
                r.city,
                r.owner_name,
                r.renter_name,
                r.owner_email,
                r.renter_email,
              ]
            : module.id === 'incidencias'
              ? [r.id, r.title, r.description, r.owner_id, r.vehicle_id]
              : [r.id, r.action, r.entity_type, r.entity_id, r.reason, r.admin_name];
    const status =
      module.id === 'publicaciones'
        ? view.filter === 'SUSPENDIDA'
          ? r.blocked || r.owner_suspended
          : r.status === view.filter
        : module.id === 'propietarios'
          ? (view.filter === 'SUSPENDIDO') === r.suspended
          : r.status === view.filter;
    return normalize(fields.join(' ')).includes(normalize(view.query)) && (!view.filter || status);
  });
}
/** Limita la página al rango válido después de filtrar y devuelve el segmento y metadatos de paginación. */
export function paginar(rows, page, size = 8) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(pages, Math.max(1, Number.isInteger(page) ? page : 1));
  return {
    rows: rows.slice((current - 1) * size, current * size),
    page: current,
    pages,
    total: rows.length,
    start: rows.length ? (current - 1) * size + 1 : 0,
    end: Math.min(current * size, rows.length),
  };
}
/** Genera CSV de las reservas filtradas y protege celdas que podrían interpretarse como fórmulas. */
export function reservasCsv(rows) {
  const data = [
    [
      'Reserva',
      'Vehículo',
      'Propietario',
      'Arrendatario',
      'Inicio',
      'Devolución',
      'Estado',
      'Total simulado COP',
      'Comisión simulada COP',
    ],
    ...rows.map((r) => [
      r.id,
      r.brand + ' ' + r.model,
      r.owner_name,
      r.renter_name,
      r.start_date,
      r.end_date,
      r.status,
      r.total,
      r.commission,
    ]),
  ];
  const cell = (value) =>
    '"' +
    String(value)
      .replace(/^(\s*[=+@-])/u, "'$1")
      .replaceAll('"', '""') +
    '"';
  return '\ufeff' + data.map((row) => row.map(cell).join(';')).join('\r\n');
}
