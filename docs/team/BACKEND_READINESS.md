# Backend readiness audit - task #25

Date: 2026-10-19. Reviewed source baseline: `151a1ab` (bootstrap), branch
`tixmo/task-25-backend-readiness`. Static assessment only; **not a security,
payment, concurrency, runtime-test or launch pass**. Only this document changed.

## Existing controls and contract

- JWT authentication populates identity/role (`tixmoapi2/src/middleware/auth.ts`).
  `utils/tenantScope.ts` reloads actor organization/role from Prisma and provides
  event/ticket-type organization assertions. Events and ticket-type controllers
  invoke those checks. Role permission alone is not equivalent to tenant scope.
- `payments/routes.ts` authenticates intent creation; controller passes caller ID;
  `payments/service.ts:40` calls owner-filtered `orders/service.ts:getOrderById`.
  Intent amount derives from persisted order total, not request amount.
- `src/app.ts:53-61` installs raw-body handling before JSON for the webhook;
  `payments/service.ts:95-98` verifies Stripe signature before dispatch.
- Persistent webhook deduplication **already exists**: `PaymentWebhookEvent.id`
  is the primary key (`prisma/schema.prisma:287`); service skips existing
  PROCESSING/PROCESSED records, catches unique conflicts, and retries FAILED.
- Order creation atomically reserves inventory using conditional `updateMany`
  and a transaction (`orders/service.ts:163-243`). Confirmation/cancellation
  guard held quantities. These are meaningful protections, not proof of every
  lifecycle interleaving.

All API-relative paths below start at `tixmoapi2/`.

## Prioritized findings and bounded follow-ups

### P1 - Order operator paths lack the tenant assertions used elsewhere

Evidence: `src/api/orders/controller.ts:8,65-117` treats OWNER/ADMIN/MANAGER
as unscoped for read/list/cancel, passing undefined user ID. Confirm/refund
pass only order ID. `orders/routes.ts:114,174` supplies role gates, not tenant
checks; `orders/service.ts:getOrderById/listOrders/confirmOrder/refundOrder`
contains no actor organization predicate. In contrast, `utils/tenantScope.ts`
explicitly limits non-global actors to their organization. This is a concrete
source-level scope omission on these paths, not a reproduced exploit.

Follow-up: add two-organization negative route tests for scoped OWNER, ADMIN,
MANAGER and PROMOTER across get/list/confirm/cancel/refund; verify CUSTOMER
ownership separately. Then enforce event-derived organization scope before
privileged reads/mutations. Resolve global-role policy explicitly:
`docs/ROLE_ACTION_PERMISSION_MATRIX.md` says global owners/admins, but
`tenantScope.ts:isGlobalAdmin` permits only ADMIN without an organization.
PROMOTER also has confirm permission but is not in `canManageOrders`; avoid
silently broadening its read/cancel privilege while fixing scope.

### P1 - Intent preparation is not retry/concurrency-idempotent

Evidence: `src/api/payments/service.ts:40-77` checks PENDING, creates a fresh
Stripe intent without an idempotency option or stored-intent reuse, then
unconditionally replaces `order.paymentIntentId`. The database write follows
the external create and is not atomic with it. Repeated/concurrent preparation
or a failed database write can leave multiple intents; success handling rejects
a nonmatching stored intent (`:224-228`). This does **not** establish duplicate
charges in any deployed environment.

Follow-up: mocked-Stripe tests for repeat, concurrent preparation, response-loss
retry and write failure; specify stable intent ownership/idempotency and failure
recovery. Assert one usable intent per order and correct mismatch handling.
No live payments are needed for these regressions.

### P1 - Fulfillment failure can be acknowledged as processed

Evidence: `payments/service.ts:243-265` retries confirmation then catches final
failure and sends an admin alert without rethrowing if alert succeeds.
`handleWebhook:122` subsequently records PROCESSED. A paid-but-unfulfilled
order can therefore rely on manual recovery rather than webhook retry.
`tests/integration/payments_retry.test.ts:68-124` asserts retry counts/alerts
through the private success method, not final webhook HTTP/event state.

Follow-up: drive full webhook dispatch with mocked confirmation exhaustion;
assert durable retry/reconciliation state and response behavior. Define and
verify a bounded operator recovery procedure rather than claiming alerts alone
recover fulfillment.

### P1 - Lifecycle concurrency and expiry recovery remain unproven

Evidence: `orders/service.ts:320-395,449-521` reads order status outside its
transaction, then updates order by ID without a conditional PENDING transition.
Held-inventory guards are aggregate ticket-type guards, not per-order locks.
Distinct success event IDs for one order can bypass event-ID deduplication;
FAILED event reclaim (`payments/service.ts:142-152`) is also an unconditional
read-then-write. PROCESSING has no stale-reclaim branch in this service despite
persisted `processingStartedAt`. `jobs/order-expiry.job.ts:15-34` selects expired
PENDING orders and cancels them; confirmation does not check expiry. Creation
sets 15 minutes (`orders/service.ts:192`), while job commentary says 30 minutes.

Follow-up: disposable-DB deterministic tests for two confirmations, two cancels,
confirm versus expiry/cancel, distinct success IDs for one intent, simultaneous
FAILED retries, and worker death after PROCESSING. Assert one state transition,
no negative counters, conservation of available/held/sold and a recoverable
paid-after-expiry outcome. Aggregate inventory predicates alone must not be
reported as proof that an individual order is processed once.

### P1 - Verification has destructive-target and logging gaps

Evidence: `scripts/verify-api.mjs` preserves inherited/config-file DATABASE_URL
using `||=`, starts Compose, then runs `prisma db push --accept-data-loss` against
that configured URL without disposable-target validation. Starting local Compose
does not constrain Prisma's target. It logs REDIS_URL verbatim; DATABASE_URL
redaction masks password only. `tests/setup.ts:7-13` independently invokes the
same destructive schema push and suppresses bootstrap failure. Jest config
loads this setup even for unit tests. These paths were read, **not executed**.

Follow-up: require explicit disposable-local target identification before any
schema/test cleanup; reject remote/unknown targets before subprocess launch;
fail clearly on bootstrap errors. Add subprocess-stubbed target rejection and
redaction regressions including authenticated Redis URLs, without using real
credentials or databases. Keep separate from (but coordinate with) the existing
config-import console-output regression in `docs/REPO_CLEANUP_FOLLOWUPS.md`.

### P2 - Refund name does not establish financial refund completion

Evidence: `orders/service.ts:580-634` cancels eligible tickets, restores inventory
and marks REFUNDED in Prisma; it makes no Stripe refund call and leaves payment
status unchanged. Concurrent callers read PAID before the transaction and there
is no conditional status gate for inventory restoration. No financial refund was
attempted in this audit.

Follow-up: clarify bookkeeping versus financial-refund contract before release;
add authorized same-tenant, duplicate/concurrent refund tests and reconciliation
expectations. Implementation of actual money movement requires separate scope.

## Existing coverage versus gaps (source inspection, not executed)

| Source | What it establishes in test design | Missing focused evidence |
| --- | --- | --- |
| `tests/security/tenant_scope.test.ts` | Cross-org promoter event-create, organization-read and analytics negatives | Order operator tenant/role matrix and lifecycle writes |
| `tests/security/organization_update_auth.test.ts` | CUSTOMER update denial | Not a blanket tenant authorization pass |
| `tests/security/payment_validation.test.ts` | Missing/type/UUID order ID rejection | Foreign buyer's order, repeat intent and failure recovery |
| `tests/integration/orders.test.ts` | Create/hold, multi-type cancel restoration, basic confirm/cancel/list/auth | Transition races, duplicate item aggregation, expiry and refunds |
| `tests/integration/concurrency.test.ts:90-141` | Concurrent creation/sellout and held-inventory assertions | Confirmation/cancellation/refund interleavings |
| `tests/integration/payments.test.ts:149-218` | Success persistence and sequential duplicate IDs | Real signature/raw-body contract, concurrent duplicate/retry cases |
| `tests/integration/payments_retry.test.ts` | Mocked confirmation retries and alert exhaustion | HTTP response and durable webhook state after exhaustion |

The sequential duplicate webhook test uses an order paid by the earlier success
test and expects no confirmation call. It does not establish one fulfillment for
a fresh pending order receiving concurrent duplicate deliveries.

Reuse, do not duplicate, the two existing cleanup follow-ups: signature-error
handling (including non-Error throws and safer catch typing) and config import
logging. Add malformed/missing signature and exact raw-byte verification cases;
current mocked `constructEvent` success tests do not verify Stripe signatures.
Duplicate ticketTypeId lines are accepted by order validation and maxPerOrder is
checked per line; add an aggregate-per-type limit regression alongside inventory
work rather than assuming line limits enforce a per-order aggregate cap.

## Verification and handoff

- Read required team/role instructions, task #25 and its lead/verifier risk notes.
- Inspected shared-main `git status --short` and `git worktree list`; preserved
  unrelated untracked bootstrap files. Created isolated checkout from `151a1ab`.
- Used `rg`, `cat`, `sed`, and `nl` for source/test/schema/script inspection;
  no environment-value files, secrets, personal memory or live financial APIs read.
- `git diff --check`: required before commit; no product behavior changed.
- No Jest, API build, verify-api, DB setup, services or network integration checks
  run. Test names/assertions above are inspected coverage, not current passes.
- Existing Express/Prisma/Stripe implementation and Jest suite are sufficient
  starting points; no replacement module, new platform or spend proposed.
- Independent QA/lead must validate this report's source claims and exact commit
  before PM closes #25. This branch is not merged or deployed.
