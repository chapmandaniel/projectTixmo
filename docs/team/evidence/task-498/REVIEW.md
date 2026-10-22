# Independent lead498 R3 - APPROVE (source-only)

Exact target: `5526991b45eb8cf93eeda23205f8341b5637ae90`.
Comparison base: `9fb2cdf41109676dcc5aa360d99f9d4cf7a3b60b`.
Reviewer branch: `tixmo/task-498-independent-lead-r3`.
New isolated worktree: `/home/daniel/projects/projectTixmo/worktrees/task-498`.
No author/product source edits. Shared main's unrelated untracked files preserved.

Read lead/repository/team instructions, mine/inbox and complete498/493 history;
claimed exact498. Read immutable lead496 report
`689ed441741cc58f310b5daca3ca61cd142c66d9`, QA497 report and probe
`c48777b7e2c338d486fe0846bfbed6805e243a9d`, actual493 HANDOFF, checker,
full focused test source and exact R3 diff. No recursive delegation.

## Decision and control-flow review

No blocking findings in this bounded source review. The previous observer P2
is repaired using the explicitly allowed conservative-preservation alternative,
not actual observer cancellation or drainage. The only test-source changes are
the observe helper and replacing the polling bounded call with observe.

Observe awaits bounded and catches every rejection, calling preserve before
rethrowing. Therefore the observer timeout/raw query rejection sets failClosed
before concurrency finally releases/drains requests and before the owned body
can settle and remove itself from live. The raw query can remain alive after
its race wrapper and body settle; unlike R2, that no longer permits teardown.
The latch has no clearing path. Subsequent preserve calls replace its Error
but remain latched and include the still-owned fixture UUIDs.

beforeEach throws before subsequent fixture SQL admission; afterEach throws
before cleanup and still runs fallback restorers in finally; afterAll throws
before disconnect. Late raw observer success or rejection does not clear the
latch. A synchronous failure before observe is invoked cannot detach an async
observer query: the polling async IIFE converts its synchronous throws into a
rejected promise consumed by observe. When the observer succeeds normally it
has awaited its raw query/poll operations, and the existing request ownership
rules apply. Poll expiration without observed blocking settles the observer;
the unchanged blocking assertion then fails without a detached raw query.

The existing request drain remains bounded Promise.allSettled with nested
finally spy restoration; afterEach retains fallback restoration. UUIDs remain
allocated/registered before first INSERT, and partial setup cleanup remains
UUID-scoped and FK-ordered: audit, ticket, order, type, event, user, organization.
No product audit retention/RESTRICT rule or service behavior changed. Exact
R3 diff shows all original multiline assertions and these lifecycle mechanisms
unchanged, in addition to the41 assertion-start-line comparison below.

## Extracted regression linkage and actual checks

Inspected scripts before execution: built-in fs/path/module/vm/assert only.
The author checker strips the actual test source and constructs an unlinked,
unevaluated SourceTextModule; only helper/hook text from gate to before fixture
is evaluated separately with fake hooks/timers/Prisma. It asserts the real poll
callsite uses observe and that an owned body leaves live while its raw observer
remains pending, with hooks denied, restoration performed and late-settle latch.
This is actual-helper control-flow evidence, not a duplicated latch model.

Also inspected the complete immutable QA497 probe, copied it byte-for-byte into
this report directory, and independently executed it against this checkout.
`check-observer.cjs` is reused QA-authored evidence, not claimed as newly authored
lead coverage. Fresh contexts exercise timeout, immediate rejection and success.
Failure cases assert latch inside the body's finally while live still contains
the body (therefore before removal), retained fixture IDs, zero cleanup and
disconnect, denied admission, fallback restoration and denial after late settle.
The success control admits cleanup/disconnect once each with no latch. Fake
transaction does NOT execute its SQL callback; FK compatibility is not tested.
Source inspection establishes ordering before request drain, which these helper
probes do not execute as a whole concurrency test.

Actual commands/results:

- `node --experimental-vm-modules docs/team/evidence/task-493/check-source.cjs`:
  exit0, unlinked TS parse,17 static markers and deferred-observer probe PASS.
- `node docs/team/evidence/task-498/check-observer.cjs`: exit0, inspected reused
  QA497 actual-helper timeout/rejection/success probes PASS.
- Inspected inline standard-library Python: git-show original
  `2a3de901c2297381c9ef5cb816405b0ec981cf9e` versus current test, compare lines
  starting expect/await expect: exit0, all41 identical and in order. Preservation
  evidence only; no assertions executed. Exact R3 source diff also reviewed.
- `git diff --check 9fb2cdf41109676dcc5aa360d99f9d4cf7a3b60b 5526991b45eb8cf93eeda23205f8341b5637ae90`:
  exit0. Staged report/probe whitespace check required before commit.

Node emitted experimental strip/VM warnings only. No failed review checks.

## Limits and disposition

APPROVE independent lead source readiness only. SQL/Jest/typecheck/generated
client/runtime compatibility NOT RUN or established. No app imports or whole
module evaluation, DB/services/schema generation/migration, network/install,
env/secrets/config/scheduler/provider/production/spend/push/merge/deploy.

Timers do not cancel SQL; the latch does not stop already-running bodies or
polling operations, which may later settle/commit. External sole-owned process
and exclusively disposable-target reaping with owned-ID evidence preservation
remains required before reuse, under a separately scoped runtime grant.
Historical replay/conflict/no-op, pause/resume conjunction and real-holder-PID
expectations remain prepared source, not SQL proof. Audit-first FK failure is
unchanged-state atomicity, not rollback of an earlier flag write; stale generic
payload is sequential, not overlap qualification. Mounted auth/tenant and wider
launch gates remain outside scope.

Complete review498 only; do not close493 here. QA497 is separate exact-SHA
evidence; PM controls493 disposition. Full248/243/launch remain OPEN and this
report grants no runtime or release authority.
