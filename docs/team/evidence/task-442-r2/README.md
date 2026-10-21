# Independent QA442 fresh spy-layering successor

Exact reviewed **98adaa1b057f5feddd221d4ac8a39673e494df26** versus
**701ad1040caad539ff0afb625d6aa6256c026473**. New isolated worktree
`/home/daniel/projects/projectTixmo/worktrees/task-442-r2`, branch
`tixmo/task-442-successor-qa`. PM explicitly authorized same-task fresh followup.
Original review remains immutable at b5755df7288708560a8e590c1ba8f9b7c550aa33.
Read actual delta, tracked-spy helper and successor REPAIR section. Evidence-only
ownership; no author/product source edits or shared main mutation.

**Scoped PASS: QA442's two concrete eval spy findings are repaired in source and
independent offline reproduction. NOT whole-app safety or HTTP qualification.**

## Actual independent checks

`node docs/team/evidence/task-442-r2/probes.cjs` exit0, raw results committed.
Uses installed task434 jest-mock and actual tracker/trackedSpy, extracts/transpiles
the actual new phase delegate block; synthetic Redis only, no app import.

- All three exact delegates (before-acquire, after-acquire, controller) call native
  eval exactly once. Before/after gates hold at intended native call counts and
  join rejects while gated, then completes after release. Controller here means
  its eval delegate only, not actual controller/request execution.
- Per-phase reset retains same lifetime spy. Healthy fallback is still tracked
  on each of three iterations; no recursion or phase-restoration tracking loss.
- Detached zRem's actual synthetic native pending promise blocks join until
  released; same permanent spy retains its call count.
- Rejected phase settles tracker, and final mockRestore preserves exact original
  eval/zRem method identities.
- Original Error identity still survives artifact ENOSPC with diagnostics.
- Source asserts duplicate eval spy/per-phase mockRestore removed; join precedes
  phase delegate reset.

Actual exit0 supplementary checks: author spy-probes with installed jest-mock,
lifecycle-probes, cleanup-probes, offline-check (TS5.9.3 syntax/emitted parse,
exact package/lock/schema matching task434, unsafe path/static checks), task427
transport-stub (no native connect/listen), node syntax check and diffcheck.
One inspection attempted nonexistent spy-layering-probes filename; actual
spy-probes.cjs located/read/run. No target failure implied.

## Remaining limits / handoff

The delta captures native methods before spying and uses one permanent tracking
spy; phase delegates receive the captured native, not another spy. Lifetime
restoration remains after final join. This resolves the two QA442 repros only.
Lifecycle tracker/receipt helpers unchanged from701ad104; previous independent
checks support their scoped behavior, not full async exhaustiveness. SourceSHA
still assumes runner Git cwd corresponds to executed source; full runner binding,
pre-import dependency resolution, whole-app async compatibility and owned process
termination after unjoined-work timeout remain review/execution prerequisites.
No live server ACK/socket-drain/real Lua/database/inventory behavior tested.

ActualHTTP/Jest/typecheck/build/runtime qualification **NOTRUN**. No services,
DB/Redis, sockets/PIDs/ports/runtime dirs or dependency links created; no network,
install, generation, configuration, spend, push, merge or deploy. Task426 remains
OPEN; fresh independent exact lead review still required before author closure,
and safe runner plus authorized actual qualification remain separate. No
launch/capacity/product acceptance implied. Commit uses invocation-only identity
and hooksPath=/dev/null, no persistent config changes.
