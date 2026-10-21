# W09 exact-candidate source reconciliation (2026-10-21)

Task #376, documentation/source preparation only. Product/base:
`80c6710b89d147588e1514aa99a4e55c5630d38a`.
Branch `tixmo/task-376-capacity-map`; isolated worktree `worktrees/task-376`.
No runtime, services, DB, tests, installs, network, providers or configuration changes.
Independent QA of this exact documentation commit is required. #246 stays OPEN;
its W04/W06-W08 prerequisites still gate the full capacity execution. Preparation
is independently authorized by original #246, not contingent on QA #375.

## Existing solutions inspected

Root package scripts, `scripts/`, API Jest/Supertest suites and historical task
branches were inspected before proposing anything. No dedicated k6/Artillery/
Locust/session-ramp harness exists in this candidate's tracked files. Use the
existing Jest/Supertest stack; no new load framework or paid service is needed.

- Existing `scripts/local-checkout-smoke.mjs` is ONE buyer, registration, public
  event, order, payment-intent, cancellation; it accepts an arbitrary URL and
  inherited environment. It is NOT a safe capacity runner and must not be run
  unchanged for this slice (payment/provider path and missing loopback guard).
- Existing `tixmoapi2/tests/integration/orders.test.ts` provides real app HTTP
  order contracts via Supertest; `tests/utils/testUtils.ts` provides fixtures.
- Historical accepted pressure harness at
  `c0c41a07f6ef72f27e1c4d35551edc147db1bcad:tixmoapi2/tests/integration/orders-pressure.local.test.ts`
  schedules 1800 arrivals, caps 30 active service calls and records backlog,
  arrival lateness, service/end-to-end latency, event-loop and PG lock samples.
  Its runner is the same commit's
  `docs/team/evidence/task-287-local-pressure/runtime.sh`. Neither file is
  integrated in current candidate. Reuse/adapt these existing tools, not a
  parallel orchestration framework. Hardcoded task/artifact paths require new
  ownership and must not overwrite historical evidence.

## Historical evidence versus current source

#284 accepted evidence `5947e4737410c6ed732230eb84581dcb87f8ed83`, tested
harness `4cae9eb99b29714e190aa09ae5a6993cad51425b`, product
`4ec8594850eb547dafc145a14bb1b85cdeaa235c`; independent QA #286:
100 concurrent real OrderService calls, 10 reservations/90 specific sold-out,
zero other errors, stock 0 available/10 held/0 sold, cap/rollback/uniqueness;
69 observed lock waiters. QA race p95 1171.635ms includes lock gating.

#287 accepted evidence `c0c41a07f6ef72f27e1c4d35551edc147db1bcad`, tested
harness short SHA `4b3dcd8`, same old product; independent QA #289 evidence
`0e4879c`: 1800 attempts/60s, 900 reservations/900 sold-out, GA 1800 held,
VIP 200 untouched, unique orders/tickets, final backlog zero/max two;
service-path p95 24.786ms. Arrival buckets are not proof of exactly 30 each
wall-clock second. Neither result measures HTTP, auth, Redis behavior,
sessions, payment, fulfillment, recovery or launch SLA.

Exact `git diff 4ec85948 80c6710b -- tixmoapi2/src tixmoapi2/prisma scripts`
changes only orders/service.ts, payments/service.ts and the new
services/paid-sales-query.ts. `createOrder` and its event/type/promo SQL locking
and conditional stock update are unchanged; schema/migrations, app, auth,
limiter, waiting-room and scripts are unchanged. Orders changes fence stale
cancel/refund observations; payment change fences refund observations; paid
sales query is added. Thus reservation-path source parity is narrow and
explicit, NOT whole-file parity or a current runtime pass. Replaying old tests
would still require current exact harness/product verification and independent
QA; cancellation/recovery/refund conclusions cannot inherit old evidence.
The dated #295 index `0cac3d60212e621607a22a5947816799d608525b` remains a
historical index, not this candidate's acceptance.

## Acceptance map against original #246

| Criterion | Existing evidence / current gap |
| --- | --- |
| 100/250/500 sessions | #284's 100 buyers are service calls, not sessions; all three HTTP/session ramps remain unproved. 1000 stress is not promised. |
| 200 sessions, 30-minute soak | No session/soak harness or current result found. Fixture reset required between scenarios. |
| 30 order attempts/sec for 60 sec | Historical #287 service-only scoped PASS above; authenticated HTTP arrival fidelity and current runtime remain unproved. |
| 100 buyers for last ten | Historical #284 service-only scoped PASS; unchanged reservation source, not current HTTP race acceptance. Do not repeat merely to generate another green. |
| Read p95 <=500ms; reservation p95 <=2s | Historical service numbers are not HTTP latency/SLA. Capture request-start to complete separately by route/outcome and report p50/p95/p99/max. |
| Unexpected 5xx <0.5% | No current HTTP denominator. Classify sold-out 400 by exact message, expected auth/rate-limit outcomes, and waiting-room 503 separately; never silently exclude unexpected failures. |
| Zero oversell/duplicate charge/fulfillment | Historical inventory/order/barcode uniqueness only. No charges were made: duplicate-charge or fulfillment absence is NOT payment proof. |
| Paid-ticket p95 <=30s | Not exercised; local payment/notification mocks cannot establish provider delivery or real inbox receipt. |
| Healthy recovery <=5min | Not exercised under capacity; cancellation, expiry, Redis outage/lease recovery and backlog drain require bounded local acceptance and current source. |
| Locks/connections/CPU/memory/Redis/queue age | Old #284 lock waiters and #287 sampled lock/active DB/backlog/event-loop only. CPU/RSS, connection ceiling, actual Redis state, queue age and recovery timeline remain missing. A zero sampled waiter maximum is not absence of contention. |
| Same-IP/auth/HTTP/waiting-room | Service harness bypasses every seam. Exact source below identifies bounded missing slice; it is not fair-queue/session proof. |

## Exact HTTP seams and constraints

- `src/app.ts:25,73,147`: trust proxy=1; waitingRoom precedes
  `/api` optionalAuthenticate -> read/write limiters -> routes. A forwarded-IP
  test is not proof of trusted-proxy correctness in deployment.
- `src/api/orders/routes.ts`: authenticate all orders; POST `/api/v1/orders`
  validates items, creates pending inventory hold; GET `/api/v1/orders/:id/recovery`
  is status-only; POST `/:id/cancel` releases pending inventory.
- `src/middleware/rateLimiter.ts`: authenticated keys `user:<id>`, anonymous
  keys `ip:<req.ip>`; separate Redis read/write prefixes; auth excluded from
  API limiter. Auth has shared IP window 60s, production max20, development100,
  test100 or strict5. API window defaults 900000ms, production read600/write240;
  test hardcodes1000/1000, strict header forces read3/write2. Test strict is a
  contract probe, NOT production capacity configuration. Preparing 100 users by
  HTTP registration in one minute would contaminate same-IP auth budget.
- `src/middleware/waitingRoom.ts`: Redis sorted-set active REQUEST leases,
  ceiling5000, lease120s/renew30s; finish/close/abort releases; Redis unavailable
  fails open; full capacity returns503/retryAfter5. It is not a FIFO buyer room
  and 100/500 clients cannot alone prove ceiling behavior.
- `tests/setup.ts` mocks Redis and rate-limit-redis. Existing general Jest
  suite does not establish real Redis limits/leases. A missing HTTP pressure
  case must explicitly unmock both and connect owned Redis before app import.

## ONE next local missing harness slice (preparation, not executed)

Implement a bounded **100 pre-authenticated buyers, same-IP HTTP reservation
burst** in existing Jest/Supertest, based on exact product above, extending the
existing #287 scheduler/fixture/telemetry and #284 inventory assertions. No new
framework, no repeated full API suite, no payment-intent route.

1. New isolated task branch, sole DB owner scheduled by PM, new restrictive
   disk runtime/artifacts. Adapt #287 env-i runner with owned PG18/Redis,
   loopback/listener/PID verification, bounded statement/lock/outer timeouts,
   TERM/KILL cleanup and independent listener/postmaster/socket absence check.
   Inspect current `scripts/verification-safety.cjs` guard; don't weaken it.
   Existing `scripts/test-target.cjs` additionally requires NODE_ENV=test,
   TIXMO_ALLOW_TEST_RESET=true, explicit matching loopback TIXMO_TEST_DATABASE_URL
   named tixmo_test[_suffix]; honor whichever setup is used, no inherited URL.
2. Add ONE targeted `tests/integration/orders-http-pressure.local.test.ts`;
   use existing app/Supertest and owned Prisma fixtures. Preseed 100 synthetic
   users and valid access tokens locally before measurement (existing JWT
   utility), one published event/100 GA, cap4. Explicitly restore actual Redis
   module and rate-limit-redis instead of global mocks; retain provider/email
   isolation and no app server bootstrap jobs. Validate own fixture and tokens
   before timing. All requests same explicit X-Forwarded-For loopback identity,
   no x-test-rate-limit strict on measured burst.
3. Each of 100 distinct bearer users: GET `/api/v1/events/public/:slug`, then
   POST `/api/v1/orders` quantity1; dispatch 30 arrivals/sec for 100 arrivals
   (~3.34s), bounded 30 active/max100 queued. Record actual arrivals, completions,
   route percentiles, statuses/messages, backlog/age, PG locks/connections,
   process CPU/RSS and real Redis lease/limiter state. This is 100 synthetic
   authenticated request actors, not browser sessions or 60s burst proof.
4. Acceptance: 100 reads200/100 orders201, no 401/403/429/unexpected5xx, exact
   stock0available/100held/0sold,100 unique pending orders/HELD tickets/barcodes;
   readp95<=500ms/reservationp95<=2s (a local observation only). Drain backlog
   and observe lease removal. Cancel all owned pending orders outside timed
   window; assert100available/0held/0sold, no residual owned leases. Never call
   payment-intent, charge, webhook, receipt or provider routes.
5. Target command AFTER implementation and owner coordination, inside scrubbed
   guarded owned runner: `timeout --signal=TERM --kill-after=5s 110s npm --prefix
   tixmoapi2 test -- --runInBand --runTestsByPath
   tests/integration/orders-http-pressure.local.test.ts` (single shell line).
   This file does not yet exist; this is a precise implementation handoff, NOT
   a runnable artifact delivered or a claimed pass. Independent QA must review
   exact new harness/product and reproduce in its own owned runtime.

Limits: test1000/user limits do not verify production budgets, login storm,
strict limiter isolation or 5000-lease rejection. Those remain explicitly open,
as do 250/500 sessions, 30min soak, full60s HTTP burst, paid fulfillment and
five-minute recovery. No runtime work is authorized/executed by this document.

## Checks performed

Read board #376/#246/#284/#287/#295 including independent reviewer notes;
read required team docs; source/file-tree and old-to-current scoped diffs;
inspect historical harness/runner by exact Git objects. `git diff --check` and
source-parity/static evidence recorded in `source-check.txt`. No tests run.
