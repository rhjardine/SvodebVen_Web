-- 0001 · Esquema inicial: identidad, expedientes de afiliación y auditoría, todo con RLS.
--
-- Se ejecuta como svodeb_owner. {{app_role}} es el rol de la aplicación (svodeb_app):
-- solo DML y SIEMPRE sujeto a RLS (sin BYPASSRLS, sin DDL).
--
-- Modelo de identidad ("proxy de identidad"): Express autentica, abre una transacción y fija
--   app.current_member_id   (uuid del miembro; vacío si no hay)
--   app.current_actor_role  (anon | system | member | secretaria | tesoreria | admin)
-- con set_config(..., true) (alcance de transacción). Las políticas leen esos valores.
-- Sin identidad el rol efectivo es 'anon' y casi nada es visible: la base falla CERRADA.

CREATE SCHEMA IF NOT EXISTS app;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO {{app_role}};
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- ─── Funciones de identidad ─────────────────────────────────────────────────
CREATE FUNCTION app.current_member_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.current_member_id', true), '')::uuid $$;

CREATE FUNCTION app.current_actor_role() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT coalesce(nullif(current_setting('app.current_actor_role', true), ''), 'anon') $$;

-- Personal con acceso a datos de miembros (incluye tesorería).
CREATE FUNCTION app.is_staff() RETURNS boolean
  LANGUAGE sql STABLE
  AS $$ SELECT app.current_actor_role() IN ('secretaria', 'tesoreria', 'admin') $$;

-- Quien puede revisar expedientes (datos personales de postulantes): minimización de datos.
CREATE FUNCTION app.is_reviewer() RETURNS boolean
  LANGUAGE sql STABLE
  AS $$ SELECT app.current_actor_role() IN ('secretaria', 'admin') $$;

CREATE FUNCTION app.reject_mutation() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es de solo inserción', TG_TABLE_NAME USING ERRCODE = '42501';
END
$$;

GRANT EXECUTE ON FUNCTION
  app.current_member_id(), app.current_actor_role(), app.is_staff(), app.is_reviewer()
  TO {{app_role}};

-- ─── Expedientes de afiliación ──────────────────────────────────────────────
CREATE TABLE applications (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia             text        NOT NULL UNIQUE,
  estado                 text        NOT NULL DEFAULT 'RECIBIDA'
    CHECK (estado IN ('RECIBIDA', 'EN_REVISION', 'REQUIERE_INFORMACION', 'APROBADA', 'RECHAZADA')),
  categoria              text        NOT NULL CHECK (categoria IN ('ACTIVO', 'ASOCIADO', 'ESTUDIANTE')),
  email                  text        NOT NULL CHECK (email = lower(email)),
  datos                  jsonb       NOT NULL,
  consentimiento_en      timestamptz NOT NULL,
  consentimiento_version text        NOT NULL,
  recibida_en            timestamptz NOT NULL,
  actualizada_en         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX applications_estado_idx ON applications (estado, recibida_en DESC);
CREATE INDEX applications_email_idx  ON applications (email);

-- ─── Miembros y cuentas de personal ─────────────────────────────────────────
CREATE TABLE members (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text        NOT NULL CHECK (email = lower(email)),
  nombres        text        NOT NULL,
  apellidos      text        NOT NULL,
  role           text        NOT NULL DEFAULT 'member'
    CHECK (role IN ('member', 'secretaria', 'tesoreria', 'admin')),
  categoria      text        CHECK (categoria IN ('ACTIVO', 'ASOCIADO', 'ESTUDIANTE')),
  estado         text        NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'SUSPENDIDO')),
  vigente_hasta  date,
  application_id uuid        UNIQUE REFERENCES applications (id),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX members_email_key ON members (email);

-- ─── Bitácora de expedientes y auditoría general (solo inserción) ───────────
CREATE TABLE application_events (
  id             bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  application_id uuid        NOT NULL REFERENCES applications (id),
  desde          text,
  hacia          text        NOT NULL,
  actor_id       uuid        REFERENCES members (id),
  nota           text,
  ocurrido_en    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX application_events_app_idx ON application_events (application_id, id);

CREATE TABLE audit_log (
  id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ocurrido_en timestamptz NOT NULL DEFAULT now(),
  actor_id    uuid,
  actor_role  text        NOT NULL,
  accion      text        NOT NULL,
  entidad     text,
  entidad_id  text,
  detalle     jsonb
);

CREATE TRIGGER application_events_append_only
  BEFORE UPDATE OR DELETE ON application_events
  FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();
CREATE TRIGGER application_events_no_truncate
  BEFORE TRUNCATE ON application_events
  FOR EACH STATEMENT EXECUTE FUNCTION app.reject_mutation();
CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION app.reject_mutation();

-- ─── Sesiones y enlaces de acceso (solo contexto 'system') ──────────────────
CREATE TABLE login_challenges (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid        NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  token_hash  bytea       NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE TABLE auth_sessions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  uuid        NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  family_id  uuid        NOT NULL,
  token_hash bytea       NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  revoked_at timestamptz
);
CREATE INDEX auth_sessions_family_idx ON auth_sessions (family_id);
CREATE INDEX auth_sessions_member_idx ON auth_sessions (member_id);

-- ─── Privilegios mínimos para el rol de la aplicación ───────────────────────
GRANT SELECT, INSERT, UPDATE ON applications, members TO {{app_role}};
GRANT SELECT, INSERT ON application_events, audit_log TO {{app_role}};
GRANT SELECT, INSERT, UPDATE, DELETE ON login_challenges, auth_sessions TO {{app_role}};
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {{app_role}};

-- ─── RLS: activada y FORZADA (el dueño de la tabla también queda sujeto) ────
ALTER TABLE applications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications       FORCE  ROW LEVEL SECURITY;
ALTER TABLE members            ENABLE ROW LEVEL SECURITY;
ALTER TABLE members            FORCE  ROW LEVEL SECURITY;
ALTER TABLE application_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_events FORCE  ROW LEVEL SECURITY;
ALTER TABLE audit_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log          FORCE  ROW LEVEL SECURITY;
ALTER TABLE login_challenges   ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_challenges   FORCE  ROW LEVEL SECURITY;
ALTER TABLE auth_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions      FORCE  ROW LEVEL SECURITY;

-- Convención: (SELECT fn()) fuerza evaluación única por sentencia (initPlan), no por fila.

-- members: cada miembro ve solo su fila; el personal ve todas; 'system' solo para el inicio de sesión.
CREATE POLICY members_select_self ON members FOR SELECT TO {{app_role}}
  USING (id = (SELECT app.current_member_id()));
CREATE POLICY members_select_staff ON members FOR SELECT TO {{app_role}}
  USING ((SELECT app.is_staff()));
CREATE POLICY members_select_system ON members FOR SELECT TO {{app_role}}
  USING ((SELECT app.current_actor_role()) = 'system');
CREATE POLICY members_insert_reviewers ON members FOR INSERT TO {{app_role}}
  WITH CHECK ((SELECT app.is_reviewer()));
CREATE POLICY members_update_reviewers ON members FOR UPDATE TO {{app_role}}
  USING ((SELECT app.is_reviewer())) WITH CHECK ((SELECT app.is_reviewer()));

-- applications: cualquiera puede ENVIAR (solo en estado RECIBIDA); solo revisores leen y cambian.
-- OJO: INSERT ... RETURNING exige además una política SELECT; el alta anónima no usa RETURNING.
CREATE POLICY applications_insert_intake ON applications FOR INSERT TO {{app_role}}
  WITH CHECK (estado = 'RECIBIDA');
CREATE POLICY applications_select_reviewers ON applications FOR SELECT TO {{app_role}}
  USING ((SELECT app.is_reviewer()));
CREATE POLICY applications_update_reviewers ON applications FOR UPDATE TO {{app_role}}
  USING ((SELECT app.is_reviewer())) WITH CHECK ((SELECT app.is_reviewer()));

-- application_events: el alta anónima solo puede registrar el evento inicial.
CREATE POLICY application_events_insert_initial ON application_events FOR INSERT TO {{app_role}}
  WITH CHECK (desde IS NULL AND hacia = 'RECIBIDA' AND actor_id IS NULL);
CREATE POLICY application_events_insert_reviewers ON application_events FOR INSERT TO {{app_role}}
  WITH CHECK ((SELECT app.is_reviewer()));
CREATE POLICY application_events_select_reviewers ON application_events FOR SELECT TO {{app_role}}
  USING ((SELECT app.is_reviewer()));

-- audit_log: no se puede falsificar la identidad del actor; solo admin lee.
CREATE POLICY audit_log_insert ON audit_log FOR INSERT TO {{app_role}}
  WITH CHECK (
    actor_role = (SELECT app.current_actor_role())
    AND actor_id IS NOT DISTINCT FROM (SELECT app.current_member_id())
  );
CREATE POLICY audit_log_select_admin ON audit_log FOR SELECT TO {{app_role}}
  USING ((SELECT app.current_actor_role()) = 'admin');

-- Sesiones y enlaces: invisibles para miembros y personal; solo la lógica de autenticación ('system').
CREATE POLICY login_challenges_system ON login_challenges FOR ALL TO {{app_role}}
  USING ((SELECT app.current_actor_role()) = 'system')
  WITH CHECK ((SELECT app.current_actor_role()) = 'system');
CREATE POLICY auth_sessions_system ON auth_sessions FOR ALL TO {{app_role}}
  USING ((SELECT app.current_actor_role()) = 'system')
  WITH CHECK ((SELECT app.current_actor_role()) = 'system');
