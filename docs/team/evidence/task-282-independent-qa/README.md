# Independent QA282 — exact SHA verdicts

2026-10-21 UTC. QA branch `tixmo/task-282-independent-qa`, isolated worktree `task-282`.

## 279: scoped PASS

Independently reviewed and reran exact `f9f513a3b8245f674bc5e3214d8b6996dca24abb`, product/base `4ec8594850eb547dafc145a14bb1b85cdeaa235c`. Product unchanged. Manifest checks all 210 tracked API source, Prisma and scripts files. Test harness byte-for-byte unchanged; copied runtime differs only runtime/task-282 and own artifact directory paths. Original task279 artifacts preserved; TASK279 log labels and synthetic DB/user names intentionally retained.

Actual command `bash docs/team/evidence/task-282-independent-qa/runtime.sh > docs/team/evidence/task-282-independent-qa/runtime.log 2>&1` exit0. `bash -n` exit0; source manifest exit0. New restrictive0700 ext4 runtime `runtime/task-282/run.5ECx5r`, scrubbed env-i, explicit synthetic loopback targets and existing task57 PG18/Redis cache. Before execution independently verified prior279 PG2633375/Redis2633390 and ports27335/51091/44191 absent. Inspected ownership/listener guards, imports, fixtures, dotenv test suppression, migrations, destructive-test guard and provider stub. Existing task271 dependency symlink used without install/client-generation and removed afterward.

31 migrations succeeded, followed by actual Jest 7/7 PASS (14.309s). Four early/closed event/ticket HTTP400 no-mutation checks; open intersection HTTP201 plus service aggregate-cap and buyer-isolation checks; observed real pg_stat_activity Lock waiter crossing close with rejection/no mutation; actual database manual LATE_PAYMENT through real processEvent/fence, duplicate plus distinct replay yielding one REQUESTED manual exception and two PROCESSED webhook rows. Direct reconciliation and background recovery preserve exception; order/tickets CANCELLED, inventory RELEASED, every mocked Stripe method uncalled. Policy73 not weakened.

Own PG2641638/Redis2641651 stopped; independently observed PIDs absent, ports38385/58251 and HTTP33289 no listeners, postgres pidfile and redis socket absent. See cleanup.txt. Sole DB lane released.

Limits: signed HTTP webhook/provider/email not exercised; synthetic internal provider event. Jest mocks Redis/rate-limit/logger and notifications; Redis readiness only. No full candidate E2E/browser/staging/device/inbox/payment-provider acceptance; launch remains NO-GO.

## 280: preparation NEEDS CORRECTION; browser BLOCKED, not PASS

Exact `cea1a5756869b8f7a96131935818759f575cf7fc`, product/base `4ec8594850eb547dafc145a14bb1b85cdeaa235c`. `node --check scripts/browser/task-280-delivery.mjs` and exact-commit diff-check exit0. Independent ldd confirms the recorded 12 unresolved Chromium libraries. No browser launch retried, screenshot, page or rendered acceptance claimed.

Meaningful design: actual App/Vite and Axios, page request interception denying non-origin requests, synthetic login/session failure, explicit private-state/QR clearing assertions and account-switch absence checks. This is synthetic UI evidence only, never backend ownership proof. The non-origin guard is page Fetch interception, not a general browser/host network sandbox.

Concrete blocker in committed harness (`scripts/browser/task-280-delivery.mjs`): return URL uses `orderId=synthetic-order`, while `RecoveryPage` (`tdash/src/pages/CheckoutPage.jsx:709`) requires UUID format. Invalid candidate never requests recovery or renders auth, so the return-expiry wait cannot complete. Additionally, harness handles `/orders/synthetic-order` only, but App requests `/orders/{uuid}/recovery`; App requires exact `{id,paymentStatus,status}` while synthetic full order has unrelated keys and no paymentStatus. Thus environment repair alone cannot make intended return assertions meaningful. Author must use a valid synthetic UUID consistently and intercept actual recovery endpoint with exact status projection; independent browser execution remains required afterward.

No product edits, external target/provider/email calls, environment repair, spending, configuration changes, push, merge or deployment.
