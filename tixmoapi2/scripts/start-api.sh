#!/bin/sh
set -eu

printf '%s\n' '{"scope":"api-startup","phase":"migration"}'
npm run migrate

if [ "${TIXMO_ASSET_SHARE_AUDIT_ON_START:-}" = true ]; then
  printf '%s\n' '{"scope":"api-startup","phase":"asset-audit"}'
  TIXMO_ASSET_REKEY_DATABASE_URL="${DATABASE_URL:-}" node prisma/rekey-asset-shares.js
fi

if [ "${TIXMO_STRIPE_READ_PROBE:-}" = true ]; then
  printf '%s\n' '{"scope":"api-startup","phase":"stripe-read-probe"}'
  node scripts/stripe-read-probe.cjs
fi

printf '%s\n' '{"scope":"api-startup","phase":"server"}'
exec node dist/index.js
