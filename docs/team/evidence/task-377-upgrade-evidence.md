# Task 377 source-only evidence persistence and inventory assertions

2026-10-21; tixmo-release. Base `f8a407cd789ecdebf11927debc3e3b26c4ea5267`.
Branch `tixmo/task-377-upgrade-evidence`; isolated worktree
`/home/daniel/projects/projectTixmo/worktrees/task-377`.

## Source deliverable

Existing `scripts/verify-payment-upgrade.cjs` and synthetic fixture reused;
no dependency, framework, released migration or target-guard change.
Explicit sorted expectations cover all eight tickets' inventory state/tier,
all five original ticket-type total/available counters (100/90 unchanged),
all six tiers' limits/sold/held, including unchanged ambiguous, unmatched,
inconsistent sold5 and cancelled sold1 counters. Original before/after equality
now also conserves original type/tier counters.

Optional `TIXMO_UPGRADE_EVIDENCE_DIR` selects an existing user-owned 0700 parent
with no symlink path traversal. A unique 0700 child retains before/after selected
snapshots with ordered ledgers, migration source checksums and provenance
(commit, harness/fixture hashes, timestamps). JSON bigint uses a `$bigint`
string wrapper; Dates become ISO strings without precision loss for bigint.
Persistence omits password/email/barcode/QR/provider intent/error/token/key
fields. No environment, connection string, raw error, argv or URL is persisted.
Raw selected-field equality remains in memory for conservation assertions.
The source fixture is inert synthetic only; these are NOT whole-database dumps.

Files use exclusive create, 0600 during write, fsync, then 0400; finalized run
directory is 0500. No file is reused or overwritten, and no evidence is deleted
by staging cleanup. Partial files are retained read-only on write failure.
Result records phase/pass/fail and SHA256 of completed artifacts, not raw errors;
the original runtime error is still printed by the existing catch. Cleanup and
evidence-finalization failures mark failure, not a success. Read-only modes are
application-level immutability, not WORM protection from the owning user.
Earlier artifacts survive failed assertions or later migration/runtime errors;
no after snapshot is claimed if migration/query fails before it can be captured.

Default unset mode retains in-memory behavior; existing target guard still runs
before evidence initialization and Prisma construction. Disk backing, sufficient
space, environment scrubbing, service ownership and network isolation remain
separate future operator checks, not inferred from filesystem permissions.
No runtime invocation is authorized by this source change or variable.

## Actual checks and limits

- `node --check scripts/verify-payment-upgrade.cjs`: exit0.
- `git diff --check`: exit0.
- Static Python source check: eight unique expected ticket IDs equal fixture
  ticket IDs; five type labels/six tier expectations; target guard ordering and
  exclusive-create/modes/finalization/source-checksum presence: exit0.

No harness, helper behavior, DB, SQL parser/execution, services, API build/tests,
PG17/Redis8.2.10 parity, dump/new-DB restore, old-code compatibility or rollback
executed. No install/network/provider/envsecret/config/spend/push/merge/deploy.
Independent lead plus QA must review the exact new SHA; author cannot close377.
Parent245/W08 remains OPEN/NO-GO. Fresh separate PM sole-owner runtime grant
and reviewed restrictive-disk/scrubbed-loopback/service/network plan are required.
Commit uses command-scoped synthetic identity and hooksPath=/dev/null because
prior task established missing identity/husky; no persistent config changed.
Hook checks NOT RUN. Shared main preserved.
