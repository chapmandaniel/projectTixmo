# Task 409: optional prior-schema archive source checkpoint

Base: `aa422d361d13fe4715aec56e2886185200cde8e5`.
Branch: `tixmo/task-409-prior-dump`, isolated `worktrees/task-409`.

## Contract

Existing `scripts/verify-payment-upgrade.cjs` defaults are unchanged. Explicit
`TIXMO_UPGRADE_PRIOR_DUMP=1` requires `TIXMO_UPGRADE_EVIDENCE_DIR` using the
existing owned, realpath/no-symlink, mode-0700 evidence-parent guard. Any other
explicit dump value fails before migrations. No standalone destination option:
archive is exclusively created as `prior-schema.dump` in the fresh evidence
child, with mode 0600 during writing and 0400 afterward. Existing files/symlink
leaves are rejected, never overwritten. The existing disposable loopback target
guard runs first and is rechecked before tools. No new source-reset operation.

Order: prefix deploy, fixture, before snapshot/ledger persistence, server version,
pg_dump version, custom-format dump, receipt, then remaining migration deploy.
Failure blocks remaining migration deploy; existing finalization retains partial
evidence and seals its directory. No restore or old-code implementation.

`pg_dump` is resolved from the caller-approved PATH, with a minimal child env;
connection settings use PG variables, not URI/credentials in arguments. Tool
stdout/stderr/errors are not emitted. Version is parsed to a numeric string.
Dump uses `--format=custom --no-password`, 10-second connection timeout and
60-second process timeout. Archive magic/size/hash and tool/server versions,
start/end, exit status, success and `before.json` SHA linkage are retained in
`prior-dump.json`. `before.json` contains the prefix ledger; provenance contains
source/fixture SHA. The result artifact hash map links the receipt, whose hash
links the archive. Existing pre-seal `result.json` is not a terminal verdict.

## Actual checks (source-only)

- `node --test scripts/prior-schema-dump.test.cjs`: 4 passed, 0 failed.
- `node --check scripts/verify-payment-upgrade.cjs`: exit 0.
- `node --check scripts/prior-schema-dump.cjs`: exit 0.
- `git diff --check`: exit 0.

Tests use actual harness code in a VM with mocked Prisma and process spawning;
no real Prisma CLI, pg_dump, DB, service, network or app Jest bootstrap. They prove
snapshot/dump/upgrade ordering, tool failure blocks upgrade, failed receipt,
rejected targets/malformed options cause zero tools/migrations, default no dump,
symlink/existing-file/unsafe-directory rejection, credential-free arguments and
no sensitive error output. Synthetic archive bytes are NOT a usable dump.
Initial test attempts exposed mock env wiring and sealed mock-directory cleanup;
fixed the test harness, then reran all four successfully.

## Limitations / handoff

No actual backup, restore, version parity, rollback, RTO/RPO or full #245
acceptance. No executable binary provenance check; authorized PATH is required.
Archive header/hash alone does not establish restoreability. Tool-version or
pre-open failure can precede receipt creation; `result.json` phase/failure and
outer exit remain required. No query snapshot isolation guarantee beyond the
existing sole-owner disposable fixture scenario. Raw archive intentionally
contains synthetic fixture data; it is not scrubbed JSON. Live execution needs
fresh explicit sole-DB authority, disk-backed evidence directory and approved
tooling. No downloads/install/config/provider/cloud/spend/merge/deploy.
Independent lead and QA exact-commit review required; author cannot approve.
