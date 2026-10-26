'use strict';
// Single reviewed migration census for the qualified rollback candidate.
// The next candidate that adds or removes a migration changes this number
// only. Callers compare it with the migration directory and the applied ledger.
// This integration tree is main's 35 migrations plus 20261026230000_payment_refund_lines.
const MIGRATION_COUNT = 36;
module.exports = { MIGRATION_COUNT };
