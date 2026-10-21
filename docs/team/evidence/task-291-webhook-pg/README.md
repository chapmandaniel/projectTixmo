# Task291: real PostgreSQL webhook poison-backlog slice

2026-10-21 UTC. Author scoped PASS; independent QA required. Branch `tixmo/task-291-webhook-pg`, isolated task-291. Product baseline `4ec8594850eb547dafc145a14bb1b85cdeaa235c` unchanged. Exact tested harness commit `08f96af42cb88d094450293f48881c792ac0e2d5`; source-sha256.txt covers all API source, integration test, global setup, schema, lockfile, Jest config, guard and runner. Evidence-only follow-up commits do not alter tested source.

## Fresh execution

```
bash -n docs/team/evidence/task-291-webhook-pg/runtime.sh
bash docs/team/evidence/task-291-webhook-pg/runtime.sh > docs/team/evidence/task-291-webhook-pg/runtime.log 2>&1
sha256sum -c docs/team/evidence/task-291-webhook-pg/source-sha256.txt
git diff --check
```

All exit0. 31 real migrations applied. Jest 1 suite/3 tests PASS (5.998s; individual 282/26/19ms). Global setup additionally performs guarded disposable db push. No source/database/Prisma/query mocking. No app/HTTP bootstrap. Real `PaymentService.recoverPayments`, provider-retrieval boundary, `processEvent`, DB-time claim/CAS, completion, recovery selection, generation and stale effect fence run against new actual PostgreSQL18.

- Seed actual `payment_webhook_events`: 50 oldest FAILED poison rows generation7 and healthy row51, all older than cooldown. First retrieval stub rejects for all first50. Assert exact retrieval order; actual durable rows retain FAILED/status/generation/lease, null processedAt, updated timestamp and explicit backend-owned retry-after60s reason. Row51 not touched.
- Reconstruct `PaymentService` (same process, new instance); provider returns safe unsupported synthetic event only. Next real recovery skips all cooling poison rows and progresses healthy51 through actual claim/process/finish to PROCESSED generation1, null error, fresh timestamps. Immediate third recovery does not retrieve again. Duplicate direct `processEvent` cannot finish twice or mutate durable result. `finishWebhookEvent` spy is call-through, not a replacement.
- Real cooldown reeligibility is bounded without waiting: explicitly age just one poison updatedAt by61s in SQL, reconstruct service, assert only that row retried. Other49 stay excluded. This tests eligibility threshold by SQL fixture age, not elapsed60-second wall-clock passage.
- Two concurrent real claims from separate service instances admit exactly one generation1. Active lease rejects another claim. SQL-age processingStartedAt301s; takeover admits generation2. Stale generation1 completion cannot change the row; real transaction-scoped `withWebhookFence` rejects stale owner before calling effect callback. Generation2 completion persists PROCESSED with no stale error.
- Simulated provider retrieval race completes the selected row through competing actual claim/finish then throws. Recovery catch's actual SQL CAS cannot overwrite the newer generation/status/timestamps/error. Durable row remains PROCESSED generation1/error null.

`acceptance.log` contains actual SQL snapshots of every row after first50, healthy51/reeligible-one, generation takeover, retrieval CAS. Actual expected fields and timestamps are asserted, not merely logged.

## Safety and cleanup

Only local test/evidence files added; no product edits. PM granted soleDB owner after289 cleanup; lead290 noDB. Runner adapts inspected284 owned PID/listener/cleanup guards. Fresh restrictive0700 disk-backed `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-291/run.N1rHsr`; env-i scrubs credentials. Explicit disposable DB `tixmo_disposable_291`, loopback PostgreSQL18 port35172 PID2677268 and Redis/1 port51228 PID2677301. Exact executable/PID/listener checks run before TCP database access. Redis is readiness-only; Jest global Redis/logger/rate-limit mocks retained. Known existing task271 dependencies temporarily symlinked (removed); no install, inherited .env or credentials, remote target, provider calls, payment/refund/email actions, cloud/spend/config/push/merge/deploy.

Stripe constructor is a synthetic mock exposing only `events.retrieve`; no live SDK object exists. Notification module is a throwing boundary proxy. The synthetic event is deliberately unsupported so no financial handler, order fulfillment, refund or notification is invoked. OrderService itself is not mocked. Other recovery categories query empty actual tables. All provider responses/errors are test-owned synthetic data. Native Redis's availability does not prove application cache behavior.

Outer35s migration/100s test deadlines and bounded exact-owned-PID cleanup retained. Exit0 cleanup, independently checked PIDs/listeners absent, postmaster.pid/Redis socket absent; cleanup.txt. SoleDB released. Logs normalized trailing whitespace only. Commits use command-local author identity and hooks bypass because this checkout lacks configured author/Husky bootstrap; no repository config changed.

## Explicit limits

Proves real SQL backlog fairness/cooldown/claim/CAS/generation fencing and unsupported-event terminal deduplication only. Financial event handler is not exercised, and effect callback is deliberately never executed for stale claim. Does NOT prove financial fulfillment exactly-once, signed ingress, provider/payment/refund behavior, notification delivery, process crash/restart (new service instance only), elapsed real60s cooldown, full outage recovery, HTTP/browser, production/staging or full W04 launch acceptance. Full W04 remains NO-GO; independent QA must inspect/rerun exact harness and recorded scope before PM closure.
