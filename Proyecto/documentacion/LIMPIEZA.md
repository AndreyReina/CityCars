# Reorganización MVC y limpieza

## Alcance

Se conservan Svelte, Express, Node.js, PostgreSQL y pg. No se alteraron endpoints, claves JSON, reglas del negocio, esquema SQL ni archivos del frontend. No se ejecutó ninguna migración ni carga de datos sobre la base CityCars. No se crearon commits, etiquetas ni cambios en el historial de Git.

El usuario aclaró expresamente que se retiraran documentación académica y UML, conservando SQL, migraciones y documentación operativa. Esa aclaración incluye los diagramas que tenían cambios locales previos.

## Estructura final

```text
Proyecto/
├── backend/
│   ├── configuracion/       # Conexión y transacciones
│   ├── controladores/       # Siete controladores HTTP
│   ├── intermediarios/      # Sesión, permisos y origen
│   ├── modelos/             # Siete modelos con acceso SQL
│   ├── rutas/               # Endpoints y middleware
│   ├── servicios/           # Reglas y procesamiento de archivos
│   ├── aplicacion.js
│   └── servidor.js
├── frontend/
│   ├── public/              # Activos públicos
│   ├── src/
│   │   ├── componentes/
│   │   ├── datos/
│   │   ├── vistas/
│   │   ├── Aplicacion.svelte
│   │   ├── api.js
│   │   ├── datosPortada.js
│   │   ├── estilos.css
│   │   └── principal.js
│   └── index.html
├── base_datos/
│   ├── esquema.sql
│   └── migraciones/
├── herramientas/            # Cinco herramientas operativas
├── pruebas/                 # Suite existente conservada
├── documentacion/           # Guías operativas y metadatos físicos
├── .local/                  # Recursos privados y PostgreSQL local
├── dist/                    # Compilación regenerable usada por npm start
├── node_modules/            # Dependencias instaladas desde lockfile
├── .env / .env.example
├── .gitignore / .prettierrc.json
├── package.json / package-lock.json
├── vite.config.js
└── README.md
```

## Código reorganizado

| Origen | Responsabilidad extraída / ubicación actual |
|---|---|
| backend/rutas/flota.js | SQL y transacciones en modelos/Flota.js; HTTP en controladores/ControladorFlota.js; validaciones puras en servicios/reglasFlota.js y servicios/archivos.js. |
| backend/rutas/arrendatario.js | SQL en modelos/Arrendatario.js; HTTP en controladores/ControladorArrendatario.js. |
| backend/rutas/imagenes.js | SQL en modelos/Imagen.js; HTTP en controladores/ControladorImagenes.js; procesamiento Sharp en servicios/procesarImagen.js. |
| backend/servicios/imagenesVehiculo.js | Conserva la validación, delegando la consulta de titularidad a Imagen.perteneceA. |
| documentacion/06_guia_desarrollador.md | documentacion/GUIA_DESARROLLO.md, referencias y comandos actualizados. |
| documentacion/12_diccionario_datos.md | documentacion/DATOS.md; conserva el esquema físico y evidencia asociada. |
| documentacion/antecedentes/CATALOGOS.md | documentacion/CATALOGOS.md, rutas de componentes, pruebas e importador actualizadas. |

README.md y las guías README/ARQUITECTURA/LIMPIEZA de documentacion describen la organización operativa. No se crearon capas adicionales ni se introdujeron dependencias.

## Elementos retirados

- Documentación académica numerada restante: requisitos, casos de uso, trazabilidad, explicaciones UML, inventarios y auditorías de la reorganización anterior. La guía operativa y el diccionario físico se conservaron con nombres claros.
- documentacion/diagramas, incluidos PlantUML, DOT, Mermaid, SVG, PNG y generadores locales de casos de uso.
- documentacion/antecedentes, después de conservar la guía de catálogos; CONTEXTO_PROYECTO_CODEX.md, contexto académico histórico.
- Evidencias exclusivamente académicas: clases, relaciones para diagramas, trazabilidad, responsabilidades, contratos de la etapa anterior y mapas de renombrado. Se conserva evidencias/esquema_verificado.json como referencia del diccionario físico.
- Generadores exclusivos de esa documentación: exportarDiagramas.js, generarDatosDocumentados.py, generarDiagramas.py, generarInventario.py y validarDocumentacion.py.
- Recursos locales exclusivos de UML: .local/diagramador, .local/uml-runtime y cuatro imágenes revision-* de los diagramas anteriores.
- Scripts de una sola ejecución de la refactorización anterior en .local: comentarFunciones.py, documentarCodigo.py, especificar.py, redactar.py, reorganizar.py, traducir.mjs y traducirVistas.mjs. Caché Python de herramientas cuando estaba presente.

Estos elementos no intervienen en los scripts de ejecución de la aplicación. Las referencias operativas afectadas se actualizaron.

## Elementos conservados

- Todas las pruebas, el esquema SQL y la migración 002_textos_publicos.sql.
- .local/pgdata, .local/postgresql, .env y demo-accounts.json: datos, ejecutables y configuración privada necesarios para el entorno local.
- .local/catalogs: fuentes para reconstruir los catálogos; no son archivos temporales descartables.
- .local/postgresql.zip: instalador local que puede servir para recuperar el entorno, conservado por precaución.
- Capturas históricas de la aplicación y postgres.log: se conserva su valor de evidencia/diagnóstico; no son duplicados demostrados.
- Métodos de revisión de vehículos no enlazados directamente a la ruta administrativa: se conservan por compatibilidad; no se asumió que carecieran de uso externo.
- dist y node_modules: generados, ignorados por Git y necesarios para la ejecución local; se regeneraron, no se movieron.

## Validaciones ejecutadas

| Comprobación | Resultado |
|---|---|
| npm ci --no-audit --no-fund | Correcto: 133 paquetes instalados según lockfile. El intento offline falló por caché incompleta; un intento posterior encontró Sharp bloqueado por el servidor. Se detuvo únicamente el proceso identificado de CityCars y se repitió con éxito. |
| npm ls --depth=0 | Dependencias directas resueltas, sin errores. |
| npm run build | Correcto: 161 módulos; sin errores de compilación. Vite informa que utiliza la configuración Svelte predeterminada. |
| npm test | 34 pruebas aprobadas, 0 fallos. Integración sobre base temporal independiente, eliminada por la suite. |
| Comparación AST de rutas | 19 endpoints extraídos conservan método, URL y middleware de roles; api.js permanece sin cambios. |
| Comparación de consultas | Las 46 consultas SQL extraídas conservan su texto; se preservaron wrappers y límites transaccionales. |
| PostgreSQL existente | Transacción BEGIN READ ONLY / ROLLBACK correcta; versión 17.11, 16 tablas. Sin escrituras de negocio. |
| npm start | Express iniciado en http://127.0.0.1:3000. |
| HTTP GET público | /, /carros, /api/vehicles, /api/vehicle-cities y /api/auth/me devuelven 200. |
| HTTP GET privado sin sesión | /api/owner/overview y /api/renter/account devuelven 401. |
| Ruta API inexistente | Devuelve 404. |
| Separación MVC | No quedan llamadas SQL query en rutas, controladores ni servicios. |
| Integridad del alcance | git diff confirma sin cambios en frontend, base_datos, pruebas, package.json y package-lock.json. |

No se repitió una inspección visual completa en navegador ni una prueba de carga. La compilación, pruebas existentes y comprobaciones HTTP no sustituyen esas verificaciones. El frontend permanece intacto.
