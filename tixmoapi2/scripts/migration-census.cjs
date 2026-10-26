'use strict';
// Single reviewed migration census for the qualified rollback candidate.
// The next candidate that adds or removes a migration changes this number
// only. Callers compare it with the migration directory and the applied ledger.
// fd256a9 has 36 migrations. This candidate adds
// 20261026180000_payment_status_refunded and 20261026234000_staff_action_audit.
const MIGRATION_COUNT = 38;
module.exports = { MIGRATION_COUNT };
