# Guía del desarrollador
## Requisitos y configuración
Node.js 24 (>=24 <25), npm y PostgreSQL con btree_gist/unaccent. Se verificó PostgreSQL 17.11.
Python 3 y pdfplumber solo son necesarios para reimportar catálogos.

1. Ejecutar npm ci.
2. Preparar base PostgreSQL y usuario con permisos de migración.
3. Copiar .env.example a .env y reemplazar marcadores.
4. Configurar DATABASE_URL, SESSION_SECRET aleatorio de al menos 32 caracteres, PORT y APP_ORIGIN.
5. Ejecutar npm run db:migrate.
6. Opcional: npm run db:seed, sin reiniciar contraseñas existentes.

Nunca versionar .env ni .local/demo-accounts.json. El seed guarda allí contraseñas aleatorias locales, no se incluyen en documentos.

## Instancia aislada Windows
npm run db:start usa .local/postgresql/pgsql/bin y .local/pgdata, puerto 55432; no descarga binarios. Usa ruta corta 8.3 en inicialización. Sin alias 8.3, elegir ruta ASCII o instancia propia. npm run db:stop detiene sin borrar datos.
Si se inicializa clúster nuevo con .env existente, revisar antes la configuración: el script no sobrescribe secretos.

## Desarrollo
~~~sh
npm run db:start
npm run db:migrate
npm run dev:api
~~~
En otra terminal: npm run dev. Abrir http://127.0.0.1:5173.

## Ejecución compilada
~~~sh
npm run build
npm start
~~~
Abrir http://127.0.0.1:3000. No ejecutar start y dev:api simultáneamente.

## Verificación
~~~sh
npm test
npm run build
node --env-file=.env herramientas/inspeccionarEsquema.js
~~~
Integración crea una base citycars_test_* temporal y la elimina al terminar; requiere CREATEDB y extensiones. No usar credenciales de producción. Un fallo de importación anterior al bloque de limpieza puede dejar una base temporal; verificar origen antes de eliminarla.

La migración principal es aditiva pero contiene UPDATE y recreación de constraints/triggers: revisar y respaldar antes de aplicarla fuera del entorno local. Las migraciones históricas no se ejecutan automáticamente.

## Dónde ampliar
Vista: vistas/ y Aplicacion.svelte; componentes compartidos: componentes/; cliente HTTP: api.js.
Endpoint: backend/rutas/api.js con permitirRoles; coordinación: controladores/; SQL: modelos/; reglas: servicios/.
Cambios SQL requieren actualizar pruebas y el diccionario operativo de datos. No ejecutar migraciones como parte de una limpieza de archivos.

No cambiar sin revisar dependencias: claves JSON, roles, estados, SQL, bloqueos, precios históricos, rutas públicas, variables de entorno ni claves de navegador. Las rutas delegan en controladores; el SQL de negocio se concentra en modelos.

Catálogos: python herramientas/importarCatalogos.py .local/catalogs con pdfplumber. Fuentes y cobertura en CATALOGOS.md y frontend/src/datos/fuentes-catalogos.json; no se actualizan automáticamente.

Arquitectura y responsabilidades actuales: véase ARQUITECTURA.md.
