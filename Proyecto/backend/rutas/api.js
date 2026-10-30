/**
 * Relaciona endpoints HTTP con permisos y controladores; integra flota, imágenes y arrendatario.
 * Capa: Rutas y coordinación híbrida.
 * Relación: ./imagenes.js, ./arrendatario.js, ./flota.js, ../controladores/ControladorAdministracion.js, express, ../controladores/ControladorAutenticacion.js
 */
import { images } from './imagenes.js';
import { renter } from './arrendatario.js';
import { fleet } from './flota.js';
import { ControladorAdministracion } from '../controladores/ControladorAdministracion.js';
import { Router } from 'express';
import { ControladorAutenticacion } from '../controladores/ControladorAutenticacion.js';
import { ControladorVehiculos } from '../controladores/ControladorVehiculos.js';
import { ControladorReservas } from '../controladores/ControladorReservas.js';
import { permitirRoles } from '../intermediarios/autenticacion.js';
export const api = Router();
api.get('/auth/me', ControladorAutenticacion.actual);
api.post('/auth/register', ControladorAutenticacion.registrar);
api.post('/auth/login', ControladorAutenticacion.ingresar);
api.post('/auth/logout', ControladorAutenticacion.salir);
api.get('/vehicles', ControladorVehiculos.catalogo);
api.get('/vehicle-cities', ControladorVehiculos.ciudades);
api.get('/vehicles/:id', ControladorVehiculos.detalle);
api.get('/vehicles/:id/quote', ControladorReservas.previsualizar);
api.get('/owner/vehicles', permitirRoles('PROPIETARIO'), ControladorVehiculos.propios);
api.post('/owner/vehicles', permitirRoles('PROPIETARIO'), ControladorVehiculos.crear);
api.put('/owner/vehicles/:id', permitirRoles('PROPIETARIO'), ControladorVehiculos.actualizar);
api.post(
  '/owner/vehicles/:id/deactivate',
  permitirRoles('PROPIETARIO'),
  ControladorVehiculos.desactivar,
);
api.get('/admin/vehicles', permitirRoles('ADMINISTRADOR'), ControladorVehiculos.todos);
api.post(
  '/admin/vehicles/:id/review',
  permitirRoles('ADMINISTRADOR'),
  ControladorAdministracion.revisar,
);
api.get(
  '/reservations',
  permitirRoles('ARRENDATARIO', 'PROPIETARIO', 'ADMINISTRADOR'),
  ControladorReservas.listar,
);
api.post('/reservations', permitirRoles('ARRENDATARIO'), ControladorReservas.crear);
api.post('/reservations/:id/cancel', permitirRoles('ARRENDATARIO'), ControladorReservas.cancelar);
api.post('/reservations/:id/finish', permitirRoles('PROPIETARIO'), ControladorReservas.finalizar);

api.get('/admin/overview', permitirRoles('ADMINISTRADOR'), ControladorAdministracion.resumen);
for (const type of ['owners', 'vehicles'])
  api.post(
    '/admin/' + type + '/:id/restriction',
    permitirRoles('ADMINISTRADOR'),
    (solicitud, respuesta, continuar) => {
      solicitud.params.type = type;
      return ControladorAdministracion.restringir(solicitud, respuesta, continuar);
    },
  );
api.post(
  '/admin/incidents',
  permitirRoles('ADMINISTRADOR'),
  ControladorAdministracion.crearIncidencia,
);
api.put(
  '/admin/incidents/:id',
  permitirRoles('ADMINISTRADOR'),
  ControladorAdministracion.actualizarIncidencia,
);

api.use(fleet);

api.use(images);
api.use(renter);
