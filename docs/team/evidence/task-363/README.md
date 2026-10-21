# W04 acceptance reconciliation - task 363

Source/document review only, 2026-10-21. Product/base:
`80c6710b89d147588e1514aa99a4e55c5630d38a`.
Branch `tixmo/task-363-w04-reconciliation`, isolated worktree `task-363`.
Docs successor `2d878423391e3d34761cbea622c1a7e0b7dfac25` changes only
`docs/team/evidence/task-361/{README.md,manifest.json}` relative to this base;
it adds no runtime behavior. No current acceptance run is claimed.

## Original #241 criterion map

- **50 poison records + healthy 51st:** accepted #267
  `afef1d734187dbce260271284a50e719742c48b2` proves refund fairness/backoff
  with mocked queries/reconciler; #271
  `f803f11632cfe16cde4cf9c2bcd0bac699cb978a` adds both webhook retrieval
  routes with mocked queues/effects. These are not SQL or financial proofs.
  #291 `adc81d94f8ec5d9b50ac025cabdf4fb535611da0` (tested harness
  `08f96af42cb88d094450293f48881c792ac0e2d5`) adds real PostgreSQL webhook
  selection, cooldown, claims/generation/CAS and healthy synthetic unsupported
  event processing, NOT a payment/fulfillment handler.
- **Healthy progress and no duplicated local stock/money bookkeeping:** #308
  `c8424ca6d1cf53aba9a97c1013da59230b486857` (tested harness
  `bb22435a9230e7bf430933eddc8c0f417b9a444d`) proves real SQL refund backlog,
  real reconciliation/finalization, one synthetic create and one SOLD-to-RELEASED
  stock transition; three owned worker kills occur AFTER commits. External
  financial effects and delivered fulfillment are not proved.
- **Outage/restart:** #311 `feb60b185cf4a311ee4d934fb15a21cd836f7ca5`
  (tested harness `2e6c52e62861e915b7b2b512645ee74dd6d9a8a8`) adds an owned
  in-flight SIGKILL after fsynced synthetic provider effect, before create returns.
  Replacement process uses same running DB/durable ledger, list-match, zero new
  create, real finalization and unchanged replay. Immediate ledger rejection is
  not elapsed outage/SDK timeout; no host or DB restart is proved.
- **Old provider idempotency window:** #267/#308/#311 prove old unlinked,
  unmatched refund fail-closed with no create (23h local safety cutoff, not a
  verified provider retention guarantee). #311's matching-effect recovery uses
  a young refund; its separate aged record has no matching effect.
- **Observable accountable exception:** persisted sanitized
  `owner=tixmo-backend` retry metadata and unchanged manual #73 late-payment
  rows are locally demonstrated. This is not operational-owner acknowledgment,
  staffed escalation, provider reconciliation or release authorization.

All five tasks were accepted for these bounded scopes with independent reviews;
their runtime evidence remains HISTORICAL at product
`4ec8594850eb547dafc145a14bb1b85cdeaa235c` for #291/#308/#311, not a new pass
at the current candidate. #241 remains open.

## Exact financial source parity / invalidation

`git diff OLD BASE -- tixmoapi2/src tixmoapi2/prisma` names exactly:

- `src/api/payments/service.ts`: ONLY `refundOrder` ingress gained optional
  status/paymentStatus observation and equality check under order lock.
  `reconcileRefund`, `recoverRefunds`, webhook recovery/claim/fences, manual
  late-payment guard, 23h safety constant and provider list-before-cutoff path
  are unchanged. Whole-file identity is FALSE.
- `src/api/orders/service.ts`: public cancellation now rechecks observed state
  under lock; public refund captures scoped observation and passes it to
  payment ingress. `finalizeRefund` and transactional financial/inventory
  helpers are unchanged. Whole-file identity is FALSE.
- `src/services/paid-sales-query.ts`: date parameters explicitly normalize UTC;
  reporting is changed, not recovery financial execution.

All other source paths and the entire Prisma directory have exact Git parity.
Thus historical recovery/finalizer behavior is source-supported, but prior
whole-product/whole-payment-file manifests and ingress/reporting acceptance
cannot be carried forward as current-candidate identity or runtime evidence.
No source change was made here. Full API results are not repeated or upgraded.

## ONE recommended next bounded local criterion

**Old-window matching-effect recovery after an ambiguous worker crash.**
This is the concrete intersection of original #241's old-window and restart
criteria, not a speculative all-queue matrix. Inspection of #311 check.cjs
lines 31-35 shows `healthy` created about two minutes ago; only the separate
unmatched `aged` fixture exceeds 23h. Current `reconcileRefund` lists and matches
`metadata.refundId` BEFORE applying the old-window no-create guard.

Proposed task base: exact product `80c6710b89d147588e1514aa99a4e55c5630d38a`
(or docs-only `2d878423391e3d34761cbea622c1a7e0b7dfac25`, after parity check).
Reuse existing #311 `check.cjs` / `runtime.sh` at exact
`feb60b185cf4a311ee4d934fb15a21cd836f7ca5`; copy ONLY these harness files into
new task-owned evidence paths, never cherry-pick the old product snapshot.
Adapt task-specific path/env guards consistently. Existing open-source local
Postgres/Redis and the existing harness suffice; no custom service/install.

Single scenario: retain the existing fsync/IPC barrier and SQL unchanged-state
assertion, kill/reap exact owned worker, then deliberately SQL-age the SAME
healthy refund's `createdAt` to 24h before now (keep it recovery eligible).
Read back and assert age >= 23h before spawning replacement against SAME DB
and ledger. Require matching list result, zero replacement creates, exactly one
ledger effect, SUCCEEDED/REFUNDED state, one SOLD-to-RELEASED transition,
[available,held,sold]=[1,0,0], then replay with zero provider calls and deep SQL
snapshot equality. Preserve existing manual73 and aged-unmatched controls.

Proposed execution AFTER separate assignment/sole-DB ownership and source
inspection: `bash docs/team/evidence/task-N-old-window-recovery/runtime.sh`.
Use its scrubbed env-i, fresh 0700 disk runtime, explicit disposable loopback
PG18/Redis guards, owned worker/DB/Redis PID/listener/socket cleanup. Record
exact harness/product SHAs, command/status/logs and independent QA+lead review.
No execution occurred in #363. This proves only local SQL/bookkeeping against
synthetic durable transport; SQL aging is not 24h elapsed outage, provider list
completeness/retention, external exactly-once, SDK timeout or owner signoff.

#231 retains integration ownership. #61/#250 gates and all production/provider,
spend, publishing, default-branch merge and operational-owner gates remain.
