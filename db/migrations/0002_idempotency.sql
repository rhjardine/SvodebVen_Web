-- 0002 · Claves de idempotencia.
--
-- Una operación con efectos (pago, reserva, afiliación) se ejecuta UNA vez por (scope, key):
-- la fila se inserta y se completa en la MISMA transacción que la operación, así que o existen
-- ambas o ninguna. Dos peticiones simultáneas con la misma clave se serializan en el índice
-- único: la segunda espera, no encuentra nada que insertar y repite la respuesta guardada.
-- Solo se guardan respuestas exitosas: un fallo hace ROLLBACK y la clave queda libre para reintentar.

CREATE TABLE idempotency_keys (
  scope         text        NOT NULL,
  key           uuid        NOT NULL,
  actor_id      uuid,
  actor_role    text        NOT NULL,
  request_hash  bytea       NOT NULL,
  response_body jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  PRIMARY KEY (scope, key)
);
CREATE INDEX idempotency_keys_expiry_idx ON idempotency_keys (expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON idempotency_keys TO {{app_role}};

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys FORCE  ROW LEVEL SECURITY;

-- Cada actor solo ve y completa SUS claves (los anónimos comparten el rol 'anon': la clave es un
-- UUID aleatorio y el alcance incluye la ruta, por eso no es adivinable ni reutilizable entre rutas).
CREATE POLICY idempotency_owner ON idempotency_keys FOR ALL TO {{app_role}}
  USING (
    actor_role = (SELECT app.current_actor_role())
    AND actor_id IS NOT DISTINCT FROM (SELECT app.current_member_id())
  )
  WITH CHECK (
    actor_role = (SELECT app.current_actor_role())
    AND actor_id IS NOT DISTINCT FROM (SELECT app.current_member_id())
  );

-- La purga de claves vencidas corre como 'system' (un DELETE con WHERE también exige poder verlas).
CREATE POLICY idempotency_purge_select ON idempotency_keys FOR SELECT TO {{app_role}}
  USING ((SELECT app.current_actor_role()) = 'system' AND expires_at < now());
CREATE POLICY idempotency_purge_delete ON idempotency_keys FOR DELETE TO {{app_role}}
  USING ((SELECT app.current_actor_role()) = 'system' AND expires_at < now());
