#!/bin/sh
# Shared Docker/Railway startup. Hard guards fail closed; optional receipts are best effort.
set -eu

npm run migrate
if [ "${TIXMO_ASSET_SHARE_AUDIT_ON_START:-}" = true ]; then
  if [ "${TIXMO_ASSET_SHARE_AUDIT_PRESERVE_HASH_ONLY_ON_START:-}" = true ]; then
    TIXMO_ASSET_REKEY_DATABASE_URL="${DATABASE_URL:-}" node prisma/rekey-asset-shares.js --preserve-hash-only
  else
    TIXMO_ASSET_REKEY_DATABASE_URL="${DATABASE_URL:-}" node prisma/rekey-asset-shares.js
  fi
fi
if [ "${TIXMO_STRIPE_READ_PROBE:-}" = true ]; then node scripts/stripe-read-probe.cjs; fi
if [ "${TIXMO_ASSET_LINK_CHECK_ON_START:-}" = true ]; then TIXMO_ASSET_REKEY_DATABASE_URL="${DATABASE_URL:-}" node prisma/check-asset-share-links.js; fi
if [ "${TIXMO_RUNTIME_VERSION_PROBE:-}" = true ]; then node scripts/runtime-version-probe.cjs; fi
if [ "${TIXMO_APPROVED_EMAIL_ONCE:-}" = true ]; then node scripts/approved-email-once.cjs || true; fi
if [ "${TIXMO_STORAGE_CANARY:-}" = true ]; then node scripts/storage-canary.cjs || true; fi
if [ "${TIXMO_BACKUP_REHEARSAL:-}" = true ]; then node scripts/backup-rehearsal.cjs || true; fi
exec node dist/index.js
