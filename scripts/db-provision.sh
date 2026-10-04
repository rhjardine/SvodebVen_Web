#!/usr/bin/env bash
# Crea los roles (svodeb_owner, svodeb_app) y las bases indicadas. Es idempotente.
#
#   DATABASE_ADMIN_URL   conexión de administrador (si falta, usa el usuario `postgres` local)
#   DB_NAMES             bases a crear (por defecto: "svodeb_dev svodeb_test")
#   DB_OWNER_PASSWORD    contraseña de svodeb_owner (por defecto, solo para desarrollo)
#   DB_APP_PASSWORD      contraseña de svodeb_app   (por defecto, solo para desarrollo)
#
# En producción define contraseñas largas y aleatorias; los valores por defecto son SOLO de desarrollo.
set -euo pipefail
cd "$(dirname "$0")/.."

OWNER_PW="${DB_OWNER_PASSWORD:-svodeb_owner_dev}"
APP_PW="${DB_APP_PASSWORD:-svodeb_app_dev}"
DBS="${DB_NAMES:-svodeb_dev svodeb_test}"

run_psql() {
  if [ -n "${DATABASE_ADMIN_URL:-}" ]; then
    psql "$DATABASE_ADMIN_URL" -X -q -v ON_ERROR_STOP=1 "$@"
  else
    runuser -u postgres -- psql -X -q -v ON_ERROR_STOP=1 "$@"
  fi
}

for db in $DBS; do
  run_psql -v owner_pw="$OWNER_PW" -v app_pw="$APP_PW" -v db="$db" -f - < db/provision.sql
  echo "✔ Base '$db' lista (roles svodeb_owner y svodeb_app)."
done
