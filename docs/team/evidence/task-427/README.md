# Task427 source-only full API runtime contract repair

Base `8aae387bcd4290edd259fd75aa11baaa1f62ca63`; branch
`tixmo/task-427-full-api-contract`; isolated worktree
`/home/daniel/projects/projectTixmo/worktrees/task-427`.
Owned files: this directory and only the async-scope wrapper of existing
`tixmoapi2/tests/integration/orders-http-pressure.local.test.ts`.

## Diagnosis and reuse

Inspected379 runner/native guard/runtime-path,393 process observer,362 actual
runner/outer guard/DI,390 board reviewed971275ba scoped acceptance, and424 exact
`21e2c8fec6f6fd7913c1c14e274b79fda964fc46` README/summary/raw failure contract.
424 remains FAIL:803PASS/1FAIL/26SKIP, missing artifact before HTTP setup;
market audit network failure remains separate. No historical green inherited.
Existing Node AsyncLocalStorage, verifyApi DI, native379 guard and owned runner
are sufficient; no package/framework/install/custom orchestration needed.

Artifact env alone cannot satisfy current run identity/private disk/native
listener contract. Globally preloading strict379 also rejects unrelated suites'
Supertest ephemeral listeners. New runtime reuses379 private task379 disk path,
fresh challenge, exact-owned process/listener preconnect checks and cleanup;
changes only entry grant identity, full gate invocation and composed preload.
New outer guard is424's362-derived guard (name/log variable only changed).
The scoped guard loads outer first, captures strict379 next, and dispatches
strict only inside native AsyncLocalStorage context. Pressure body is wrapped
at its outermost boundary (including connectRedis/setup/finally); standalone379
without scope still uses its existing globally strict guard. Existing100buyers,
rate, concurrency, inventory, leases, monitoring and cleanup assertions unchanged.
All other suites retain full-suite outer protection, not strict379 semantics.
Strict dispatch delegates to379, which itself delegates outer then bottom socket.
Native listener registration/revocation stays unchanged. No filter or skip added.

## Actual checks (source/stub ONLY)

PASS `bash -n docs/team/evidence/task-427/runtime.sh`; `node --check` on
network-guard.cjs, outer-guard.cjs and run-gate.mjs; `git diff --check`.
PASS `node docs/team/evidence/task-427/transport-stub.cjs`: bottom native connect
replaced before preload, no listen/network; rejects external before transport,
strict scope rejects unowned loopback/Unix path, allows owned PG/Redis,
normalized argument vector and HTTP path:null, validates fake native-class
listener registration/revocation, persists across await, restores outer context.
Five bottom stub calls asserted. Mock native handle is not real-listener proof.
No compiler/Jest/build/migrate/schema/DB/Redis/runtime/services/network/install/
generation/shared dependency writes/provider/spend/config/scheduler/push/merge/
deploy executed. No dependencies added or linked in this checkout.

## Required independent handoff and later runtime

REVIEW ONLY, not done or runtime-ready acceptance. Independent lead AND QA must
review exact commit, especially AsyncLocalStorage/Jest native module bridging,
async context propagation, concurrent callbacks, bypass boundaries and unchanged
assertions. No live compile/Jest evidence supplied. Parent PM owns next grant.

After both reviews and NEW explicit sole-owned DB grant, release must inspect
scripts and provenance before invoking `bash docs/team/evidence/task-427/runtime.sh`
from the reviewed worktree, with `TASK427_PM_RUNTIME_GRANT=source-reviewed-sole-owner`.
The marker is NOT authorization. Runner env-i scrubs inheritance and creates fresh
0700 disk task379/run.*, validates exact PG/Redis listeners before connections;
preload combines both guards, records full verifyApi build/migrate/schema/Jest
commands, raw logs and Jest JSON in private runtime. Full Jest remains unfiltered;
outer timeout360s replaces pressure-only110s. Outer orchestrator must budget
startup and cleanup beyond360s, never impose an unsafe six-minute runtime cutoff.
Exact dependency locks/generated-client provenance must be independently checked
before reuse, with no install/generation. Native/subprocess traffic is NOT an OS
sandbox; guards cannot establish production safety or provider acceptance.

Cleanup inherits379/393 failclosed current-challenge observer. If full gate fails
before pressure receipts exist, observer fails closed as missing proof rather than
inventing success; inspect live exact processes/ports and retain original failure.
Observer expects terminated Jest PID and native HTTP listener absence; independently
corroborate all service/listener/link cleanup. Record actual counts/skips, preserve
424 original failures. Current runner remains PG18/Redis8.0.5 NONPARITY, not245.
No full API/market pass, task424 closure, launch GO or runtime grant claimed.
