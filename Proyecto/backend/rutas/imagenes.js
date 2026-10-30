/** Endpoints y permisos de fotografías. Capa: Rutas. */
import { Router } from 'express';
import { permitirRoles } from '../intermediarios/autenticacion.js';
import { ControladorImagenes } from '../controladores/ControladorImagenes.js';
export const images = Router();
images.post('/vehicle-images', permitirRoles('PROPIETARIO'), ControladorImagenes.crear);
images.get('/vehicle-images/:id', ControladorImagenes.obtener);
