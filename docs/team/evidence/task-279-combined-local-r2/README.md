# Task279 R2 — reason-specific recovery exclusion and financial-state preservation

Product candidate unchanged: `4ec8594850eb547dafc145a14bb1b85cdeaa235c`.
Parent harness: `f9f513a3b8245f674bc5e3214d8b6996dca24abb`; current harness SHA is this commit (git rev-parse HEAD). Same isolated task279 branch/worktree. Original task279 evidence files untouched.

## Actual fresh result

2026-10-21 UTC: PASS 1suite7tests, Jest14.05s. All six original realPGHTTP sale/cap/buyer/observed-lockwait cases passed unchanged. Seventh strengthened test uses realDB/realprocessEvent and real inventory transactions:

- After first late success, explicit baseline is CANCELLED/PROCESSING/refundStatus NONE/paymentClosedAt null, plus full ticket rows and inventory quantities.
- Identical-event and distinct-event replay each preserve every baseline field, ticket and inventory value.
- Durable REQUESTED LATE_PAYMENT row is aged120seconds, safely beyond60second recovery backoff. A realDB count proves generic REQUESTED/time eligibility1; adding reason-not-LATE_PAYMENT yields0. Recovery therefore cannot pass only because row is too new.
- Direct reconcile and background recover both preserve baseline financial/order/ticket/inventory state and entire aged manual-exception record (REQUESTED, no Stripe refund identity). All mocked Stripe intent/refund methods remain uncalled. One manual exception and two PROCESSED webhook rows remain; no fulfillment or financial finalization.

## Commands and cleanup

Actual exit0 from task279 worktree:

```sh
bash -n docs/team/evidence/task-279-combined-local-r2/runtime.sh
sha256sum -c docs/team/evidence/task-279-combined-local-r2/source-sha256.txt
bash docs/team/evidence/task-279-combined-local-r2/runtime.sh > docs/team/evidence/task-279-combined-local-r2/runtime.log 2>&1
git diff --check
```

Runner copied unchanged ownership guards, changing ONLY runtime/artifact paths to new R2 locations; env-i scrubbed Node24, NODE_ENV=test, explicit synthetic credentials, ownedPG18/Redis executable/PID/loopback listener validation BEFORE disposable targetguard/migrations. Prior QA282 PG2641638/Redis2641651 and38385/58251/33289 independently absent before soleDB transfer.

Fresh ext40700 root `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-279-r2/run.0pXqPV`; PG2645550 port26464, Redis2645563 port44732, HTTP46559. All stopped and independently absent, no listeners or PGpid/Redis socket; cleanup.txt. SoleDB lane released.31 migrations successful; logs all fresh. Manifest unchanged and verified current all API source/Prisma/root scripts. No product changes. Dependency symlink reused task271 cache and removed after run; no install/generation/lockfile changes. Raw migration log retained runtime/task-279-r2/migrate.raw.log, committed log whitespace-normalized only. Same checkout missing Husky helper, commit command uses core.hooksPath=/dev/null only after explicit checks, no configuration mutation.

## Limits

Author evidence only; independent281/282 rereview of exact new SHA required. Synthetic internal webhook processing bypasses HTTP signature/provider; Stripe mocked, notifications disabled. Prisma/transactions/order/inventory/refund/webhook persistence real. Existing Jest setup mocks Redis/rate-limit/logger; native Redis ownership/readiness only. No browser/fullE2E/provider/email/staging/parity/launch qualification. Policy73 unchanged; full launch NO-GO. No real provider calls, external targets, credentials loaded, spend, system configuration, merge/push/deploy or shared main modification.
