# Task433 independent QA: partial composition core

Reviewer tixmo-qa, 2026-10-21. Exact target
`c3707a5a199ccc567a6d93f5a8b5a0f9bd40f484` vs
`fcab880ea7caf50493439a21032b7a93effc438f`.
Branch `tixmo/task-433-qa-core`, new isolated worktree `worktrees/task-433`.
**REQUEST CHANGES to partial core**; default shared-table extraction passes.
No author source changed. This is not final432 acceptance or runtime authority.

## Reproduced findings for original author432

1. Receipt canonical fields are overwritten by adapter result properties in
   scripts/market-composition.mjs receipt construction (`...step`, canonical
   started/finished, then `...result`). Independent in-memory probe returns
   valid status/stdout/stderr plus index999, phasewrong, commandnot-executed,
   spoofedargs/started; all12 persisted receipts contain spoofed fields.
   Thus the joined evidence can misstate the exact commands/ordering/timing
   despite those being known by the orchestrator. Allowlist execution-result
   fields (status/signal/error/stdout/stderr) or place canonical fields last;
   add regression checking canonical receipt fields cannot be replaced.
2. Candidate identity is checked at iteration start, before audit teardown
   and local admission, but not again before session.run. A stub audit close
   mutates capture identity; first local stage still runs once before the
   subsequent unchanged check rejects it. Reproduced localRuns=1, then
   INCOMPLETE. Revalidate after phase teardown/admission immediately before
   invoking stage (both phase boundaries), preserving close/failure receipts.
   This is eventual invalidation, not fail-closed pre-execution invalidation.

Both are bounded core-contract defects, not allegations that trusted production
adapters exist. Their current absence is honestly stated by the author. Returned
findings remain with432 original author; no fix made by reviewer.

## Actual checks (all exit0)

- `node docs/team/evidence/task-432/offline-stub.mjs`: reproduced exact12 stage
  object/override parity, all12 failfast positions, phase teardown, stale source,
  rejected contract and cleanup failure behavior using in-memory executors.
- `node docs/team/evidence/task-433/adversarial-stub.mjs`: retained independent
  reproductions above and successful thrown-run test: phase closed once,
  zero receipts, failure persisted INCOMPLETE. No native connections/listens.
- Python exact byte comparison: default verify-market-local.mjs equals base
  after only replacing old table with shared-table import. Therefore default
  spawn arguments, inherited env/production override and failfast code unchanged.
- `node --check` market-composition.mjs, market-stages.mjs,
  verify-market-local.mjs; `git diff --check fcab880e c3707a5a`.

Inspected all five candidate files. Core receives no inherited environment and
closes audit session before local open in successful stubs; no PASS emitted.
Real registry443/existing-resolver DNS admission, credential/config scrubbing,
redirect/proxy denial,427 owned-runtime adapter/preimport/native bridging,
nested API raw receipts, immutable persistence and version/generated-client
provenance remain explicitly missing, not approved. Contract booleans are not
security enforcement, and Node hooks are not OS/native process isolation.

No default runner/audit/compiler/Jest/runtime/DB/services/network/install,
spend/config/CI/scheduler/provider/production/push/merge/deploy executed. No
source/lock changes outside reviewer evidence. Original424 failures retained;
432 remains open and needs author repair/continuation plus final exactSHA
independent lead+QA acceptance before named audit/runtime owners and grants.
