# Task 294 — real-backend API-first checkpoint (NOT full-stack acceptance)

Product base: `4ec8594850eb547dafc145a14bb1b85cdeaa235c` unchanged.
Branch: `tixmo/task-294-real-auth`; isolated worktree `task-294`.

## Reproduce

From worktree root, link the existing matching-lockfile task235 API dependency
cache into `tixmoapi2/node_modules`, then run:

```
bash docs/team/evidence/task-294/runtime.sh
```

Runtime script adapted from reviewed task279 R2 `4c8561342268ffe764a1dd8abd6661488b63e3e5`.
It execs env-i before imports, skips dotenv with NODE_ENV=test, validates both
known disposable loopback targets and owned executable/PID/listeners, creates
0700 disk runtime under workspace/runtime/task294 (not /tmp), deploys schema,
then runs one bounded Jest acceptance test. API listens only on 127.0.0.1
and ephemeral port. The test closes its HTTP server and disconnects Redis and
Prisma; outer trap stops only owned PG18/Redis and records ports/PIDs.

## Actual assertions

- POST `/api/v1/auth/login` authenticates synthetic locally seeded A and B
  using actual password hash comparison, JWT generation, SQL session lookup.
- Wrong password returns 401. Correctly signed expired JWT returns 401.
- GET `/api/v1/tickets/mine` contains A's seeded ticket for A, not B.
- GET `/api/v1/tickets/:id/qr` produces a real PNG data URL for A.
- B gets 403/404 on A's ticket, QR and order detail; no barcode leaks.
- Incrementing SQL sessionVersion invalidates A's token (401); actual HTTP
  re-login restores read access to the same PAID order and wallet.
- Order row, ticket count, paymentAttempt count, and paymentRefund count remain
  unchanged across reads/re-login. Every stubbed provider method is uncalled.

## Boundaries and missing acceptance

Fixture is directly seeded PAID/SUCCEEDED with SOLD ticket: not a purchase,
webhook, confirmation, receipt/inbox, provider or financial-effect proof.
No authentication/authorization middleware, JWT/password/session, Prisma,
QR generator or route controller is mocked. Standard tests/setup.ts logger
mock remains; its global Redis and rate-limit-redis mocks are explicitly
unmocked, using real owned Redis. Stripe constructor/transports and entire
notificationService are inert mocks only to prevent external effects.

NO frontend/browser launched, so no browser process/profile to clean. Missing
link is actual App login -> actual backend wallet/QR -> expiry UI clear ->
B isolation -> return/re-auth recovery. Reviewed task280 synthetic-browser
proof does not bridge that link. Expiry here uses an explicitly signed expired
JWT, not elapsed-time waiting. Session revocation is direct SQL fixture change,
not user logout UX. No multiple-payment claim beyond unchanged local DB state
and uncalled synthetic Stripe methods. No live provider, inbox, credential
recovery, process restart, staging/device/production proof. Full W05 NO-GO.

Independent QA must check exact resulting harness SHA before accepting this
API-first checkpoint; this task does not self-certify full acceptance.

Commit tooling: checkout's configured pre-commit hook cannot source its absent
`tixmoapi2/.husky/_/husky.sh` after dependency unlink. Commit uses command-local
`core.hooksPath=/dev/null`; no persistent Git/host config change. Explicit
`bash -n`, `git diff --cached --check` and fresh runtime acceptance passed.
