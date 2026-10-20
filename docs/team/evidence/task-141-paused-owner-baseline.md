# Task 141: signed paused-owner baseline

Test-only descendant of independently reviewed `c94eb9f9da3d032ed3b538e3e5faa842cad23143`.
Branch `tixmo/task-141-paused-owner-baseline`, isolated `worktrees/task-141`.
Existing Jest/Prisma/Stripe fixtures and bounded deferred gates suffice; no new dependencies.
Historical task137 files are unchanged. No production source/schema/policy changes.

## Schedules and actual observations

Real signed `PaymentService.handleWebhook` calls; no Prisma results mocked.
The first private begin wrapper waits only AFTER its real claim commits; the
finish wrapper waits BEFORE real finish, after the handler/fulfillment returns.
Observer snapshots confirm PAID/SUCCEEDED before the latter gate; gates are outside
transactions. B uses the identical signature/payload while A is paused.
Only the owned fixture timestamp is explicitly changed to year2000 for expiration;
this is not a product lease duration or fake ownership/takeover.

Fresh duplicate: B returns without any full durable snapshot change, no email.
Before-handler expired: B returns with target PENDING, event PROCESSING, 6/4/0,
zero email. Before-finish expired: B returns with target PAID/SUCCEEDED, event
PROCESSING, 6/2/2, one email. A is then released and actually completes; both
finish PROCESSED/PAID/SUCCEEDED, one email, four unchanged tickets, other buyer
unchanged, one event, inventory6/2/2. Full paused/beforeB/afterB/final snapshots
and phase traces are in `task-141-processing-snapshots.json`.

## Reproduction

The tracked `task-141-runtime.sh` is run from the task worktree. Its guard prefix
is byte-equivalent to PM-inspected review135 helper after ONLY owned mktemp path
and log-label normalization. Test tail has no source mutation. Fresh disk initdb,
exact UID/PID/executable/datadir/direct-child identity, loopback listener owner,
readiness, target safety, bounded cleanup and postcleanup listener checks remain.
The PostgreSQL username/database retain harmless helper labels; disk and ports
are newly owned, never inherited5433/5434/6380/6381. Dependency symlink reuses
existing task65 modules with the identical schema; build runs normal Prisma generate.

Commands in helper:

```sh
npm --prefix tixmoapi2 test -- --cacheDirectory "$PWD/.jest-cache141" --runInBand --runTestsByPath tests/integration/payment-paused-owner.baseline.test.ts
TIXMO_ASSERT_PAUSED_RECOVERY=1 npm --prefix tixmoapi2 test -- --cacheDirectory "$PWD/.jest-cache141" --runInBand --runTestsByPath tests/integration/payment-paused-owner.baseline.test.ts
npm --prefix tixmoapi2 run build
```

GREEN default intentionally records baseline skips; recovery mode disables those
expired equality observations and requires recovered fulfillment before-handler,
recovered terminal event before-finish. RED is deliberate durable-state mismatch,
not timeout. Baseline assertions are NOT future recovery acceptance. For a candidate,
replace default expired skip observations and add the full139 acceptance suite.

## Limits / next reviewer

This baseline has no successor generation or takeover, hence cannot prove stale
success/failure zero-row fencing. No fake B ownership, fabricated counts, mutation
kill or recovery success claimed. Future candidate must hold B STILL PROCESSING
AFTER real takeover, outside locks, then exercise stale A success and failure
separately and assert real affected-row count zero/full snapshots unchanged BEFORE
releasing B. After-terminal status checks cannot substitute. Failed recovery,
cutoff/generation/overflow/TOCTOU and mutation oracles remain future implementation
acceptance in139. This test-only work does not resolve68 or release NO-GO.
Independent exact-SHA QA required; author submits review, never closes141.

## Actual final checks and cleanup

Final helper exit0: GREEN suite1/1, tests3/3 passed (exit0); recovery RED
suite1 failed, tests2 failed/1 passed (exit1); API build exit0. RED failures
are expected PENDING vs PAID and PROCESSING vs PROCESSED, no barrier timeout.
Initial run also3 GREEN/2 RED/build0; final rerun follows the explicit separation
of expired baseline equality from recovery mode. Both runs cleanly stopped owned services.
Initial PG PID981234/port32624, Redis PID981247/port48828. Final PG
PID982055/port38183, Redis PID982068/port57306. Final ss output empty;
helper checks both exact PIDs stopped. No inherited service touched.
Runtime helper prefix normalized byte-equivalence assertion PASS; git diff --check PASS.

## QA142 boundedness repair (supersedes prior exact93d024e)

Formal REQUEST CHANGES correctly identified an unbounded finally drain. Retain
immediate Promise.allSettled rejection handling, release A, then bound its drain
at5s; nested finally restores spies even when drain rejects. Optional timeout
argument exists solely to exercise this exact helper without waiting5s.
Every test/build subprocess now uses GNU `timeout --signal=TERM --kill-after=5s 35s`.
Default timeout process groups receive TERM and then KILL; the owning shell
continues to its unchanged EXIT cleanup. Only exact GREEN0/RED1/build0 passes;
124/137 or any other timeout exit is not an expected recovery RED.
Runtime guard prefix preceding test tail verified byte-identical to93d024e.
Prior QA PIDs984866/984879 absent and ports34569/47659 empty before new runtime.

Meaningful isolated checks actually performed: extracted exact TypeScript bounded
function, transpiled with installed TypeScript and executed against unresolved
Promise with20ms deadline; rejected `Barrier timeout (harness failure)` within1s
(PASS). GNU timeout0.1s/KILL+0.1s against a TERM-ignoring bash loop exited137
(PASS); this status cannot satisfy helper's red=1 predicate. Probe used no DB.
These probes are harness checks, not product failure/mutation proof.

Actual repaired helper run exit0: GREEN suite1/tests3 passed, recovery RED
suite1/tests2 deliberately failed and1 fresh passed; API build0. Six fresh full
snapshots replace only task141 snapshot artifact. No barrier timeout.
New exact PG986462/port30879 and Redis986494/port43162 stopped; empty postcleanup
listeners. Historical137/source/schema unchanged. Exact repairedSHA requires
independent QA rereview; no author closure or recovery/fencing success claimed.
