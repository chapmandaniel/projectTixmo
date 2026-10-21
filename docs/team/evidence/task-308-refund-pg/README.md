# Task 308 — scoped SQL / owned-child restart evidence

Author-scoped PASS, **independent QA and technical acceptance required**. Full W04 and release remain NO-GO.

Product baseline unchanged: `4ec8594850eb547dafc145a14bb1b85cdeaa235c`.
Tested harness: `bb22435a9230e7bf430933eddc8c0f417b9a444d`.
Branch `tixmo/task-308-refund-pg`; checkout `/home/daniel/projects/projectTixmo/worktrees/task-308`.
Only harness/evidence files changed; product src/Prisma diff empty.

## Fresh commands and results

- `bash docs/team/evidence/task-308-refund-pg/runtime.sh > docs/team/evidence/task-308-refund-pg/runtime.log 2>&1`: exit 0, PG18, 31 migrations (`migrate.log`), real Prisma and real payment recovery/finalizer.
- `bash -n docs/team/evidence/task-308-refund-pg/runtime.sh`: exit 0.
- `node --check docs/team/evidence/task-308-refund-pg/check.cjs`: exit 0.
- Product source/schema `git diff BASE --exit-code -- tixmoapi2/src tixmoapi2/prisma`: exit 0.
- Independent post-run PID/listener/socket/pidfile absence assertions: exit 0 (`cleanup.txt`).

Runtime reexecs `env -i` before imports, makes a new restrictive disk-backed task308 directory, proves owned PG/Redis loopback listeners before clients, validates destructive verification targets before application imports. Dependencies symlinked temporarily to existing matching task235 cache; no install/config changes. Sole DB ownership after QA306 cleanup.

## Observed real SQL assertions

53 synthetic refund rows: 50 poison oldest, healthy position51, old uncertain row52, manual late-payment row53. Worker1 runs real `recoverRefunds`, observes exactly first50 synthetic intent failures; all50 persist REQUESTED plus fresh cooldown timestamps and `owner=tixmo-backend` message. Parent SIGKILLs exact IPC child after batch commits. Worker2 is a distinct OS process with new Prisma/service connections to the **same running PG database**: healthy completes through real `reconcileRefund` and real `OrderService.finalizeRefund`, one synthetic processor-create call, refund/order SUCCEEDED/REFUNDED, ticket SOLD→RELEASED and inventory [available,held,sold]=[1,0,0]. Old row created more than23h ago encounters empty synthetic prior-refund list and fails closed: no new create, unchanged REQUESTED/null processor ID and durable owner message. Worker2 is killed. Worker3 reconnects same DB, has zero provider calls, unchanged healthy/order/ticket/inventory and manual late-payment row. Worker3 killed/reaped. `acceptance.log` records exact worker PIDs, provider-call traces and real SQL snapshots.

Policy73 manual row remains byte-equivalent as returned by Prisma. No late-payment automatic-refund permission introduced. Existing 291 webhook SQL cases intentionally not rebuilt.

## Boundaries / remaining acceptance

Provider **module transport stub only**: synthetic successful response for healthy, synchronous promise rejection with ETIMEDOUT for poison, empty prior-refund list for aged uncertain row. No actual HTTP outage, elapsed timeout, Stripe SDK retry, processor idempotency retention or remote provider proof. Logger is no-op; notification module throws on any attempted method; no notification/receipt/fulfillment delivery claimed. No Prisma, query, reconciler or finalizer mocks. TypeScript is compiled in memory by existing ts-node transpileOnly, not a fresh typecheck/build.

SIGKILL is deliberately **after committed batch completion**, not between provider response and SQL commit. This proves real owned-process restart/replay durability at the stated boundary, NOT in-flight ambiguous financial outcome/crash coverage. Cooldown checked via fresh SQL timestamp/exclusion without waiting60seconds. Aged fixture is >23h, not exact >= boundary. Real SQL covers stock and refund/order bookkeeping only, not external money movement or full financial/fulfillment exactly-once guarantees. Operational accountable-owner acceptance beyond the persisted message remains open. Full original #241 cannot be closed solely from this slice.

No product changes, inherited env secrets, external provider/email/network targets, spend, production mutation, push, merge or deployment. No new permission needed for this local slice.
