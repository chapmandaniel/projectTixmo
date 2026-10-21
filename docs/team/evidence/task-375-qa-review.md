# Task 375 independent QA source receipt

2026-10-21, reviewer tixmo-qa. **PASS SOURCE PREPARATION ONLY**.
Tested exact author `f8a407cd789ecdebf11927debc3e3b26c4ea5267`, parent
`80c6710b89d147588e1514aa99a4e55c5630d38a`. Isolated branch
`tixmo/task-375-review`, worktree `/home/daniel/projects/projectTixmo/worktrees/task-375`.
Contract read with `git show 95e62218:docs/team/evidence/task-371-upgrade-preflight.md`;
lead receipt read with `git show db8b70127846f44587e8187fc643085f9c672ded:docs/team/evidence/task-374-lead-review.md`.
Both reads exit 0. Review is independent source inspection, not inherited lead PASS.
A newer author commit invalidates this exact-SHA acceptance. Only this evidence file changed.

## Substantive findings

No blocking findings for the bounded fixture/full31 source-preparation deliverable.

- Ten explicit INSERT column lists match CREATE TABLE columns in the first26 SQL.
  Inspected omitted fields/defaults: users/organizations/scanners created_at defaults,
  all required updated_at supplied; order fees/tax/discount default zero; ticket type
  status ACTIVE and tier is_active true. Prefix nullable category/timezone/venue
  ALTERs permit fixture events without these fields. Enum literals match UserRole,
  OrganizationType/Status, EventStatus, OrderStatus, PaymentStatus and TicketStatus.
  Insert ordering supplies organization, user, event, type, tier, order, ticket and
  scanner IDs before their dependent FK rows; all referenced IDs resolve within
  the fixture. No account/inventory/generation columns are seeded prematurely.
- Synthetic password, scanner and intent strings are explicitly inert; invalid
  example domains are used except deliberate legacy bootstrap/deleted-account
  migration triggers. No INSERT invokes payment/mail services; no credential read.
- Exactly26 prefix migrations end at webhook events; remaining five are copied
  into existing staged Prisma harness and deployed together. Full31 successful
  non-rolled-back ledger names and SHA256 checksums compare against source files.
  No released migration edited. Final generation DDL is BIGINT NOT NULL DEFAULT0;
  all three historical webhook rows retain original fields and assert bigint0.
- Before/after ordered snapshots conserve orders' identity/amount/payment/timestamps,
  users' original identity/password markers, tickets' owner/check-in/transfer
  history, scan rows and historical webhook fields. This is selected-column,
  in-memory evidence design, NOT persistent artifacts or whole-database coverage.
- Bootstrap/deleted identities assert disabled, sessionVersion1, platform false;
  deleted role/customer and organization clearing checked separately. Normal buyer
  retains active sessionVersion0, unscoped admin is not granted platform access.
  These assertions do not test disabled/stale JWT or invitation API rejection.
- Transfer asserts changed barcode, cleared cached QR, VALID normalization,
  recipient/tier retained and updatedAt delta; USED ticket status/barcode plus
  check-in/scan history preserved. No sender QR/API/scanner behavior proved.
- Known tier limit3, sold2/held1 and READY align with two paid tickets plus one
  pending; overlap/unmatched/inconsistent and cancelled-paid-event cases require
  reconciliation. Inconsistent old sold5 is not silently reset by migration SQL.
  Checkout calls for known exhaustion and three reconciliation cases match current
  service gate ordering before allocation writes/notifications. Cancelled event
  checkout is not exercised, but event rejection exists ahead of inventory gates.
  Historical order currency usd/LEGACY_UNKNOWN/unsent and payment amount1600 asserted.
- Advisory execution-slice coverage gap: harness does not directly assert every
  fixture ticket's inventory_state/tier_id or all original type counters, and
  tests historical receipt policy on one paid order. Existing aggregate/reconcile
  assertions are coherent source preparation, not exhaustive preservation proof.
  Add explicit expected per-ticket states/counter checks in the separately scoped
  runtime acceptance slice; do not infer all preservation acceptance from success text.
- Target guard precedes Prisma construction and migrations; accepts explicit test
  opt-in plus matching loopback tixmo_test URL, then harness requires empty public
  schema. Module resolution and temp directory creation precede guard, without DB
  access. Guard does not prove service ownership, disk-backed restrictive TMPDIR,
  environment scrubbing, network isolation or operator authorization. Dist imports
  reach environment/email configuration: future run needs separate scrubbed-env,
  compiled-artifact provenance and no-provider/network safeguards, not just guard.

## Commands and outcomes

All commands below ran from the isolated worktree; no harness execution.

- `git rev-parse HEAD HEAD^`: exit0, exact SHAs above.
- `git diff --stat HEAD^ HEAD`: exit0, only harness/fixture/author evidence (3 files).
- `node --check scripts/verify-payment-upgrade.cjs`: exit0.
- `git diff --check 80c6710b89d147588e1514aa99a4e55c5630d38a f8a407cd789ecdebf11927debc3e3b26c4ea5267`: exit0.
- `cat scripts/verify-payment-upgrade.cjs tixmoapi2/tests/migrations/payment-inventory-upgrade-fixture.sql scripts/test-target.cjs`: exit0.
- `cat tixmoapi2/prisma/migrations/202610*/migration.sql`: exit0; all five tail migrations inspected.
- `rg -n 'CREATE TABLE|ALTER TABLE|CREATE TYPE' tixmoapi2/prisma/migrations/*/migration.sql`: exit0; followed by exact prefix DDL reads with cat/sed (exit0).
- `sed -n '1,170p' tixmoapi2/src/api/orders/service.ts`: exit0; gate ordering inspected.
- Independent `node` stdin source/guard check reproduced below: exit0; output
  `PASS 31/26/5 migration set; BIGINT default; 10 fixture INSERT column lists; one accepted/seven rejected pure guard cases. No DB connection.`

```js
const fs=require('node:fs'),a=require('node:assert/strict');
const dir='tixmoapi2/prisma/migrations';
const names=fs.readdirSync(dir).filter(n=>fs.existsSync(`${dir}/${n}/migration.sql`)).sort();
a.equal(names.length,31);a.equal(names[25],'20260602010000_add_payment_webhook_events');a.equal(names.slice(26).length,5);
a.match(fs.readFileSync(`${dir}/${names[30]}/migration.sql`,'utf8'),/attempt_generation.*BIGINT NOT NULL DEFAULT 0/);
const prefix=names.slice(0,26).map(n=>fs.readFileSync(`${dir}/${n}/migration.sql`,'utf8')).join('\n');
const fixture=fs.readFileSync('tixmoapi2/tests/migrations/payment-inventory-upgrade-fixture.sql','utf8');
let count=0;
for(const insert of fixture.matchAll(/INSERT INTO (\w+) \(([^)]+)\)/g)){
 const table=insert[1], ddl=prefix.match(new RegExp('CREATE TABLE "'+table+'" \\(([\\s\\S]*?)\\n\\);'));
 a.ok(ddl,table);for(const col of insert[2].split(',').map(s=>s.trim()))a.ok(ddl[1].includes('"'+col+'"'),`${table}.${col}`);count++;
}
a.equal(count,10);
const {assertDisposableTestTarget:g}=require('./scripts/test-target.cjs');
const good={NODE_ENV:'test',TIXMO_ALLOW_TEST_RESET:'true',TIXMO_TEST_DATABASE_URL:'postgresql://synthetic@127.0.0.1:5432/tixmo_test_375'};
a.equal(g(good),good.TIXMO_TEST_DATABASE_URL);
for(const patch of [{NODE_ENV:'production'},{TIXMO_ALLOW_TEST_RESET:'false'},{TIXMO_TEST_DATABASE_URL:undefined},{TIXMO_TEST_DATABASE_URL:'postgresql://synthetic@remote.invalid/tixmo_test_375'},{TIXMO_TEST_DATABASE_URL:'postgresql://synthetic@localhost/customer'},{DATABASE_URL:'postgresql://synthetic@localhost/tixmo_test_other'},{TIXMO_TEST_DATABASE_URL:'https://localhost/tixmo_test_375'}])a.throws(()=>g({...good,...patch}));
console.log('PASS 31/26/5 migration set; BIGINT default; 10 fixture INSERT column lists; one accepted/seven rejected pure guard cases. No DB connection.');
```

Column-list checks are source text checks, NOT a SQL parser/DDL execution pass.
No failed checks during this review. Startup/main untracked AGENTS.md/docs/team
were preserved; no shared-main mutation.

## Limits / handoff

No DB, services, full harness, API runtime/build, SQL execution/parser, PG17 /
Redis8.2.10 parity, installs/network/provider, secrets/.env, configuration, spend,
push, merge or deploy. Persistent immutable before/after snapshots, source dump,
separate NEW empty recovery DB restore, old-code/new-schema compatibility,
post-backup reconciliation and recovery security disposition remain unimplemented
execution-slice acceptance. No rollback/restore/runtime/parity pass claimed.

Task375 completes this bounded independent review only. PM retains task373 closure;
parent245/W08/launch remain OPEN/NO-GO. Any runtime work requires fresh PM sole-owner
grant and reviewed restrictive-disk/scrubbed-loopback/service/network plan.
