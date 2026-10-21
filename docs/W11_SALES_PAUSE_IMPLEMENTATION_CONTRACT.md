# W11 dedicated sales-pause implementation contract (#485)

Source baseline: `8aae387bcd4290edd259fd75aa11baaa1f62ca63` (2026-10-21).
Input: accepted #481 `56fbad5630df09fc3be304d480b38263f9c7130a`,
`docs/W11_SALES_PAUSE_INCIDENT_HANDOFF.md` at that commit, not assumed merged.
This is a bounded implementation handoff, not an implemented/qualified control.

## Authority and reuse

Actual #248 board decision `BB248-20261021-SALES-PAUSE-V1` is APPROVED;
queued run `5649c568-d35e-4807-b372-729658f66c8b` alone was not approval.
It approves independent persistent pause, commit-linearized admission, valid
PENDING completion under unchanged rules, explicit resume and customer wording.
The assignment remains SOURCE/DOCS ONLY. No implementation is supplied here.

Existing-solutions preflight: the repository already has Express routing,
Prisma transactions/Postgres event-row locking, tenant scope and Zod validation.
Reuse those; no custom framework, new service, dependency or paid platform.
Source search found no generic audit service/model. The existing narrow
`TicketInventoryReconciliation` model in `tixmoapi2/prisma/schema.prisma`
provides an append-only actor/before/after evidence pattern, not an event audit
facility. Do not misuse inventory evidence or public event metadata for pause
history. Recommendation: one equally narrow event-sales-control evidence model
in the same database. PM is seeking clarification that this satisfies the
approved reuse/audit condition. HOLD audit-model-dependent implementation until
that clarification is recorded; policy approval does not resolve this gap.

## Minimal persistence and HTTP contract (proposed source changes)

- `tixmoapi2/prisma/schema.prisma`: Event `salesPaused Boolean @default(false)`
  mapped to `sales_paused`, independent of EventStatus, quantity and metadata.
  New/clone defaults unpaused; existing rows explicitly default/backfill false.
  Never derive pause from SOLD_OUT, cancellation or payment failures.
- Proposed migration source location:
  `tixmoapi2/prisma/migrations/<timestamp>_event_sales_pause/migration.sql`.
  Review additive column/backfill and audit table/index/uniqueness DDL; do not
  generate/apply against a database under this assignment. No migration exists
  in this handoff. Deployment/backfill/rollback review is separately required.
- Conditional narrow model `EventSalesControl`: immutable id, eventId,
  organizationId snapshot, actorId snapshot, requestId, reason, beforePaused,
  afterPaused, createdAt. Unique `(eventId, requestId)`; index event/time.
  Keep snapshots meaningful after actor deletion, as inventory evidence does.
  Public serializers must expose only `salesPaused`, not reason/actor/history.
- Existing mounted API chain is `src/app.ts` -> `src/api/index.ts` -> events;
  with configured version v1 propose `POST /api/v1/events/:id/sales-pause`
  body `{ "paused": true, "reason": "incident reference and explanation",
  "requestId": "UUID" }`. False is explicit resume, never toggle.
  Reason trimmed/nonempty/bounded (propose 1000 chars); UUID request key.
- Edit `tixmoapi2/src/api/events/{routes.ts,validation.ts,controller.ts,service.ts}`.
  Reuse authentication, `authorize('OWNER','ADMIN','MANAGER','PROMOTER')`,
  `getActorScope` and `assertEventAccess` from `src/utils/tenantScope.ts`.
  No role expansion: only actual platform ADMIN satisfies global scope;
  OWNER is not a global override. Bind event/tenant to persisted event and actor,
  never caller-supplied organization/actor IDs. Revalidate scope against locked
  event before writing, preserving existing tenant denial semantics.
- Return existing success envelope after transaction commit with eventId,
  salesPaused, changed, requestId and audit identifier. Authenticate/authorize
  before replay lookup. Same requestId + same actor/target/reason/desired state
  returns stored outcome without mutation/new audit. A reused key with different
  input returns 409. A new key requesting current state records one no-op
  before=after outcome; no silent toggle. Return stored replay outcome as
  historical acknowledgement, not a claim of current state: UI refetches event.
  Failures roll back flag and evidence together; no success before commit.

## Transaction boundary and all actual new-order ingress

`src/api/orders/routes.ts` mounts authenticated POST `/orders`, validates,
passes existing `waitingRoom`, then `orders/controller.ts` calls
`orderService.createOrder`. Search of all `tixmoapi2/src` finds one order
creation write: `tx.order.create` inside `src/api/orders/service.ts:createOrder`.
There is no separate public/box-office/payment order-creation write in that
source tree. Public event routes are reads, not an alternate admission gate.
CheckoutPage's free, promo-discount and paid selections all POST `/orders`;
zero-total orders auto-confirm only AFTER that same creation transaction.
Existing PENDING resume, create-intent, webhook/recovery and operator confirm
are existing-order paths, not alternate permission to create a replacement.
Future ingress must call this same eligibility gate; do not protect UI alone.

Pause/resume transaction: take existing
`SELECT id FROM events WHERE id = ... FOR UPDATE`, read current event, check
scope and undeleted state, check/replay request, update only salesPaused and
append evidence. Proposed control may set the independent flag on any
undeleted lifecycle state; this never makes a closed event purchasable.

Checkout already takes that same event lock before reading eligibility and
before ticket-type locks, holds, promo reservation, order/ticket insertion.
Add `salesPaused` rejection to `orders/service.ts` there, not a preflight
outside the transaction. Preserve existing lifecycle/window/start/tier/stock
checks. For an otherwise eligible paused event use 409 with stable
`SALES_PAUSED` code via existing error envelope; lifecycle/deleted/expired
errors retain precedence. Preserve waiting-room middleware precedence.

The ordering boundary is committed transaction serialization, not request
arrival/button time. A creation holding the event lock before pause can commit
as a pre-pause order. Pause waits; once pause commits, later serialized NEW
orders fail without holds/orders/tickets/promo consumption. Resume also takes
the lock; checkout between pause and resume fails, checkout after committed
resume still needs every other existing predicate. Rollback is not a pause.
Do not add order locks to sales-control transactions or invert existing
order/event/type/promo lock ordering.

## Lifecycle writer races that must be repaired in the same backend change

In `events/service.ts`, generic `transitionEventStatus` and standalone
`publishEvent` read/validate then update without their own shared event lock.
`updateEvent` accepts unchanged status but can later write that stale status
back via `if (data.status) updateData.status = data.status`, overwriting an
intervening transition. Fix by transaction-wrapping standalone writers,
locking before validation, and never writing status from generic updates;
reject attempts to change it via dedicated validation. Do not write a stale
whole Event object or add salesPaused to generic update/configuration input.

`configuration.service.ts:saveEventConfiguration` already locks event in its
transaction and passes tx into update/publish; preserve that composition (no
nested independent transaction). `cancelEvent`, `deleteEvent`, `restoreEvent`
already lock event: retain current lock/state checks and side effects; none
may clear salesPaused. `cloneEvent` must start a new draft unpaused rather than
copying pause/audit state. Inspect every event writer when implementing;
resume must never restore a saved lifecycle, alter stock or auto-publish.

## UI and unchanged existing-order eligibility

Update `events/service.ts` public list/detail explicit projections and
`events/public.routes.ts` contract as necessary to include only salesPaused.
`tdash/src/features/EventCommandCenter.jsx`: separate role-gated pause/resume
control, reason and pending/error/committed state, refetch after response;
never reuse status/SOLD_OUT button. Reuse `tdash/src/lib/api.js` client.
`tdash/src/pages/CheckoutPage.jsx`: disable NEW preparation when paused,
show approved wording only in an otherwise applicable sales context:
“Ticket sales are temporarily paused. Existing orders and tickets remain available.”
Handle server SALES_PAUSED when cached state was unpaused. Do not hide
existing PENDING completion/resume, wallet links or recovery on pause.
Existing cancellation/expiry/access/outage messaging takes precedence; wording
is not an entry, uptime, fulfillment or payment-completion guarantee.

Do NOT add salesPaused to existing-order confirmation, payment-intent,
webhook/recovery, receipt, ticket or scanner predicates. Existing valid PENDING
and intents may finish under unchanged expiry/reservation/auth/payment rules;
no hold extension, resurrection or replacement order. Preserve #73 late-paid
manual reconciliation and NO automatic refund. Paid QR/wallet/receipt/scanner
remain subject to existing ownership, tenant, refund, ticket and event rules,
not unconditional access. No automatic resume; operational incident review,
named owner and second approver remain unqualified gates from #481.

## Future acceptance and integration order

1. Resolve audit-model clarification; PM assigns bounded backend schema/API/
   writer repair, then frontend against its exact contract, then independent
   lead + QA exact-SHA review. No runtime authorization follows from this doc.
2. Proposed source tests: add
   `tixmoapi2/tests/unit/events-sales-pause.test.ts` (validation/auth/replay/audit
   rollback) and `tests/integration/events-sales-pause.test.ts` (real mounted
   routes plus transaction races). Extend existing
   `tests/orders-sale-windows.unit.test.ts`,
   `tests/integration/event-configuration.test.ts`,
   `tests/unit/api/events-public.service.test.ts`;
   frontend `tdash/src/test/{EventCommandCenter,CheckoutPage}.test.jsx`.
3. Acceptance must cover both PUBLISHED and ON_SALE, free/paid/promo orders;
   unauthorized/missing auth, disallowed role, cross-tenant OWNER/MANAGER/
   PROMOTER and valid scoped roles/global ADMIN. Denials leave flag/audit/stock
   unchanged. Malformed body, duplicate/conflicting keys, failed audit write
   and failed commit must not acknowledge a new pause or partly mutate state.
4. Deterministic barriers, not sleeps: checkout-first then pause; pause-first
   then checkout; pause/resume/checkout in both lock orders; duplicate pause;
   stale generic update/status/publish/configure racing cancel/delete/restore.
   Assert actual order/hold/promo counts and final lifecycle/flag/evidence,
   not just HTTP status. Unrelated edits cannot clear flag or revive lifecycle.
5. Preserve existing PENDING intent/confirm and free auto-confirm after pause,
   expiry/cancel rejection, already-PAID idempotence, late-paid manual exception
   without auto-refund, webhook/recovery and receipt retry. Reuse existing
   payment/order integration suites and `tests/integration/scanners-offline.test.ts`
   for paid QR/receipt/scanner/tenant regressions; retain unchanged refund and
   cancellation predicates. Resume cannot bypass stock/window/tier/waiting-room.
6. Later separately authorized disposable synthetic DB/mounted-route concurrency
   acceptance is mandatory; source/mock assertions cannot qualify locking,
   real authorization or operational control. Target monitoring/alert delivery,
   named on-call/resume approvals and full #248/#243/launch remain OPEN.

## Actual #485 evidence

Only this Markdown handoff changed on isolated branch
`tixmo/task-485-sales-pause-contract`, worktree `task-485`, exact baseline above.
Checked source/routes/schema/callers and accepted #481 via git show; actual
#248 policy read directly. `git diff --check` is the static formatting check.
Guessed event-studio/public-service paths were absent; corrected to
`events/configuration.service.ts` and `events/public.routes.ts`.
No tests/build/runtime/DB/services/network/env/secrets/install/config/scheduler/
cloud/provider/production/spend/push/merge/deploy executed. Independent QA must
review this exact committed SHA before PM scoped closure; not full W11 acceptance.
