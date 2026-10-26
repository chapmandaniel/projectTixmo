'use strict';
// Count migration directories in this tree so the census matches whichever of
// the in-flight refund migrations is present.
// This branch alone (main's 35 plus payment_refund_lines) is 36.
// With PR #132's 20261026180000_payment_status_refunded as well, the count is 37.
const fs = require('node:fs');
const path = require('node:path');
const MIGRATION_COUNT = fs
  .readdirSync(path.join(__dirname, '../prisma/migrations'))
  .filter((name) => /^\d/.test(name)).length;
module.exports = { MIGRATION_COUNT };
