# Task410 independent source QA: PASS scoped409

Reviewer tixmo-qa, 2026-10-21. Exact reviewed implementation
`bb158828a3faaa7b2df7c3a4106fbb18551082d6`; supplied/base parent
`aa422d361d13fe4715aec56e2886185200cde8e5`. Isolated task-410 worktree,
branch `tixmo/task-410-independent-qa`; original task409 not claimed.
No implementation edits. Shared main preserved.

## Independent findings

PASS optional source checkpoint, no blocking findings. Exact diff is4 files,
250 additions; helper, harness, four VM/mock tests, documentation. Read complete
helper, target guard, harness integration/finalization and test bodies.

- `priorDumpRequested` absent defaults false; explicit value other than exact1
  or absent evidence parent rejects before migration execution. Harness target
  guard precedes options/startEvidence/Prisma activity; helper rechecks before
  even version invocation. Real guard enforces explicit disposable test reset,
  loopback tixmo_test target and matching inherited DATABASE_URL.
- In actual harness order:26-prefix deploy -> fixture -> snapshot and ledger
  persisted in before.json -> server version -> version/dump -> receipt ->
  remaining migrations. Throwing helper prevents upgrade. Default path has
  no dump or server-version query. No new reset/restore functionality.
- Existing realpath/owner0700 evidence-parent guard creates fresh child;
  helper independently checks owned realpath0700 directory. Fixed archive
  uses exclusive wx0600 (existing leaves/symlinks rejected), sealed0400 after
  writing, and existing finalization seals child. Same-user concurrent path
  sabotage is not an isolation guarantee or newly established threat claim.
- Tool gets minimal PG environment, no connection URL/password in arguments,
  bounded timeouts, no raw version/stderr/exception printing. Numeric version
  parsing avoids retaining trailing private output. PG credential use is only
  synthetic runtime connection context; no actual credentials were accessed.
- Successful receipt requires exit0, no signal/error and PGDMP prefix, hashes
  exact archive bytes and links before.json SHA (ledger); persist hash links
  receipt from pre-seal result artifact map. Failure receipt retained where
  available; early failure may precede receipt, correctly documented. Header
  check is intentionally not restore validation. Terminal outer exit/finalization
  required: result.json alone is not success. PATH binary provenance remains
  caller responsibility; no PG17/Redis parity proof or actual version run.

## Fresh checks

All commands from task-410 checkout, exit0:

- `node --test scripts/prior-schema-dump.test.cjs`:4 pass,0 fail. Actual harness
  in VM with fake Prisma/spawn, proves order/default, malformed and rejected
  target zero tools/migrations, failure prevents upgrade and failed receipt,
  exclusive/unsafe/symlink rejection and output sanitization.
- `node --test docs/team/evidence/task-410/adversarial.cjs`:2 pass,0 fail.
  Independent extra coverage: eight malformed options/missing parent, truncated
  PGDM archive, status-null timeout, signalled status0 rejection, fixed sanitized
  failure, exact archive hash and linkage,0400 final file, no inherited
  PGOPTIONS/provider secret variable, no password arguments or trailing private
  version output in receipt. All inputs synthetic, tool function stubbed.
- `node --check scripts/verify-payment-upgrade.cjs` and
  `node --check scripts/prior-schema-dump.cjs`:0.
- `git diff aa422d361d13fe4715aec56e2886185200cde8e5 bb158828a3faaa7b2df7c3a4106fbb18551082d6 --check`:0.

Supplied tests intentionally stop after upgrade dispatch with a mock exception;
not a complete migration/product gate pass. Temporary mock filesystem artifacts
were created and removed by tests; no service/DB/real pg_dump/Prisma CLI/network,
provider/cloud/config/spend/install/merge/deploy. No actual dump, restore,
version-parity, old-code compatibility, rollback, RTO/RPO or full245 acceptance.
Lead review remains independently required; original task closure stays PM-owned.
Commit uses command-local synthetic identity/hooksPath; hooks not run.
