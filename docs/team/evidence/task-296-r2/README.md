# Task296 R2 independent actual-browser / actual-backend QA

Reviewed exact source82a1d24f45d7ffcbc656ae2e22c23b48ac92ebc8, product4ec8594850eb547dafc145a14bb1b85cdeaa235c unchanged. Branch tixmo/review-296-r2, isolated worktree review-296-r2. Verdict PASS for the bounded actual App wallet/session/account-isolation slice ONLY. Prior QA91bbfb2 API-first verdict and295 dated documentation verdict remain separately valid, not rerun here.

## Inspection before execution

Exact git-object bytes and hashes verified for author runtime/browser/support/integration test/setup/verification safety/Redis client before adaptations. Only runtime task_root/artifact directory and browser output artifact path adapted for QA ownership; no product or assertion changes. Retained source-sha256.txt records original source. Test Redis/rate-limit-redis explicitly unmocked; real client database asserted1 matching REDIS_DB=1 and URL/1. Stripe constructor/transports, notification service inert and setup logger mocked; password/JWT/session/auth/Prisma/QR/controller middleware not mocked.

Read env-i runtime, destructive loopback disposable DB/Redis guards, exact executable/PID/listener checks and owned stop logic. Browser child gets scrubbed explicit fixture-only env. Vite configFile:false/envFile:false, exact owned loopback proxy target; test config clientUrl exact frontend origin set before app import (CORS test setup, no product policy bypass). CDP only continues allowed actual API requests, never fulfills synthetic responses. Other origins blocked. Qualified task288 private-font browser launcher read: dead proxy/exact loopback bypass/DNS restriction; application-level not kernel confinement.

## Actual commands/results

- bash -n docs/team/evidence/task-296-r2/runtime.sh: exit0.
- node --check scripts/browser/task-294-real-wallet.mjs: exit0.
- bash docs/team/evidence/task-296-r2/runtime.sh > docs/team/evidence/task-296-r2/runtime.log 2>&1: exit0. Fresh PG18 schema31 migrations, real Redis DB1, mounted API, Vite actual App, qualified Chromium. Jest1/1 PASS17.621s total,11275ms case.
- Audit result PASS, failures[];3 actual auth/login200;2 actual auth/refresh401, wallet401 during both revocations, wallet/QR200 on A. Browser flow actual A UI password login/wallet/QR -> SQL sessionVersion revoke -> actual refresh401/private identity and QR clear -> A UI re-login restores same order -> second revoke -> B UI login -> actual Page.reload -> B empty orders/tickets/no A order/QR. API assertions separately expiredJWT401/wrongpassword401/B direct order-ticket-QR denial; seeded order and ticket/attempt/refund counts unchanged and stub Stripe functions uncalled after browser. No finance mutation proof beyond those explicit invariants.
- Four fresh PNGs personally opened: A wallet with legible generated QR, signed-out empty private view, A restored wallet, B reload empty wallet. Later shots captured a dim transition frame but DOM assertions and HTTP statuses confirm intended state. QR PNG prefix/real library rendering, not optical decoding or gate admission. Displayed US$ is fixture/default display, not qualification of commercial CAD/currency semantics.
- cleanup.txt independently confirms PG2705069/Redis2705082/API2705207/browser2705575 absent and ports25652/41209/41323/37603 no TCP listeners. PG socket/postmaster and browser profile absent; owned disk runtime0700. Vite closes in browser helper; Jest awaits harness child exit0 before completion. Both temporary matching dependency symlinks removed. No author or prior QA artifacts overwritten.

## Remaining limits / authority

Synthetic users and directly seeded PAID/SUCCEEDED/SOLD rows are not purchase/provider/webhook confirmation. SQL revocation is actual middleware rejection, not elapsed expiry/logout/restart/credential loss. No actual checkout return-link/order recovery-route scenario, inbox/receipt send, Stripe/payment/refund, physical close-reopen/device scanner, staging/version/config/production proof. Private rendering is not accessibility/device acceptance. FullW05/W01-W12 and release remain NO-GO. Independent technical297 remains required. No inherited secret values, target network calls, provider/email/spend/config/push/merge/deploy; source fixture credentials are synthetic only. Task296 review, not done; PM retains closure/integration authority.

Commit uses command-local Git identity and hooksPath bypass because checkout lacks hook shim, without persistent config changes. Explicit syntax, fresh acceptance, cleanup and diff checks performed.

Final git diff --cached --check returned exit2 for four raw-log trailing-whitespace lines (three Chromium DBus diagnostics and one migrate blank line). Raw logs intentionally retained unchanged; this is NOT a clean-range diffcheck claim. Syntax/runtime/cleanup checks above passed.
