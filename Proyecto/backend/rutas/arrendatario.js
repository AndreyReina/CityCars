/** Endpoints privados de cuenta y favoritos. Capa: Rutas. */
import { Router } from 'express';
import { permitirRoles } from '../intermediarios/autenticacion.js';
import { ControladorArrendatario } from '../controladores/ControladorArrendatario.js';
export const renter = Router();
renter.use('/renter', permitirRoles('ARRENDATARIO'));
renter.get('/renter/account', ControladorArrendatario.cuenta);
renter.put('/renter/favorites/:id', ControladorArrendatario.cambiarFavorito);
renter.put('/renter/notifications/:id', ControladorArrendatario.leerNotificacion);
renter.put('/renter/profile', ControladorArrendatario.actualizarPerfil);
