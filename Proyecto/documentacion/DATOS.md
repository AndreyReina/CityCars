# Diccionario de datos físico

Fuente: pg_catalog de PostgreSQL 17.11, inspección de solo lectura del 29 de octubre de 2026. [Evidencia completa](evidencias/esquema_verificado.json). Se verificaron 16 tablas y 139 columnas; no se copiaron filas de negocio.

Tipos, nulabilidad, defaults, índices y constraints se transcriben del motor. Los roles de las FK a users se validan además en la aplicación; la FK por sí sola no obliga a que el usuario tenga un rol concreto. Todos los ON DELETE/UPDATE no especificados usan NO ACTION.

## admin_actions

Auditoría de decisiones administrativas; entity_id es referencia lógica, no FK polimórfica.

| Campo | Tipo | PK/FK | Nulo | Valor por defecto / identidad | Descripción |
|---|---|---|---|---|---|
| id | integer | PK | No | GENERATED ALWAYS AS IDENTITY | Identificador de la fila. |
| admin_id | integer | FK → users | No | Sin default | Usuario administrador autor de la decisión. |
| entity_type | character varying(20) | — | No | Sin default | Tipo lógico de entidad auditada. |
| entity_id | integer | — | No | Sin default | Identificador lógico; no tiene FK. |
| action | character varying(40) | — | No | Sin default | Acción registrada. |
| reason | text | — | No | Sin default | Motivo de la decisión. |
| created_at | timestamp with time zone | — | No | now() | Instante de creación. |

### Restricciones

- admin_actions_admin_id_fkey: FOREIGN KEY (admin_id) REFERENCES users(id)
- admin_actions_pkey: PRIMARY KEY (id)

### Índices

- admin_actions_pkey: CREATE UNIQUE INDEX admin_actions_pkey ON public.admin_actions USING btree (id)

## financial_entries

Asientos manuales de cobro/desembolso, no transacciones bancarias ejecutadas.

| Campo | Tipo | PK/FK | Nulo | Valor por defecto / identidad | Descripción |
|---|---|---|---|---|---|
| id | integer | PK | No | GENERATED ALWAYS AS IDENTITY | Identificador de la fila. |
| reservation_id | integer | FK → reservations | No | Sin default | Reserva relacionada. |
| kind | character varying(12) | — | No | Sin default | Tipo de registro: documento, mantenimiento, incidencia o movimiento. |
| amount | numeric(14,2) | — | No | Sin default | Importe positivo del asiento. |
| reference | character varying(180) | — | No | Sin default | Referencia manual única del movimiento. |
| paid_on | date | — | No | Sin default | Fecha informada del movimiento. |
| created_by | integer | FK → users | No | Sin default | Usuario autor del registro. |
| created_at | timestamp with time zone | — | No | now() | Instante de creación. |

### Restricciones

- financial_entries_amount_check: CHECK ((amount > (0)::numeric))
- financial_entries_created_by_fkey: FOREIGN KEY (created_by) REFERENCES users(id)
- financial_entries_kind_check: CHECK (((kind)::text = ANY ((ARRAY['COBRO'::character varying, 'DESEMBOLSO'::character varying])::text[])))
- financial_entries_pkey: PRIMARY KEY (id)
- financial_entries_reference_key: UNIQUE (reference)
- financial_entries_reservation_id_fkey: FOREIGN KEY (reservation_id) REFERENCES reservations(id)

### Índices

- financial_entries_pkey: CREATE UNIQUE INDEX financial_entries_pkey ON public.financial_entries USING btree (id)
- financial_entries_reference_key: CREATE UNIQUE INDEX financial_entries_reference_key ON public.financial_entries USING btree (reference)

### Disparadores

- fleet_track_changes: CREATE TRIGGER fleet_track_changes AFTER INSERT OR UPDATE ON public.financial_entries FOR EACH ROW EXECUTE FUNCTION fleet_track()

## fleet_events

Historial de cambios y avisos del propietario generado por triggers.

| Campo | Tipo | PK/FK | Nulo | Valor por defecto / identidad | Descripción |
|---|---|---|---|---|---|
| id | integer | PK | No | GENERATED ALWAYS AS IDENTITY | Identificador de la fila. |
| owner_id | integer | FK → users | No | Sin default | Usuario propietario responsable. |
| vehicle_id | integer | FK → vehicles | Sí | Sin default | Vehículo relacionado. |
| module | character varying(24) | — | No | Sin default | Módulo de destino del evento. |
| record_id | integer | — | No | Sin default | Identificador lógico del registro; no FK. |
| action | character varying(60) | — | No | Sin default | Acción registrada. |
| detail | jsonb | — | No | '{}'::jsonb | JSONB con estado o antes/después del cambio. |
| read_at | timestamp with time zone | — | Sí | Sin default | Instante de lectura, null si no leído. |
| created_at | timestamp with time zone | — | No | now() | Instante de creación. |

### Restricciones

- fleet_events_owner_id_fkey: FOREIGN KEY (owner_id) REFERENCES users(id)
- fleet_events_pkey: PRIMARY KEY (id)
- fleet_events_vehicle_id_fkey: FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)

### Índices

- fleet_events_owner_idx: CREATE INDEX fleet_events_owner_idx ON public.fleet_events USING btree (owner_id, id DESC)
- fleet_events_pkey: CREATE UNIQUE INDEX fleet_events_pkey ON public.fleet_events USING btree (id)

## fleet_files

Comprobantes privados y contenido binario de adjuntos.

| Campo | Tipo | PK/FK | Nulo | Valor por defecto / identidad | Descripción |
|---|---|---|---|---|---|
| id | integer | PK | No | GENERATED ALWAYS AS IDENTITY | Identificador de la fila. |
| owner_id | integer | FK → users | No | Sin default | Usuario propietario responsable. |
| name | character varying(180) | — | No | Sin default | Nombre del usuario o archivo según tabla. |
| mime | character varying(40) | — | No | Sin default | Tipo de contenido validado del comprobante. |
| content | bytea | — | No | Sin default | Bytes del archivo; máximo 3 MB por constraint. |
| created_at | timestamp with time zone | — | No | now() | Instante de creación. |

### Restricciones

- fleet_files_content_check: CHECK ((octet_length(content) <= 3145728))
- fleet_files_owner_id_fkey: FOREIGN KEY (owner_id) REFERENCES users(id)
- fleet_files_pkey: PRIMARY KEY (id)

### Índices

- fleet_files_pkey: CREATE UNIQUE INDEX fleet_files_pkey ON public.fleet_files USING btree (id)

## incident_messages

Mensajes de seguimiento con autor y adjunto opcional.

| Campo | Tipo | PK/FK | Nulo | Valor por defecto / identidad | Descripción |
|---|---|---|---|---|---|
| id | integer | PK | No | GENERATED ALWAYS AS IDENTITY | Identificador de la fila. |
| incident_id | integer | FK → incidents | No | Sin default | Caso al que pertenece el mensaje. |
| author_id | integer | FK → users | No | Sin default | Usuario autor del mensaje. |
| body | text | — | No | Sin default | Texto del mensaje. |
| file_id | integer | FK → fleet_files | Sí | Sin default | Comprobante privado opcional. |
| created_at | timestamp with time zone | — | No | now() | Instante de creación. |

### Restricciones

- incident_messages_author_id_fkey: FOREIGN KEY (author_id) REFERENCES users(id)
- incident_messages_file_id_fkey: FOREIGN KEY (file_id) REFERENCES fleet_files(id)
- incident_messages_incident_id_fkey: FOREIGN KEY (incident_id) REFERENCES incidents(id)
- incident_messages_pkey: PRIMARY KEY (id)

### Índices

- incident_messages_pkey: CREATE UNIQUE INDEX incident_messages_pkey ON public.incident_messages USING btree (id)

### Disparadores

- fleet_track_changes: CREATE TRIGGER fleet_track_changes AFTER INSERT OR UPDATE ON public.incident_messages FOR EACH ROW EXECUTE FUNCTION fleet_track()

## incidents

Reportes y seguimiento de incidencias asociados opcionalmente a vehículo, propietario o reserva.

| Campo | Tipo | PK/FK | Nulo | Valor por defecto / identidad | Descripción |
|---|---|---|---|---|---|
| id | integer | PK | No | GENERATED ALWAYS AS IDENTITY | Identificador de la fila. |
| created_by | integer | FK → users | No | Sin default | Usuario autor del registro. |
| vehicle_id | integer | FK → vehicles | Sí | Sin default | Vehículo relacionado. |
| owner_id | integer | FK → users | Sí | Sin default | Usuario propietario responsable. |
| title | character varying(160) | — | No | Sin default | Título del reporte. |
| description | text | — | No | Sin default | Descripción funcional del registro. |
| priority | character varying(10) | — | No | Sin default | Prioridad BAJA, MEDIA o ALTA. |
| status | character varying(16) | — | No | 'ABIERTA'::character varying | Estado permitido por constraint, según tabla. |
| resolution | text | — | No | ''::text | Última nota o resolución administrativa. |
| created_at | timestamp with time zone | — | No | now() | Instante de creación. |
| updated_at | timestamp with time zone | — | No | now() | Instante de última actualización. |
| reservation_id | integer | FK → reservations | Sí | Sin default | Reserva relacionada. |
| kind | character varying(30) | — | No | 'GENERAL'::character varying | Tipo de registro: documento, mantenimiento, incidencia o movimiento. |
| file_id | integer | FK → fleet_files | Sí | Sin default | Comprobante privado opcional. |

### Restricciones

- incidents_created_by_fkey: FOREIGN KEY (created_by) REFERENCES users(id)
- incidents_file_id_fkey: FOREIGN KEY (file_id) REFERENCES fleet_files(id)
- incidents_owner_id_fkey: FOREIGN KEY (owner_id) REFERENCES users(id)
- incidents_pkey: PRIMARY KEY (id)
- incidents_priority_check: CHECK (((priority)::text = ANY ((ARRAY['BAJA'::character varying, 'MEDIA'::character varying, 'ALTA'::character varying])::text[])))
- incidents_reservation_id_fkey: FOREIGN KEY (reservation_id) REFERENCES reservations(id)
- incidents_status_check: CHECK (((status)::text = ANY ((ARRAY['ABIERTA'::character varying, 'EN_REVISION'::character varying, 'PENDIENTE_INFO'::character varying, 'RESUELTA'::character varying, 'CERRADA'::character varying])::text[])))
- incidents_vehicle_id_fkey: FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)

### Índices

- incidents_pkey: CREATE UNIQUE INDEX incidents_pkey ON public.incidents USING btree (id)

### Disparadores

- fleet_track_changes: CREATE TRIGGER fleet_track_changes AFTER INSERT OR UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION fleet_track()

## maintenance

Planes de mantenimiento con intervalo bloqueante opcional.

| Campo | Tipo | PK/FK | Nulo | Valor por defecto / identidad | Descripción |
|---|---|---|---|---|---|
| id | integer | PK | No | GENERATED ALWAYS AS IDENTITY | Identificador de la fila. |
| vehicle_id | integer | FK → vehicles | No | Sin default | Vehículo relacionado. |
| kind | character varying(80) | — | No | Sin default | Tipo de registro: documento, mantenimiento, incidencia o movimiento. |
| description | text | — | No | Sin default | Descripción funcional del registro. |
| due_date | date | — | No | Sin default | Fecha programada del mantenimiento. |
| due_km | integer | — | Sí | Sin default | Kilometraje objetivo opcional. |
| start_date | date | — | Sí | Sin default | Inicio del intervalo por fecha. |
| end_date | date | — | Sí | Sin default | Devolución/fin exclusivo para cálculo por días. |
| status | character varying(12) | — | No | 'PROGRAMADO'::character varying | Estado permitido por constraint, según tabla. |
| completed_date | date | — | Sí | Sin default | Fecha de realización informada. |
| mileage | integer | — | Sí | Sin default | Kilometraje informado; null significa no registrado. |
| cost | numeric(14,2) | — | No | 0 | Costo de mantenimiento, no negativo. |
| file_id | integer | FK → fleet_files | Sí | Sin default | Comprobante privado opcional. |
| created_at | timestamp with time zone | — | No | now() | Instante de creación. |

### Restricciones

- maintenance_check: CHECK ((((start_date IS NULL) AND (end_date IS NULL)) OR ((start_date IS NOT NULL) AND (end_date IS NOT NULL) AND (end_date > start_date))))
- maintenance_cost_check: CHECK ((cost >= (0)::numeric))
- maintenance_due_km_check: CHECK ((due_km >= 0))
- maintenance_file_id_fkey: FOREIGN KEY (file_id) REFERENCES fleet_files(id)
- maintenance_mileage_check: CHECK ((mileage >= 0))
- maintenance_pkey: PRIMARY KEY (id)
- maintenance_status_check: CHECK (((status)::text = ANY ((ARRAY['PROGRAMADO'::character varying, 'COMPLETADO'::character varying, 'CANCELADO'::character varying])::text[])))
- maintenance_vehicle_id_daterange_excl: EXCLUDE USING gist (vehicle_id WITH =, daterange(start_date, end_date, '[)'::text) WITH &&) WHERE ((((status)::text = 'PROGRAMADO'::text) AND (start_date IS NOT NULL)))
- maintenance_vehicle_id_fkey: FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)

### Índices

- maintenance_pkey: CREATE UNIQUE INDEX maintenance_pkey ON public.maintenance USING btree (id)
- maintenance_vehicle_id_daterange_excl: CREATE INDEX maintenance_vehicle_id_daterange_excl ON public.maintenance USING gist (vehicle_id, daterange(start_date, end_date, '[)'::text)) WHERE (((status)::text = 'PROGRAMADO'::text) AND (start_date IS NOT NULL))

### Disparadores

- fleet_track_changes: CREATE TRIGGER fleet_track_changes AFTER INSERT OR UPDATE ON public.maintenance FOR EACH ROW EXECUTE FUNCTION fleet_track()

## renter_favorites

Asociación N:M entre arrendatarios y publicaciones favoritas.

| Campo | Tipo | PK/FK | Nulo | Valor por defecto / identidad | Descripción |
|---|---|---|---|---|---|
| renter_id | integer | PK, FK → users | No | Sin default | Usuario arrendatario. |
| vehicle_id | integer | PK, FK → vehicles | No | Sin default | Vehículo relacionado. |
| created_at | timestamp with time zone | — | No | now() | Instante de creación. |

### Restricciones

- renter_favorites_pkey: PRIMARY KEY (renter_id, vehicle_id)
- renter_favorites_renter_id_fkey: FOREIGN KEY (renter_id) REFERENCES users(id)
- renter_favorites_vehicle_id_fkey: FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)

### Índices

- renter_favorites_pkey: CREATE UNIQUE INDEX renter_favorites_pkey ON public.renter_favorites USING btree (renter_id, vehicle_id)

## renter_notifications

Avisos internos por estado de reserva para cada arrendatario.

| Campo | Tipo | PK/FK | Nulo | Valor por defecto / identidad | Descripción |
|---|---|---|---|---|---|
| id | integer | PK | No | GENERATED ALWAYS AS IDENTITY | Identificador de la fila. |
| renter_id | integer | FK → users | No | Sin default | Usuario arrendatario. |
| reservation_id | integer | FK → reservations | No | Sin default | Reserva relacionada. |
| status | character varying(12) | — | No | Sin default | Estado permitido por constraint, según tabla. |
| created_at | timestamp with time zone | — | No | now() | Instante de creación. |
| read_at | timestamp with time zone | — | Sí | Sin default | Instante de lectura, null si no leído. |

### Restricciones

- renter_notifications_pkey: PRIMARY KEY (id)
- renter_notifications_renter_id_fkey: FOREIGN KEY (renter_id) REFERENCES users(id)
- renter_notifications_reservation_id_fkey: FOREIGN KEY (reservation_id) REFERENCES reservations(id)
- renter_notifications_reservation_id_status_key: UNIQUE (reservation_id, status)

### Índices

- renter_notifications_pkey: CREATE UNIQUE INDEX renter_notifications_pkey ON public.renter_notifications USING btree (id)
- renter_notifications_reservation_id_status_key: CREATE UNIQUE INDEX renter_notifications_reservation_id_status_key ON public.renter_notifications USING btree (reservation_id, status)

## reservations

Alquileres con tarifa histórica, fechas, horarios y kilometraje.

| Campo | Tipo | PK/FK | Nulo | Valor por defecto / identidad | Descripción |
|---|---|---|---|---|---|
| id | integer | PK | No | GENERATED ALWAYS AS IDENTITY | Identificador de la fila. |
| vehicle_id | integer | FK → vehicles | No | Sin default | Vehículo relacionado. |
| renter_id | integer | FK → users | No | Sin default | Usuario arrendatario. |
| start_date | date | — | No | Sin default | Inicio del intervalo por fecha. |
| end_date | date | — | No | Sin default | Devolución/fin exclusivo para cálculo por días. |
| daily_price | numeric(12,2) | — | No | Sin default | Tarifa diaria; en reserva es copia histórica. |
| days | integer | — | No | Sin default | Diferencia de fechas, mínima un día. |
| total | numeric(14,2) | — | No | Sin default | Valor contractual: días por tarifa. |
| commission | numeric(14,2) | — | No | Sin default | 10 % del total, redondeado a dos decimales. |
| status | character varying(12) | — | No | 'CONFIRMADA'::character varying | Estado permitido por constraint, según tabla. |
| created_at | timestamp with time zone | — | No | now() | Instante de creación. |
| delivery_km | integer | — | Sí | Sin default | Odómetro registrado al entregar. |
| return_km | integer | — | Sí | Sin default | Odómetro registrado al devolver. |
| delivered_at | timestamp with time zone | — | Sí | Sin default | Instante de registro de entrega. |
| returned_at | timestamp with time zone | — | Sí | Sin default | Instante de registro de devolución. |
| start_time | time without time zone | — | Sí | Sin default | Hora local de recogida, null en registros históricos. |
| end_time | time without time zone | — | Sí | Sin default | Hora local de devolución, null en registros históricos. |

### Restricciones

- reservations_check: CHECK ((total = ((days)::numeric * daily_price)))
- reservations_check1: CHECK ((commission = round((total * 0.10), 2)))
- reservations_check2: CHECK (((end_date > start_date) AND (days = (end_date - start_date))))
- reservations_check3: CHECK ((return_km >= delivery_km))
- reservations_daily_price_check: CHECK ((daily_price > (0)::numeric))
- reservations_days_check: CHECK ((days > 0))
- reservations_delivery_km_check: CHECK ((delivery_km >= 0))
- reservations_pkey: PRIMARY KEY (id)
- reservations_renter_id_fkey: FOREIGN KEY (renter_id) REFERENCES users(id)
- reservations_status_check: CHECK (((status)::text = ANY ((ARRAY['CONFIRMADA'::character varying, 'CANCELADA'::character varying, 'FINALIZADA'::character varying])::text[])))
- reservations_vehicle_id_daterange_excl: EXCLUDE USING gist (vehicle_id WITH =, daterange(start_date, end_date, '[)'::text) WITH &&) WHERE (((status)::text = 'CONFIRMADA'::text))
- reservations_vehicle_id_fkey: FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)

### Índices

- reservations_pkey: CREATE UNIQUE INDEX reservations_pkey ON public.reservations USING btree (id)
- reservations_renter_idx: CREATE INDEX reservations_renter_idx ON public.reservations USING btree (renter_id)
- reservations_vehicle_id_daterange_excl: CREATE INDEX reservations_vehicle_id_daterange_excl ON public.reservations USING gist (vehicle_id, daterange(start_date, end_date, '[)'::text)) WHERE ((status)::text = 'CONFIRMADA'::text)

### Disparadores

- fleet_track_changes: CREATE TRIGGER fleet_track_changes AFTER INSERT OR UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION fleet_track()
- renter_reservation_notice: CREATE TRIGGER renter_reservation_notice AFTER INSERT OR UPDATE OF status ON public.reservations FOR EACH ROW EXECUTE FUNCTION notify_renter_reservation()

## reviews

Una reseña por reserva finalizada.

| Campo | Tipo | PK/FK | Nulo | Valor por defecto / identidad | Descripción |
|---|---|---|---|---|---|
| id | integer | PK | No | GENERATED ALWAYS AS IDENTITY | Identificador de la fila. |
| reservation_id | integer | FK → reservations | No | Sin default | Reserva relacionada. |
| rating | integer | — | No | Sin default | Calificación entera entre 1 y 5. |
| comment | text | — | No | Sin default | Comentario de la reseña. |
| recommendation | text | — | No | ''::text | Sugerencia opcional de la reseña. |
| created_at | timestamp with time zone | — | No | now() | Instante de creación. |

### Restricciones

- reviews_pkey: PRIMARY KEY (id)
- reviews_rating_check: CHECK (((rating >= 1) AND (rating <= 5)))
- reviews_reservation_id_fkey: FOREIGN KEY (reservation_id) REFERENCES reservations(id)
- reviews_reservation_id_key: UNIQUE (reservation_id)

### Índices

- reviews_pkey: CREATE UNIQUE INDEX reviews_pkey ON public.reviews USING btree (id)
- reviews_reservation_id_key: CREATE UNIQUE INDEX reviews_reservation_id_key ON public.reviews USING btree (reservation_id)

### Disparadores

- fleet_track_changes: CREATE TRIGGER fleet_track_changes AFTER INSERT OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION fleet_track()

## sessions

Sesiones técnicas de express-session; no entidad de negocio.

| Campo | Tipo | PK/FK | Nulo | Valor por defecto / identidad | Descripción |
|---|---|---|---|---|---|
| sid | character varying | PK | No | Sin default | Identificador técnico de sesión. |
| sess | json | — | No | Sin default | Contenido JSON gestionado por express-session. |
| expire | timestamp(6) without time zone | — | No | Sin default | Caducidad de la sesión. |

### Restricciones

- sessions_pkey: PRIMARY KEY (sid)

### Índices

- sessions_expire_idx: CREATE INDEX sessions_expire_idx ON public.sessions USING btree (expire)
- sessions_pkey: CREATE UNIQUE INDEX sessions_pkey ON public.sessions USING btree (sid)

## users

Cuentas con un rol principal, autenticación y suspensión.

| Campo | Tipo | PK/FK | Nulo | Valor por defecto / identidad | Descripción |
|---|---|---|---|---|---|
| id | integer | PK | No | GENERATED ALWAYS AS IDENTITY | Identificador de la fila. |
| name | character varying(100) | — | No | Sin default | Nombre del usuario o archivo según tabla. |
| email | character varying(254) | — | No | Sin default | Correo normalizado a minúsculas, único. |
| password_hash | text | — | No | Sin default | Hash bcrypt, nunca contraseña en claro. |
| role | character varying(20) | — | No | Sin default | Rol único de la cuenta. |
| created_at | timestamp with time zone | — | No | now() | Instante de creación. |
| suspended | boolean | — | No | false | Cuenta suspendida para operaciones mutables. |
| suspension_reason | text | — | No | ''::text | Motivo de suspensión. |

### Restricciones

- users_email_check: CHECK (((email)::text = lower((email)::text)))
- users_email_key: UNIQUE (email)
- users_pkey: PRIMARY KEY (id)
- users_role_check: CHECK (((role)::text = ANY ((ARRAY['ARRENDATARIO'::character varying, 'PROPIETARIO'::character varying, 'ADMINISTRADOR'::character varying])::text[])))

### Índices

- users_email_key: CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email)
- users_pkey: CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)

## vehicle_documents

Historial de SOAT/RTM y vencimientos, sin verificación oficial.

| Campo | Tipo | PK/FK | Nulo | Valor por defecto / identidad | Descripción |
|---|---|---|---|---|---|
| id | integer | PK | No | GENERATED ALWAYS AS IDENTITY | Identificador de la fila. |
| vehicle_id | integer | FK → vehicles | No | Sin default | Vehículo relacionado. |
| kind | character varying(8) | — | No | Sin default | Tipo de registro: documento, mantenimiento, incidencia o movimiento. |
| expires_on | date | — | No | Sin default | Fecha de vencimiento documental. |
| file_id | integer | FK → fleet_files | Sí | Sin default | Comprobante privado opcional. |
| verified | boolean | — | No | false | Indicador persistente; no existe verificación oficial automática. |
| created_at | timestamp with time zone | — | No | now() | Instante de creación. |

### Restricciones

- vehicle_documents_file_id_fkey: FOREIGN KEY (file_id) REFERENCES fleet_files(id)
- vehicle_documents_kind_check: CHECK (((kind)::text = ANY ((ARRAY['SOAT'::character varying, 'RTM'::character varying])::text[])))
- vehicle_documents_pkey: PRIMARY KEY (id)
- vehicle_documents_vehicle_id_fkey: FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)

### Índices

- documents_vehicle_idx: CREATE INDEX documents_vehicle_idx ON public.vehicle_documents USING btree (vehicle_id, kind, id DESC)
- vehicle_documents_pkey: CREATE UNIQUE INDEX vehicle_documents_pkey ON public.vehicle_documents USING btree (id)

### Disparadores

- fleet_track_changes: CREATE TRIGGER fleet_track_changes AFTER INSERT OR UPDATE ON public.vehicle_documents FOR EACH ROW EXECUTE FUNCTION fleet_track()

## vehicle_images

Fotografías procesadas a WebP y vinculadas mediante URLs en vehicles.

| Campo | Tipo | PK/FK | Nulo | Valor por defecto / identidad | Descripción |
|---|---|---|---|---|---|
| id | integer | PK | No | GENERATED ALWAYS AS IDENTITY | Identificador de la fila. |
| owner_id | integer | FK → users | No | Sin default | Usuario propietario responsable. |
| content | bytea | — | No | Sin default | Bytes del archivo; máximo 3 MB por constraint. |
| created_at | timestamp with time zone | — | No | now() | Instante de creación. |

### Restricciones

- vehicle_images_content_check: CHECK ((octet_length(content) <= 3145728))
- vehicle_images_owner_id_fkey: FOREIGN KEY (owner_id) REFERENCES users(id)
- vehicle_images_pkey: PRIMARY KEY (id)

### Índices

- vehicle_images_owner_idx: CREATE INDEX vehicle_images_owner_idx ON public.vehicle_images USING btree (owner_id)
- vehicle_images_pkey: CREATE UNIQUE INDEX vehicle_images_pkey ON public.vehicle_images USING btree (id)

## vehicles

Publicaciones de vehículos y estado operativo de flota.

| Campo | Tipo | PK/FK | Nulo | Valor por defecto / identidad | Descripción |
|---|---|---|---|---|---|
| id | integer | PK | No | GENERATED ALWAYS AS IDENTITY | Identificador de la fila. |
| owner_id | integer | FK → users | No | Sin default | Usuario propietario responsable. |
| brand | character varying(60) | — | No | Sin default | Marca seleccionada. |
| model | character varying(80) | — | No | Sin default | Modelo o línea seleccionada. |
| year | integer | — | No | Sin default | Año del vehículo. |
| city | character varying(80) | — | No | Sin default | Ciudad o municipio almacenado. |
| daily_price | numeric(12,2) | — | No | Sin default | Tarifa diaria; en reserva es copia histórica. |
| description | text | — | No | Sin default | Descripción funcional del registro. |
| image | text | — | No | Sin default | URL de la imagen principal; puede estar vacía. |
| status | character varying(24) | — | No | 'PENDIENTE_APROBACION'::character varying | Estado permitido por constraint, según tabla. |
| created_at | timestamp with time zone | — | No | now() | Instante de creación. |
| blocked | boolean | — | No | false | Publicación restringida por administración. |
| block_reason | text | — | No | ''::text | Motivo de restricción. |
| paused | boolean | — | No | false | Pausa operativa del propietario. |
| archived | boolean | — | No | false | Archivo reversible de publicación. |
| mileage | integer | — | Sí | Sin default | Kilometraje informado; null significa no registrado. |
| features | text | — | No | ''::text | Características heredadas; no se muestran en formulario actual. |
| conditions | text | — | No | ''::text | Condiciones heredadas; no se muestran en formulario actual. |
| photos | jsonb | — | No | '[]'::jsonb | Arreglo JSONB de URLs adicionales, sin FK a imágenes. |
| rtm_required | boolean | — | No | false | Indica si la RTM debe bloquear por vencimiento. |
| photo_categories | jsonb | — | No | '{}'::jsonb | Objeto JSONB que categoriza fotos interiores/exteriores. |

### Restricciones

- vehicles_daily_price_check: CHECK ((daily_price > (0)::numeric))
- vehicles_mileage_check: CHECK ((mileage >= 0))
- vehicles_owner_id_fkey: FOREIGN KEY (owner_id) REFERENCES users(id)
- vehicles_pkey: PRIMARY KEY (id)
- vehicles_status_check: CHECK (((status)::text = ANY ((ARRAY['PENDIENTE_APROBACION'::character varying, 'APROBADO'::character varying, 'RECHAZADO'::character varying, 'INACTIVO'::character varying])::text[])))
- vehicles_year_check: CHECK (((year >= 1950) AND (year <= 2200)))

### Índices

- vehicles_owner_idx: CREATE INDEX vehicles_owner_idx ON public.vehicles USING btree (owner_id)
- vehicles_pkey: CREATE UNIQUE INDEX vehicles_pkey ON public.vehicles USING btree (id)

### Disparadores

- fleet_track_changes: CREATE TRIGGER fleet_track_changes AFTER INSERT OR UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION fleet_track()

## Reglas que no son constraints
No se confunde validación de interfaz con SQL: selección exacta de catálogos, roles de usuarios referenciados, titularidad, cierre temporal de reservas, verificación de pago simulado y cruces con maintenance se comprueban en código.
vehicle_document_blocked toma el último documento por tipo/id y solo bloquea vencimientos registrados. Ausencia de documento no bloquea. fleet_track registra cambios; notify_renter_reservation crea un aviso por reserva/estado.
Las horas son columnas time opcionales sin constraint de pareja. La API las valida; la exclusión SQL sigue siendo por días. En JSONB se conservan URLs y categorías; no hay claves foráneas a vehicle_images.
