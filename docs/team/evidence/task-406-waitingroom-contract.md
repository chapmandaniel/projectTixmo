# #406: current waiting-room gaps and bounded phase-1 contract

Source-only qualification, 2026-10-21. Parent #404. Exact audited base:
`971275ba7c87b7d6d3d8831d6334922dcf618a05`.
Branch `tixmo/task-406-waitingroom-contract`; isolated worktree `task-406`.
This is a repair contract, not implementation, capacity certification, or release approval.
Line references below refer to that base, not historical `2f3a055`.

## Existing-solution preflight

Inspected existing manifests and implementation offline: Express 4 routers,
Redis 4 request leases, express-rate-limit/rate-limit-redis, Axios, Jest and
Vitest already cover the required mechanisms. Reuse these; rate limiting is
not a replacement for concurrent-request leases. No new library, hosted queue,
plugin, service, admission-token authority, edge layer or POS is needed for
phase 1. No network discovery performed under this task's source-only boundary.

## Current-gap matrix

| Area | Exact source evidence | Current conclusion / phase-1 disposition |
| --- | --- | --- |
| Historical permanent counter drift | `tixmoapi2/src/middleware/waitingRoom.ts:7-24,36-56,63-95` | #404's INCR/DECR/no-TTL account is stale. Atomic Redis-time sorted-set leases prune expiry; key TTL is twice the 120s lease; renewal every 30s; finish/close/aborted handlers attach before acquire; token removal is idempotent, including uncertain acquisition. Preserve, do not replace with per-process counter. |
| Root operational endpoints | `waitingRoom.ts:28`; `src/app.ts:103-124` | `/health`, `/ready`, `/metrics` already bypass leases. `/ready` can legitimately return unrelated 503. No `/metrics` handler is mounted in app.ts: bypass does not establish endpoint existence. Preserve bypasses. |
| Versioned health | `src/api/index.ts:32-39,66`; `src/app.ts:73,147` | `/api/v1/health` is currently limited: full req.path at global middleware is not `/health`. Router-local admission removes that contention too. Version defaults to v1 (`src/config/environment.ts:49`). |
| Checkout writes | `src/api/orders/routes.ts:11,60`; `src/api/payments/routes.ts:49-54` | Only POST `/api/{version}/orders` and POST `/api/{version}/payments/create-intent` should acquire phase-1 leases, after existing authentication/validation and before controller execution. Same Redis key/cap shared across these two operations and instances. |
| Stripe confirmation | `src/app.ts:55-64,73,147`; `src/api/index.ts:57`; `src/api/payments/routes.ts:67` | POST `/api/v1/payments/webhook` raw parser is earlier, but controller remains behind global admission. Saturation can reject confirmation before signature handling. Remove this lease contention without moving raw parsing, signature checks or payment lifecycle. |
| Scanner device and offline paths | `src/api/index.ts:51,53`; `src/api/scanners/routes.ts:50,85,118,165,213,256,308,340`; `src/api/tickets/routes.ts:81-84,116-119` | All scanner routes currently contend: POST `/scanners/register`, `/auth`, `/validate` (offline scan upload), `/scan`; GET `/scanners`, `/sync`, `/logs`, `/:id`. Also POST `/tickets/validate` and `/tickets/check-in`. All must bypass phase-1 admission. These paths are under `/api/{version}`. |
| Login/session | `src/api/index.ts:42`; `src/api/auth/routes.ts:14,101,168,226,260,294` | `/auth/accept-invitation`, `/register`, `/login`, `/refresh`, `/logout`, `/me` all currently cross global admission despite independent auth rate limits. Router-local checkout admission exempts them, preserving auth controls. |
| Organizer/admin/recovery | `src/api/index.ts:43-63`; `src/api/users/routes.ts:189`; `src/api/organizations/routes.ts:174`; `src/api/orders/routes.ts:13,95,125,155-156,194` | No separate mounted `/admin` router. Role-gated DELETE `/users/:id`, DELETE `/organizations/:id`, POST `/orders/:id/refund`, plus organizer list/read/cancel/receipt/request-refund paths all contend today. Remove lease contention for every non-target route, not a guessed `/admin` exemption. Approvals/assets/reports/events/analytics similarly bypass. |
| Docs / unmatched requests | `src/app.ts:73,137-150`; `src/api/index.ts:60` | Swagger `/api/v1/docs`, versioned docs router and unmatched paths cross admission today. Route-local mounting removes them from lease accounting. |
| Capacity | `waitingRoom.ts:65`; `src/config/environment.ts:43-58` | Redis acquisition hardcodes `5000`. It counts active admitted requests, not users; no fairness/place in line. Source does not establish actual DB pool size or safe launch capacity. Add strict configuration; do not claim guessed pool=10 or cap=5000 is safe. |
| 503 response / UI | `waitingRoom.ts:72-76`; `tdash/src/lib/api.js:129-146`; `tdash/src/App.jsx:149-160,286-287` | No explicit admission marker or Retry-After header; all Axios 503s trigger waiting-room event. App also suppresses generic 503 global errors. Fix both producer and consumers; otherwise unmarked errors silently disappear. |
| Misleading queue UI | `tdash/src/features/WaitingRoomView.jsx:20-43`; `App.jsx:287` | Claims "in line"/"lose your place" without queue state; retry merely dismisses overlay. Use busy/retry wording, no fairness claim or automatic replay of checkout POSTs. |

## Smallest bounded repair contract (future implementation)

1. Backend owns `tixmoapi2/src/app.ts`, `src/api/orders/routes.ts`,
   `src/api/payments/routes.ts`, `src/middleware/waitingRoom.ts`,
   `src/config/environment.ts`, and focused tests. Remove only global
   `app.use(waitingRoom)`/unused import. Mount waitingRoom explicitly in the
   two POST handlers above after their existing auth/validation. Do not mount
   on the whole orders/payments router or implement URL-prefix skip lists.
   All callers of these operations share admission regardless of role; there
   is no speculative POS/role bypass inside checkout.
2. Preserve lease scripts/key, timing, renewal, registration-before-acquire,
   release-once, close/abort handling and Redis fail-open policy unchanged.
   Fail-open is existing behavior, not a guarantee under Redis outage. No
   inventory/payment service, schema, migration, expiry-job or webhook changes.
3. Add `WAITING_ROOM_MAX_CONCURRENT_REQUESTS` ->
   `config.waitingRoomMaxConcurrentRequests`: strict positive safe integer;
   reject blank, zero, negative, fractional, junk or overflow explicit values.
   Absent value retains 5000 solely for backward compatibility. Pass its
   decimal string to existing acquire Lua. Document that launch requires a
   separately evidenced aggregate checkout capacity budget (all instances,
   DB pool headroom for scanners/webhooks/recovery, representative workload).
   No production env change or invented safe number in this patch.
4. Admission rejection contract: HTTP 503, JSON
   `{ code: 'WAITING_ROOM_ACTIVE', message: <existing message>, retryAfter: N }`,
   with integer `Retry-After: N` seconds and `Cache-Control: no-store`.
   Use bounded N=5..7 seconds (jitter), identical in body/header; inject/mock
   randomness in tests, never timing-based assertions. Keep release semantics
   unchanged for rejections. Body marker avoids needing CORS exposed headers.
5. Frontend owns `tdash/src/lib/api.js`, `src/App.jsx`,
   `src/features/WaitingRoomView.jsx` and focused tests. Dispatch waiting-room
   event only for status 503 AND exact body code `WAITING_ROOM_ACTIVE`;
   include validated retryAfter in event detail (fallback 5 for invalid data).
   Unmarked 503 follows existing global-error path, and App must allow 503
   there (retain 401 behavior). Preserve stale-session guard and refresh logic.
   Use retry delay to gate manual dismiss/retry, busy-state wording, no place
   in line claims; do not automatically replay orders/intents or erase forms.

## Required tests / acceptance for implementation and independent QA

- Extend `tixmoapi2/tests/unit/waiting-room.test.ts`: retain all seven current
  cases; add `/ready` bypass (currently omitted), configured acquire argument,
  marker/header/body and jitter-bound agreement. Add fake-clock renewal and
  terminal timer cleanup coverage; no lifecycle rewrite to make tests pass.
- Add `tixmoapi2/tests/unit/waiting-room-routes.test.ts`: exercise actual app
  mounts with mocked controllers/auth/validation/dependencies. At forced full
  capacity only the two target POST handlers return marked 503; their
  controllers are not invoked. Auth/validation failures must not acquire.
  Test both orders and create-intent; trailing slash/query-string variants
  must behave as Express routes. Parameterize every scanner route above,
  auth routes, webhook, tickets validate/check-in, admin role routes,
  orders read/cancel/refund/receipt, root/versioned health and docs. Assert
  no admission eval, and normal handler/auth response rather than asserting
  every exempt endpoint succeeds unauthenticated. Preserve raw webhook body
  delivery to mocked signature/controller boundary.
- Add `tixmoapi2/tests/unit/waiting-room-config.test.ts` for absent/default,
  valid override and explicit invalid values; isolate imports/environment.
- Add `tdash/src/test/api-waiting-room.test.js`, reusing the Axios adapter
  pattern in `api-session-races.test.js`: marked/unmarked 503, non-503 marker,
  malformed delay, stale-session error suppression, no automatic write retry.
  Add `tdash/src/test/AppWaitingRoom.test.jsx`: only admission event displays
  busy view; unmarked 503 renders global error; delay gates manual action;
  copy has no queue/place claim; existing auth/session cases remain green.
- Existing `scripts/waiting-room-redis.test.cjs:10-35` already covers two-client
  atomic capacity, same-token idempotence, expiry replacement and duplicate
  removal against explicit disposable loopback Redis. Reuse, do not replace
  this with mocked Redis evidence. It imports built `dist`: require matching
  fresh build before executing. It does not test full renewal/HTTP lifecycle.
- Future focused commands: API Jest with `--runInBand --runTestsByPath` for
  the three named API suites; dashboard Vitest `--run` for new suites plus
  `api-session-races`, `AppSession`, `AppCheckoutReturn`. Use repository tools,
  not installs. **Default API Jest setup calls `bootstrapTestDatabase`**
  (`tixmoapi2/tests/setup.ts:8-9`); even unit runs require separately approved,
  coordinated disposable DB/Redis setup or an explicitly reviewed isolated
  mock-only setup. Never bypass the safety guard to obtain a green run.
- Later QA/release: fresh API/dashboard builds, dashboard design guard,
  authorized disposable Redis script and `verify:api` after reading verifier
  safety instructions. Full gate/load/abort testing is not performed here.
  Acceptance must distinguish passing route/lease tests from measured safe
  capacity: no source-only launch-capacity claim.

## Integration boundaries and current verification

Freeze the response contract first. Backend/API-marker change must precede
or ship atomically with marker-only frontend: frontend first would classify
old backend overload as generic error. One serial integration owner reconciles
app/route edits against the reviewed candidate; independent QA reviews exact
result SHA and reruns relevant checks. This document author cannot approve
their own repair. No merge/deploy is authorized; #404 phases 2/3 stay backlog.

This task inspected source, manifests, existing test bodies, Git base/status
and worktree inventory. Only this Markdown file changes. `git diff --check`
is the deliverable check; no npm lifecycle, build, tests, DB, Redis, services,
network, provider, credentials, config, scheduler or cloud actions performed.
Existing historical test descriptions are not fresh passing test evidence.
Result SHA and exact check outcomes are recorded on #406 at review handoff.
