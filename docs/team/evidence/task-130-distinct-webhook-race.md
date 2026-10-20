# Task 130: distinct successful webhook IDs

Test-only slice from independently reviewed `3ea87153aa3a7a241100a72eab16569745d0ccff`.
Branch `tixmo/task-130-webhook-race`; isolated worktree `/home/daniel/projects/projectTixmo/worktrees/task-130`.
Reuses the existing Jest/Prisma lifecycle harness and plan `977848b`; no new dependencies or production-source edits.

## Actual contract observed

Four controlled schedules: each event wins once, with natural/reversed real payment-success order reads. AsyncLocalStorage binds gate indexes to webhook invocation identity, not asynchronous event-row/query completion. Both handlers capture actual PENDING order.findUnique snapshots before fulfillment; no Prisma results or transactions are fabricated. Stripe SDK constructs and verifies synthetic signed events locally; only email/admin delivery is mocked.

All schedules: target becomes PAID/SUCCEEDED with original intent and two unchanged tickets. Inventory is exactly available6/held2/sold2, nonnegative and conserving10. Full unrelated distinct-buyer order/ticket snapshot remains identical; total ticket cardinality remains4. One webhook resolves and its independent event row is PROCESSED. The competitor rejects400 after existing confirmation retries with `Cannot confirm order with status PAID`; its independent durable row is FAILED with that error and processing/completion timestamps. FAILED same-ID redelivery then observes already-PAID/same-intent, resolves, clears its error and reaches PROCESSED. Subsequent successful-event duplicate leaves both complete event rows unchanged. All full order, ticket and inventory snapshots remain unchanged across recovery and duplicate delivery; exactly one confirmation email is attempted.

This is supported retry behavior, not evidence that every racing success event must initially return success. No new terminal-state policy or product fix is prescribed. No claim of lease recovery/fencing, simultaneous FAILED reclaim, provider acceptance, HTTP-route status, full-market readiness or decision73 paid-after-expiry enforcement. Decision73 manual handling/no automatic financial refund is unchanged.

## Actual verification

PM assigned sole fresh disposable disk-backed PostgreSQL/Redis ownership. Inspected `/home/daniel/projects/projectTixmo/worktrees/review-129/.review129-runtime.sh`; task-local `.task130-runtime.sh` preserves its approved57-derived UID/PID/executable/datadir/direct-child checks, loopback listener ownership, readiness/target validation and bounded exact cleanup. Only worktree/cache/log identifiers and test list adapted. Dependency symlink inspected and reused. No inherited DATABASE_URL used.

Final command: `bash .task130-runtime.sh > .runtime130-final.log 2>&1`, exit0. It ran:

```
npm --prefix tixmoapi2 test -- --cacheDirectory /home/daniel/projects/projectTixmo/worktrees/task-130/.jest-cache --runInBand --runTestsByPath tests/integration/payment-distinct-success.race.test.ts tests/integration/order-confirm-expiry.race.test.ts tests/integration/order-confirm-cancel.race.test.ts tests/integration/order-double-confirm.race.test.ts tests/integration/order-double-cancel.race.test.ts tests/integration/order-double-refund.race.test.ts tests/orders-tenant.unit.test.ts tests/security/tenant_scope.test.ts
npm --prefix tixmoapi2 run build
```

8 suites /58 tests PASS (new matrix4/4), Jest18.159s; API build0. `git diff --check` clean.

Initial run:54 passed/4 failed because test assumed stale-CAS error rather than actual final PAID precheck error; no barrier timeout or inventory failure. Intermediate corrected run58/58+build0. Final hardening directly gates payment-success findUnique (instead of confirm findFirst), binds event invocation identity and forces both read orders; final exact-source run above passed. Final subsequent edit is comment-only.

Cleanup: initial PG919843/Redis919856 ports30977/40917, intermediate PG921210/Redis921223 ports27606/40905, final PG922608/Redis922621 ports26661/42330 all stopped via owned helper. Final independent `ps -p 919843,919856,921210,921223,922608,922621 -o pid,stat,args` contains header only; `ss -H -ltnp 'sport = :26661 or sport = :42330'` empty. Disk clusters, logs, cache, helper and dependency symlink remain untracked for inspection, no live services.

## Review handoff

Independent exact-SHA review required before PM closure; author submits review only. Inspect test-only diff and event semantics, then rerun in a separate checkout with explicitly reassigned sole fresh disposable runtime ownership and inspected helper adapted to reviewer-owned disk paths. Task68 and broader release readiness remain open.
