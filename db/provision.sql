-- Aprovisionamiento de roles y base de datos (una vez por servidor, con un usuario administrador).
--
-- Uso:
--   psql "$DATABASE_ADMIN_URL" -X -v ON_ERROR_STOP=1 \
--        -v owner_pw=... -v app_pw=... -v db=svodeb -f db/provision.sql
--
-- Separación de privilegios (requisito de RLS):
--   svodeb_owner  dueño del esquema; solo lo usan las migraciones (DDL).
--   svodeb_app    rol de la aplicación; solo DML y SIEMPRE sujeto a RLS
--                 (sin SUPERUSER, sin BYPASSRLS, sin CREATEROLE, sin DDL).
--
-- Si el proveedor no permite CREATE ROLE, usar el plan B documentado en
-- docs/DESPLIEGUE.md (un solo rol con FORCE ROW LEVEL SECURITY).

SELECT format(
  'CREATE ROLE svodeb_owner LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS',
  :'owner_pw')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'svodeb_owner') \gexec

SELECT format(
  'CREATE ROLE svodeb_app LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS',
  :'app_pw')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'svodeb_app') \gexec

SELECT format('CREATE DATABASE %I OWNER svodeb_owner', :'db')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'db') \gexec

REVOKE ALL ON DATABASE :"db" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db" TO svodeb_app;
