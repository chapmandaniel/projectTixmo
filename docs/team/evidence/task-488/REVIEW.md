# Independent lead review #488

Verdict: **SCOPED SOURCE PASS**, no blocking source defect identified in this bounded review. This is NOT runtime, migration, authorization, concurrency or operational qualification.

Reviewed exact candidate `434bb2fda62ab0d9645896e2020e8a96202ee612` against `1b52f0a353ee1fd5330f26830f7464f84501fa2e`. Branch `tixmo/task-488-independent-review`, new isolated worktree `/home/daniel/projects/projectTixmo/worktrees/task-488`. Author task #487 was read but never claimed or closed. Separate QA conclusions were not consulted. Main's existing untracked AGENTS/team files preserved.

## Findings and contract review

No severity P0/P1/P2 source finding established. Evidence gaps below are mandatory later qualification, not a representation of acceptance.

- `tixmoapi2/src/api/events/service.ts:250`: explicit desired state, role check, event lock before read and tenant recheck before replay. Server event/tenant/actor snapshot, timestamp DB default; atomic evidence and narrow flag mutation. New key/no-op persists before=after; replay returns original acknowledgement and does not overwrite a later resume. Conflict compares actor/reason/state. Controller explicitly tells consumers to refetch current event.
- `tixmoapi2/prisma/schema.prisma:918` and migration source: additive false default applies existing/new events; event relation RESTRICT retains audit against hard event deletion; tenant/actor snapshots avoid cascading deletion. No automatic pruning or broad CRUD. Application append-only convention is not database tamper resistance. Indefinite retention with no automatic purge is explicit in author handoff; future policy/export/deletion requires separate review.
- `tixmoapi2/src/api/events/service.ts:283`, `:537`, `:558`: generic update/status/publish lock and validate inside composable transaction; generic updates no longer reapply lifecycle. Configuration passes its existing transaction; cancellation/delete/restore retain event locking and narrow mutations. Clone omits pause/audit and takes default false.
- `tixmoapi2/src/api/orders/service.ts:89`: only actual new-order create ingress locks same event before eligibility; both PUBLISHED/ON_SALE require pause false, existing deleted/lifecycle/time predicates precede pause. Error uses existing ApiError errors.code envelope, confirmed against errorHandler source. Pause precedes ticket allocation/promo/order mutation.
- Public list/detail return full Event scalars, so salesPaused is exposed without needing a new projection; neither includes salesControls. No audit reason/actor/history exposure found. No pause reads inserted into existing pending-order/payment/paid-ticket/scanner/recovery paths. This is source preservation, not regression proof.

## Actual independent checks

Inspected imports first: event service imports Prisma/config, order inventory and order service with transitive application dependencies. No application module was imported. No dependencies present in this worktree; compilation remains UNVERIFIED.

1. `node docs/team/evidence/task-488/inert-check.cjs` — exit 0. Runs the exact extracted setSalesPause body (TypeScript signature removed, body unchanged) using in-memory mocks only. Assertions: transition and lock/read/scope/audit/update sequence; repeat replay; conflicting desired state and errors.code; new-key no-op; historical replay after resume without mutation; disallowed role; cross-tenant denial; audit/update/commit failure propagation with simulated rollback. **Mock scope helper is simplified, not actual tenant authorization proof; mocked transaction rollback is not Prisma/Postgres rollback proof.**
2. `python3 docs/team/evidence/task-487/source_checks.py` — exit 0, six static checks. Read before execution; no imports beyond Python stdlib. These are static assertions only, not behavioral evidence.
3. `git diff --check 1b52f0a353ee1fd5330f26830f7464f84501fa2e 434bb2fda62ab0d9645896e2020e8a96202ee612` — exit 0.
4. Source searches `rg -n 'event\.(update|updateMany|upsert|create)' tixmoapi2/src`, `rg -n 'order.create|salesControls|salesPaused' tixmoapi2/src`, plus inspection of tenantScope, ApiError, errorHandler, validate, public routes/services, configuration and clone paths. Only actual order insertion found at orders/service.ts:197. Existing-order pause predicate absent.

One inspection command ended exit 1 because `test -d tixmoapi2/node_modules` was false, not because a test failed. Node is available. No build/test runner/app startup used.

## Remaining limits

No real route/auth/validation execution, generated-client compile, Prisma schema validation, SQL application, real lock ordering/concurrency/rollback, free/paid/promo flow or paid-access regression proof. Those require later separately authorized synthetic acceptance, including global ADMIN boundary, both lifecycle paths, denied roles/tenant, failed commit, pause/resume/new-order barriers and stale writer races. Frontend is intentionally unchanged; client must handle errors.code SALES_PAUSED and refetch after historical replay. Separate QA #489 mandatory; PM alone may close implementation #487 after both reviews. Full #248/#243/launch remain OPEN.

No author-code edits; no app/runtime/services/DB/schema generation/migration execution/network/install/env/secret/config/provider/production/spend/push/merge/deploy. This report and inert harness are the only review-owned additions.
