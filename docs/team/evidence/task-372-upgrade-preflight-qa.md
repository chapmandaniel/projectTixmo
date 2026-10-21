# Task 372 independent QA: preparation only PASS

2026-10-21; reviewer `tixmo-qa`, not the task371 author. Exact reviewed commit
`95e62218cabe1a9b315459a67f7144682dc4a47d`, parent
`80c6710b89d147588e1514aa99a4e55c5630d38a`. Isolated branch
`tixmo/task-372-upgrade-review`, worktree
`/home/daniel/projects/projectTixmo/worktrees/task-372`. Owned file: this receipt.

## Actual independent checks

- `git show -s --format='%H%n%P' HEAD`: exact commit/parent match above.
  `git diff HEAD^ HEAD --name-only`: sole author file
  `docs/team/evidence/task-371-upgrade-preflight.md`.
  `git diff HEAD^ HEAD --check`: exit 0.
- Python pathlib/re assertions: all 10 relative Markdown links resolve; 31
  ordered migration SQL files. Prefix26 ends `20260602010000_add_payment_webhook_events`;
  remaining27 account revocation,28 payment/inventory integrity,29 durable approval
  reminders,30 reconciliation audit,31 webhook attempt generation. Thus26->31 is
  a defensible synthetic baseline, not a claim about any deployed schema.
- Read `scripts/verify-payment-upgrade.cjs`: sorted prefix before inventory is27,
  then only inventory SQL is copied. Fixture path does not exist and `git ls-files`
  returns no tracked fixture. `node --check scripts/verify-payment-upgrade.cjs`
  exits0; syntax is not execution acceptance. Its temporary path uses os.tmpdir.
- Read account/inventory SQL and final three migrations, generation preservation
  SQL in task170, target guard and checkout fail-closed branch in
  `tixmoapi2/src/api/orders/service.ts`; searched accountSession/session source
  and integration tests. Document accurately separates expected auth/QR/session
  behavior from stored SQL invariants. Ambiguous/unmatched stock and inconsistent
  counters remain blocked; no zero-counter reopening or unreviewed reconciliation.
- Independently ran only cached binary `--version` with its library path:
  postgres/pg_dump/pg_restore18.6 and Redis8.0.5, all exit0. Known task57 extracted
  `usr/lib/postgresql` contains only18; archive paths name18.6/8.0.5.
  `command -v postgres pg_dump pg_restore redis-server initdb` found none
  on this inherited PATH. PG17/Redis8.2.10 are not evidenced by these paths;
  this is NOT an exhaustive machine inventory or permission to install.
- Read task276 README at `cb95d021dd5f08d2fa9b95fc1fee17987f8ee564`:
  tiny post-schema synthetic restore, matching row fingerprints, stored disabled
  user/version7 and invitation6, ~0.08s/~0.12s backup/restore. Historical only,
  not repeated. Existing full API725 likewise historical, not a fresh QA run.

## Verdict and limits

PASS task371 **documentation/preparation only**; no correction required.
The next slice is a reviewed pre-account fixture plus adapted full31 harness,
then separately authorized one-owner disposable runtime and parity tooling.
Rollback contract is appropriately conditional: prefer forward-fix; validate
exact old-code/new-schema compatibility; restore only NEW empty recovery DB;
retain/reconcile post-backup writes and preserve revocation/QR/session safety
before serving. No inverse migration/ledger deletion or blind data overwrite.

Task372's independent source/document review is complete; PM alone may close371.
Parent245/fullW08 remains OPEN / launch NO-GO. NOT RUN: services, databases,
empty/populated upgrade, API/browser/auth/QR/session tests, restore, rollback,
PG17/Redis8.2.10 parity, PITR, target checks or RTO/RPO measurement. No DB grant
was held or used. No network/provider/download/install, .env/secrets, cloud,
configuration/scheduler, spend, push/merge/deploy. Version probes started no service.
This review changes no source, migration or runtime artifact.
