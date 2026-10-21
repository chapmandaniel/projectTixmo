# Task345 independent QA - event cancellation explicit reentry

Exact tested SHA `3b87aa81d9e83933adbc92f298e7bf1a31754b76`; product base `f8bac3e1f53e64533b65bf6a1c3c7f0aebe2cb3d`. Isolated worktree task-345, branch `tixmo/task-345-independent-qa`. Bounded APPROVE of the single qualification case, not full task341 acceptance. Separate lead346 review remains required.

## Independent checks

Read author341 handoff, actual test, runtime/guard and event/order cancellation source. `git diff --exit-code f8bac3e 3b87aa8 -- tixmoapi2/src tixmoapi2/prisma` exit0: product and schema unchanged. Existing baseline verification safety/Jest bootstrap inspected in prior344; same safety/setup files on this base. No fake read: spy awaits actual original Prisma findFirst, retains actual snapshot, gates continuation after it. Separate real transaction commits PROCESSING while paused; application cancellation then locks and rereads. Gates determine schedule; timeout only bounds failure, no sleeps select ordering.

Assertion sensitivity inspection: removing observation guard would make expected400 fail; aborting event commit would fail CANCELLED-atObservation; skipping/doubling release would fail full target/stock assertions; mutating unrelated buyer/event/stock would fail full equality. This is source/assertion review, not a mutation-test run. No source or test/assertion changed; no baseline RED requested or claimed for this source-unchanged qualification.

Prior author341 PIDs3000903/3000916 and ports20098/44820 independently confirmed absent before grant use. Copied independent writable dependencies from task344 via `cp --reflink=auto -a`; generated client inode1996225 versus source1860406, no shared symlink mutation. Reused inspected341 harness with task345 runtime/artifact naming; actual test unchanged. `bash -n` harness and `node --check` guard exit0.

Fresh command:

`TASK345_SOLE_DB_GRANTED=1 bash docs/team/evidence/task-345/runtime.sh > docs/team/evidence/task-345/runtime.log 2>&1`

Exit0,1suite1PASS0FAIL0SKIP,5.986s. env-i before application imports, new0700disk runtime, owned PG18+Redis127.0.0.1, explicit disposable DB and RedisDB1, preimport nonloopback guard, synthetic-only keys, no provider call on this service path. Existing Jest setup mocks application Redis; no real provider integration qualified.

## Actual retained fresh SQL snapshots

snapshots.json extracted from this run raw Jest output, not reused author snapshots:

- Before: ON_SALE/PENDING/PENDING, stock8/2/0.
- Actual public observation: eventCANCELLED, target/tickets/stock unchanged.
- External committed mutation: paymentPROCESSING; stale public call rejects400 `Cannot cancel order that has changed`; entire afterFailure equals afterMutation.
- Explicit second call to same event service: targetCANCELLED, both ticketsCANCELLED/RELEASED, stock10/0/0. Exact other order fields retained, except allowed order/ticket/stock updatedAt changes.
- Third call: full order/ticket/stock equality. Only target event.updatedAt normalized, explicitly disclosed. Full distinct-event foreign buyer order/tickets/event/stock remain unchanged at all checkpoints, including replay.

Independently parsed result JSON and checked full postfailure equality plus every foreign snapshot. Source confirms event commit precedes order processing and alreadyCANCELLED is accepted; reentry is an explicit caller retry, not automatic recovery. No unrecoverable defect/fix/policy inferred.

## Cleanup and limitations

cleanup.json confirms run.k5UsI5 mode0700, actual owned PG3004157/Redis3004170 absent, ports29034/59924 no listeners, sockets/pidfiles/owned node-postgres-redis workers absent, blockednetwork bytes0. DB RELEASED; retained disk audit directory, unrelated services untouched.

Parent341 remains PARTIAL REVIEW. No PAID/inverse-contention/multiorder-progress/promo/routeauth/manual73/fullAPI/build/browser/provider or release inference. No cloud/provider/real secrets/spend/config/scheduler/push/merge/deploy. Commit uses command-scoped synthetic identity and hooksPath=/dev/null for known missing Husky bootstrap; no full precommit gate claimed and no configuration edited.
