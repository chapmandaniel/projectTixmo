# PR75 operational decision packet - task 549

Prepared 2026-10-22 by tixmo-lead, documentation only. Candidate is **exactly
`a5da21936f4e0c730cab448610d9ecc75d2ef398`**. Budget: **0 new spend**.
No acceptance criteria are waived. This packet is not approval or deployment.
Original owner **231 / moosey** retains integration authority; the scheduled
PM cannot merge or change production, regardless of a proxy response.

## Concrete proposal for Blockerbuster

Owner231 should request a bounded decision on accepting the operational risk
of landing this migration-bearing candidate through the existing reviewed
integration sequence. Request must name target environment/service/database,
exact final integration SHA, auto-deploy behavior, migration window, backup
and rollback evidence, execution owner and second approver. Separate permission
to merge from permission for any resulting deployment/database migration.
If merge triggers deployment, it cannot be treated as a code-only decision.
Do not interpret a generic approval as production authorization.

Recommended disposition: **conditional approval only after all conditions below
are evidenced; otherwise hold the migration-bearing merge**. Proxy may approve
the concrete bounded scope, require evidence, or defer to Daniel. This packet
does not establish the proxy's authority or request approval itself. Do not
infer target facts, approve spend, or waive launch gates to resolve unknowns.

## Source facts and consequence

Inspected exact candidate files:

- `tixmoapi2/prisma/migrations/20261021120000_event_sales_pause/migration.sql`:
  adds `events.sales_paused BOOLEAN NOT NULL DEFAULT false`; creates
  `event_sales_controls` with actor/organization/request/reason/before/after/time,
  event FK `ON DELETE RESTRICT`, unique `(event_id,request_id)` and time index.
  No explicit row deletion, legacy rewrite or down migration is provided.
  Initial audit table is empty, not fabricated history. Additive does not mean
  lock-free or risk-free: ALTER TABLE needs a lock and can block/fail; deployment
  duration, contention, privileges, drift and target migration history are unknown.
- `tixmoapi2/railway.toml`: Dockerfile builder; startup is
  `/bin/sh -c 'npm run migrate && exec node dist/index.js'`, `/ready` healthcheck,
  `ON_FAILURE` restart policy. Dockerfile copies migrations and has the same
  migration-before-node CMD. `package.json` maps `migrate` to
  `prisma migrate deploy`.
- Thus a deployment/start using these definitions applies **all pending
  migrations**, not only this SQL, before serving the new API. Failure prevents
  the `&&` API launch. Failed DDL may need operator recovery; a restart is not
  proof of recovery. The source does **not** prove Railway currently watches
  main, auto-deploys, uses this config, or targets a particular database.
  If actual wiring auto-deploys a main merge, that merge can start a real
  migration without a separate operator command: authorization must precede it.
- New sales pause blocks new orders; existing held/paid/scanner/recovery policy
  remains as reviewed. Old code would not enforce a newly enabled pause, so a
  code rollback can change operational behavior even with additive schema.

## Evidence and provenance (not rerun in task549)

- Task520 source `6afac91e55d9c92f4b77eccae550b9eeecf9f593`, combined523/524
  `8b0b5d62fb1b9307d0ba7b5557636943c89915be`: independent lead and QA preparation
  receipts cover pause/auth/tenant/atomic audit/locking/UI and existing guarded
  populated-upgrade verifier. Exact successor a5da preserves product and verifier
  bytes; task520 records the separately reviewed race-test-only delta.
- Task528 attempt1 established actual populated-upgrade/build proof but overall
  failed on npm503; it was **not** full qualification.
- Independent544 immutable receipt commit
  `0bbfabe5d66748a808dc44601d425a80121f9caa`,
  `docs/TASK_544_INDEPENDENT_CI_RECEIPT.md`: PR75 exact a5da run
  [39712412966 attempt2, job119643506073](https://github.com/chapmandaniel/projectTixmo/actions/runs/39712412966/job/119643506073)
  terminal SUCCESS. Actual populated upgrade completed with retained legacy
  fields, salesPaused=false and audit count0 assertions; API build/verification,
  both audits0, 40 UI files/296 tests, guard924/no regressions, dashboard build,
  full market gates and PostgreSQL/Redis/network cleanup passed. No fabricated
  per-API or per-SQL assertion totals; this is disposable hosted CI, not target proof.
- Task548 supersedes544's old PR73 failure for the repaired PR73 head
  `0dfb0badcd1cd6afc01c8047abc99622941af3d7`: independent receipt
  `9845fe695181ed917f1960e0b40807a28efbe68d`, market39725844988/job119649419698
  and Tdash39725844799 both SUCCESS. Do not transfer this to an untested aggregate.
- Fresh read-only `gh pr view 75` during549: OPEN, DRAFT, exact a5da,
  base `tixmo/task-521-storefront-eligibility`, MERGEABLE/CLEAN; both checks
  completed SUCCESS (market job above; Tdash39712412978/job119606584431).
  It is a stacked PR, not presently based on main. GitHub mergeability and green
  checks do not authorize flattening/rebasing or prove final-main CI.

## Required safe conditions and rollback limits

1. Owner231 reconciles stacked73/74/75 sequence and exact final tree/SHA;
   required independent review and full checks must apply to any affected
   successor. No silent cherry-pick/rebase approval transfer.
2. Authorized operator records actual Railway project/environment/API/Postgres
   IDs, current/last-good deployment SHA/ID, redacted database target, actual
   branch/config/deploy wiring, pending migration inventory and schema state.
   No secret values belong in packet. Verify target can accept all pending DDL,
   with a controlled window and appropriate traffic/write freeze.
3. Follow `docs/DB_BACKUP_AND_MIGRATION_ROLLBACK.md`: scheduled backup/retention,
   fresh manual pre-migration backup ID/time, demonstrated non-production
   restore evidence, last-good compatible release, named rollback owner and
   second approver. These are **unknown here**, not satisfied by CI.
4. Agree migration execution once through the real deploy path, monitoring,
   health/auth/event/order/scanner smoke acceptance and stop/rollback criteria.
   No duplicate manual migration is proposed alongside startup migration.
   Any recovery requiring new paid resources needs separate spend authorization;
   this decision has zero new budget and cannot assume a paid recovery service.
5. Code rollback leaves migrated schema and audit records intact only after
   compatibility and pause-policy impact are verified. Do not drop the audit
   table/column or mark migrations unapplied as a rollback shortcut. RESTRICT
   audit FK changes hard-delete behavior. No tested production rollback is claimed.
   Before customer writes a verified restore may be considered; after writes,
   never overwrite blindly: separate recovery, compare paid orders/scans/changes,
   forward-fix or verified replay plan with second approval and launch-owner
   signoff per runbook. Backup restore is not automatic schema undo.

## Task549 checks and limits

Actual operations: board/source/immutable-receipt reads, read-only GitHub PR
metadata, new isolated branch `tixmo/task-549-operational-packet` worktree
`/home/daniel/projects/projectTixmo/worktrees/task-549` from exact a5da, this
single docs file, and `git diff --check`. No technical tests repeated. No DB,
services, runtime, installs, client generation, provider/target probes, secrets,
host configuration, scheduler, push, PR mutation, merge, deployment or spend.
Shared main and dependencies preserved. Target evidence collection and any
operational action remain outside this task; full248/launch acceptance remains open.
