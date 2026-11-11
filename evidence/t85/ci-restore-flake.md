# T85 configured-image-restore drop flake

Head under test: `d64fc7f0ff7ca2ec50b59d5f3c721458d4820815` on draft PR #187 (`cursor/configured-image-restore-drop-7b43`).

#187 is stacked on draft PR #185. Its parent is #185's head `d7c771d2` (`cursor/t84-fast-xml-parser-advisory-4f84`). The only commit after that parent is the T85 cleanup. The pull request base stays `main`, so the GitHub diff contains #185's commits until #185 merges. Merge #185 first. After that, #187's diff shrinks to `scripts/verify-parity-upgrade.cjs` and `scripts/parity-upgrade.test.cjs`. Do not merge #187 before #185. PR #185 was not modified.

## Symptom

`configured-image-restore` in `Tixmo Market Readiness Local Gates` failed intermittently while dropping the job-owned upgrade database. [Run 42880294445](https://github.com/chapmandaniel/projectTixmo/actions/runs/42880294445) attempt 1, job `130054441155`, PR #184, head `2336e80c2a0932ab674477b104c3cac8cae9d28c`, 2026-11-10 18:57Z:

```json
{"scope":"task607-configured-image-populated-upgrade","phase":"ledger","ok":false,"migrations":43,"unchangedHarnessPassed":true,"databaseCleanupVerified":false,"stagingCleanupVerified":true,"possibleDatabaseOrphan":true,"durationMs":18265,"postgresqlVersionNum":180006,"redisVersion":"8.2.9","targetUpgradeProved":false}
```

The ledger checksums had already passed. Cleanup then refused to remove `tixmo_disposable_upgrade_<uuid>`. The script swallows the SQL error, so the log does not contain the PostgreSQL text. The receipt is the failure: `databaseCleanupVerified` is false and `possibleDatabaseOrphan` is true. Attempt 2 of only that job, job `130064483599`, passed on the same SHA with no code change.

## Root cause

The open session is an autovacuum worker on that owned database, not a Prisma pool, the upgrade child, or a `psql` session the harness still owns.

`scripts/verify-payment-upgrade.cjs` is spawned with `detached: true` and the parent waits for the child's `close` event. The child's `finally` awaits both `prisma.$disconnect()` and `runtimePrisma.$disconnect()` before the process exits. The parent then runs the ledger SELECTs, including one checksum query per migration, all of which succeeded on the failing run. A client backend left open by that child would still have been visible for that whole ledger and would have failed every run. The re-run of the same SHA passed, so the holder is not a leaked client.

What remains is PostgreSQL's autovacuum worker (`backend_type = 'autovacuum worker'`) on the database just created from `template0` and filled by 43 migrations. The launcher visits databases on `autovacuum_naptime` (default 60s). Postgres in the failing job had been up for about two and a half minutes by the drop (container start 18:57:03Z, parity step 18:59:29Z, failure 18:59:47Z), so a worker is only sometimes connected to the new database.

That worker holds `AccessShareLock` on the database for its whole life. `DROP DATABASE` needs `AccessExclusiveLock` before it can signal the worker (`CountOtherDBBackends` in PostgreSQL 18). The old cleanup did two things that make this timing fatal:

1. One `pg_stat_activity` count had to be exactly `0`, including autovacuum. A worker visible at that instant aborted the drop before `DROP DATABASE` ran.
2. The drop session used `lock_timeout=2000`. When a worker appeared in the gap after a zero count, the lock wait was cancelled before PostgreSQL's own autovacuum shutdown (about one `deadlock_timeout`, default 1s, then the 5s backend wait) could finish. The statement is refused because another session still holds the database.

## Fix

`scripts/verify-parity-upgrade.cjs` still joins the upgrade child before cleanup. It then:

- signals only `backend_type = 'autovacuum worker'` rows whose `datname` is the owned database, from a session connected to `tixmo_disposable_restore_source`
- waits up to 8s for every other backend on that database to drain
- runs the same unforced `DROP DATABASE "<owned>"` with `lock_timeout=10000` and `statement_timeout=15000`

Client backends are not signalled. A client that is still connected when the wait ends leaves the database in place and sets `possibleDatabaseOrphan`. No `WITH (FORCE)`, and no other database is touched. `scripts/parity-upgrade.test.cjs` still requires a connection-free owned drop and still refuses a drop while a client session remains. It also covers a client that drains during the wait, and it checks that every `pg_terminate_backend` call is limited to autovacuum workers on the owned name.

## CI on this head

All checks that ran finished without failures. `http-soak` skipped because `.github/workflows/http-soak-qualification.yml` only runs that job when `github.head_ref` is `codex/http-soak-qualification`.

| Check | Run | Attempt | Job | Result |
| --- | --- | --- | --- | --- |
| configured-image-restore | [43023300645](https://github.com/chapmandaniel/projectTixmo/actions/runs/43023300645) | 1 | 130531602801 | pass, 12:46:55Z–12:49:35Z |
| local-gates | [43023300645](https://github.com/chapmandaniel/projectTixmo/actions/runs/43023300645) | 1 | 130531602568 | pass, 12:46:55Z–13:01:12Z |
| guard-and-build | [43023300656](https://github.com/chapmandaniel/projectTixmo/actions/runs/43023300656) | 1 | 130531602985 | pass, 12:46:55Z–12:48:12Z |
| http-soak | [43023300714](https://github.com/chapmandaniel/projectTixmo/actions/runs/43023300714) | 1 | 130531605605 | skipped |

The populated-upgrade receipt on the passing restore job:

```json
{"scope":"task607-configured-image-populated-upgrade","phase":"ledger","ok":true,"migrations":43,"unchangedHarnessPassed":true,"databaseCleanupVerified":true,"stagingCleanupVerified":true,"possibleDatabaseOrphan":false,"durationMs":14605,"postgresqlVersionNum":180006,"redisVersion":"8.2.9","targetUpgradeProved":false}
```

## Consecutive restore reruns

The requested sequence was this initial pass plus two `gh run rerun <run-id> --job <job-id>` calls with no commits between them. The first rerun was rejected, so there are not three attempts.

```text
gh run rerun 43023300645 --job 130531602801
job 130531602801 cannot be rerun
```

`POST /repos/chapmandaniel/projectTixmo/actions/jobs/130531602801/rerun` returned HTTP 403 `Resource not accessible by integration`. The response asked for `actions=write`. The authenticated `gh` account is the cursor GitHub App (`ghs_` token). It can push this branch and read Actions, and it cannot re-run jobs. No second rerun was issued. The only `configured-image-restore` result on this head is run `43023300645` attempt 1, job `130531602801`, pass.
