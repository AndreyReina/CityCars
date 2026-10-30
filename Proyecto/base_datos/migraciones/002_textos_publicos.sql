-- Migración histórica de textos públicos; no forma parte de la ejecución automática.
-- Revisar alcance y respaldo antes de aplicarla manualmente sobre datos propios.
-- Actualiza únicamente los textos de ejemplo creados durante la integración.
-- No altera publicaciones redactadas por usuarios ni sus ciudades.
BEGIN;
UPDATE vehicles SET description='Consulta la tarifa diaria y elige las fechas que mejor se ajusten a tu próximo viaje.'
WHERE description='Automóvil de demostración para probar el catálogo y las reservas académicas.'
AND owner_id IN (SELECT id FROM users WHERE email='propietario@citycars.test');
UPDATE vehicles SET model='Civic Hatchback', description='Consulta la disponibilidad de este Honda Civic en Bogotá y organiza tu próxima ruta.'
WHERE model='Civic · Prueba de publicación'
AND description='Publicación de demostración creada durante la verificación de la interfaz.'
AND owner_id IN (SELECT id FROM users WHERE email='propietario@citycars.test');
COMMIT;
