# Task330: independent SQL QA of task322

**PASS for scoped payment-test repair** at exact `1b1a7abea4341510db031063c1a61c8ce75e167f`, independently inspected and freshly run by `tixmo-qa` on 2026-10-21. No acceptance-blocking findings within assigned scope. This is not full API readiness or production/provider acceptance. Submit review, not done; PM also requires separate source review329.

## Source and isolation

- Complete implementation diff against `4ec8594850eb547dafc145a14bb1b85cdeaa235c`: exactly seven assigned test files and16 task322 evidence files; no product/schema/default test-config/lock changes or task321 composition.
- QA branch `tixmo/task-330-independent-qa`; `/home/daniel/projects/projectTixmo/worktrees/task-330`, created from exact implementation. Only task330 evidence added; original source and author evidence preserved byte-for-byte.
- Dependencies privately copied: `cp -a /home/daniel/projects/projectTixmo/worktrees/task-322/tixmoapi2/node_modules tixmoapi2/node_modules`. No hardlinks, install/generate or shared generated writes. Generated client index QA inode942754/nlink1; author829989/nlink1. Lock/schema/engine hashes match author provenance (fresh provenance.sha256).
- Before starting, independently checked all three prior322 attempts from cleanup.json: all six recorded PIDs absent, all six ports listener-free, no runtime sockets/postmaster pidfiles. Raw current observations retained in prior-cleanup-check.json. Prior failed attempts remain preserved, not counted as passes.

## Invariant assessment

Full seven-test source diff read; unchanged relevant surrounding assertions and payment implementation inspected. Fixtures now supply explicit succeeded status, target-derived amount/amount_received, currency and order/user identity, and public-sale event status. This corrects unrealistic positive fixtures without inventing production defaults.

Failure injection targets the actual transactional confirmation seam. Abandoned lease/replay checks still require only target consumption and foreign hold preservation. Distinct/failed/paused/old-owner suites retain real SQL gates, generation/lease ownership checks, stale finish immunity, exact foreign-buyer snapshots, ticket counts, nonnegative/conserved counters, final [6,2,2], duplicate ledger identity and exactly-one receipt. Updated target ticket comparisons require SOLD lifecycle with Date updatedAt while retaining all other scalar/identity/barcode fields; pre-fulfillment snapshots remain unchanged.

Late-paid cases require LATE_PAYMENT/REQUESTED manual marker, null provider refund ID, no automatic provider refund/fulfillment/financial closure and preserved newer hold. These match unchanged policy73 source, not removed protection. Wrong processor binding now checks exact UNEXPECTED_PAYMENT request amount/currency and no order mutation/receipt with inert reconcileRefund spy, matching source behavior. Generation/fence tests remain meaningful after that case.

Refund recovery verifies immediate recovery leaves SOLD inventory unchanged, then a60001ms-backdated fixture becomes eligible for repeated/concurrent recovery with exactly-once inventory release/finalization. No product cooldown changed or time sleeps introduced. New malformed-success case retains amount but omits amount_received and requires409 before transaction/refund/confirmation.

## Runtime safety and exact execution

Inspected author runtime.sh, network-guard.cjs, ordinary Jest setup/config and scripts/verification-safety.cjs before execution. Copied runtime/guard with only task322→task330 identifiers, artifact/runtime paths and disposable role/database renamed. Author evidence paths never written.

Runtime uses env-i before imports, synthetic test keys only, pre-application Node nonloopback denial, CHECKPOINT_DISABLE=1 and no provider calls. PG18/Redis binaries are read from existing task57 runtime tree; services run only in new0700 `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task330/run.T1UwIA` on `/dev/nvme0n1p2 ext4`, not /tmp. Exact user/executable/PID/path and exclusive127.0.0.1 listener ownership are verified before DB access. Default guarded schema bootstrap applies only to owned disposable DB; no migrated external database. Redis uses disposable DB1.

Exact command, from QA worktree root:

```bash
bash docs/team/evidence/task-330/runtime.sh > docs/team/evidence/task-330/runtime.log 2>&1
```

Runner contains full timeout180s/runInBand explicit seven-suite Jest command. Exit **0**; start `2026-10-21T08:24:21.437Z`; Jest duration28.096s. **7 suites passed,42 tests passed,0 failed/pending/todo,0 snapshots**. Breakdown: integrity17, failed-retry2, paused-owner3, distinct-success4, release-integration13, old-processing2, fenced-checkpoint1. Fresh raw Jest JSON/log and summary retained. No blocked-network.jsonl exists: zero observed nonloopback attempts. Guard is Node-level, not OS isolation; provider boundaries are inert fakes/spies.

## Cleanup and DB release

EXIT cleanup completed; independently verified after process exit:

- PG2893092 and Redis2893105 absent, ports39739/57457 no listeners.
- No PG/Redis runtime sockets or postmaster pidfile; no task330 Node/Jest workers (checked executable/cmdline/cwd through /proc).
- Runtime parent/run modes0700, disk-backed ext4. Datadir/logs retained privately for reproducibility, no running service.

Raw observations: cleanup.json. DB ownership330 released to PM only after these checks. Prior322 observations retained separately.

`git diff --check 4ec85948 1b1a7ab`, `git diff --check` and `git diff --exit-code 1b1a7ab -- tixmoapi2 docs/team/evidence/task-322` all exit0. Final tracked status clean after evidence commit.

## Explicit limitations

No full API/build gate, live Stripe/provider/inbox test, staging/production/deployment, spend or merge. Source is unchanged; source review329 remains separate acceptance. Malformed success missing both amount and amount_received can pass the initial undefined===undefined check in unchanged source; this test only proves missing received amount when amount is present, and does not close that source robustness gap.60001ms backdating proves eligible versus fresh behavior, not precise59999/60000ms boundary selection. No broader smoke/storage/order-refund/cancel or launch-readiness claim. Hooks bypassed only for evidence commit because isolated checkout lacks Husky helper, matching existing workflow limitation.
