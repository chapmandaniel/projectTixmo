# Independent QA532: original middleware capture repair

Candidate: `09dfb648a87eb4f006555f88a93147bf5c34d523`.
Base: `d4fd52c1637c24d9f1bb003685029e915745bf6e`.
Reviewer: tixmo-qa, independent from implementation author.
NEW isolated checkout `/home/daniel/projects/projectTixmo/worktrees/task-532`,
branch `tixmo/task-532-independent-qa`. Only task532 evidence is added.

## Verdict: scoped SOURCE/INERT capture repair APPROVE

All three original function references are saved before their corresponding
spyOn installs: authenticate, optionalAuthenticate and waitingRoom. Reading the
saved lexical value after spy installation cannot read the replaced property.
The unchanged promiseMiddleware closes over that saved function and later calls
original.apply(this, args). No original runs during capture. The source repair
is narrowly limited to these three capture pairs; no broader repair is present.

This is fresh exact-successor QA, not inherited QA529 approval. Read actual
adverse lead530 receipt `7ef5c4202c8f4bfc2fc90f4aadd6928068cc095e` and repaired
lead531 receipt `58dcbe6e8f7af9b00a8cbcc0f19977f55b244f69`, including the explicit
contradiction of QA529's capture-preservation claim. That original approval missed
the receiver-before-argument evaluation defect; it cannot cover this successor.

## Independently reproduced evidence

Read full three-file candidate diff, full qualification, full ownership.cjs,
CAPTURE-REPAIR.md, and all58 lines of author capture-order-probes.cjs before any
execution. Startup list --mine/inbox/show532 and worktree inventory inspected;
claimed ONLY532, not499. Existing shared-main untracked AGENTS.md/docs/team left
untouched. Read required role/team workflow and recent499 notes.

Authored independent `docs/team/evidence/task-532/independent-capture.cjs`.
It uses only Node built-ins and read-only git show. It extracts/checks the exact
old and new capture expressions, executing ONLY those expressions inside an
isolated VM against minimal fake objects. No qualification file, helper, Jest,
product module, setup or service is imported/executed.

For each of the THREE functions, negative control proves the old expression
captures the installed spy, re-enters it, and calls the original zero times.
Positive control proves candidate captures the original (not installed spy),
does not call it during setup, then calls it exactly once while preserving
receiver identity, argument identity and returned-object identity. Six independent
control outcomes PASS. The bounded synchronous fake-spy reentry sentinel models
JavaScript evaluation order, NOT real Jest or asynchronous helper scheduling.

Independent exact normalization of ONLY the three fixed snippets reproduces the
entire base qualification byte-for-byte. All other source, type bindings,
fixtures, measurement/stock/uniqueness/cancellation/foreign assertions and teardown
are therefore unchanged; lexical count is23 expect calls. This review does not
claim a new AST/parser check. Full helper base/candidate bytes are identical.

## Actual commands and results

All run from the new task532 worktree, all exit0:

- `node --check docs/team/evidence/task-499/capture-order-probes.cjs`
- `node docs/team/evidence/task-499/capture-order-probes.cjs`:
  three source/unsafe/safe controls PASS; exact normalization/helper PASS.
- `node --check docs/team/evidence/task-532/independent-capture.cjs`
- `node docs/team/evidence/task-532/independent-capture.cjs`:
  six exact-source controls PASS; normalization/helper/23 assertions PASS.
- `git diff --check d4fd52c1637c24d9f1bb003685029e915745bf6e 09dfb648a87eb4f006555f88a93147bf5c34d523`
- `git diff --exit-code d4fd52c1637c24d9f1bb003685029e915745bf6e 09dfb648a87eb4f006555f88a93147bf5c34d523 -- tixmoapi2/tests/qualification/task499/ownership.cjs`
- Staged evidence whitespace check before evidence commit: exit0.

## Limits and disposition

Compiler/type/mock diagnostics NOT PRODUCED, not zero. Matching generated
dependencies remain unresolved per513, CJS adapter typing/Redis overloads remain
unverified, and precollection process admission/default Jest setup safety remains
unresolved. No parser result or fake spy constitutes actual Jest compatibility.
No appimports/Jest/typecheck/setup/helper execution, DB/Redis/HTTP/runtime/network/
provider/env/secrets/install/generation/config/scheduler/push/merge/deploy/spend.
Integration231 untouched. Command-local Git identity/hook bypass only; no config edit.

Done532 means independent source/inert REVIEW COMPLETED, not broader implementation
approval. Full499/246 remain INCOMPLETE. No type/mock/runtime/capacity grant or
acceptance. PM can reconcile this scoped successor finding with lead531; remaining
compiler, admission and qualification gates need separate authorized evidence.
