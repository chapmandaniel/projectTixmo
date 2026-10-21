# Task 272 — bounded disposable-local W01 acceptance

Base: `eee5fa0dc5d097b65fbd5c48881b9dd97f3e1d58`.
Branch: `tixmo/task-272-local-sale-acceptance`; isolated worktree `worktrees/task-272`.
Only integration harness and this evidence directory changed; no product implementation.

## Actual result (2026-10-21 UTC)

PASS: one suite, six tests; final Jest time 13.798s. Real PostgreSQL transactions and real loopback HTTP:

- Event early/closed and ticket early/closed reject HTTP 400 without order/inventory mutation.
- Open intersection creates HTTP 201 PENDING order; duplicate-line aggregate maxPerOrder rejects; another buyer cannot retrieve it.
- A separate transaction actually locks the event row. `pg_stat_activity` confirms a competing Lock waiter before close; holder releases after salesEnd. Purchase then rejects, with unchanged order count and inventory. No fake clock or mocked Prisma.

Final targets: PostgreSQL 127.0.0.1:37922 / tixmo_disposable_272; Redis 127.0.0.1:47801 /1; HTTP 127.0.0.1:38353. Database identity query, owned executable/PID/listener validation precede schema mutation. Fresh initdb and migrated synthetic database only.

Owned cluster/artifacts: `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-272/run.FHZlH7` (umask 077). No /tmp cluster. Existing task-231/235/236 services/artifacts were untouched. Final PG PID 2615250 and Redis PID 2615263 stopped; HTTP server closed. See cleanup.txt for absent PIDs, all three ports without listeners and no live runtime/application references. Retained disk evidence/clusters are stopped, not deleted.

## Reproduce/checks

Inspected the existing task-173 ownership-safe runtime and scripts/verification-safety.cjs before execution. Existing extracted PG18/Redis binary root under task-57 was reused read-only. Dependency directory is an uncommitted symlink to task-268's existing node_modules (no installs/lockfile changes). Initial Docker inventory failed once with socket permission denied; native extracted tools bypassed that limitation. An initial full-SHA lookup failed; `git rev-parse eee5fa0` and isolated HEAD resolved the exact base above, independently confirmed by PM.

From this worktree:

```sh
bash -n docs/team/evidence/task-272-local-sale/runtime.sh
bash docs/team/evidence/task-272-local-sale/runtime.sh
sha256sum -c docs/team/evidence/task-272-local-sale/source-sha256.txt
git diff --check
```

Runtime self-reexecs under env -i with explicit Node24/system PATH; NODE_ENV=test prevents .env loading. Explicit disposable URL guards run before migrations. Exact bounded migration/test commands are in runtime.sh; final output is migrate.log, acceptance.log, runtime.log. All exited 0. Final source hash check passed. Earlier successful runs were superseded by the final formatted harness run; total runtime comfortably below six minutes.

## Limits / handoff

Not a full W01 acceptance or launch GO. Existing Jest setup mocks Redis/rate-limit adapter and logger; notification service is disabled. Redis process ownership/readiness was verified, but application Redis integration was not exercised. No provider/email/Stripe operations, external requests, cloud, spend, deployment, main merge, migration of existing data or payment acceptance. Base intentionally excludes task-260 payment fix. Buyer isolation only, not a full staff/tenant authorization matrix. Pricing tiers and full browser flow remain outside this slice. No production-parity claim (local PG18). Harness needs independent QA of exact review commit; author must not close task.
