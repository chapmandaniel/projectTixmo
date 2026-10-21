# W03 local refund and recovery exceptions

Task #240; inspected base `317754edc7b43eb8e27b60c5374679330326c575` (candidate235, not accepted). This is factual source/simulator evidence, not approved commercial policy, live operating permission or full W03 acceptance. #250 permits local synthetic CAD only, ZERO exposure. #73 requires late-paid manual reconciliation, **NO automatic financial refund**. #123 accepted a historical bookkeeping guard; it does not approve candidate235's provider behavior.

## Mounted surfaces and observed behavior

Source paths below are relative to `tixmoapi2/src/`.

- `api/index.ts` mounts orders/payments; `api/orders/routes.ts` mounts authenticated cancel, OWNER/ADMIN refund and buyer request-refund. No order-confirm route is mounted, despite its exported controller. Actor/tenant checks remain mandatory; no global OWNER expansion.
- `api/orders/controller.ts:requestRefund` checks buyer ownership then invokes the refund service directly. This is not organizer review/approval. `api/orders/service.ts:refundOrder` delegates to `PaymentService`, not bookkeeping-only repair.
- `api/payments/service.ts:refundOrder` accepts full PAID orders, unused/untransferred buyer-owned SOLD tickets, and pre-event timing (cancelled events have explicit code exceptions). It writes PROCESSING before provider verification. These observed restrictions/exceptions do not decide customer entitlement, fee treatment or commercial authority.
- `reconcileRefund` verifies the payment amount/currency and finds a provider refund by stored ID or matching local `metadata.refundId`; absent a match within 23 hours it attempts a full refund using the local idempotency key. The list is limited to 100 without pagination. A provider refund performed outside this local identity is not automatically adopted.
- `api/orders/service.ts:finalizeRefund` requires matching full SUCCEEDED ORDER_REFUND for monetary orders, then transitions SOLD inventory to RELEASED and order to REFUNDED. No partial platform finalization is implemented here.
- `api/payments/service.ts:processEvent` wakes the durable refund recovery scan on refund/charge.refunded events; it does not import external refund amount or identity from that payload. No dedicated dispute branch exists. A processed event is not evidence the business exception was resolved.
- `api/events/service.ts:cancelEvent` closes the event, invalidates eligible paid tickets, and cancels pending holds; paid inventory remains SOLD until refund success. It does not itself refund paid orders. Cancellation is **not pause-sales**.
- `services/ticket-admission.service.ts` rejects PROCESSING refunds. `api/scanners/service.ts` also maps PROCESSING to unavailable admission during sync. Failed refunds need explicit review: refundStatus FAILED is not the same admission freeze as PROCESSING; do not assume failed repayment means tickets remain blocked.

## Bounded owned exception handling

For every exception, retain an incident owner (PM to obtain the actual authorized financial/support owner in #250), environment, sanitized order/event/provider IDs, exact timestamps/timezone America/St_Johns, amount/currency and observed statuses, last attempted operation and outcome certainty, ticket/inventory snapshot, next review time and exit evidence. Do not fabricate staffing or an SLA. Never paste credentials or QR payloads. This guide authorizes no provider calls or external messages.

| Case | Source limitation / safe local disposition |
| --- | --- |
| External full refund, no local metadata | Existing refund is not matched; full create is attempted. Simulator provider rejects it; no local success/finalize. Keep mismatch visible; never call refund as bookkeeping or issue a second refund. |
| External partial refund | No partial entitlement/state mapping. Absent local metadata a full create is attempted; linked partial result conflicts409. No blind retry, inventory release or success claim. |
| Pending/failed/unknown result | Matching pending stays PROCESSING; failed becomes FAILED; unknown transport error can leave unresolved durable state. HTTP success/processing is not repayment. Preserve evidence and reconcile through separately approved process; no new refund identity/manual reset/retry loop. |
| Dispute/chargeback | No dedicated dispute reconciliation/automatic entitlement demonstrated. Financial owner must resolve; do not substitute full refund or assume automatic ticket/inventory treatment. |
| Used/transferred tickets | Candidate refund rejects USED, transferredAt, foreign owner, or non-SOLD inventory. Cancellation may invalidate transferred tickets without making them refund-eligible. Policy unresolved; no admission reset, user change or eligibility bypass. |
| Cancelled event | Paid tickets can be invalidated while funds/SOLD inventory remain. Keep repayment and admission evidence separate. No pause-sales shortcut or promised cancellation entitlement. |
| Late-paid/expired reservation | Candidate `handlePaymentSuccess` records LATE_PAYMENT then invokes refund reconciliation. **Conflict with approved #73, not accepted behavior.** Keep manual reconciliation/no automatic refund as policy; generic replay could execute the conflicting path. Requires separately scoped financial repair and exact-SHA lead+QA before acceptance. |

Commercial choices remain with #250: eligibility/window, used/transferred restrictions, cancellation/dispute duties, fee/partial treatment, authority and actual owner. Do not infer approval from comments saying “Beta policy.” Full W03 remains open.

## Setup-free reproduction

`tests/unit/payments.external-refund.test.ts` invokes real candidate `PaymentService.reconcileRefund` with mocked Stripe, Prisma, environment, logger and order finalizer. Six tests cover external full/partial unmatched identity, linked partial mismatch and matching pending/failed/success results. Provider errors are synthetic assumptions, not observed Stripe responses. Tests establish attempted call and no finalization on mismatch, not DB rollback, inventory/admission correctness, network behavior, concurrency, eligibility, production reconciliation or financial safety acceptance.

Use an explicit Jest configuration with node environment, ts-jest transform, `setupFilesAfterEnv: []`, and only that testMatch. Never use default setup (`tests/setup.ts`) for this reproduction. Run with `env -i PATH="$PATH" node .../jest.js --config /tmp/task240-jest-config.json --runInBand`. No services, DB/bootstrap, real environment config or provider transport are loaded.

Author verification: existing dependency directory from `worktrees/task-235/tixmoapi2/node_modules` linked untracked (no install/lock change). `/tmp/task240-jest-config.json` contents:

```json
{"rootDir":"/home/daniel/projects/projectTixmo/worktrees/task-240/tixmoapi2","testEnvironment":"node","transform":{"^.+\\.ts$":"ts-jest"},"setupFilesAfterEnv":[],"testMatch":["**/tests/unit/payments.external-refund.test.ts"]}
```

Exact executed command from task240 root:

```sh
env -i PATH="$PATH" node tixmoapi2/node_modules/jest/bin/jest.js --config /tmp/task240-jest-config.json --runInBand
```

Result exit0: 1 suite, 6/6 PASS (3.901s). Initial attempt with `/usr/bin/node` exit127 (binary absent); corrected to PATH node with same scrubbed environment. `git diff --check` exit0. No DB/runtime/build/full gate/live/provider check claimed. Author submits REVIEW, independent lead+QA required on exact resulting commit; full W03/commercial acceptance remains open.
