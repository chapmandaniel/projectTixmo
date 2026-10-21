# Task303 independent QA — scoped L1 PASS

Reviewed evidence HEAD `31fa03714a2e3f822d764337cc52314f69e7172e`, tested harness/runtime `3edffb3738a8dfe46e8a9a691c15ce68515c85db`, product `4ec8594850eb547dafc145a14bb1b85cdeaa235c` (src diff empty).
Reviewer branch `tixmo/task-303-independent-qa`, isolated worktree task-303.
No author artifacts overwritten; runner adaptation changes only task identity/paths, not tests/product. Shared task235 API dependency cache has identical package-lock bytes; temporary node_modules link removed after run.

## Fresh execution

Command: `bash docs/team/evidence/task-303/runtime.sh > docs/team/evidence/task-303/runtime.log 2>&1` exit0.
Runner executes scrubbed env-i, source sha256 verification, new0700 disk runtime/task303 PostgreSQL18 and RedisDB1, exact executable/PID/listener checks before probes, disposable verification-target guard, 31 migrations, and:

`timeout --signal=TERM --kill-after=5s 100s npm --prefix tixmoapi2 test -- --cacheDirectory "$owned_run/jest-cache" --runInBand --runTestsByPath tests/integration/orders-sale-windows.local.test.ts`

Fresh result **67/67 PASS,15.903s**. 64 matrix records:32 service +32 mounted Express HTTP,20 admits/44 rejects. Exact event-limiting and narrower-ticket T−1ms/T/T+1ms, opening inclusive/closing exclusive, null/one-sided/empty/inverted/disjoint/touching intersections and lifecycle closures pass. Each rejected matrix operation checks global order/ticket counts and target available/held/sold totals unchanged. These are the specified complete count/inventory snapshot, not a comparison of every column of every preexisting row. Each admitted operation checks one new PENDING buyer/event order and one HELD target ticket, available−1/held+1/sold unchanged. SQL round-trip compares exact Date instants (millisecond JS resolution), not PostgreSQL NOW or submillisecond precision.

Aggregate duplicated-line cap and buyer isolation pass with same count/inventory snapshots. Existing durable manual late-payment replay passes with inert provider methods asserted uncalled.

## Inspection and clock limitations

Date-only replacement controls zero-argument constructors, Date() and Date.now; explicit argument parsing stays native via Reflect.construct. try/finally restores global Date on success/failure. Native setTimeout identity asserted; no fake timer API present, PG transactions/locks and HTTP unmocked. Event/ticket checks use shared sampled now after actual event row lock. JWT verification and middleware share controlled Date; fixture token issued using native Date and remains valid in tested short range. Native clock restored before real-elapsed test.

Observed real-PG lock-wait test body is byte-identical to task279R2 `4c856134`, confirmed by extraction/comparison; fresh pass1726ms observes pg_stat_activity Lock wait then native elapsed close, no duplicate/rebuilt lock test. Controlled equality matrix is distinct from this real-elapsed proof.

Inspected setup, environment, app, orders, JWT/auth/current SQL session lookup, waiting-room and runtime guards. NODE_ENV=test avoids dotenv; synthetic fixtures only. Existing global setup mocks Redis, rate-limit-redis and logger. Waiting-room eval is absent from mock and falls through existing fail-open catch; real Redis readiness/load behavior is not established. Stripe and notifications inert mocks. This does not waive those limitations.

## Cleanup and scope

Independent post-run /proc and ss inspection confirms PG2755823 Redis2755838 API2755939 absent, ports32193/58494/35655 absent, PostgreSQL postmaster and Redis socket absent, runtime0700; see cleanup-verification.txt. DB ownership released. Dependency link removed. Source/doc diff-check passed (raw upstream logs excluded).

Scoped L1 independent QA PASS; original302 and review303 remain review for PM reconciliation, not self-closed. No browser L2 clock skew/Studio inventory, full238, provider/inbox/payment, staging, deploy or release acceptance. Full launch NO-GO. No external targets, secret loading, provider/email calls, spending, configuration changes, merges or deployments.
