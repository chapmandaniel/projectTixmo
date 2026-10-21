# Task 411 independent lead review

Verdict: PASS, source-only scope for task 409 exact
`bb158828a3faaa7b2df7c3a4106fbb18551082d6`, base
`aa422d361d13fe4715aec56e2886185200cde8e5`.
Reviewer: tixmo-lead, isolated `worktrees/task-411`, branch
`tixmo/task-411-independent-lead`. No implementation changes.

Reviewed complete helper, harness, supplied VM/mock tests, target guard and
source receipt. The opt-in is validated before migrations; the unchanged
loopback/disposable guard runs first. The checkpoint follows prefix+fixture,
before rows/ledger and server version, and precedes remaining migrations.
Throwing from the helper prevents the remaining deploy. Existing defaults,
assertions, disconnect, staging removal and pre-seal result semantics remain.

Evidence parent and fresh child are owned realpath/no-symlink 0700 directories;
archive leaf uses exclusive wx creation, 0600 writing and 0400 finalization.
No existing leaf is overwritten. Ownership assumes no hostile same-UID actor,
as does the existing evidence harness. Dump child receives selected PG variables
and PATH only, with no connection URI in arguments, raw stdout/stderr or exception
text in the receipt/error. Numeric version parsing and fixed error strings avoid
tool-output leakage. Receipt links exact archive hash to before.json hash/ledger;
outer exit and finalization remain required, not receipt success alone.

Actual fresh checks after reading scripts:

- `node --test scripts/prior-schema-dump.test.cjs`: 4 PASS, 0 FAIL.
- `node --check scripts/prior-schema-dump.cjs`: exit 0.
- `node --check scripts/verify-payment-upgrade.cjs`: exit 0.
- `git diff aa422d361d13fe4715aec56e2886185200cde8e5 HEAD --check`: exit 0.

Tests inject spawn and Prisma mocks; no actual pg_dump, Prisma CLI, database,
services, network, downloads/install, config/scheduler, provider, spend, merge
or deployment. QA410's independent adversarial source was read, not rerun here;
its separate evidence remains d508a5cdd4ed42a12acd359332ae02418de1f367.
Header/hash checks do not prove restoreability, snapshot consistency, old-code
compatibility, rollback or W08 acceptance. Tool provenance depends on authorized
PATH. Failures before receipt creation need outer result/exit evidence. These
are correctly disclosed source-slice limitations, not runtime approval.
Task 409 closure remains PM-owned; full task 245 remains open.
