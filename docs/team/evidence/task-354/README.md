# Task354 full guarded API gate: FAIL

Exact tested candidate `cdb41d4d3aa4ccc323a2a1cc6b04a490feafe6a6`, isolated branch `tixmo/task-354-full-api`, worktree `/home/daniel/projects/projectTixmo/worktrees/task-354`. Evidence-only commit follows candidate; no product/test/assertion/schema/lock/baseline edits. New2d7490a tests intentionally excluded. Independent exactSHA source/evidence review still required;351 remains REVIEW, no releaseGO.

## Preparation and authorized runtime

Read role/team instructions; claimed354. Independently recomputed102/102 actual accepted-tip/candidate Git blobs equal (`source-parity.json`). Inspected351recipe and318 existing offline runtime/DI harness/guard, root verify-api, safety/Jest/setup/build/migrations. Reused inspected318 harness changing only task identifiers. Copied338M matching offline deps with `cp -a --reflink=auto` from318; generatedclient sampled distinctinode/nlink1, no absolute dependency symlinks. No install/download/shared writes.

No runtime before PM explicit10:24UTC soleDB grant after353cleanup. Actual entry point:

```sh
bash docs/team/evidence/task-354/runtime.sh > docs/team/evidence/task-354/runtime.log 2>&1
```

First reexec `env -i`, fixed Node24 PATH, no .env/inherited secrets; synthetic JWT/session/Stripe values only. Fresh owned0700 disk runtime, PostgreSQL18 loopback disposable354 DB and Redis explicitDB1. Exact PID/executable/listener ownership checks precede DB access. No provider/email/cloud/target/spend/config/push/merge/deploy operations. No harness repair or retry needed/performed; this is one full attempt.

Root verifier exported `verifyApi` called via its existing dependency-injection interface, not literal root npm command. Identical build/migrate/dbpush/fullJest sequence; only raw stdout/stderr fd capture and Jest JSON reporter args added. `commands.jsonl` has exact commands/status. No test selection/filtering or weakened assertions. Full suite test setup performs its own guarded dbpush. Raw failure output retained in4-stderr.log and JSON.

## Actual result

**FAIL** overall exit1; build0, migration rehearsal0, schema bootstrap0, full default Jest1. Jest completed232.955s; **107 suites:95passed/2failed/10skipped;747tests:715passed/6failed/26skipped**. Zero runtime-error suites. Existing conditional skips unchanged/unactivated. No forced test exit or timeout. Original31840FAIL/655PASS/26SKIP remains historicalFAIL; this fresh candidate alsoFAIL, not falsegreen.

Failures:

- `tests/orders-tenant.unit.test.ts`:2 processor refund scope cases expect `refundOrder("a")`, receive second accepted order DTO argument. Exact expected/received retained.
- `tests/integration/order-double-refund.race.test.ts`:4 cases:2 barrier timeouts; insufficient sold inventory expected500/inventory inconsistency but got400; scalar response/ticket-state case rejects400 `Order refunds require unused and untransferred tickets`. Do not infer successful rollback or waive these assertions. No product/test fix attempted.

`summary.json` retains every failed assertion/message; full unfiltered JSON/logs preserve passes/skips and complete diagnostics. Node24.21.0/npm11.19.0/TypeScript5.9.3/Prisma5.22.0/Jest30.5.2. Generatedclient schema whitespace-normalized equal source; hashes/provenance recorded.

Preimport Node net/TLS/HTTP/fetch guard: **zero blockednetwork attempts**, no block log created. Guard is not OS/native network isolation; inspected native PG/Prisma use ownedloopback URLs. No claim about arbitrary native outbound capabilities. No observed unhandled/open-handle warning; JSON openHandles is not detectOpenHandles instrumentation.

## Cleanup and handoff

Runtime completed and cleanup before10:29UTC, within six-minute grant. PG3050089/Redis3050102 absent,32499/41722closed; postmaster pidfile and all sockets absent. `/proc` executable/argv scan finds no owned Node/Jest/API/PG/Redis worker. `cleanup.json` records proof; owned private disk diagnostic directory remains, no live work. DB slot released immediately to PM. Gate runtime is concluded; no continuation running.351 notclosed,325 broader scope still notaccepted. Evidence requires independent review.
