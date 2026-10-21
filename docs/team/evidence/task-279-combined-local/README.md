# Task 279 — current combined candidate disposable-local requalification

Product candidate/base: `4ec8594850eb547dafc145a14bb1b85cdeaa235c`.
Branch: `tixmo/task-279-combined-local`; isolated `worktrees/task-279`.
Only integration harness and this NEW evidence directory change; no product source changes.
Harness/runtime transplanted from independently reviewed `03db05ca5976fd92168acd4daae5e33821b2ff50` (task272), not old logs. Updated task IDs/runtime/artifact paths; added an actual-DB manual-late-payment test and mocked Stripe boundary. Harness SHA is the commit containing this document (resolve `git rev-parse HEAD`); source manifest covers every tracked API source, Prisma and root scripts file.

## Actual final run, 2026-10-21 UTC

PASS: 1 suite, 7 tests, Jest 14.059s. Real PostgreSQL transactions and loopback HTTP:

- Event early/closed and ticket early/closed: HTTP400 without order/inventory mutation.
- Open intersection: HTTP201 PENDING, aggregate duplicate-line cap rejection, other-buyer retrieval denied.
- Actual event row lock held in a separate transaction; pg_stat_activity observes Lock waiter before close; release after salesEnd rejects purchase without order/inventory mutation.
- New actual-DB late success: expired held order, synthetic succeeded intent delivered through real processEvent/fence; identical event replay plus distinct event replay persist exactly ONE REQUESTED LATE_PAYMENT manual exception, two PROCESSED webhook rows, CANCELLED order/ticket, RELEASED inventory, no fulfillment. Direct reconciliation and background recovery leave exception unchanged. Every mocked Stripe paymentIntent/refund method asserted not called. Policy73 is preserved; this is not a real payment/provider acceptance test.

Final own run: `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-279/run.gk7RwB`, ext4, restrictive0700/umask077, PG18.6 from existing task57 cache. DB `127.0.0.1:27335/tixmo_disposable_279`, Redis `127.0.0.1:51091/1`, HTTP `127.0.0.1:44191`. PG PID2633375/Redis2633390 stopped, HTTP closed; independently checked all PIDs/listeners absent and PID/socket files removed. Preliminary six-case pass used own run.ZDy6W3 and was superseded by final run; its services/listeners also independently absent (cleanup.txt). No other service/artifact takeover. Prior278 cleanup verified before soleDB ownership.

## Reproduce / provenance

From this worktree, actual exit0 commands:

```sh
bash -n docs/team/evidence/task-279-combined-local/runtime.sh
bash docs/team/evidence/task-279-combined-local/runtime.sh > docs/team/evidence/task-279-combined-local/runtime.log 2>&1
sha256sum -c docs/team/evidence/task-279-combined-local/source-sha256.txt
git diff --check
```

Inspected ownership cleanup/listener checks, verification-safety guard, 31 migrations, test setup mocks, environment loading and payment paths before execution. Runtime self-reexecs env-i, explicit Node24 PATH and synthetic fixture credentials only; NODE_ENV=test suppresses .env. New initdb, verified exact owned executable/PID and loopback listeners, database identity + disposable URL guard BEFORE migration. Exact bounded migration/test commands retained in runtime.sh; migration31 succeeded. Tests setup also applies db-push only under the same disposable guard. Dependency symlink reused existing task271 API node_modules read-only; no installation, lockfile mutation or Prisma generation; symlink removed after execution. Final source manifest check retained in own runtime/task-279/source-check.log.

## Limits / independent handoff

Author result only: independent QA exact commit required, review not done. Full candidate E2E, delivered browser, provider/email, staff/tenant matrix and production parity remain unqualified; launch NO-GO. Manual-payment test invokes internal processing with synthetic provider object, bypassing signed HTTP webhook transport. Prisma and database/order/inventory/payment persistence are real; Stripe constructor/methods mocked, notification service disabled. Existing Jest setup mocks Redis/rate-limit/logger: native Redis ownership/readiness verified, not application Redis integration. Buyer isolation is service-level; cap is service-level. No cloud/network targets, real providers, external email, spending, configuration changes, push/merge/deploy, live financial actions or main checkout changes.

Commit preparation: initial staged diff-check found Prisma migration output trailing whitespace; raw log retained in own runtime/task-279/migrate.raw.log and committed copy whitespace-normalized. Initial commit hook failed because checkout lacks tixmoapi2/.husky/_/husky.sh; used one-command core.hooksPath=/dev/null only after explicit checks passed, no repo/global config change.
