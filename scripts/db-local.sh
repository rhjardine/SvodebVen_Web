#!/usr/bin/env bash
# Desarrollo local: arranca el cluster de PostgreSQL del sistema (si está apagado) y aprovisiona roles/bases.
# Alternativa con Docker: `docker compose up -d db` y luego
#   DATABASE_ADMIN_URL=postgresql://postgres:postgres@localhost:5432/postgres pnpm db:provision
set -euo pipefail
cd "$(dirname "$0")/.."

if command -v pg_lsclusters >/dev/null 2>&1; then
  pg_lsclusters -h | awk '$4 == "down" { print $1, $2 }' | while read -r version name; do
    pg_ctlcluster "$version" "$name" start
  done
  for _ in $(seq 1 20); do pg_isready -q && break; sleep 0.5; done
fi

pg_isready || { echo "✘ PostgreSQL no responde en localhost:5432" >&2; exit 1; }
bash scripts/db-provision.sh
