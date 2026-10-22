# Independent lead 496 R2 review - FINDING, not approved

Exact target: `9fb2cdf41109676dcc5aa360d99f9d4cf7a3b60b`.
Base: `6ab827bff6fdf67283b93f16612106f2217d4dc0`.
Original rejected source: `2a3de901c2297381c9ef5cb816405b0ec981cf9e`.
Prior immutable review: `3d7b5cfbc72c2cfb2ac9cb10d960fe041b5a51ff`.
Reviewer branch: `tixmo/task-496-independent-lead-r2`.
Isolated worktree: `/home/daniel/projects/projectTixmo/worktrees/task-496`.
Only this independent report added; no author/product edits.

## P2 - timed-out SQL observer is not owned/drained

`tixmoapi2/tests/integration/event-sales-pause.sql.test.ts:222` passes an
anonymous polling IIFE to `bounded`; its actual `prisma.$queryRaw` is at225.
The IIFE is not registered separately in `live` or `requests`. A timeout at
`bounded` does not cancel its query. Concrete source failure ordering:

1. Observer query stalls beyond the five-second race timer. The polling loop's
   three-second deadline is checked only between queries, not during the await.
2. The race rejects; concurrency finally releases the gate at244 and successfully
   drains the earlier/later service requests at245. Those requests do not include
   the observer. Its successful drain does not call `preserve`.
3. The test-body promise rejects/settles and `owned` removes it from `live` at32.
   The observer query is still pending, but afterEach's live snapshot at45 is
   empty. It proceeds to fixture SQL deletion at55 and eventual disconnect at73.

Thus R2 can still run cleanup/disconnect against an owned live query and permit
later SQL tests. This is not a claim of an observed database failure. The handoff
correctly warns timers are not cancellation, but its fail-closed containment
claim is incomplete for this path. Whole-body ownership does not imply ownership
of detached promises that the body stops awaiting after Promise.race rejects.

Minimal author repair: retain/track the actual observer work independently of
its timeout wrapper, and include it in bounded settlement before cleanup; latch
failClosed on unresolved observer work. Alternatively conservatively latch
failClosed on observer timeout before request-drain completion, preserve IDs,
restore spies, skip cleanup/disconnect/later SQL, and require external reaping.
Do not merely track the already-rejected race promise or swallow its timeout.
Preserve assertions and product code. A meaningful inert regression expectation
must distinguish underlying observer ownership from race-wrapper completion and
check the timeout-to-failClosed path before cleanup; a string marker for bounded
alone cannot prove this. Any deferred-promise model should be self-contained,
with no application imports, Jest evaluation, DB or services, and requires its
own script inspection before execution. Actual SQL fault qualification still
needs separately authorized runtime containment, not a source-model PASS.

## Accepted portions of the original two repairs

Fixture IDs are now allocated/registered before the first INSERT (79-80), so
partial/ambiguous setup remains identified. Cleanup uses owned UUID predicates
in FK-safe order: audit, tickets, orders, ticket type, event, user, organization
(57-63). Audit RESTRICT is unchanged; explicit synthetic audit deletion is not
a product retention exception. Current priced createOrder does not enter free
confirmation or create provider payment rows; current fixture relations support
this cleanup order. Actual SQL compatibility is NOT verified.

Service-request drain now has a five-second bound and nested finally spy
restoration (243-247). afterEach has fallback restoration and whole-body drain;
its 12s hook exceeds sequential five-second body-drain and five-second cleanup
budgets. Concurrency Jest budget is20s. Other tests use Jest's default budget;
when Jest times out it does not cancel their body. afterEach can await that body
for another5s, then latch failClosed, restore spies and skip teardown/disconnect
on unresolved body work. This is reasonable for tracked work, but does not
repair the detached-observer case above. A failClosed latch does not cancel
already-running bodies; external owner must retain evidence and reap the owned
process and exclusively disposable target before reuse. No runtime grant exists.

The original41 assertion-start lines are identical and ordered; manual R2 diff
also shows no multiline assertion weakening. Both real-lock orderings still
assert actual holder PID blocking before gate release and final stock/order/
audit state. Historical replay, changed-input conflict and no-op evidence checks
remain intact. Audit insertion precedes flag update in actual EventService:
real FK failure is planned unchanged-state atomicity, not rollback of an earlier
flag write. Generic stale payload remains sequential stale-writer coverage,
not an overlapped writer race. HTTP auth/tenant and broader runtime gates remain
outside this source-only review.

## Actual checks and boundaries

Read role/repository/team instructions, latest493/494/495/496 board state,
immutable494 report, R2 HANDOFF, checker and full test; inspected R2 diff,
current event/order services, Prisma relations and Jest config/setup as text.
Claimed only496 after list --mine/inbox. Shared main's unrelated untracked files
preserved; created a new isolated exact-target worktree.

- Inspected checker before execution: built-in fs/path/module/vm only; strips
  TypeScript and constructs unlinked/unevaluated SourceTextModule.
- `node --experimental-vm-modules docs/team/evidence/task-493/check-source.cjs`:
  exit0, syntax parse and17 static markers PASS. Experimental warnings observed.
  No application imports, linking/evaluation, typechecking or SQL proof.
- Inspected inline Python comparison: reads original source through git show and
  local text, compares lines starting expect/await expect; exit0, all41 identical
  and ordered. This is assertion-preservation evidence, not behavior execution.
- `git diff --check 6ab827bff6fdf67283b93f16612106f2217d4dc0 9fb2cdf41109676dcc5aa360d99f9d4cf7a3b60b`:
  exit0. Report staged whitespace check also required before commit.

SQL/Jest/runtime/typecheck NOT RUN. No application imports/evaluation, services,
DB/schema generation/migration, network/install/env/secrets/config/scheduler,
provider/production/spend/push/merge/deploy. Return the finding to the original
backend author;493 remains REVIEW pending repair and fresh exact-SHA independent
lead and QA. This report completes reviewer496 only, not acceptance of493.
Full248/243/launch remain OPEN; no runtime authorization or launch acceptance.
