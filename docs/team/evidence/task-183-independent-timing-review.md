# Task 183 independent timing/failure evidence review

**APPROVE evidence only** exact `4e3664d719c301159b40a58a2fc684c4d84ab905`
against source `7574eea362ea827c1da85a0bf60002352a355dd1`.
Reviewer tixmo-qa, 2026-10-20; isolated `tixmo/review-183` at
`/home/daniel/projects/projectTixmo/worktrees/review-183`.

Read/claimed183 after checking claims; task182 is REVIEW, not closed. Audited
report, all artifact hashes, runtime helper, identity/cleanup logs, raw API
failure summary, source fixtures and historical board137/141/143/105.

## Actual read-only checks

- Candidate diff contains only16 evidence files. `git diff --exit-code
  7574eea 4e3664d -- tixmoapi2 tdash scripts package.json package-lock.json`
  exit0: source, tests, schema, manifests and locks unchanged.
- `sha256sum -c SHA256SUMS`: all14 artifact hashes OK.
- `bash -n runtime.sh` exit0. Diff against retained177 helper confirms identical
  guards/cleanup apart from task labels, and explicit timed schema/API commands
  replacing the market/supplementary commands. No custom safety bypass.
- Explicit recovery=1, fresh0700 UID1000 disk-backed runtime, loopback unique
  listeners, exact PG UID/executable/datadir/PID-file and Redis unreaped child
  identity guards precede DB operations. Explicit constructed disposable URLs,
  target validation and synthetic local values; no inherited DB target.
- Recorded schema exit0 wall0.83s; API and wrapper exit1 wall148.20s,
  Jest147.399s. Raw final summary:79 suites,3failed76passed;493 tests,
  7failed486passed; snapshots0. These are retained release-run measurements,
  NOT a fresh QA execution. Complete failing run, not timeout or green gate.
- Runtime log shows final source identity and both owned services stopped.
  Cleanup validation records PID_ABSENT1289227/1289240 and no26315/55877
  listeners. Fresh QA `ps -p 1289227,1289240 -o pid,uid,args` returned header
  only; `ss -H -ltnp 'sport = :26315 or sport = :55877'` empty. Exact-child
  cleanup is supported by retained logs and independent current absence.

## Seven failures and narrowly deduplicated followups

Raw API summary independently corroborates:

1. Paused-owner fresh and before-handler: two line11 barrier timeouts.
2. Paused-owner before-finish: line74 baseline equality expects generation1/
   PROCESSING, receives generation2/PROCESSED. This is explicitly a baseline
   observation, not candidate acceptance. Current fixture also still expects
   beginWebhookEvent result `true`; current generation-bearing claim contract
   requires bounded diagnosis. Do not declare the timeouts product failures.
3. Old-processing ancient=false/true: two line43 JSON.stringify BigInt failures;
   downstream assertions did not pass and must remain meaningful after repair.
4. Retry exhaustion: expected DB Timeout, received missing claim.eventId;
   eventual success: same TypeError. Both call the private handler without a
   claim and spy legacy confirmOrder, rather than transactional confirmation.

Recommend at most three scoped fixture/contract followups: (a) paused-owner
baseline/candidate oracle alignment plus barrier diagnosis, (b) BigInt-safe
old-processing diagnostic serialization preserving assertions, (c) retry
fixture valid claim/real fence/current transactional-confirmation contract.
Do not remove suites, weaken durable-state assertions or bypass the fence.
These are new aggregate compatibility findings, not reason to reopen/duplicate
the already-DONE137/141 reproductions or143 product recovery work. Retry
history105 already repaired older actor/error expectations; scope only the
new fenced-handler contract gap, not another broad105 repair. Open board has
no existing matching repair task; PM should deduplicate again before creation.
No product correction is justified solely by these logs.

Budget recommendation is faithfully caveated:240s API versus observed148.20s,
30s schema;300s future market starting deadline plus at least60s setup/cleanup
reserve is not a proven total bound because dashboard/build were not timed.
More time cannot fix the seven failures. Native Node24/PG18/Redis8 and reused
dependencies are not fresh CI Node20/PG14/Redis7 parity.

No QA services, DB access, installs, source/config changes or test reruns.
Documentation commit uses command-local author identity and hooksPath override
for missing Husky helper, no persisted Git configuration or test bypass.
Task182 closure remains PM-only. Tasks175/177 remain open/nonpassing; release
NO-GO, full-market acceptance still required. No merge/deploy/production,
spend/secrets/outbound action. Approval accepts honest failure/timing evidence,
not product correctness or launch readiness.
