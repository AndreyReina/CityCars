/**
 * Configura la aplicación Express de CityCars.
 *
 * Integra las protecciones HTTP, la lectura de solicitudes JSON,
 * las sesiones en PostgreSQL, las rutas API y el frontend compilado.
 *
 * Esta función devuelve la aplicación configurada.
 * No inicia el servidor: esa responsabilidad corresponde a servidor.js.
 */

import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Conjunto de conexiones disponibles para acceder a PostgreSQL.
import { pool } from './configuracion/conexion.js';

// Agrupa los endpoints de la aplicación.
import { api } from './rutas/api.js';

// cargarUsuarioActual: recupera el usuario asociado a la sesión.
// validarOrigen: verifica las condiciones de seguridad de las solicitudes
// que modifican información, como origen, formato JSON y cabecera esperada.
import {
  cargarUsuarioActual,
  validarOrigen,
} from './intermediarios/autenticacion.js';

/**
 * Crea y configura una instancia de Express.
 *
 * Los middleware se ejecutan en el orden en que se registran.
 * Por eso las sesiones se configuran antes de cargar al usuario
 * y las rutas API se registran antes de servir el frontend.
 *
 * @returns {import('express').Express} Aplicación lista para escuchar conexiones.
 * @throws {Error} Si falta SESSION_SECRET o tiene menos de 32 caracteres.
 */
export function crearAplicacion() {
  // Comprueba que exista un secreto suficientemente largo.
  // express-session lo utiliza para firmar la cookie de sesión.
  if (
    !process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.length < 32
  )
    throw new Error(
      'Configura SESSION_SECRET con al menos 32 caracteres.',
    );

  // Crea una aplicación Express independiente.
  const app = express();

  // Evita enviar la cabecera que identifica a Express.
  // Esto reduce la información técnica expuesta en las respuestas.
  app.disable('x-powered-by');

  /**
   * Middleware de cabeceras de seguridad.
   *
   * Se ejecuta para todas las solicitudes.
   * "continuar" es la función next de Express: permite que la solicitud
   * avance al siguiente middleware o controlador.
   */
  app.use((solicitud, respuesta, continuar) => {
    // Indica al navegador que respete el Content-Type declarado,
    // evitando que intente interpretar el contenido como otro tipo.
    respuesta.set('X-Content-Type-Options', 'nosniff');

    // Permite enviar la cabecera Referer solo a destinos del mismo origen.
    respuesta.set('Referrer-Policy', 'same-origin');

    // Impide mostrar la página dentro de marcos, incluidos los iframe.
    respuesta.set('X-Frame-Options', 'DENY');

    continuar();
  });

  // Convierte el JSON recibido en un objeto disponible en solicitud.body.
  //
  // Las imágenes y los adjuntos requieren límites mayores porque viajan
  // codificados en base64 dentro del JSON. Estos límites corresponden
  // al cuerpo HTTP; los servicios validan también el tamaño del archivo.
  app.use('/api/vehicle-images', express.json({ limit: '12mb' }));
  app.use('/api/files', express.json({ limit: '5mb' }));

  // Establece un límite menor para las demás solicitudes JSON.
  // Los cuerpos procesados por los lectores anteriores no se vuelven a leer.
  app.use(express.json({ limit: '32kb' }));

  // Crea el adaptador que permite a express-session guardar
  // las sesiones en PostgreSQL.
  const Store = connectPgSimple(session);

  // Aplica la validación de origen y la gestión de sesiones
  // únicamente a las rutas que comienzan por /api.
  app.use(
    '/api',
    validarOrigen,
    session({
      // Nombre de la cookie que identifica la sesión del navegador.
      name: 'citycars.sid',

      // Secreto usado para firmar la cookie y detectar alteraciones.
      secret: process.env.SESSION_SECRET,

      // Evita volver a guardar una sesión que no ha sido modificada,
      // sin perjuicio de la actualización de vigencia del almacén.
      resave: false,

      // Evita guardar sesiones nuevas que todavía no contienen cambios.
      saveUninitialized: false,

      // Guarda los datos de sesión en la tabla sessions.
      // La cookie contiene el identificador; los datos permanecen
      // en el servidor, dentro de PostgreSQL.
      store: new Store({
        pool,
        tableName: 'sessions',
      }),

      cookie: {
        // Impide que JavaScript del navegador lea la cookie.
        httpOnly: true,

        // Limita el envío de la cookie en solicitudes entre sitios.
        // Es una protección complementaria, no reemplaza validarOrigen.
        sameSite: 'lax',

        // En producción, la cookie solo se envía mediante HTTPS.
        secure: process.env.NODE_ENV === 'production',

        // Define una vigencia de ocho horas, expresada en milisegundos.
        maxAge: 8 * 60 * 60 * 1000,
      },
    }),
  );

  // Primero carga el usuario de la sesión en solicitud.user.
  // Después entrega la solicitud al conjunto de rutas API.
  // Cada ruta aplica los permisos que correspondan.
  app.use('/api', cargarUsuarioActual, api);

  /**
   * Respuesta para endpoints API inexistentes.
   *
   * Si ninguna ruta anterior atendió la solicitud, devuelve un 404 JSON.
   * Esto evita que una URL API desconocida reciba el HTML del frontend.
   *
   * El prefijo "_" indica que el parámetro de solicitud no se utiliza.
   */
  app.use('/api', (_req, respuesta) =>
    respuesta.status(404).json({
      error: 'Ruta no encontrada.',
    }),
  );

  // Resuelve la carpeta dist respecto de este archivo.
  // fileURLToPath convierte la URL del módulo en una ruta del sistema,
  // compatible con espacios y diferencias entre Windows y otros sistemas.
  const dist = fileURLToPath(
    new URL('../dist/', import.meta.url),
  );

  // Sirve los archivos generados por Vite:
  // JavaScript, CSS, imágenes y demás recursos del frontend.
  app.use(express.static(dist));

  /**
   * Entrada del frontend para las rutas GET restantes.
   *
   * Devuelve index.html para que Svelte resuelva la navegación.
   * Permite abrir directamente direcciones como /carros o /panel.
   *
   * La sintaxis /{*path} de Express 5 incluye también la ruta raíz /.
   */
  app.get('/{*path}', (_req, respuesta) =>
    respuesta.sendFile(path.join(dist, 'index.html')),
  );

  /**
   * Middleware centralizado de errores.
   *
   * Express lo identifica por sus cuatro parámetros:
   * error, solicitud, respuesta y next.
   * Aunque _next no se utilice, debe conservarse en la firma.
   *
   * Recibe los errores propagados por los middleware y controladores,
   * incluidas las promesas rechazadas de manejadores async en Express 5.
   */
  app.use((error, solicitud, respuesta, _next) => {
    // Respeta el estado definido por la aplicación.
    // Si no existe, convierte ciertos errores de PostgreSQL en conflictos:
    // 23505: violación de una restricción UNIQUE.
    // 23P01: violación de una restricción de exclusión.
    // Los demás errores se consideran fallos internos (500).
    const status =
      error.status ||
      (error.code === '23505'
        ? 409
        : error.code === '23P01'
          ? 409
          : 500);

    // Registra información del fallo interno en la consola del servidor.
    // Ese detalle no se devuelve directamente al cliente.
    if (status === 500)
      console.error(error.code || error.message);

    // Devuelve un mensaje JSON según el tipo de error.
    //
    // Observación sobre el comportamiento existente:
    // 23505 puede corresponder a cualquier restricción UNIQUE,
    // aunque aquí siempre se comunica como correo duplicado.
    // 23P01 también puede originarse en exclusiones de mantenimiento.
    respuesta.status(status).json({
      error:
        error.code === '23505'
          ? 'El correo ya está registrado.'
          : error.code === '23P01'
            ? 'Las fechas ya están reservadas.'
            : status === 500
              ? 'No fue posible completar la operación. Intenta nuevamente.'
              : error.message,
    });
  });

  // Entrega la instancia configurada a servidor.js o a las pruebas.
  // El puerto y la escucha de conexiones se establecen fuera de esta función.
  return app;
}
