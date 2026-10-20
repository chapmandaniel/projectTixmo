> **Historical archive, not current acceptance.** Original 2026-10-20 deliverable `8d9f7b2ce020289b8f6a314b3e14837a2d7e9c5d`; tested/reference product `0d193a6e8f8180d509f5cfdbb793203904047237`. Imported by task236; no gate rerun. Present-tense wording below belongs to the original capture. See [provenance and limits](HISTORICAL_DELIVERABLES_236.md).

# Task214 independent scanner-integrated full-market evidence review

## Verdict: APPROVE scoped task213 evidence

Exact immutable evidence reviewed: `d2dc727b5b34acd8be756be03a3f218afd668c5d`.
Exact tested candidate: `0d193a6e8f8180d509f5cfdbb793203904047237`.
Reviewer tixmo-qa, 2026-10-20; isolated branch `tixmo/review-214`,
worktree `/home/daniel/projects/projectTixmo/worktrees/review-214`, created at
that candidate then fast-forwarded to exact evidence commit. No blocking finding
within task213 evidence acceptance; not launch approval. PM retains task213 closure.

## Independent audit

Read role/repository/team/workflow instructions, local gate documentation, board
213/214/207/208 and prior approved207 helper/review208. No historical run was
substituted for current evidence. Read all committed213 report/raw provenance,
helper, exit/time, migration, stage-result, parity, snapshot and cleanup artifacts.

- Exactly18 paths differ from candidate, all task213 documentation/evidence.
  Product/source/tests/assertions/schema/scripts/config/manifests/locks unchanged.
- Independently recomputed all449 snapshot SHA256 entries against exact candidate
  Git blobs, immutable evidence checkout and release checkout: identical. Snapshot
  covers every tracked candidate non-doc/non-Markdown path; no weakened assertions.
- All22 recorded dependency/config parity entries independently match candidate
  and reused177 Git blobs, including five manifests/locks. No tracked root lock.
- Immutable213 helper startup/ownership/cleanup prefix byte-identical207 after
  task-label substitution. Guard includes fresh umask077 disk directory, UID,
  exact Postgres executable/datadir/postmaster PID and Redis executable/unreaped
  direct-child/INFO PID, unique loopback listeners before DB access, SQL/disposable
  identity validation, identity-rechecked bounded cleanup and original exit retention.
- Actual single gate300s TERM/5s escalation, recovery1 and synthetic disposable
  URLs retained. Recorded invocation uses env-i, dropping inherited targets and
  credentials. No supplementary runtime/counts run; no new orchestration.

## Fresh results from exact immutable artifacts

Market exit0, wall167.61s; outer helper exit0. Product-sha.txt records exact candidate.
All eight stage exits0 are established by inspected synchronous fail-fast runner
status checks, ordered progression and final success marker, not headings alone.
Stage-results.json correctly discloses no individual stage wall-time measurements.

| Stage | Raw result |
| --- | --- |
| API build | Prisma Client5.22.0 generation, TypeScript and tsc-alias PASS |
| API verification | Schema bootstrap/full Jest subprocess PASS; child counts suppressed |
| Dashboard tests | Vitest4.0.18,25 files/170 tests PASS,10.49s; scanner30 included; no skips reported |
| Design guard |1055 existing baseline violations, no regressions |
| Dashboard build |2531 modules,7.77s PASS; nonfatal chunk/browser-data warnings |
| Root helper syntax | PASS by runner progression |
| Status checker syntax | PASS by runner progression |
| External smoke syntax | PASS by final success marker; not live smoke |

Migrate log contains exactly27 Applying migration entries and final successful
application marker. migrate.exit0 is recorded from successful set-e helper
progression, not an independent rerun. Actual API suite/test/skip totals are
unavailable because verify-api.mjs captures/suppresses child output. No209,
historical or inferred totals credited; supplementary artifact explicitly NOT RUN.

## Independent cleanup corroboration

After final immutable handoff, at **11:26:54 UTC**, read-only independent checks:

- Exact `/proc/1425552` PostgreSQL and `/proc/1425565` Redis entries absent;
  thus no executable/cmdline remains at either recorded owned PID.
- `ss -H -ltnp` separately for32589 and50384 returned zero listeners.
- Exact retained datadir parent
  `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task213.2xSR5O`
  mode0700 UID1000; `pg/postmaster.pid` absent. Runtime log records disk ext2/ext3,
  guarded SQL `tixmo_disposable_57|tixmo57|127.0.0.1|32589` and Redis PONG.
- Both exact task213 API/dashboard node_modules paths absent, including broken
  symlinks (lexists check). Release checkout all449 source hashes still match.

Recorded successful exact cleanup is independently corroborated. Did not start,
signal or inspect unrelated services; retained owned disk data untouched.

## Limitations and scope

This is an independent evidence/static/cleanup review, not an independent rerun of
market, DB tests, browser or live environments. No services, runtime, DB access,
dependency writes/install/hooks or product edits by214. Prior guard evidence is
historical context; only immutable213 output establishes this fresh local run.

Temporary lock-identical177 dependency reuse is not fresh npmci/install evidence.
Raw API build explicitly regenerated Prisma client within reused177 dependencies;
this dependency-tree side effect is disclosed and not erased by source parity.
Native Node24.21.0/npm11.19.0/Postgres18.6/Redis8.0.5 is not CI Node20/Postgres14/
Redis7 parity. API totals remain suppressed/unavailable; individual API schedules
are not separately evidenced. Design baseline/warnings are not zero-debt claims.
Scanner code tests are not physical-device/offline field evidence. Task61 manual/
target/nativeCI/physical scanner gaps remain: **release NO-GO**. No default merge,
deploy, production/target/provider/config/Gateway/scheduler/spend/secrets/outbound.
