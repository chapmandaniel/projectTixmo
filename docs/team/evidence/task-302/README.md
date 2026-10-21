# Task302 — W01 L1 exact sale-window acceptance

Product/base: `4ec8594850eb547dafc145a14bb1b85cdeaa235c` unchanged.
Exact harness/runtime SHA: `3edffb3738a8dfe46e8a9a691c15ce68515c85db`.
Branch: `tixmo/task-302-exact-sale-boundaries`; worktree `task-302`.
Existing harness imported from task279R2 `4c856134` and extended, not replaced.

## Fresh verification

`bash docs/team/evidence/task-302/runtime.sh` exit0 on final harness:
**67/67 PASS, 15.368s**, 1 suite. Raw migrate/runtime/acceptance logs retained.
All 31 migrations deployed onto a newly initialized disposable PostgreSQL18 DB.
64 controlled-clock cases: 32 fixtures through direct OrderService and the same
32 through the mounted real Express `/api/v1/orders` endpoint over loopback HTTP.
20 admitted cases each assert exactly one new order and ticket, correct buyer/
event/PENDING order, HELD ticket, available−1 / held+1 / sold unchanged.
44 rejected cases assert total SQL order/ticket counts and all available/held/
sold totals unchanged. Fixtures round-trip exact salesStart/salesEnd through SQL.

Event and narrower-ticket opening/closing at T−1ms/T/T+1ms enforce [start,end).
Event-limiting fixtures keep ticket bounds broader; ticket-limiting fixtures
keep event bounds broader. Covers all-null, one-sided null, empty, touching,
disjoint and inverted intersections, unpublished/DRAFT, CANCELLED, COMPLETED,
DELETED, SOLD_OUT, deletedAt on PUBLISHED, event start closure, HIDDEN/SOLD_OUT
 ticket types. No new product behavior or weakened rejection semantics.
Existing aggregate-cap/buyer-isolation regression retained with added complete
SQL state snapshots. Existing durable late-payment/manual exception test retained.
No Stripe/provider calls occur: provider and notification boundary inert mocks.

## Clock and SQL distinction

Only global Date is temporarily replaced inside each admission operation, in a
try/finally: zero-argument Date/Date.now use the specified instant; constructors
with arguments retain native timestamp parsing. No fake timers are installed;
setTimeout identity is asserted. Date restoration precedes later tests.
This is **controlled Date equality**, not evidence of real wall-clock elapsed
boundary crossing, browser clock skew, device clock behavior or PostgreSQL NOW.
JWT/middleware Date reads within the mounted request share that controlled Date.
Actual SQL transactions, row locks and HTTP routing are not mocked.

The existing `actual event row lock wait crosses close before server clock
sampling` test is byte-for-byte identical to279R2, including observed
pg_stat_activity Lock wait and real native timer crossing. It passed1726ms on
this run with native Date restored. That is separate real-elapsed-lock evidence;
it must not be conflated with the equality matrix. No duplicate lock test built.

## Runtime safety and reproduction

Inspect runtime.sh, source-sha256.txt, tests/setup.ts, verification-safety.cjs,
app/order service/environment before running. Runtime first execs env-i, then
verifies the seven source hashes before any service import/access. NODE_ENV=test
skips dotenv; fixtures are synthetic. It creates a new mode0700 disk run under
workspace/runtime/task302 (not /tmp), owned PostgreSQL18/RedisDB1 loopback
listeners and validates exact executable/PID/listener before DB probes/migrate.
Shared dependency cache task235 matches the API lockfile byte-for-byte. To
reproduce, link its existing tixmoapi2/node_modules into this checkout, run the
command above, remove the symlink afterwards. No install or lockfile edits.

Redis is owned/probed and DB1 configured but the existing global Jest setup mocks
Redis/rate-limit-redis/logger. This is NOT new Redis integration/readiness proof.
Real mounted HTTP/prisma use PostgreSQL; Jest setup explicitly guards disposable
PG+Redis targets before schema bootstrap. No unknown inherited environment used.

Final owned PG2751387/Redis2751400/API2751541, ports28794/56474/39443 all absent
following trap and separate author post-run /proc/ss checks. Postmaster file and
Redis socket absent. First run similarly PG2750307/Redis2750320/API2750422,
ports23646/43357/41415 absent. See cleanup-verification.txt; these checks are by
author, not independent QA. All services stopped, dependency link removed,
sole DB ownership **released**. Trap has exact API cwd/node-exe/starttime fallback,
PG data-dir/PID/exe and unreaped child Redis ownership checks; no unrelated kills.
First67/67 PASS15.044s retained under first-run; final adds sourcehash fail-closed
and full cap/tenant snapshots and reruns final harness, not inherited green.

## Review and limits

Author submits **review, not done**. Independent QA must inspect exact harness
SHA and freshly rerun under its own coordinated disposable runtime. No browser
clock skew/Studio inventory acceptance (L2), provider/email/inbox, live payment,
staging/version/production/release acceptance. Full238 remains pending L2 browser
clause and independent acceptance; launch remains NO-GO. No external targets,
provider actions, spending, Gateway/config edits, merge or deploy.
Raw Prisma migration output is preserved, including any upstream whitespace;
source/doc diff-check excludes raw log files if whitespace is reported.
Native parent-message relay was unavailable once; checkpoint recorded on board.
