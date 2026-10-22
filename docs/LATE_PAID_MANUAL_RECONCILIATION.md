# Late-paid manual reconciliation (policy #73)

A successful payment for a matching order that is expired, nonpending, or has
an ineligible event must not fulfill tickets or trigger an automatic refund.
The existing fenced webhook transaction preserves its cancellation/locking
behavior and upserts the durable `PaymentRefund` exception with reason
`LATE_PAYMENT`, payment/order identity, amount/currency and a manual-reconciliation
`errorMessage`. The table name and default `REQUESTED` status do **not** authorize
financial execution. This is an internal durable exception, not a new UI queue
or a claim that an operator alert has been delivered.

`recoverRefunds` excludes this reason for all statuses, including old
`REQUESTED`, `PROCESSING`, and `FAILED` rows. `reconcileRefund` independently
returns before provider access for this reason, including legacy linked or
`SUCCEEDED` records. Existing identities/statuses are retained as evidence, not
rewritten as a successful local financial outcome. Legacy records need not have
the new explanatory error string: their `LATE_PAYMENT` reason itself identifies
the manual exception. No schema migration or historical data mutation is needed.

An operator must reconcile actual processor state and obtain the applicable
financial authority; this change supplies no permission to refund, retry an
uncertain transaction, close an exception, or send live messages. It does not
undo refunds already executed before the repair. No new commercial entitlement
or automatic behavior is selected for `UNEXPECTED_PAYMENT`, `INCORRECT_AMOUNT`
or ordinary `ORDER_REFUND` records.

## Isolated mocked regression

From this worktree root, using existing installed API dependencies:

```sh
env -i PATH="$PATH" node tixmoapi2/node_modules/jest/bin/jest.js --config tixmoapi2/jest.manual-late-paid.config.js --runInBand
```

The dedicated config excludes global setup, DB bootstrap and dotenv; all service
transports/configuration/persistence dependencies are mocked. No services are
started and no provider/DB/network targets are supplied. The tests call the real
success handler with a mocked transaction/fence and repeat same/new event IDs;
they do not prove real event claiming/deduplication or SQL/lease concurrency.
They exercise background recovery and defensive ingress for legacy states, and
retain ordinary refund creation/finalization checks. Synthetic CAD is a test
assumption, not an event/settlement currency decision.

Before source repair: 8 failed / 3 passed, including forbidden provider access
and missing recovery exclusion. After repair: 11 passed. Independent exact-SHA
lead and QA review remain required; real persistence/inventory, Stripe/provider,
release and commercial acceptance remain open. Tasks #250/#73/#61 and release
NO-GO are unchanged. No deployment, merge, live financial action or new spend.

## Current-main composition (#511)

Ported `acc801da` (original policy73 approval260/261/262), `56080a0f`
(original refund-only267/269/270), and `4ec85948` (webhook271/273/274) onto
`013023cb`. Current-main uses a local `queueRefund` closure and `receipt` result,
not the older `recordRefund`/`confirmed` implementation. The closure persists the
same manual message and omits `refundId` only for LATE_PAYMENT. Durable attempt
binding, `orderTransaction`/`withWebhookFence`, event locks and sanitized signature
errors remain unchanged. Refund and webhook cooldown/CAS changes are equivalent.

Current-main has no `reconcileSuccess` or synthetic `reconcile-*` webhook ingress;
that old retrieval branch was intentionally not imported. The corresponding old
mock case is omitted, not reported passing. Existing provider-event 51-row and
stale-generation cases remain. Main's direct reconcileIntent implementation and
its financial behavior are not rewritten by this bounded port. Manual test
fixtures add main's explicit event read and refund update mock; assertions remain.
Setup-free recovery config runs 16 mocked tests (11 manual +5 fairness), not17.
No real SQL/lease/process-restart/provider proof is claimed; metadata persistence
failure may still abort a batch, and no hung-provider deadline is added.
