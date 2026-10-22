# Independent QA #495: FINDINGS / NOT APPROVED

Reviewed exact target `9fb2cdf41109676dcc5aa360d99f9d4cf7a3b60b` against
`6ab827bff6fdf67283b93f16612106f2217d4dc0`, not superseded rejected
`2a3de901c2297381c9ef5cb816405b0ec981cf9e`.
Branch `tixmo/task-495-independent-qa`; isolated worktree
`/home/daniel/projects/projectTixmo/worktrees/task-495`.
Only this independent report was authored; no product/author test changes.

Read role/repository/team instructions, board493/494/495/496, actual493 R2
HANDOFF/check-source/test and immutable494 report
`3d7b5cfbc72c2cfb2ac9cb10d960fe041b5a51ff`. Inspected actual event/order
services, ActorScope usage, Prisma relations/defaults/client, Jest setup/config,
verification bootstrap and existing order/payment fixture/barrier precedents.
Main's unrelated untracked AGENTS/team files were preserved.

## P2: observer SQL lifetime escapes fail-closed ownership

`tixmoapi2/tests/integration/event-sales-pause.sql.test.ts:222` passes a polling
async IIFE directly to `bounded`. Its raw observer query at225 is not in
`requests` or separately registered in `live`. A five-second timeout races that
IIFE; it does not cancel the pending Prisma query. The three-second deadline is
checked only between awaited queries, so cannot bound a pending query.

Concrete source failure path: observer query stalls; bounded polling rejects;
finally releases the holder; both mutation requests settle within their bounded
drain245; the outer test body rejects and is removed from `live`32. No call to
`preserve` occurred, because the requests drain succeeded. afterEach45 therefore
sees no tracked work, starts cleanup55 and can eventually disconnect73 while the
observer query remains live. If that query later resolves, its polling coroutine
also continues after the owning test has finished. Read-only observer SQL still
violates the claimed no-teardown-against-live-SQL boundary. This is a source
readiness defect, not an observed database failure.

Original author must register the actual polling operation's lifetime (not only
its timeout race), and require it to settle before cleanup/disconnect, or latch
failClosed/preserve evidence if it cannot drain. Do not treat Promise.race as
cancellation or weaken barrier/assertion coverage. External sole-process/owned
DB containment remains mandatory even after repair.

## Independent contract and repair assessment

- Original494 fixture leak is addressed on the normal/settled partial-setup
  path: exact UUIDs registered before INSERT80, tracked whole bodies29-33,
  UUID-scoped audit/ticket/order/type/event/user/org cleanup57-63. Audit deletion
  precedes the RESTRICT event FK and is disposable-only teardown, not retention
  policy. No payment attempts/refunds/tiers/scan logs are created by these paths.
- Original494 unbounded request drain and skipped spy restoration are addressed
  at245-247 and fallback47-50. Cleanup timeout/failure and genuinely un-drained
  tracked body/request failures latch failClosed and skip later fixture SQL,
  further cleanup and disconnect. These safeguards do not cover the observer
  lifetime above. Jest timeout does not cancel bodies; continuing SQL or cleanup
  after any timeout still requires external process/target reaping before reuse.
- PUBLISHED/ON_SALE pause rejection is sensitive to removal of salesPaused
  enforcement: expects409/SALES_PAUSED plus unchanged full snapshots. Explicit
  resume preserves event lifecycle/window/stock then checks a PENDING order and
  available9/held1. Independent SOLD_OUT/elapsed-window/zero-stock cases require
  rejection and unchanged snapshots after resume. This is focused representative
  conjunction coverage, not every lifecycle/window/tier permutation.
- Both orderings gate the actual post-event-lock read. Holder PID observation
  and blocked>0 precede release; zero pre-release orders, final count/held-stock,
  audit count and subsequent rejection distinguish pause-first from create-first.
  Planned SQL contention is meaningful, but NOT RUN and needs sufficient pool
  capacity for holder/waiter/observer. It is not a simulated mocked-lock pass.
- Replay asserts original evidence before and after resume, full unchanged
  snapshots and no re-pause. Changed target/reason conflict and distinct-key
  no-op audit before=true/after=true, changed=false match current service.
  Actor-conflict and cross-event key cases are not additional coverage claimed.
- Genuine invalid event FK reaches audit INSERT and expects P2003 with complete
  unchanged snapshot. Audit insertion precedes flag write in service269-275:
  source checks failure atomicity, not rollback of an already-written flag.
- Generic writer carries pre-pause false after committed pause; explicit update
  mapping ignores it and snapshots check evidence/stock/order preservation.
  This is stale payload coverage, not an independent overlapping-writer race.
- Service-level ActorScope does not qualify mounted authentication/tenant routes,
  payment/access/scanner/recovery or waiting-room runtime acceptance.

## Actual checks

1. Inspected checker before execution: only built-in fs/path/module/vm;
   stripTypeScriptTypes then SourceTextModule without link/evaluate.
   `node --experimental-vm-modules docs/team/evidence/task-493/check-source.cjs`
   exit0: inert parse plus17 static markers PASS; experimental warnings only.
2. `git diff --check 6ab827bff6fdf67283b93f16612106f2217d4dc0 9fb2cdf41109676dcc5aa360d99f9d4cf7a3b60b`
   exit0. Diff only adds HANDOFF, checker and265-line focused suite.
3. Separate Python standard-library static comparison via git-show: all41
   original assertion-start lines identical/in order versus2a3de901, exit0.
   This is preservation evidence, not evaluation or behavioral mutation testing.

No app imports/evaluation, Jest/test collection, runtime/services/DB,
generation/migration, network/install/env/secrets/config/scheduler/provider/
production/spend/push/merge/deploy. SQL/typecheck/generated-client compatibility
NOT RUN/UNVERIFIED. Source review is NOT APPROVED pending original-author
repair and exact-SHA independent re-review. #493 remains REVIEW; no runtime grant
or full #248/#243/launch closure.

Before final disposition, read fresh496 board DONE note and complete immutable
lead report `689ed441741cc58f310b5daca3ca61cd142c66d9` at
`docs/team/evidence/task-496/REVIEW.md`. It independently reaches the same P2
observer lifetime finding and scoped acceptance of the repaired portions. No
stale or parallel approval is inferred; both reviews require author repair.
