# Task346 independent lead source-contract review

## Decision and provenance

**Bounded APPROVE** of the single PROCESSING interleaving qualification at exact candidate `3b87aa81d9e83933adbc92f298e7bf1a31754b76`, against product base `f8bac3e1f53e64533b65bf6a1c3c7f0aebe2cb3d`. Independent reviewer: tixmo-lead, 2026-10-21. Isolated branch `tixmo/task-346-independent-lead`, worktree `/home/daniel/projects/projectTixmo/worktrees/task-346`. Only this review document is added. No product repair is proposed or approved. Parent341 remains PARTIAL REVIEW; this is not full closure or launch approval.

Read tasks346/341/345 and required team instructions before review; claimed346 only. Read author341 test, harness, guard and handoff; independently read retained QA345 evidence commit `e7f8f1bb2e10a1c5e7cdb8e01815dc4718ad198d`. No database, service, application runtime, provider or external network execution in this review. Existing test/harness was adequate; no custom implementation needed.

## Source contract findings

- `tixmoapi2/src/api/events/service.ts:571-601`: event row lock, existence/deleted checks and CANCELLED update occur in their own awaited transaction (574-581). The transaction completes before scanning PENDING/PAID event orders. A later per-order failure cannot roll back that event commit. No catch/retry loop hides the stale-observation error.
- Each selected order has its own lock transaction for the PAID ticket branch (587-595), followed by an unlocked current-state read and public `cancelOrder` for PENDING (598-599). The test targets the subsequent actual public observation, not the earlier event scan or fabricated row. Event-level cancellation is not an all-orders atomic transaction.
- `tixmoapi2/src/api/orders/service.ts:435-455`: public findFirst produces the observed row before the order-lock transaction. The spy delegates to original Prisma, captures its real result, and pauses only its continuation. An independent committed transaction changes paymentStatus to PROCESSING, while status stays PENDING. The locked reread then rejects400 `Cannot cancel order that has changed` before inventory/promo changes. Gates select ordering; deadlines bound failure, not ordering.
- Explicit same-event reentry is eligible: event579 skips transition validation for alreadyCANCELLED, while still rejecting a missing/deleted event. It rescans eligible orders. A stable PENDING/PROCESSING order now agrees with its new public observation; `cancelOrderInTransaction` checks order status, not paymentStatus, so it cancels the pending order. This describes existing source behavior for this schedule, not newly authorized commercial policy.
- `orders/service.ts:459-476` and `services/order-inventory.service.ts:6-52`: order lock plus conditional PENDING transition and HELD-only ticket transition fence the release. Inventory counters and tickets mutate in the same order transaction. The completed CANCELLED order is effect-free if called directly; event reentry excludes CANCELLED orders from the next scan. Two HELD tickets release stock8/2/0 to10/0/0 once. No broad inverse-contention or all-schedule proof is implied.
- Foreign-buyer control is deliberately on a **different event**, with independent ticket type. Full order/tickets/event/stock equality checks constrain unrelated-event mutation. Cancellation targets are selected by eventId, not purchaser: another buyer's eligible order on the cancelled event is a legitimate target, not a nonmutation control. Only one same-event order exists here, so multiorder progress-before-error remains unqualified.
- No payment-provider/refund method is invoked on this service path. PAID handling visible in source invalidates applicable tickets without releasing SOLD accounting, but this case never exercises it. No provider-confirmed finalization change, automatic refund, automatic retry/recovery, or manual late-paid policy73 qualification is inferred. The second and third service invocations are explicit caller actions.

## Assertion sensitivity and exact scope

Read `tixmoapi2/tests/integration/event-cancel-reentry.race.test.ts` in full. CANCELLED-at-observation plus exact original order/stock constrain event-first commit. Exact400 rejection is sensitive to removing/bypassing the stale guard. Whole afterFailure snapshot equality with afterMutation constrains unintended effects during refusal. Recovered target comparison preserves every other order/ticket field and requires both tickets CANCELLED/RELEASED; full stock comparison requires10 available/0 held while retaining sold and other fields. Skipped/doubled inventory release would fail. Full foreign control equality covers all checkpoints, including replay through the whole replay comparison. These are inspected sensitivities, **not executed mutation tests or a RED run**.

Recovered order/ticket/stock updatedAt values are only type-checked as Dates, not exact timestamps; all other fields are retained. The recovered event assertion requires statusCANCELLED, not a full pre-recovery event comparison. Third-call equality is complete except **only target event.updatedAt is normalized to recovered.event.updatedAt**, because reentry still updates the event row. Thus replay proves order/ticket/stock no-op and unchanged other event fields, not an unchanged event timestamp. No event-wide exact timestamp/no-write claim is approved. Console error payload is a literal summary, but the actual rejected promise separately asserts exact message/statusCode.

Nonblocking documentation mismatch: events/routes.ts:392 still advertises400 for already-cancelled events, whereas service579 accepts reentry. The reviewed artifact correctly states the service contract; route authorization and HTTP behavior are not tested here. Preserve this discrepancy as a future documentation consideration, not proof that HTTP reentry was qualified.

## Checks actually performed here

- `git diff --exit-code f8bac3e1f53e64533b65bf6a1c3c7f0aebe2cb3d 3b87aa81d9e83933adbc92f298e7bf1a31754b76 -- tixmoapi2/src tixmoapi2/prisma`: exit0; product/schema unchanged.
- `bash -n docs/team/evidence/task-341/runtime.sh`: exit0; syntax only, harness not invoked.
- `node --check docs/team/evidence/task-341/network-guard.cjs`: exit0; syntax only.
- Independently parsed retained QA345 jest-result.json from e7f8f1bb: success true,1 passed suite,1 passed test,0 failed,0 pending. This is QA's fresh SQL run, not a new lead runtime pass.
- Independently parsed retained QA345 snapshots.json directly from e7f8f1bb: exact afterFailure==afterMutation; every separate-event foreign control equal at all five later checkpoints; replay==recovered after only event.updatedAt normalization; stock8/2/0 ->10/0/0 ->10/0/0. All assertions passed in the local artifact inspection.
- `git diff --check` for this review document: exit0 before commit. No source/test assertion weakened or changed.

QA345 records fresh SQL1suite/1PASS/0FAIL/0SKIP5.986s and cleanup release; this source-only review does not independently rerun services or attest current live cleanup. Author341's historical6.188s is not a new pass.

## Handoff limits

No blockers in this narrowly disclosed qualification. PAID/concurrent finalization, inverse lock contention, multiple same-event orders/progress-before-error, promo reservations, route/actor authorization, manual73 end-to-end, full API/build/market gate and provider/refund matrix remain unqualified. Do not close341 on this bounded result. No grant was consumed; no cloud, real secrets, spend, config/scheduler, outbound messaging, merge, push or deploy. Shared main and author's worktree were not modified. Review commit uses command-scoped synthetic Git identity and hooksPath=/dev/null for the documented missing Husky bootstrap; no persistent config or full precommit gate claim.
