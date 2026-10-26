'use strict';
// Single reviewed migration census for the qualified rollback candidate.
// The next candidate that adds or removes a migration changes this number
// only. Callers compare it with the migration directory and the applied ledger.
// Main's 36 migrations plus 20261026234000_staff_action_audit.
const MIGRATION_COUNT = 37;
module.exports = { MIGRATION_COUNT };
