#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
start_services=false
run_migrations=false
for argument in "$@"; do
  case "$argument" in
    --services) start_services=true ;;
    --migrate) run_migrations=true ;;
    --help|-h)
      cat <<'HELP'
Usage: bash scripts/setup.sh [--services] [--migrate]

Installs locked dependencies, creates a private .env if absent and generates Prisma.
--services starts local PostgreSQL and Redis and waits for health.
--migrate applies checked-in migrations to an explicitly selected local database.

Migrations require NODE_ENV=development, TIXMO_ALLOW_LOCAL_MIGRATIONS=true,
TIXMO_DEV_DATABASE_URL and an identical DATABASE_URL (if present).
Fixture reset/populate separately require TIXMO_ALLOW_DEV_DATA=true.
HELP
      exit 0 ;;
    *) printf 'Unknown setup option: %s\n' "$argument" >&2; exit 1 ;;
  esac
done

node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major !== 24 || minor < 21) { console.error("Node.js >=24.21.0 <25 is required. Run nvm install and nvm use."); process.exit(1); }'
CI=true npm ci
if [[ ! -f .env ]]; then
  (umask 077; cp .env.example .env)
fi
mkdir -p logs
npm exec -- prisma generate

if [[ "$start_services" == true ]]; then
  docker compose up -d --wait --wait-timeout 120 postgres redis
fi
if [[ "$run_migrations" == true ]]; then
  node scripts/local-migrate.cjs
fi

printf 'Setup complete. Configure .env, apply local migrations explicitly, then run npm run dev.\n'
