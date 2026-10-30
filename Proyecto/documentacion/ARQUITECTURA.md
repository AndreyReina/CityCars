# Arquitectura operativa

El flujo de una operación es: vista Svelte → cliente HTTP → ruta Express y permisos → controlador → servicio/modelo → PostgreSQL → respuesta HTTP → vista.

## Responsabilidades

Los archivos de `backend/rutas` declaran endpoints y middleware. No contienen consultas SQL ni manejadores de negocio anónimos, salvo la adaptación existente del tipo de restricción administrativa.

Los siete controladores reciben los parámetros HTTP, llaman a modelos/servicios y configuran estados, JSON o descargas. Los modelos Usuario, Vehiculo, Reserva, Administracion, Flota, Arrendatario e Imagen contienen el acceso a PostgreSQL. Los modelos de flota y reservas conservan las comprobaciones de negocio junto a los bloqueos y transacciones donde deben ejecutarse atómicamente.

Los servicios validan reglas, fechas, horarios, propiedad de imágenes, adjuntos y transformación de fotos. La comprobación de propiedad de fotos delega su consulta al modelo Imagen. No hay SQL en rutas, controladores ni servicios. El SELECT 1 de arranque y BEGIN/COMMIT/ROLLBACK pertenecen a infraestructura, no a operaciones del negocio.

La configuración Express conserva el almacenamiento de sesiones mediante connect-pg-simple, los límites de carga, cabeceras, estáticos y manejo de errores. El middleware conserva la autorización de roles y suspensiones.

## Módulos extraídos

| Ruta | Controlador | Modelo | Servicios relacionados |
|---|---|---|---|
| flota.js | ControladorFlota | Flota | reglasFlota, archivos, reglas |
| arrendatario.js | ControladorArrendatario | Arrendatario | reglas |
| imagenes.js | ControladorImagenes | Imagen | procesarImagen, reglas |

Los modelos nuevos reciben usuario, parámetros y datos simples; no reciben objetos Request/Response de Express. Los endpoints y claves JSON se conservaron.

## Persistencia y vistas

`base_datos/esquema.sql` y `base_datos/migraciones` permanecen intactos. El DER propuesto en la conversación no fue aplicado. Los catálogos JSON del frontend y los activos de frontend/public permanecen en sus ubicaciones. La salida dist es generada por Vite y es necesaria para npm start.

`.local/pgdata` contiene datos persistentes y no es una carpeta temporal. `.env` y `.local/demo-accounts.json` contienen configuración privada. No deben versionarse ni eliminarse como limpieza.
