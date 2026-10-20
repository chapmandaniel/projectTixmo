# Task 134: conditional FAILED webhook retry admission

Base: `35f6f7b3cf53019561152fb79ad23b24fdc68142`.
Branch: `tixmo/task-134-failed-retry-fix`; isolated worktree `task-134`.

## Change and contracts

FAILED retry admission uses Prisma updateMany conditional on ID and FAILED status;
only affected-row count 1 enters payment handling. No schema, lease, stale
PROCESSING recovery, actor, signature, tenant, payment/order/email or financial
policy changes. Decision73 manual/no automatic financial refunds is unchanged.
Existing maintained Prisma/Jest harness reused; no custom replacement runtime.

Both genuine FAILED pre-reads are held, then claim winner0 and winner1 are
exercised separately. Both updates execute in the real database. Loser count0
must skip the order handler (`gated.size === 1`); claims must equal1. Signed
public webhook delivery, durable event/order/tickets/inventory, full other-buyer
snapshot and exactly once email assertions remain. Sequential FAILED retry and
processed duplicate preserve exact order/ticket/inventory snapshots. Existing
recovery unit suite also covers actual confirmation failure then successful retry.

## Commands and results

Ran `bash .task134-runtime.sh` from isolated worktree; helper locally retained.
It preserves review133 helper guards verbatim except task-owned paths/cache and
commands below: PID/UID/executable/datadir/direct-child identity; loopback
listener ownership before TCP probes; readiness; disposable target validation;
bounded TERM/KILL cleanup. Existing container services untouched. Dependency
symlink points to existing task65 API node_modules. Fresh disk-backed database
was initialized below `.runtime134.QpT5Hx/`, verified target:
`tixmo_disposable_57|tixmo57|127.0.0.1|29362`.

Original reviewed source kept during first command; adapted harness produced
RED exit1: 1 suite, 2 failed tests, both Expected1 Received2 at ownership oracle,
not barrier timeout (6.89s). Then restored fixed service and ran GREEN exit0:
9 suites, 114 tests passed (19.84s). Build exit0. Exact command tail:

```bash
npm --prefix tixmoapi2 test -- --cacheDirectory "$PWD/.jest-cache" --runInBand --runTestsByPath tests/integration/payment-failed-retry.race.test.ts > .task134-red.log 2>&1
red_status=$?
echo "TASK134_ORIGINAL_RED_EXIT=$red_status"
cp .task134-fixed-service tixmoapi2/src/api/payments/service.ts
npm --prefix tixmoapi2 test -- --cacheDirectory "$PWD/.jest-cache" --runInBand --runTestsByPath tests/integration/payment-failed-retry.race.test.ts tests/integration/payment-distinct-success.race.test.ts tests/unit/payments.webhook-recovery.test.ts tests/unit/payments.webhook-signature.test.ts tests/unit/payments.prepare.test.ts tests/orders-tenant.unit.test.ts tests/orders-recovery.unit.test.ts tests/integration/order-double-confirm.race.test.ts tests/integration/order-confirm-cancel.race.test.ts > .task134-green.log 2>&1
test_status=$?
echo "TASK134_GREEN_EXIT=$test_status"
npm --prefix tixmoapi2 run build > .task134-build.log 2>&1
build_status=$?
echo "TASK134_BUILD_EXIT=$build_status"
test "$red_status" -ne 0 && test "$test_status" = 0 && test "$build_status" = 0
```

`git diff --check`: exit0. Local logs: `.task134-red.log`,
`.task134-green.log`, `.task134-build.log`, `.task134-runtime.log`.

## Cleanup and limits

Guarded shutdown succeeded. PostgreSQL PID944647 port29362 and Redis PID944660
port43765 stopped; final ss output for both ports empty. Runtime scratch is
retained on disk, no service running. No production/provider/financial actions,
merge/deploy, scheduler/config or secret changes. Not a full readiness run.
Independent QA and lead must review the exact implementation SHA before PM
closure; implementation remains review, not done.
