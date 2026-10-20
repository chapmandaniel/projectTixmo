# Task207 fresh guarded full market gate

## Actual result: PASS, scoped local gate only

Owner tixmo-release. Exact tested candidate `e48e4a0069cdb25f8f524e0afdfcbf43b8eb55f7`, accepted independent QA205 and non-author contract206. Branch `tixmo/task-207-repaired-full-market`, isolated worktree `worktrees/task-207`. Fresh sole-owner PM runtime grant recorded on207 at10:53UTC,2026-10-20. No implementation changes.

`TIXMO_EXPERIMENTAL_RECOVERY=1 npm run verify:market`: **exit0, wall167.56s**, deadline300s TERM/5s escalation. Native runtime helper exit0. All ordered stages completed:

- Prisma migrate deploy: all27 migrations applied, exit0; raw migrate.log. Explicit migrate.exit0 recorded after observing successful guarded script progression (set-e), not a separately rerun migration.
- API build: Prisma generate / TypeScript / tsc-alias passed. Prisma Client5.22.0 generated in reused task177 API dependency tree as build side effect, not installation or persistent configuration change.
- API verification: disposable target guard, schema bootstrap and full API Jest subprocess passed. Repository verifier intentionally suppresses child output, so exact API suite/test/skip counts and individual schedule results are **unavailable**, not inferred from historical counts. Explicit recovery1 propagated.
- Dashboard: **25 files /164 tests passed**, no skipped tests reported; Vitest (version recorded in raw log), duration10.72s (raw log authoritative).
- Design guard: passed,1055 existing baseline violations, no regressions; baseline not changed.
- Dashboard production build passed, with nonfatal existing chunk-size warning.
- Root API verifier, status checker and external smoke helper syntax gates passed.

Supplementary complete API180s was deliberately NOT RUN: market completed after predeclared10:56:35UTC start cutoff. No fresh runtime launched for counts; PM accepted conservative omission. This passing market gate does not manufacture API counts or claim independent per-schedule output.

## Reproducible command and artifacts

Read actual candidate scripts, local gate docs, task207 and approved177/202 runtime helper before running. Raw artifacts under `docs/team/evidence/task-207-artifacts/`: runtime.sh, runtime.log, migrate.log/exit, market.log/exit/time, supplementary omission log, exact product-sha.txt, guard-parity.log, dependency-parity.log, source-sha256.json/source-before.log, cleanup-source-validation.log.

```sh
env -u DATABASE_URL -u REDIS_URL bash docs/team/evidence/task-207-artifacts/runtime.sh > docs/team/evidence/task-207-artifacts/runtime.log 2>&1
```

Approved177 guard/startup/ownership/cleanup prefix byte-identical after207 label/path substitution. Only gate timeout changed150->300, time capture added, supplementary100->optional180 with explicit cutoff. No new orchestration or product helper. Existing57 native binaries reused. Full command and synthetic-only fixture environment retained in runtime.sh; no real credentials read. No inherited unknown database/Redis target used.

Five manifests/locks match baseline and task177, SHA256 retained. Existing177 API/dashboard node_modules linked temporarily, **no fresh npmci, installs or hooks**. Node24.21.0/npm11.19.0. Prisma generation in reused dependency tree disclosed above; source/schema/manifests/locks unchanged. Both links removed after checks. All tracked product/test/schema/config/script/manifest file hashes byte-identical before/after candidate; source guard and diff identity passed. No assertions altered, focused rechecks or repairs performed.

## Runtime ownership and cleanup

Fresh0700 UID1000 disk ext2/ext3 directory `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task207.XBzbh8`. PostgreSQL18.6 PID1382870 loopback27885; Redis8.0.5 exact foreground direct-child PID1382883 loopback49646. UID/executable/datadir/postmaster PID/direct-child/Redis INFO identity and unique loopback listener guards passed before disposable database creation/access. SQL identity `tixmo_disposable_57|tixmo57|127.0.0.1|27885`; fresh isolated cluster, Redis /1; target validator passed. Process precheck found no competing UID1000 runtime; unrelated UID70/999 services untouched.

Approved bounded exact cleanup completed. Independent post-helper checks: both /proc PIDs absent; ports27885/49646 have zero listeners; both dependency links removed; source hashes unchanged. Owned disk data retained; no other process stopped. Helper/gate exit0, cleanup before10:58UTC (well before hard deadline). No service leftovers or need for a cleanup decision.

## Handoff and limits

Submit207 REVIEW, independent QA of this exact evidence commit required; no selfclosure.175/177 broader reconciliation remains PM-owned, not automatically accepted by this report. Gate PASS is fresh local evidence only: scanner71 remains excluded,61/manual/target/native18/8-versus-CI14/7 gaps unresolved, **release NO-GO**. Not fresh-install reproducibility or actual native-CI equivalence, external provider/production readiness or deployment approval. No merge/deploy/production/Gateway/config/scheduler/provider/spend/secrets/outbound actions.
