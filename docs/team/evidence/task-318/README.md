# Task 318 — full disposable-local API gate (candidate 4ec85948)

Candidate: `4ec8594850eb547dafc145a14bb1b85cdeaa235c`. Isolated branch `tixmo/task-318-full-api`, task-318 worktree. This task adds evidence/harness only, not product/tests/assertion edits. Complementary full frontend evidence is task315; this is not a combined full-market, provider, staging or release approval.

## Safe environment and exact entry point

`bash docs/team/evidence/task-318/runtime.sh > docs/team/evidence/task-318/runtime.log 2>&1`

The script first re-execs with `env -i`, fixed Node24 PATH, no implicit .env or inherited provider secrets; uses disk-backed0700 owned task318 runtime, PG18 loopback disposable database and Redis DB1. Verifies exact process identity/listener before DB access. Sole DB ownership followed task316's recorded cleanup. Synthetic JWT/session/Stripe fixtures only. Existing PG18/Redis executables reused, no downloads/global install/config/cloud/spend/deploy/merge action.

Candidate `verifyApi` is invoked through its exported dependency-injection interface: same build/migrate/db-push/full-default-Jest sequence, with stdout/stderr redirected to task files and Jest JSON reporting arguments added. commands.jsonl records actual child commands/exit status. No test filtering, assertion or baseline change. Test setup independently enforces explicit disposable targets and applies schema before each suite. Migration rehearsal applies checked-in migrations; db push may destructively reconcile only this fresh owned database.

338M node_modules copied with `cp -a` from task235 (matching package-lock),177G initially free; copy has distinct inodes/nlink1 for sampled generated files, not writable hardlinks/shared symlinks. Build generates Prisma5.22 client in task318's owned dependency tree. Compiler/client versions, source schema and generated hashes recorded in generated-client-provenance.json/provenance.sha256. Generated schema is whitespace-normalized equivalent to candidate source.

Pre-import NODE_OPTIONS guard blocks nonloopback Node net/TLS/HTTP/fetch before connection; exceptions and attempted hostname/PID are retained. It is a task-only Node guard, not OS/network-namespace isolation or proof about arbitrary native executables. Inspected native PG/Prisma operations target explicit owned loopback services; child test CLIs inherit scrubbed env/guard. Remote calls count as guarded-gate failures even if a library catches the thrown error. No real Stripe/email/provider operation is authorized or used.

## Attempt1 and one bounded harness repair

Attempt1 build/migrate/dbpush all exited0; full Jest did not finish before240s gate deadline (exit124). No complete Jest counts/result exist for that attempt. Parent verifier buffered child output, so incomplete Jest stdout/stderr was lost on timeout; this limitation is preserved, not a test pass. Guard logs retain blocked checkpoint.prisma.io telemetry attempts. No remote connection occurred. Exact owned PG/Redis/Jest PIDs and ports were absent after cleanup.

One bounded harness repair: set Prisma-supported `CHECKPOINT_DISABLE=1`, stream child output directly to file descriptors, extend the bounded whole gate to360s, and fail if any blocked-network record exists. Fresh disposable runtime, same candidate/product/tests. Attempt1 logs retained under attempt-1; no further retry authorized/performed.

## Final result

**FAIL**, attempt2 exit1. Full default Jest completed in230.895s (not interrupted): **15 failed /79 passed /10 skipped suites** of104; **40 failed /655 passed /26 skipped tests** of721. Build, migrate and db-push each exit0; full Jest exit1. No runtime-error suites (0), Jest-reported openHandles `[]`, no unhandled-rejection/open-handle warning observed in retained stderr. This is not a claim of detectOpenHandles instrumentation.

10 suites/26 cases remain skipped by existing `TIXMO_EXPERIMENTAL_RECOVERY` conditions; this task did not change activation flags or assertions. One current nonloopback attempt to `s3.us-east-1.amazonaws.com` was blocked before connection. The library caught it, so a passing suite is not clean-provider-isolation evidence; guarded-gate verdict is independently FAIL. Checkpoint telemetry is absent in repaired run. No current Stripe/email remote attempt observed.

| Failed suite | Failed tests |
| --- | ---: |
| `tests/integration/payment-inventory-integrity.test.ts` | 5 |
| `tests/smoke/v1-market-smoke.test.ts` | 1 |
| `tests/integration/payment-failed-retry.race.test.ts` | 2 |
| `tests/integration/order-double-refund.race.test.ts` | 6 |
| `tests/integration/payment-distinct-success.race.test.ts` | 4 |
| `tests/unit/release-integration.test.ts` | 1 |
| `tests/integration/payment-paused-owner.baseline.test.ts` | 3 |
| `tests/integration/order-double-cancel.race.test.ts` | 4 |
| `tests/integration/order-confirm-expiry.race.test.ts` | 4 |
| `tests/integration/payment-old-processing.baseline.test.ts` | 1 |
| `tests/integration/payment-fenced-checkpoint.test.ts` | 1 |
| `tests/integration/order-confirm-cancel.race.test.ts` | 4 |
| `tests/integration/order-double-confirm.race.test.ts` | 2 |
| `tests/benchmark/event_cache.benchmark.test.ts` | 1 |
| `tests/unit/api/events-public.service.test.ts` | 1 |

### Deduplicated repair findings for PM/original authors

- Payment/inventory/refund recovery contracts: five integrity failures plus late-success reconciliation mock contract; expected rejection/refund/finalization/closed-at did not occur. Keep product-versus-stale-fixture diagnosis separate; full logs retain exact expected/actual values.
- Payment webhook/race/baseline fixtures: several synthetic intents reach `paymentRefund.upsert` with missing `amount` and undefined currency under incorrect-amount handling. This is concrete fixture/contract investigation evidence, not proof of a live-provider failure.
- Order concurrency/refund test contracts: actual cancel/confirm guards reject stale fixture orders; double-refund barriers time out and unused/untransferred-ticket precondition rejects fixtures. Restore representative accepted fixtures/barriers without weakening safety assertions.
- Public event mocks: benchmark lacks `ticketTypes`; public-detail mock lacks `_count.tiers`, causing service `.map`/`.tiers` TypeErrors. Backend/public-event test owners should reconcile mocks with current query shape.
- V1 smoke reaches analytics with `sales.totalOrders=0` expected>=1; investigate fixture/time-scope contract (do not waive assertion).
- Provider-isolation gap: one unmocked S3 attempt is swallowed by library code. Identify original test/import path and replace only inert transport in local harness; task318 guard prevented all connection. Guard currently records PID/host but not originating stack, so do not attribute to a particular suite without evidence.

No second product/harness repair or retry. Raw Jest JSON, compact per-suite summary including all40 failure messages, exact command/status JSONL and full current stderr are retained.

### Cleanup and handoff

`cleanup.json`: both attempts' four service PIDs absent; four PG/Redis ports closed; both postmaster pidfiles absent; no retained PG/Redis socket files; no task318 Node/Jest/API worker remains. No API server/browser was launched. DB ownership released. Disk runtime roots remain private for diagnostics; no live services remain. Product/test/script diff against candidate empty. Review this evidence commit independently; task318 is **review**, never a release GO.

