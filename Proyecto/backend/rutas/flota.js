/** Declara endpoints de flota y sus permisos.
 * Capa: Rutas. Extracción del módulo de flota; conserva reglas y transacciones. */
import { Router } from 'express';
import { permitirRoles } from '../intermediarios/autenticacion.js';
import { ControladorFlota } from '../controladores/ControladorFlota.js';
export const fleet = Router();
fleet.get('/owner/overview', permitirRoles('PROPIETARIO'), ControladorFlota.resumen);
fleet.post('/owner/events/:id/read', permitirRoles('PROPIETARIO'), ControladorFlota.leerEvento);
fleet.post(
  '/owner/vehicles/:id/state',
  permitirRoles('PROPIETARIO'),
  ControladorFlota.cambiarEstadoVehiculo,
);
fleet.post('/owner/documents', permitirRoles('PROPIETARIO'), ControladorFlota.registrarDocumento);
fleet.post(
  '/owner/maintenance',
  permitirRoles('PROPIETARIO'),
  ControladorFlota.registrarMantenimiento,
);
fleet.put(
  '/owner/maintenance/:id',
  permitirRoles('PROPIETARIO'),
  ControladorFlota.cerrarMantenimiento,
);
fleet.post(
  '/owner/reservations/:id/odometer',
  permitirRoles('PROPIETARIO'),
  ControladorFlota.registrarKilometraje,
);
fleet.post('/reservations/:id/review', permitirRoles('ARRENDATARIO'), ControladorFlota.crearResena);
fleet.post('/owner/incidents', permitirRoles('PROPIETARIO'), ControladorFlota.crearIncidencia);
fleet.post(
  '/incidents/:id/messages',
  permitirRoles('PROPIETARIO', 'ADMINISTRADOR'),
  ControladorFlota.enviarMensaje,
);
fleet.post(
  '/files',
  permitirRoles('PROPIETARIO', 'ADMINISTRADOR'),
  ControladorFlota.guardarArchivo,
);
fleet.get(
  '/files/:id',
  permitirRoles('PROPIETARIO', 'ADMINISTRADOR'),
  ControladorFlota.obtenerArchivo,
);
fleet.post(
  '/admin/financial-entries',
  permitirRoles('ADMINISTRADOR'),
  ControladorFlota.registrarMovimiento,
);
