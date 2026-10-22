// Inert syntax compilation only. No linking/evaluation, project imports or Jest.
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const path = require('node:path');
const root = path.resolve(__dirname, '../../../..');
const file = 'tixmoapi2/tests/integration/event-sales-pause.sql.test.ts';
const source = fs.readFileSync(path.join(root, file), 'utf8');
const javascript = stripTypeScriptTypes(source, { mode: 'strip' });
new vm.SourceTextModule(javascript, { identifier: file }); // deliberately never link/evaluate
const required = [
  "['PUBLISHED', 'ON_SALE']", "['lifecycle', 'window', 'stock']",
  "['pause', 'create']", 'pg_blocking_pids(pid)', "code: 'P2003'",
  "code: 'SALES_PAUSE_REQUEST_CONFLICT'", 'replayed: true',
  'noop.changed', 'stale.event.salesPaused', 'Promise.allSettled(requests)',
];
for (const fragment of required) {
  if (!source.includes(fragment)) throw new Error('Missing source contract: ' + fragment);
}
console.log('PASS: TypeScript stripped and parsed without evaluation; 10 static coverage markers (NOT SQL/runtime proof)');
