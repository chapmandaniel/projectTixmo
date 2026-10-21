# QA282 R2 independent exact-SHA verdicts

2026-10-21 UTC. Branch `tixmo/task-282-independent-qa-r2`; isolated worktree task-282-r2. Original task279/282 evidence preserved.

## 279 R2 — scoped PASS

Exact `4c8561342268ffe764a1dd8abd6661488b63e3e5`, parent `f9f513a3b8245f674bc5e3214d8b6996dca24abb`, product unchanged `4ec8594850eb547dafc145a14bb1b85cdeaa235c`. Reviewed test diff, provider stub, source manifest and unchanged runner guards. Runner adaptation ONLY own runtime/task-282-r2 and own artifact directory; TASK279 log labels/DB names intentionally retained. Source manifest all210 entries independently passes. Prior279R2 PG2645550/Redis2645563 and ports26464/44732/46559 independently absent before soleDB ownership.

Actual commands exit0:

```sh
bash -n docs/team/evidence/task-282-independent-qa-r2/runtime.sh
sha256sum -c docs/team/evidence/task-279-combined-local-r2/source-sha256.txt
bash docs/team/evidence/task-282-independent-qa-r2/runtime.sh > docs/team/evidence/task-282-independent-qa-r2/runtime.log 2>&1
```

Actual31migrations+7/7PASS, Jest14.239s. Four HTTP sale-window rejection/no-mutation cases; HTTP open201 with service aggregate-cap/buyer-isolation assertions; actual observed event-row Lock wait crossing close and rejection/no mutation; strengthened actualDB/processEvent manual late-payment replay.

Seventh test explicitly establishes CANCELLED/PROCESSING/refundStatus NONE/paymentClosedAt null and full tickets/inventory baseline. Duplicate and distinct replay each preserve baseline. Exception aged120seconds exceeds60second backoff: actual generic eligibility count1, reason-not-LATE_PAYMENT count0. Direct reconciliation and background recovery each preserve full aged exception and baseline; all Stripe methods uncalled. One manual exception/two PROCESSED webhook rows, cancelled/released tickets and original inventory. This resolves recency-only false-positive concern; policy73 preserved.

Fresh disk-backed ext40700 env-i runtime `runtime/task-282-r2/run.IR72It`, verified owned PG18/Redis loopback listeners before targetguard/migration; explicit synthetic credentials, NODE_ENV=test. Existing task271 dependencies reused via symlink, removed after; no install/generation. Own PG2648114/Redis2648127 stopped and independently absent; ports30932/49326/HTTP45179 listener absence verified (authoritative HTTP port in cleanup.txt); PID/socket absent. SoleDB lane released. See logs and cleanup.txt.

Limits unchanged: signed HTTP webhook/provider/email not tested; Stripe mocked, notifications disabled; Jest Redis/rate-limit/logger mocked, native Redis readiness only. No full E2E/browser/inbox/device/staging/provider qualification, launch NO-GO.

## 280 R2 — scoped preparation PASS, rendered browser BLOCKED

Exact `ed9cfdabb2c812019bbbe96667ee7c890e99a164`, reviewed in separate detached `review-282-280-r2`. Actual commands/results captured browser-static.log:

```sh
node --test scripts/browser/task-280-support.test.mjs
node --check scripts/browser/task-280-delivery.mjs
node --check scripts/browser/task-280-support.mjs
git diff --check ed9cfdab^ ed9cfdab
ldd /home/daniel/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome
```

5/5 Node testsPASS: real product UUID guard/exact recovery projection contract; CDP lost response timeout/late response/closure rejection; own stubborn child SIGTERM-to-SIGKILL and PID absence; own listener close/profile removal on startup failure; profile removal despite injected server-close failure. Syntax and exactdiffcheck exit0. These are Node harness support tests, NOT browser tests.

Static inspection confirms valid UUID shared order/return fixture, exact `/orders/{uuid}/recovery` interception and exact `{id,status,paymentStatus}` shape, positive transfer-dialog presence before expiry, B empty tickets+orders/session identity checks, at least two actual recovery requests in audit. Unexpected API method/routes fail closed; non-origin page requests denied; CDP calls bounded, cleanup independently attempts child/server/profile and records listener/PID proof. Original concrete recovery-contract defects corrected.

Independent ldd still shows12missing Chromium libraries. No browser launch retried, rendered checks/screenshots/real browser cleanup claimed. Page Fetch interception is not browser-wide or host-wide network sandbox. Functional browser runtime and successful independent actual rendered execution still required; full W05/provider/backendownership/production acceptance NO-GO.

No product edits, external target/provider/email, environment repair, spending, configuration changes, push/merge/deploy.
