# Task378 independent QA document review

2026-10-21, tixmo-qa. **PASS bounded source/document preparation, with a minor
wording correction recorded below.** Exact reviewed SHA
`024e15f107d20af08f9c037bc463b9dd6836ac2b`, parent/product
`80c6710b89d147588e1514aa99a4e55c5630d38a`. Isolated branch
`tixmo/task-378-review`, worktree `/home/daniel/projects/projectTixmo/worktrees/task-378`.
Only this review receipt added; no product/harness implementation.

## Independent findings

- Original246 numeric acceptance is mapped accurately: 100/250/500 sessions,
  200-session30min soak, 30/sec60sec,100 buyers last10, readp95<=500ms,
  reservationp95<=2s, unexpected5xx<0.5%, paid-ticketp95<=30s,
  healthyrecovery<=5min and zero oversell/duplicate charge/fulfillment. Resource,
  queue, same-IP measurements and fixture resets are acknowledged. Full execution
  remains gated by W04/W06-W08; preparation is independently permitted.
- Board284/287 independently corroborate the cited historical service-only
  outcomes and exact product4ec85948. QA286 p951171.635ms/69waiters and QA289
  p9524.786ms/maxbacklog2 are faithfully scoped; no HTTP/session/Redis behavior,
  payment/fulfillment/SLA pass is imported into current acceptance.
- Independently inspected complete scoped old-to-current diff. Exactly three
  modified source files; createOrder unchanged, orders cancellation/refund and
  payments refund observation fencing changed. App/auth/limiter/waitingroom,
  schema/migrations/scripts unchanged in that diff. Narrow reservation source
  parity is supported; no current execution parity inferred.
- Minor factual wording correction: paid-sales-query.ts is **modified, not new**.
  It already exists at4ec85948; current change normalizes bound dates through
  timestamptz AT TIME ZONE UTC. Both README phrases calling it new/added should
  be read as an existing helper changed. Does not affect proposed reservation
  slice or map acceptance; do not propagate claim of a newly introduced file.
- Exact routes/HTTP201 order response, authentication, optionalAuthenticate before
  separate Redis-backed read/write limiters and waitingRoom before these match
  source. Auth middleware resolves current account session; seeded tokens must
  carry matching version and belong to enabled current users. Pre-auth fixtures
  avoid shared-IP register/login budget; same forwarded IP does not test deployed
  proxy trust. Distinct authenticated users are user-keyed, not one shared API key.
- Limiter budgets/windows/strict-header claims match source/config. Waiting room
  is active REQUEST leases,5000 ceiling/120s lease/30s renewal, fail-open Redis and
 503/retryAfter5, not FIFO/session admission. Real Redis and rate-limit-redis are
  globally mocked in tests/setup.ts; explicit unmock/connect before app import
  is required, with real lease/key assertions to avoid accidental mock evidence.
- Existing Jest/Supertest and historical287 scheduler/runner are adequate reuse
  seams. Source inspection supports ONE100-actor HTTP slice feasibility: 100
  same-IP preauthenticated GET+order pairs,30 arrivals/sec (~3.34s, not60s),
  stock100/cap4, expected100200+100201, exact pending/HELD/uniqueness counters,
  cancellation restoration, lease cleanup, route latencies/resource/backlog
  metrics. No payment-intent/provider endpoint is needed. Run is not browser
  sessions, login storm, strict limiter or ceiling/recovery/fulfillment proof.
- Proposed ownership/env-i/loopback/PID/listener/restrictive-disk/timeouts/cleanup
  safeguards align with existing historical runner. Jest setup itself calls
  bootstrapTestDatabase and accepts destructive schema push: verify target before
  any test import. verification-safety requires tixmo_disposable_* plus Redis/1..15;
  test-target.cjs uses tixmo_test_* and a different opt-in. These are distinct,
  incompatible DB-name contracts, NOT simultaneously satisfiable. For proposed
  Jest runner use its actual verification-safety contract; document phrase
  'honor whichever setup is used' is appropriately conditional, not permission
  to weaken either guard. Existing npx bootstrap must resolve installed Prisma
  locally without download; implementation must enforce no-install/no-network.

## Exact commands / status

All source/document-only in task378 worktree unless noted. No tests executed.

- `kanban show 378`, `kanban show 376`, `kanban show 246`, `kanban claim 378`
  with KANBAN_AGENT=tixmo-qa KANBAN_PROJECT=tixmo: each exit0.
- `cat docs/team/evidence/task-376/README.md docs/team/evidence/task-376/source-check.txt`: exit0.
- `kanban show 284`, `kanban show 287` under same identity: each exit0.
- `git rev-parse HEAD HEAD^`: exit0, exact SHAs above.
- `git diff --check HEAD^ HEAD`: exit0.
- `git diff --name-status 4ec85948 80c6710b -- tixmoapi2/src tixmoapi2/prisma scripts`: exit0, three M entries.
- `git diff 4ec85948 80c6710b -- tixmoapi2/src/api/orders/service.ts tixmoapi2/src/api/payments/service.ts tixmoapi2/src/services/paid-sales-query.ts`: exit0; full diff inspected.
- `cat tixmoapi2/src/middleware/rateLimiter.ts tixmoapi2/src/middleware/waitingRoom.ts tixmoapi2/src/middleware/auth.ts`: exit0.
- `cat tixmoapi2/tests/setup.ts` and `cat scripts/verification-safety.cjs`: exit0.
- `rg -n 'events/public|/public|publicRouter|slug|rateLimit' tixmoapi2/src/api/index.ts tixmoapi2/src/api/events/routes.ts tixmoapi2/src/config/environment.ts`: exit0.
- `git show c0c41a07:docs/team/evidence/task-287-local-pressure/runtime.sh | head -65`: exit0, read historical safety/ownership/cleanup source only.
- `cat tixmoapi2/src/api/events/public.routes.ts`, relevant environment.ts/JWT/
  accountSession.ts source reads: exit0. No environment files or secrets read.

## Limits / handoff

Harness explicitly NOT IMPLEMENTED. Proposed command is a future handoff, NOT a
runnable delivered artifact or test pass. No runtime/tests/services/DB/network,
install/secrets/.env/config/provider/spend/push/merge/deploy. Source text and
historical board evidence cannot prove present performance or environment safety.
No blocking bounded-map finding; correction above is documentary and nonblocking.
Task378 closes this independent receipt only; PM owns376 closure;246 remains OPEN.
A new author commit invalidates this exact-doc-SHA review. Future implementation
requires fresh bounded assignment and coordinated sole DB owner before execution.
