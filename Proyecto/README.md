# CityCars

Aplicación de alquiler de vehículos con Svelte 5, Vite, Node.js 24, Express 5 y PostgreSQL. Utiliza SQL directo mediante `pg`, sin ORM.

## Ejecutar

```sh
npm ci
npm run build
npm start
```

Configura primero `.env` siguiendo `.env.example` y la [guía de desarrollo](documentacion/GUIA_DESARROLLO.md). Para una base nueva, aplica `npm run db:migrate` antes de iniciar. La limpieza del proyecto no ejecuta migraciones sobre la base existente.

La aplicación se abre en http://127.0.0.1:3000. Para desarrollo, ejecuta `npm run dev:api` y `npm run dev` en terminales separadas. La instancia PostgreSQL local se controla con `npm run db:start` y `npm run db:stop`.

## Organización MVC

- `backend/modelos`: consultas SQL, persistencia y operaciones transaccionales.
- `backend/controladores`: coordinación de solicitudes y respuestas HTTP.
- `backend/rutas`: endpoints, permisos y vinculación con controladores.
- `backend/servicios`: validaciones y transformaciones reutilizables.
- `backend/intermediarios`: sesión, autorización y validación de origen.
- `backend/configuracion`: conexión y transacciones PostgreSQL.
- `frontend/src`: vistas, componentes, estilos y cliente HTTP Svelte.
- `base_datos`: esquema y migraciones conservados.
- `herramientas`: inicio local, migración, datos de ejemplo, catálogos e inspección.
- `pruebas`: pruebas automatizadas.
- `documentacion`: guías operativas y registro de reorganización.

## Verificar

```sh
npm test
npm run build
```

Las pruebas de integración crean y eliminan una base temporal; requieren permisos `CREATEDB`. No usan la base de la aplicación para escribir datos de prueba.

[Documentación operativa](documentacion/README.md). Los pagos son simulados; los movimientos financieros son registros internos.
