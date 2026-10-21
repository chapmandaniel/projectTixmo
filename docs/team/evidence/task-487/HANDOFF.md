# Task 487 source-only checkpoint

Base: `1b52f0a353ee1fd5330f26830f7464f84501fa2e`.
Branch/worktree: `tixmo/task-487-sales-pause`, `task-487`.

Existing Express/Prisma/Zod retained. No UI changes or dependencies.
POST `/api/v1/events/:id/sales-pause`: authenticated existing scoped roles;
strict `{paused:boolean, reason:trimmed 1..1000 chars, requestId:UUID}`.
Actor, organization, event and timestamp are server-derived. Reason is operational
text, never credentials. Response success envelope data includes eventId,
salesPaused, changed, requestId, auditId, replayed. Replayed state is HISTORICAL;
frontend MUST refetch current event after acknowledgement. Same actor/input/key
replays original evidence; different actor/reason/desired state gives 409
`errors.code=SALES_PAUSE_REQUEST_CONFLICT`. New-key no-op records before=after
and changed=false; no synthetic transition. Undeleted lifecycle states accept the
independent flag; resume never bypasses lifecycle/window/stock/waiting-room.

Otherwise eligible new orders reject with 409 `errors.code=SALES_PAUSED` and
"Ticket sales are temporarily paused. Existing orders and tickets remain available."
Existing lifecycle/deleted/window errors retain precedence. Existing pending,
payment, receipt, scanner and recovery predicates are unchanged; #73 manual
late-paid reconciliation remains unchanged, no automatic late-paid refund.

Audit insertion and flag mutation are in the same transaction/event lock used
by checkout. Failures propagate without acknowledging success. No audit CRUD or
public relation include added. Audit has event RESTRICT deletion, tenant/actor
identifier snapshots without cascading relations, no automatic expiry/pruning.
Soft deletion retains history. A later separately reviewed retention/data-erasure
procedure is required; append-only application convention is NOT tamperproof DB
retention. Public existing full Event scalar serialization includes salesPaused,
not the salesControls relation. Clone uses explicit fields and default unpaused.

Generic update, standalone publish and status transition now lock before state
validation; composable update/publish retain supplied configuration transaction.
Generic update never writes status from stale input. Existing cancel/delete/
restore lock paths unchanged.

Checks: Python inert source suite 6 tests; `git diff --check`. These checks do NOT
prove transactional rollback, concurrency, mounted auth/tenant behavior or paid
regressions. No app/runtime/services/database/schema generation/migration
execution/install/network/env/secrets/provider/config/scheduler/spend/push/merge/
deploy. Build script inspected: runs prisma generate, so deliberately NOT run.
No generated client or installed dependencies in this new worktree; compilation
NOT verified. Source requires later reviewed schema/client generation under a
separate grant. Independent lead + QA must review exact committed SHA; later
separately authorized synthetic mounted-route/rollback/concurrency/regression
qualification remains mandatory. #248/#243/launch remain OPEN; PM owns closure.
