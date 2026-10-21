# Independent QA446 source/offline successor review

**APPROVE scoped repairs only**, exact `510824df9e9bb7f5e57984862728b52929f7f849` versus `98adaa1b057f5feddd221d4ac8a39673e494df26`. No new blocking source defect found within this bounded review. Task426 remains OPEN, not qualified; fresh independent lead review remains separate.

New isolated branch `tixmo/task-446-independent-qa`, worktree `/home/daniel/projects/projectTixmo/worktrees/task-446`. Reviewer owns only this evidence directory, no author/product edits. Read current446/443 board, immutable lead443 `70f56805520fb0029d4dedba4f52141fc6e1f9eb` findings, actual successor REPAIR.md and continuation-results, middleware/provenance/lifecycle/tracked-spy implementations and qualification delta. Existing Node built-ins plus installed matching task434 express-rate-limit/jest-mock/TypeScript used, no installs or dependency links. Did not rerun author continuation-probes as independent evidence.

## Actual checks

- `node docs/team/evidence/task-446/probes.cjs`: exit0, **13 independent cases PASS, 0 failures**, retained results.txt.
- `node docs/team/evidence/task-426/spy-probes.cjs`: exit0, existing installed jest-mock regression: three phase delegates/native exactly once, pending join, failure/reset, tracked fallback/zRem, exact original restoration. This is separately identified author coverage, not part of13.
- `node --check docs/team/evidence/task-426/provenance.cjs`: exit0.
- `node --check docs/team/evidence/task-426/middleware-lifetime.cjs`: exit0.
- `git diff --check`: exit0.

Independent cases1-2 use actual installed express-rate-limit and jest-mock, synthetic deferred stores, no HTTP/application imports. Both success and store rejection: start final cleanup while store unresolved; join cannot finish and next has not run. Release store, actual next invokes tracked nested child that remains unresolved. After limiter promise settles, cleanup still cannot restore or disconnect, and independent second join times out. Release child, then cleanup joins, restores exact original limiter identity and only then synthetically disconnects. This explicitly exercises gaps before next and between limiter settlement and child settlement, not merely already-gated handlers. Real lifecycle.finalize executes cleanup ordering, not an assumed order.

Case3 statically confirms all three exported API read/write/auth limiters are wrapped before app import; actual sendCommand also tracked; final join before restore and disconnect. Cases1-2 dynamically exercise helper with installed library, not actual app middleware module/config/Redis store import. Source inspection confirms reverse restoration includes sendCommand/limiter spies and skips restore/disconnect when final join fails; join deadline remains observation, not cancellation.

Case4 transpiles actual qualification with installed TypeScript and **executes emitted CommonJS** in a VM with builtin-only require and rejecting provenance sentinel. Sentinel is observed before supertest or any product require. Jest unmock/mock calls are stubbed and occur earlier: NOT a before-Jest-setup guard or a whole-runner preimport proof. No app/dependency code is actually imported by this emitted probe.

Cases5-13 execute real provenance.verify using a temporary local Git fixture: switch caller cwd to shared main yet derive actual executed fixture root/SHA; verify three manifest hashes; absent/wrong SHA, absent/nonexistent dependency root, modified executed source, untracked executable source, mismatched dependency manifest, and identical manifests with different real node_modules fail closed. Fixture package has no dependencies, so resolved production entry/package confinement is inspected only, not dynamically exercised across the real installed dependency set. No valid app qualification attempted. Fixture repository commits are synthetic and removed after checks.

## Verdict and limitations

Lead443's concrete deferred-limiter counterexample is addressed for the exercised promise-returning installed middleware: tracking the full continuation (not merely sendCommand) retains lifetime through next; synchronously admitted child work is then caught by iterative tracker joins. SourceSHA/cwd issue is addressed by executed-source-derived real root and explicit expected SHA, clean tracked/blob checks, relevant untracked-source denial and dependency-root identity before product imports. No claim that these constitute security attestation.

Remaining OPEN: arbitrary background work and future admissions not automatically proven quiescent; source/dependency snapshot cannot prevent mutate/revert or time-of-check/use writes; dependency entry hashes are not exhaustive installed/generated Prisma/native-binary attestation. In-module guard is **not before Jest setup**; future runner must verify scrubbed environment/native preloads and immutable source/deps before spawning Jest. No safe426 runner exists here. On join timeout, retained instrumentation/skipped disconnect still requires reviewed owned-process termination/reaping before service teardown; unchanged427 runner is not approved for that. Actual HTTP/Lua/DB/Redis/inventory/foreign-buyer/server-ACK qualification, Jest/typecheck/build NOTRUN. Top-level rejection needs external stderr/exit retention, not an in-test cleanup receipt.

**No426 closure, runtime grant, actualHTTP claim, fullmarketPASS or launch acceptance. Fresh lead still required.** No services/runtime/HTTP/DB/Redis/network/install/generation/config/spend/push/merge/deploy; no author edits. Evidence-only commit uses invocation-only Git identity/hooksPath override consistent with inherited missing Husky helper notes, no persistent config change or lint-staged claim.
