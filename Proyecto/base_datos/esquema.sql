-- Esquema físico y ampliaciones aditivas de REV RENTALS. Capa: persistencia.
-- Aplicado por herramientas/migrar.js y pruebas/integracion.test.js.
-- Mantiene nombres y datos existentes; las FK, CHECK y exclusiones protegen invariantes.
BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE TABLE IF NOT EXISTS users (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 name varchar(100) NOT NULL,
 email varchar(254) NOT NULL UNIQUE CHECK (email=lower(email)),
 password_hash text NOT NULL,
 role varchar(20) NOT NULL CHECK(role IN ('ARRENDATARIO','PROPIETARIO','ADMINISTRADOR')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS vehicles (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 owner_id integer NOT NULL REFERENCES users(id),
 brand varchar(60) NOT NULL, model varchar(80) NOT NULL, year integer NOT NULL CHECK(year BETWEEN 1950 AND 2200),
 city varchar(80) NOT NULL, daily_price numeric(12,2) NOT NULL CHECK(daily_price>0),
 description text NOT NULL, image text NOT NULL,
 status varchar(24) NOT NULL DEFAULT 'PENDIENTE_APROBACION' CHECK(status IN ('PENDIENTE_APROBACION','APROBADO','RECHAZADO','INACTIVO')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS reservations (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 vehicle_id integer NOT NULL REFERENCES vehicles(id),
 renter_id integer NOT NULL REFERENCES users(id),
 start_date date NOT NULL, end_date date NOT NULL,
 daily_price numeric(12,2) NOT NULL CHECK(daily_price>0),
 days integer NOT NULL CHECK(days>0),
 total numeric(14,2) NOT NULL CHECK(total=days*daily_price),
 commission numeric(14,2) NOT NULL CHECK(commission=round(total*0.10,2)),
 status varchar(12) NOT NULL DEFAULT 'CONFIRMADA' CHECK(status IN ('CONFIRMADA','CANCELADA','FINALIZADA')),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(end_date>start_date AND days=end_date-start_date),
 EXCLUDE USING gist (vehicle_id WITH =, daterange(start_date,end_date,'[)') WITH &&) WHERE (status='CONFIRMADA')
);
CREATE TABLE IF NOT EXISTS sessions (sid varchar PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_expire_idx ON sessions(expire);
CREATE INDEX IF NOT EXISTS vehicles_owner_idx ON vehicles(owner_id);
CREATE INDEX IF NOT EXISTS reservations_renter_idx ON reservations(renter_id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason text NOT NULL DEFAULT '';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS block_reason text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS admin_actions (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 admin_id integer NOT NULL REFERENCES users(id),
 entity_type varchar(20) NOT NULL,
 entity_id integer NOT NULL,
 action varchar(40) NOT NULL,
 reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS incidents (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 created_by integer NOT NULL REFERENCES users(id),
 vehicle_id integer REFERENCES vehicles(id),
 owner_id integer REFERENCES users(id),
 title varchar(160) NOT NULL,
 description text NOT NULL,
 priority varchar(10) NOT NULL CHECK(priority IN ('BAJA','MEDIA','ALTA')),
 status varchar(16) NOT NULL DEFAULT 'ABIERTA' CHECK(status IN ('ABIERTA','EN_REVISION','RESUELTA')),
 resolution text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;

-- Gestión de flota: ampliación aditiva; conserva reservas y publicaciones existentes.
BEGIN;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS paused boolean NOT NULL DEFAULT false;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS mileage integer CHECK(mileage>=0);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS features text NOT NULL DEFAULT '';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS conditions text NOT NULL DEFAULT '';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS photos jsonb NOT NULL DEFAULT '[]';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS rtm_required boolean NOT NULL DEFAULT false;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS delivery_km integer CHECK(delivery_km>=0);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS return_km integer CHECK(return_km>=delivery_km);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS returned_at timestamptz;
CREATE TABLE IF NOT EXISTS fleet_files (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 owner_id integer NOT NULL REFERENCES users(id), name varchar(180) NOT NULL,
 mime varchar(40) NOT NULL, content bytea NOT NULL CHECK(octet_length(content)<=3145728), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS vehicle_documents (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 vehicle_id integer NOT NULL REFERENCES vehicles(id), kind varchar(8) NOT NULL CHECK(kind IN ('SOAT','RTM')),
 expires_on date NOT NULL, file_id integer REFERENCES fleet_files(id), verified boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documents_vehicle_idx ON vehicle_documents(vehicle_id,kind,id DESC);
CREATE TABLE IF NOT EXISTS maintenance (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, vehicle_id integer NOT NULL REFERENCES vehicles(id),
 kind varchar(80) NOT NULL, description text NOT NULL, due_date date NOT NULL, due_km integer CHECK(due_km>=0),
 start_date date, end_date date, status varchar(12) NOT NULL DEFAULT 'PROGRAMADO' CHECK(status IN ('PROGRAMADO','COMPLETADO','CANCELADO')),
 completed_date date, mileage integer CHECK(mileage>=0), cost numeric(14,2) NOT NULL DEFAULT 0 CHECK(cost>=0),
 file_id integer REFERENCES fleet_files(id), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((start_date IS NULL AND end_date IS NULL) OR (start_date IS NOT NULL AND end_date IS NOT NULL AND end_date>start_date)),
 EXCLUDE USING gist(vehicle_id WITH =, daterange(start_date,end_date,'[)') WITH &&) WHERE(status='PROGRAMADO' AND start_date IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS reviews (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, reservation_id integer NOT NULL UNIQUE REFERENCES reservations(id),
 rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5), comment text NOT NULL, recommendation text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_status_check;
ALTER TABLE incidents ADD CONSTRAINT incidents_status_check CHECK(status IN ('ABIERTA','EN_REVISION','PENDIENTE_INFO','RESUELTA','CERRADA'));
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS reservation_id integer REFERENCES reservations(id);
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS kind varchar(30) NOT NULL DEFAULT 'GENERAL';
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS file_id integer REFERENCES fleet_files(id);
UPDATE incidents i SET owner_id=v.owner_id FROM vehicles v WHERE i.vehicle_id=v.id AND i.owner_id IS NULL;
CREATE TABLE IF NOT EXISTS incident_messages (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, incident_id integer NOT NULL REFERENCES incidents(id),
 author_id integer NOT NULL REFERENCES users(id), body text NOT NULL, file_id integer REFERENCES fleet_files(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS financial_entries (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, reservation_id integer NOT NULL REFERENCES reservations(id),
 kind varchar(12) NOT NULL CHECK(kind IN ('COBRO','DESEMBOLSO')), amount numeric(14,2) NOT NULL CHECK(amount>0),
 reference varchar(180) NOT NULL UNIQUE, paid_on date NOT NULL, created_by integer NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fleet_events (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, owner_id integer NOT NULL REFERENCES users(id),
 vehicle_id integer REFERENCES vehicles(id), module varchar(24) NOT NULL, record_id integer NOT NULL,
 action varchar(60) NOT NULL, detail jsonb NOT NULL DEFAULT '{}', read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vehicles ALTER COLUMN mileage DROP NOT NULL;
ALTER TABLE vehicles ALTER COLUMN mileage DROP DEFAULT;
UPDATE vehicles v SET mileage=NULL WHERE mileage=0 AND NOT EXISTS(SELECT 1 FROM fleet_events e WHERE e.vehicle_id=v.id AND e.module='vehiculos');
CREATE INDEX IF NOT EXISTS fleet_events_owner_idx ON fleet_events(owner_id,id DESC);
CREATE OR REPLACE FUNCTION vehicle_document_blocked(vid integer, through_date date) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM (SELECT DISTINCT ON(kind) kind,expires_on FROM vehicle_documents WHERE vehicle_id=vid ORDER BY kind,id DESC) d
 JOIN vehicles v ON v.id=vid WHERE (d.kind='SOAT' OR v.rtm_required) AND d.expires_on<through_date)
$$;
CREATE OR REPLACE FUNCTION fleet_track() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE vid integer; oid integer; dest text; payload jsonb;
BEGIN
 payload=to_jsonb(NEW);
 IF TG_OP='UPDATE' AND to_jsonb(OLD)=payload THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='vehicles' THEN vid=NEW.id; dest='vehiculos';
 ELSIF TG_TABLE_NAME='reservations' THEN vid=NEW.vehicle_id; dest='reservas';
 ELSIF TG_TABLE_NAME='maintenance' THEN vid=NEW.vehicle_id; dest='mantenimientos';
 ELSIF TG_TABLE_NAME='vehicle_documents' THEN vid=NEW.vehicle_id; dest='documentos';
 ELSIF TG_TABLE_NAME='reviews' OR TG_TABLE_NAME='financial_entries' THEN
 SELECT vehicle_id INTO vid FROM reservations WHERE id=NEW.reservation_id;
 dest=CASE WHEN TG_TABLE_NAME='reviews' THEN 'resenas' ELSE 'ganancias' END;
 ELSIF TG_TABLE_NAME='incidents' THEN vid=NEW.vehicle_id; oid=NEW.owner_id; dest='incidencias';
 ELSIF TG_TABLE_NAME='incident_messages' THEN SELECT vehicle_id,owner_id INTO vid,oid FROM incidents WHERE id=NEW.incident_id; dest='incidencias';
 END IF;
 IF oid IS NULL THEN SELECT owner_id INTO oid FROM vehicles WHERE id=vid; END IF;
 IF oid IS NOT NULL THEN
 IF TG_OP='UPDATE' THEN payload=jsonb_build_object('antes',to_jsonb(OLD),'despues',payload); END IF;
 INSERT INTO fleet_events(owner_id,vehicle_id,module,record_id,action,detail) VALUES(oid,vid,dest,NEW.id,TG_OP || ' ' || TG_TABLE_NAME,payload);
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['vehicles','reservations','maintenance','vehicle_documents','reviews','financial_entries','incidents','incident_messages'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS fleet_track_changes ON %I',tbl);
 EXECUTE format('CREATE TRIGGER fleet_track_changes AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fleet_track()',tbl);
 END LOOP;
END $$;
COMMIT;
BEGIN;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS photo_categories jsonb NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS vehicle_images (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 owner_id integer NOT NULL REFERENCES users(id),
 content bytea NOT NULL CHECK(octet_length(content)<=3145728),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vehicle_images_owner_idx ON vehicle_images(owner_id);
COMMIT;

-- Espacio del arrendatario: favoritos, avisos y horarios de reserva.
BEGIN;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS start_time time;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS end_time time;
CREATE TABLE IF NOT EXISTS renter_favorites (renter_id integer REFERENCES users(id), vehicle_id integer REFERENCES vehicles(id), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(renter_id,vehicle_id));
CREATE TABLE IF NOT EXISTS renter_notifications (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,renter_id integer NOT NULL REFERENCES users(id),reservation_id integer NOT NULL REFERENCES reservations(id),status varchar(12) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),read_at timestamptz,UNIQUE(reservation_id,status));
CREATE OR REPLACE FUNCTION notify_renter_reservation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
INSERT INTO renter_notifications(renter_id,reservation_id,status) VALUES(NEW.renter_id,NEW.id,NEW.status) ON CONFLICT DO NOTHING; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS renter_reservation_notice ON reservations;
CREATE TRIGGER renter_reservation_notice AFTER INSERT OR UPDATE OF status ON reservations FOR EACH ROW EXECUTE FUNCTION notify_renter_reservation();
INSERT INTO renter_notifications(renter_id,reservation_id,status,created_at) SELECT renter_id,id,status,created_at FROM reservations ON CONFLICT DO NOTHING;
COMMIT;
