-- 0003 · Directorio de especialistas y endurecimiento de privilegios sobre `members`.
--
-- A) members: la secretaría solo puede dar de alta/editar miembros con rol 'member'. Cambiar o crear
--    roles de personal (tesorería, secretaría, admin) queda reservado a 'admin' (defensa en
--    profundidad: hoy ninguna ruta lo intenta, pero un error futuro no puede auto-promoverse).
-- B) directory_profiles: ficha pública. NO contiene correo ni teléfono (minimización de datos y
--    antiraspado). Solo es visible al público si está publicada, con consentimiento y verificada
--    vigente; la base lo impone con RLS, no solo la aplicación.

-- ─── A) members ─────────────────────────────────────────────────────────────
DROP POLICY members_insert_reviewers ON members;
DROP POLICY members_update_reviewers ON members;

CREATE POLICY members_insert_admin ON members FOR INSERT TO {{app_role}}
  WITH CHECK ((SELECT app.current_actor_role()) = 'admin');
CREATE POLICY members_insert_secretaria ON members FOR INSERT TO {{app_role}}
  WITH CHECK ((SELECT app.current_actor_role()) = 'secretaria' AND role = 'member');

CREATE POLICY members_update_admin ON members FOR UPDATE TO {{app_role}}
  USING ((SELECT app.current_actor_role()) = 'admin')
  WITH CHECK ((SELECT app.current_actor_role()) = 'admin');
CREATE POLICY members_update_secretaria ON members FOR UPDATE TO {{app_role}}
  USING ((SELECT app.current_actor_role()) = 'secretaria' AND role = 'member')
  WITH CHECK ((SELECT app.current_actor_role()) = 'secretaria' AND role = 'member');

-- ─── B) directory_profiles ──────────────────────────────────────────────────
CREATE TABLE directory_profiles (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id      uuid        NOT NULL UNIQUE REFERENCES members (id) ON DELETE CASCADE,
  nombre_publico text        NOT NULL CHECK (char_length(nombre_publico) BETWEEN 2 AND 120),
  ciudad         text        NOT NULL CHECK (char_length(ciudad) BETWEEN 2 AND 80),
  entidad        text        NOT NULL CHECK (char_length(entidad) BETWEEN 2 AND 40),
  areas          text[]      NOT NULL CHECK (cardinality(areas) BETWEEN 1 AND 6),
  categoria      text        NOT NULL CHECK (categoria IN ('ACTIVO', 'ASOCIADO')),
  -- Texto normalizado (minúsculas, sin diacríticos) calculado por la aplicación para la búsqueda.
  busqueda       text        NOT NULL CHECK (char_length(busqueda) <= 400),
  publicado      boolean     NOT NULL DEFAULT false,
  consentimiento_en timestamptz,
  verificado_hasta  date,
  verificado_por    uuid     REFERENCES members (id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- No se publica sin consentimiento expreso.
  CONSTRAINT publicado_requiere_consentimiento
    CHECK (publicado = false OR consentimiento_en IS NOT NULL)
);
CREATE INDEX directory_profiles_public_idx
  ON directory_profiles (publicado, verificado_hasta);

GRANT SELECT, INSERT, UPDATE, DELETE ON directory_profiles TO {{app_role}};
ALTER TABLE directory_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory_profiles FORCE  ROW LEVEL SECURITY;

-- Lectura pública (también para 'anon'): solo fichas publicadas, con consentimiento y verificadas
-- vigentes (fecha de Caracas, UTC-4, para que el último día de vigencia cuente completo).
CREATE POLICY directory_select_public ON directory_profiles FOR SELECT TO {{app_role}}
  USING (
    publicado
    AND consentimiento_en IS NOT NULL
    AND verificado_hasta >= (now() AT TIME ZONE 'America/Caracas')::date
  );
CREATE POLICY directory_select_self ON directory_profiles FOR SELECT TO {{app_role}}
  USING (member_id = (SELECT app.current_member_id()));
CREATE POLICY directory_select_reviewers ON directory_profiles FOR SELECT TO {{app_role}}
  USING ((SELECT app.is_reviewer()));

-- Cada miembro crea SU ficha, siempre sin verificar.
CREATE POLICY directory_insert_self ON directory_profiles FOR INSERT TO {{app_role}}
  WITH CHECK (
    member_id = (SELECT app.current_member_id())
    AND verificado_hasta IS NULL
    AND verificado_por IS NULL
  );
CREATE POLICY directory_update_self ON directory_profiles FOR UPDATE TO {{app_role}}
  USING (member_id = (SELECT app.current_member_id()))
  WITH CHECK (member_id = (SELECT app.current_member_id()));
CREATE POLICY directory_update_reviewers ON directory_profiles FOR UPDATE TO {{app_role}}
  USING ((SELECT app.is_reviewer())) WITH CHECK ((SELECT app.is_reviewer()));
CREATE POLICY directory_delete_self ON directory_profiles FOR DELETE TO {{app_role}}
  USING (member_id = (SELECT app.current_member_id()));
CREATE POLICY directory_delete_reviewers ON directory_profiles FOR DELETE TO {{app_role}}
  USING ((SELECT app.is_reviewer()));

-- RLS no distingue columnas: este disparador impide que un miembro (no revisor) toque los campos
-- de verificación y hace que cambiar el contenido público invalide la verificación (así nadie
-- puede publicar bajo el nombre de otra persona conservando el sello "verificado").
CREATE FUNCTION app.directory_guard() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  NEW.updated_at := now();
  IF NOT app.is_reviewer() THEN
    NEW.id := OLD.id;
    NEW.member_id := OLD.member_id;
    NEW.categoria := OLD.categoria;
    NEW.verificado_por := OLD.verificado_por;
    NEW.verificado_hasta := OLD.verificado_hasta;
    NEW.created_at := OLD.created_at;
    IF NEW.nombre_publico IS DISTINCT FROM OLD.nombre_publico
       OR NEW.ciudad IS DISTINCT FROM OLD.ciudad
       OR NEW.entidad IS DISTINCT FROM OLD.entidad
       OR NEW.areas IS DISTINCT FROM OLD.areas THEN
      NEW.verificado_hasta := NULL;
      NEW.verificado_por := NULL;
    END IF;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER directory_profiles_guard
  BEFORE UPDATE ON directory_profiles
  FOR EACH ROW EXECUTE FUNCTION app.directory_guard();

-- Un miembro suspendido deja de aparecer de inmediato.
CREATE FUNCTION app.unpublish_on_suspension() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF NEW.estado = 'SUSPENDIDO' AND OLD.estado IS DISTINCT FROM 'SUSPENDIDO' THEN
    UPDATE directory_profiles SET publicado = false WHERE member_id = NEW.id;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER members_suspension_unpublish
  AFTER UPDATE OF estado ON members
  FOR EACH ROW EXECUTE FUNCTION app.unpublish_on_suspension();
