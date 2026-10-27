'use strict';
// Single reviewed migration census for the qualified rollback candidate.
// The next candidate that adds or removes a migration changes this number
// only. Callers compare it with the migration directory and the applied ledger.
// ee2957c has 38 migrations. This candidate adds
// 20261027001000_backfill_disputed_ticket_voids.
const MIGRATION_COUNT = 39;
module.exports = { MIGRATION_COUNT };
