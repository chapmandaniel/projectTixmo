# Task202 focused old-processing SQL evidence

2026-10-20; owner `tixmo-release`; branch `tixmo/task-202-focused-sql`; isolated `/home/daniel/projects/projectTixmo/worktrees/task-202`.
Exact product/base `195f96d55187d1544f4373599b72652d87b0eb35`, independently approved lead200 `e389b6f` and QA201 `4f243da`. No184/192 mixing. Evidence-only changes; source, assertions,15000ms deadline, finally/disconnect, native BigInt, schema, manifests and locks unchanged.

## Actual result

PASS focused scope only, explicit `TIXMO_EXPERIMENTAL_RECOVERY=1`:

- Schema exit0, wall0.84s; Jest exit0, wall5.76s (Jest5.089s).
- **1 suite,2 tests passed, no skips**: fresh and ancient crashed owner schedules.
- Fresh full before/after equality with native generation0n and no email.
- Ancient legacy seed0n becomes PROCESSED1n, PAID/SUCCEEDED; inventory available/held/sold6/2/2, email1. Full unrelated order/tickets and target tickets unchanged, ticket/event counts4/1.
- Second signed terminal redelivery full snapshot equality, including all timestamps, generation, inventory and email count.
- Full raw snapshots retained in focused.log; independently parsed/checksummed in snapshot-validation.log. JSON evidence serializes BigInt as strings, source assertions remain native BigInt.

## Execution/provenance

Read approved57/141 lifecycle and task196 exemplar before reuse. `task-202-artifacts/runtime.sh` is approved196 body, only196->202 labels/paths and focused test path changed. Prefix parity PASS in guard-parity.log. Existing177 API dependency lock byte-identical; temporary dependency symlink removed after run; no install/hooks/config.

```sh
env -u DATABASE_URL -u REDIS_URL bash docs/team/evidence/task-202-artifacts/runtime.sh > docs/team/evidence/task-202-artifacts/runtime.log 2>&1
```

Exact schema and focused commands/environment are recorded in runtime.sh. Schema `prisma db push --accept-data-loss --skip-generate --schema tixmoapi2/prisma/schema.prisma` bounded30s. Focused command bounded90s TERM/5s escalation:

```sh
npm --prefix tixmoapi2 test -- --cacheDirectory "$owned_run/jest-cache202" --runInBand --runTestsByPath tests/integration/payment-old-processing.baseline.test.ts
```

No inherited unknown DATABASE_URL/REDIS_URL; explicit disposable URLs only. Synthetic fixture values from approved script, no real credentials accessed. Source identity before/after and SHA256 hashes retained. Initial evidence hash helper assumed a root package-lock.json exists; it does not exist in candidate/worktree. Corrected hash file list only; no source change or runtime rerun.

## Runtime authority/cleanup

Fresh PM sole-owner grant202 and board/process recheck: sole202 doing, no competing UID1000 PG/Redis/Jest; unrelated UID70/999 untouched. Fresh disk-backed0700 UID1000 path `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task202.L1JQtb` (ext2/ext3). PostgreSQL18.6 PID1359190 loopback36207; Redis8.0.5 direct child PID1359203 loopback55877. UID/executable/datadir/PIDfile/direct-child/INFO identity and unique loopback listeners validated BEFORE disposable database creation/schema; SQL confirms `tixmo_disposable_57|tixmo57|127.0.0.1|36207`; fail-closed target validation passed. Database name is isolated within this fresh cluster.

Runtime/schema/Jest exit0. Approved exact-owned bounded cleanup stopped both services; independent subsequent /proc PID absence and empty port listeners PASS, dependency link removed. Runtime disk data retained. No other services touched.

## Limits

Independent exact-evidence QA required before198 closure. No fullAPI/build/fullmarket claim;175/177 remain nonpassing NO-GO. Native18/8-vsCI14/7 parity unproven. No merge/deploy/production/Gateway/scheduler/config/provider/spend/secrets/outbound actions. No additional runtime needed.
