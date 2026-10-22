# Task499 — bounded source-only blocker checkpoint

Base: `5526991b45eb8cf93eeda23205f8341b5637ae90`.
Branch: `tixmo/task-499-http-last-ten`.
Worktree: `/home/daniel/projects/projectTixmo/worktrees/task-499`.
No test or product files changed. Task remains REVIEW, not implemented/done.

## Inspected existing solutions

Read task499 acceptance, parent246 and accepted376/390/401/284 notes; team
README/PROJECT_BRIEF/ROLES/WORKFLOW and backend/repository AGENTS instructions.
Inspected existing Jest config, package scripts, setup, verification-safety,
app, orders controller/service, current `orders-http-pressure.local.test.ts`,
379 runner/guard references and 493 source/checker/handoff. Read actual284
fixture via `git show 4cae9eb99b29714e190aa09ae5a6993cad51425b:tixmoapi2/tests/integration/orders-last-ten.local.test.ts`.
Existing Jest/Supertest is appropriate; no framework/dependency is missing.

## Precise blocker — no speculative scaffold

The available HTTP test is not a reusable fail-closed lifecycle seam meeting
499's additional failure-containment criteria:

- `orders-http-pressure.local.test.ts:142-146` unconditionally awaits monitor
  and all request wrappers without a bounded failure latch. A stuck observer
  blocks later diagnostics/teardown. Merely racing those joins against a timer
  would allow raw SQL/HTTP operations to outlive wrappers; it is NOT cancellation.
- Setup creates org before registering an identifier; only eventId is retained
  for cancellation. This is sufficient only under the old exclusively disposable
  runtime/process ownership contract, not a complete preallocated owned-fixture
  inventory for partial/ambiguous setup and a foreign-fixture sentinel.
- Existing finally cancellation and disconnect stages catch errors and continue
  (`148-167`); there is no permanent latch preventing subsequent SQL/disconnect
  after a newly bounded but unresolved raw operation. Original test intentionally
  relies on external owned-process/disposable-target reaping on timeout.
- 493 supplies an informative SQL observer latch (permanent preserve/no cleanup,
  no disconnect/next fixture), not an exported HTTP acquisition/request/server
  lifecycle. Copying its SQL-only wrapper would not establish settlement of
  Supertest requests, middleware work, server close or Redis operations.
- Existing reviewed379 runner line163 hardcodes the original HTTP100 test.
  It is not a currently reviewed execution path for a new last-ten file.
  No runner change/new runner is introduced or authorized by this checkpoint.

Therefore the requested four-minute checkpoint takes task499's explicit
"if no safe reusable lifecycle report precise blocker" branch. No unreviewed
HTTP lifecycle abstraction, copied generic runner or partially safe test is
added. This does NOT invalidate historical390's bounded successful execution;
its maxActive2 result remains exactly that historical scope.

## Concrete follow-up acceptance within existing stack

A PM-scoped source-only continuation should establish/review the minimal
HTTP-specific lifecycle using existing Jest/Supertest (not a new framework):
preallocate all synthetic fixture IDs before writes; track raw setup/request/
observer/teardown work; stop admission and permanently preserve owned IDs on
uncertain settlement; do not cancel inventory/delete fixtures/disconnect while
raw work is unresolved. External owned-process/disposable-target reaping is
required before reuse on this failure path. Timers only detect failure.
Then prepare one last-ten test, preserving originals:

- 100 current-version authenticated synthetic buyers, real Redis and same IP;
  one barrier release, measure real request start-to-settlement maxInFlight,
  never label release as 100 simultaneous server-side buyers.
- Actual controller/service contract: 10 HTTP201 and 90 HTTP400 with exact
  `Not enough tickets available`; 409 lock conflicts, 429, 503, status0 and all
  other errors remain failures, never relabeled sold-out.
- Exactly 10 unique order IDs/order numbers/buyers and 10 unique HELD ticket
  IDs/barcodes with order correspondence; PENDING/no payment intent; stock
  available/held/sold `0/10/0`; cancel only owned orders and assert `10/0/0`.
- Capture foreign-fixture before/after snapshots and prove unchanged before
  deleting only registered owned rows. Record per-attempt statuses and honest
  maxInFlight, including failure diagnostics when safely possible.
- Guard before app/resource acquisition; connect real owned Redis before app
  import; register only owned IPv4 listener with existing network guard.
  Import app, never bootstrap/jobs; notification calls fail closed and no
  payment/mail/provider routes. Later execution needs separately reviewed
  admission/runner selection and fresh explicit sole-disposable-DB grant.

## Actual inert checks and limits

After reading scripts, only source text was read and TypeScript stripped and
parsed as unlinked, unevaluated VM modules for existing379 HTTP and493 SQL
files. Static source assertions verified the lifecycle observations above.
`git diff --check` and staged whitespace check passed. This is syntax/source
inspection only; no new executable acceptance test and no lifecycle proof.

No app imports/module evaluation, Jest/collection, typecheck, SQL, DB/Redis,
HTTP/listeners/services/runtime/network, install/generation, env/secrets/config,
provider/spend/push/merge/deploy. Jest setup bootstraps schema, so it was NOT run.
No capacity PASS or runtime grant. Independent lead AND QA must inspect this
exact committed checkpoint; PM queues any continuation next cycle. Full246 and
its prerequisites remain OPEN. Task499 must not be closed as implementation.

## Additional426/448 reuse assessment (parent-requested checkpoint follow-up)

Read exact426 `510824df9e9bb7f5e57984862728b52929f7f849` qualification
source, lifecycle.cjs and middleware-lifetime.cjs; read exact448
`843f0245eed7567350185190f85a6aefe60ecbef` complete RUNNER-CHECKPOINT.
These commits are separate unmerged inputs, not present on assigned5526991 base.

Correction/qualification to "no reusable seam": **426 does provide a candidate
bounded mutable-work tracker and promiseMiddleware continuation wrapper.** It
must be reused as the starting point rather than inventing another tracker.
Its qualification instruments catchAsync, auth, waitingRoom, validation, limiter
continuations and detached Redis work before importing app. This is materially
stronger than379's client-wrapper joins. Its finalize gates instrumentation
restoration and disconnect on successful work.join; timeout is not cancellation.

It is not a drop-in499 seam: setup fixtures/snapshot queries/cancellation are
outside work.run; no preallocated fixture inventory or permanent suite-admission
latch is supplied. The test exercises three gated abort phases plus one healthy
request, not100 barrier-released requests and last-ten cancellation/sentinel
invariants. Server socket drain precedes bounded mutable join and itself awaits
server.close without a deadline. 448's shell still refuses all runtime admission;
its stubborn DIRECT-child proof is not full escaped-tree/process containment.
These observations do not require changing the independently reviewed426/448
files and do not dispute their deliberately bounded acceptance.

Smallest next SOURCE prerequisite: apply/reuse426 tracker + continuation
instrumentation in an opt-in499 qualification source, preallocate whole owned
fixture inventory and integrate493's permanent uncertain-settlement latch around
ALL raw acquisition/setup/request/observer/cancellation/close work. Prove with
extracted-helper fakes that unresolved server-side continuation prevents cleanup,
disconnect and new fixture admission even after HTTP wrapper settlement. Then
add last-ten assertions above. No process helper/runner rewrite or completion
of all448 runtime gaps is required merely to prepare this source; **the blocker
here is safe bounded source adaptation within the checkpoint, not permission
or a missing library.** This checkpoint supplies evidence instead of guessing
that copied wrappers establish request lifetime. PM should queue that precise
continuation next cycle. No426/448 probe or application code was executed here.
