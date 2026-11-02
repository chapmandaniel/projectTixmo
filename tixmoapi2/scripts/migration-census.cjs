'use strict';
// Single reviewed migration census for the qualified rollback candidate.
// The next candidate that adds or removes a migration changes this number
// only. Callers compare it with the migration directory and the applied ledger.
// ac74faa has 39 migrations, including
// 20261027001000_backfill_disputed_ticket_voids. Later candidates add
// 20261027170000_order_idempotency_keys,
// 20261102120000_brand_protection, and
// 20261102143000_checker_token_scopes.
const MIGRATION_COUNT = 42;
module.exports = { MIGRATION_COUNT };
