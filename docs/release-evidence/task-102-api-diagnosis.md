# Task 102: focused diagnosis of gate98 failures

## Exact candidate and outcome

Executed candidate `0375516e058fd3a1bbc18e1db5f1f44751e96647` in isolated
`task-102`, branch `tixmo/task-102-api-diagnosis`. This commit adds evidence
only; no product, fixture, schema, config, lockfile or dependency changes.
Read gate98 evidence `5036967dcd3afa1db8192e6ad3ceea2dbad19db8` and retained
allowlisted `/tmp/tixmo98-result-repair.log`, then five suites/fixtures,
Jest setup, verifier/safety guard and reviewed task57 runtime lifecycle.
PM assigned sole disposable DB/services ownership; task68 did not run.

ONE focused execution: schema bootstrap exit0, Jest exit1, signal null.
**5 failed suites; 7 failed, 40 passed, 47 total tests**, elapsed18.944s
(from Jest startTime to final suite endTime). This reproduces all seven
failures from gate98, not its full426-test coverage.

Actual commands, run through external `/tmp/tixmo102-focused.cjs` using
spawnSync with captured/suppressed child output:

```text
node tixmoapi2/node_modules/prisma/build/index.js db push --accept-data-loss --skip-generate
node tixmoapi2/node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/unit/asset-library.service.test.ts tests/integration/tickets.test.ts tests/smoke/v1-market-smoke.test.ts tests/integration/payments.test.ts tests/integration/payments_retry.test.ts --json --outputFile=<owned-run>/jest-report.json
```

Both child commands used API cwd (paths above shown repository-relative).
Outer lifecycle: `timeout --signal=TERM --kill-after=25s 180s bash
/tmp/tixmo102-run.sh`; inner command timeout150s, TERM with20s kill grace.
The runner reused98 lifecycle, substituting unique102 names and focused
command only. Sanitized `env -i` supplied explicit existing Node24 PATH,
fresh HOME, scoped loader path, test NODE_ENV, owned disposable targets,
destructive opt-in, Redis DB1, synthetic JWT/session/Stripe values, CI1,
NO_COLOR1 and disabled AWS metadata. No inherited application URLs/live
keys/.env sourced. No installation or generated-client regeneration.
Existing task56 dependencies/client linked; extracted task57 packages reused.

## Allowlisted failures and rooted diagnosis

1. `assetLibraryService.upload creates revocable external share links for saved folders`
   (`unit/asset-library.service.test.ts:399`): expected active true, received
   false. Mock share expires2026-06-18; actual execution is October2026.
   `assets/service.ts:237` computes active from real current date. Fixed-date
   fixture drift, not evidence of broken expiry enforcement. Follow-up:
   freeze time or derive future fixture expiry, preserving expired coverage.
2. `Tickets API POST /api/v1/tickets/:id/transfer should fail to transfer cancelled ticket`
   (`integration/tickets.test.ts:301`): expected400, received200.
3. `Tickets API POST /api/v1/tickets/:id/cancel should cancel a ticket`
   (`integration/tickets.test.ts:358`): expected200, received400.
4. `Tickets API POST /api/v1/tickets/:id/cancel should fail to cancel already cancelled ticket`
   (`integration/tickets.test.ts:373`): expected already-cancelled substring;
   report instead contains the paid-order prerequisite message.
   Shared cause: beforeEach creates customer-owned PENDING order then ignores
   confirmation response using PROMOTER credentials. `orders/service.ts`
   actorOrderScope allows PROMOTER confirm action but scopes non-OWNER/ADMIN/
   MANAGER actors to their own userId. `confirmOrder` cannot find this other
   customer's order (static path yields404); no paid transition occurs.
   `tickets/service.ts:290` rejects cancellation of non-PAID orders; ignored
   cancel failure leaves VALID ticket transferable. The failed report directly
   confirms the paid-order guard message; confirmation404 was not separately
   instrumented/captured. This is a fixture/current authorization-contract
   mismatch, not proof of a transfer bypass for genuinely CANCELLED tickets.
   Whether PROMOTER should confirm customer orders requires an explicit
   authorization-contract decision/review; do not widen access to green tests.
   Follow-up first assert confirmation success with an approved scoped actor
   and assert cancellation preconditions before transfer/repeat cancellation.
5. `Payment Routes POST /payments/create-intent should create a payment intent for a valid order`
   (`integration/payments.test.ts:128`): expected200, received409.
6. `V1 market readiness smoke runs the operator, checkout, scanner, asset, approval, and analytics path`
   (`smoke/v1-market-smoke.test.ts:198`): create-intent409, intent/order mismatch.
   Both Stripe create mocks omit amount, currency, status; payments mock also
   fixes orderId rather than reflecting request and omits userId. Current
   `payments/service.ts:78` validates those returned fields against the order;
   undefined amount/currency deterministically fails before preparation.
   Mock contract drift is rooted; this is not real Stripe acceptance or proof
   of product correctness. Follow-up model complete request-derived mock
   responses and retrieve behavior without weakening payment validation.
7. `Order Confirmation Retry Logic should retry order confirmation on failure and alert admin after exhaustion`
   (`integration/payments_retry.test.ts:70`): unhandled synthetic DB Timeout.
   Test awaits success from deliberately always-rejecting confirmation spy.
   `payments/service.ts:291` now rethrows exhausted retry failure after alert
   to retain failed webhook/Stripe retry semantics. Test lacks rejects assertion
   and therefore never reaches retry-count/alert assertions. Contract drift;
   follow-up assert rejection then preserved six attempts/five warnings/alert.

No speculative repair was applied. Any payment/auth changes, including the
contract-aligned fixture follow-up, need separate exact-SHA lead and QA review
with this baseline reproduction retained. Do not change financial policy or
relax tenant scopes in this evidence cycle.

## Ownership, teardown and limitations

Fresh mode0700 runtime `/tmp/tixmo102.9XXaCE`; PostgreSQL PID751525 port29146,
Redis direct-child PID751545 port48131. Verified executable/PID ownership,
unique Redis socket INFO PID, exact PID-owned loopback listeners before TCP,
SQL actual disposable102 DB/user/address/port, Redis PONG and pure target
safety guard before schema mutation. Reviewed exact-instance EXIT teardown
returned cleanup_status0, no PG PID file; independent post-check `ps` found
neither owned PID and `ss` found neither port listener. Services stopped.

Private JSON and child output retained only in owned runtime; sanitized
inspection emitted allowlisted static test titles, numeric assertion values,
known error categories and source line numbers, never URLs/tokens/payloads or
raw child output. Raw report is not committed. Scripts/logs remain under /tmp.

Native PostgreSQL18.6/Redis8.0.5 differ from CI14/7; Redis is globally mocked.
No installs, envfiles, schema/product edits, real Stripe run, task68 race run,
full gate rerun, merge, deployment, production access or spend. Seven focused
failures remain RED; this evidence-only diagnosis is not launch approval.
`git diff --check` passed. Independent review required at this evidence SHA.
