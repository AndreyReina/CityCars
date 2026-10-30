# Catálogos de publicación

Nueva publicación y Editar vehículo usan `UbicacionPublicacion.svelte`, el mismo `SelectorPersonalizado` y `catalogoPublicacion.js`. Cambiar de marca limpia el modelo; escribir una búsqueda no sustituye la selección. Se valida la selección antes de enviar el formulario. No se alteran las reglas operativas del servidor.

## Cobertura y fuentes (consulta: 28 de octubre de 2026)

- 1.122 ubicaciones DIVIPOLA: 1.103 municipios/distritos, 18 áreas no municipalizadas y la isla de San Andrés. Fuente: [DANE, DIVIPOLA](https://www.datos.gov.co/Mapas-Nacionales/DIVIPOLA-C-digos-municipios/gdxc-w37w), descarga JSON `https://www.datos.gov.co/resource/gdxc-w37w.json?$limit=5000`.
- 211 marcas/denominaciones y 7.609 líneas o versiones, incluyendo referencias históricas. Fuente: [Ministerio de Transporte, tablas 2026](https://mintransporte.gov.co/publicaciones/12234/base-gravable-2026/). Se incluyen automóviles, camperos, camionetas, doble cabina y sus eléctricos/híbridos; no motos, buses, ambulancias o camiones de carga.
- Complemento de modelos G6, G9 y L03 de [XPENG Colombia](https://www.xpeng.com/co/).

Las tablas fiscales son una referencia amplia del parque automotor, no un registro en tiempo real de toda la oferta comercial. No se garantiza cobertura de cada lanzamiento posterior, importación particular ni versión no incluida por la fuente. No se añaden marcas anunciadas que aún no tienen oferta local verificada. El catálogo debe revisarse periódicamente; no se actualiza automáticamente.

## Reproducción

Descargar los siguientes archivos públicos en `.local/catalogs/` y ejecutar `python herramientas/importarCatalogos.py .local/catalogs` con `pdfplumber` instalado:

| Archivo local | Fuente pública |
| --- | --- |
| vehicles-2026.pdf | https://mintransporte.gov.co/info/mintransporte/media/anexos/xWWPhjxD.pdf |
| table2.pdf | https://mintransporte.gov.co/info/mintransporte/media/anexos/7XnDFsa6.pdf |
| table3.pdf | https://mintransporte.gov.co/info/mintransporte/media/anexos/YsDossPi.pdf |
| table4.pdf | https://mintransporte.gov.co/info/mintransporte/media/anexos/bJjiQQ7b.pdf |
| table9.pdf | https://mintransporte.gov.co/info/mintransporte/media/anexos/uXtwoDss.pdf |
| municipalities.json | https://www.datos.gov.co/resource/gdxc-w37w.json?$limit=5000 |

El manifiesto versionado registra huellas SHA-256 de las descargas, filas extraídas y totales. Revisar los cambios generados y ejecutar `node --test pruebas/catalogos.test.js` antes de actualizar. Los formularios usan copias locales y no dependen de servicios externos durante su uso.

## Normalización y compatibilidad

Se retiran filas fiscales genéricas (sin línea o líneas no incluidas), se consolidan mayúsculas y duplicados y se corrigen cortes tipográficos de marca. Las líneas conservan las versiones diferenciadas por la fuente. No se infieren modelos a partir del primer término.

Municipios ordenados alfabéticamente y etiquetados con departamento. Los homónimos guardan también el departamento para distinguirlos; Bogotá conserva su nombre utilizado en las publicaciones. La búsqueda reconoce tildes, mayúsculas, fragmentos y departamentos. Las denominaciones anteriores se conservan exclusivamente como opciones de la publicación editada, evitando borrar valores históricos o añadirlos a nuevas publicaciones. El selector de ciudad del catálogo público continúa mostrando solo ubicaciones con oferta disponible.
