# Task 316 independent QA — bounded LOCAL PASS

Reviewed exact author SHA `6da0f2962a0a5d8781605244c02e4ca7b4ba208b`, including target A `840388fdbf39df2891dd3c6c904821c94d5f2e76`; product source remains `4ec8594850eb547dafc145a14bb1b85cdeaa235c`. Branch `tixmo/task-316-independent-qa`, isolated worktree task-316. No product changes.

## Fresh commands and results

- `bash docs/team/evidence/task-316-A/runtime.sh > docs/team/evidence/task-316-A/runtime.log 2>&1` exit 0; 1 suite/1 test, 20.099s.
- `bash docs/team/evidence/task-316-BC/runtime.sh > docs/team/evidence/task-316-BC/runtime.log 2>&1` exit 0; 1 suite/1 test, 25.804s.
- Both author source hash manifests: all entries OK before and after execution. `bash -n`, `node --check`, `git diff --check`: exit 0.
- `git diff 4ec8594850eb547dafc145a14bb1b85cdeaa235c HEAD -- tixmoapi2/src tdash/src`: empty before evidence commit.

Inspected both runtime scripts, integration tests, browser scripts, support helper, Jest setup, verification safety guard, environment/Prisma config, font288 Chromium launcher, mounted receipt routes/controller/OrderService/NotificationService/template before execution. QA copies change only owned output/helper paths, scrub marker and disposable DB identity. Cached dependencies linked read-only in practice; no install/generation/cache mutation. PG18 and RedisDB1 endpoints explicitly created and listener/PID verified, inherited environment discarded, synthetic credentials only. Browser permits real owned HTTP requests and blocks external origins; no API/auth response stubs. Stripe is inert and asserted uncalled. A does not claim receipt coverage (whole NotificationService stub there); C explicitly unmocks NotificationService and replaces email transport/config only.

## Acceptance evidence

A: actual Chromium 2831232 closes, replacement 2831378 restores wallet with same profile; 2831378 closes, replacement 2831506 restores exact confirmed candidate URL and real PAID/SUCCEEDED recovery, links to owner wallet. Buyer B actual password login has empty wallet, no A order or QR. Four settled screenshots; confirmed screenshot visually inspected. Financial POST count zero, full seeded order and ticket/attempt/refund counts unchanged, Stripe uncalled. Historical test title mentions revocation but this target does NOT exercise revocation.

B: server-issued token iat 1792568737, exp 1792568747 (10s), actual native wait wall 8384ms / monotonic 8384.409395ms; wall end 1792568748201 = exp+1201ms. Real wallet 401 followed by refresh 200; renewed iat 1792568748 exp 1792568758 and same user ID. Real owner wallet restored, then local signout and actual password reauthentication same owner. No fabricated token, Date override, SQL expiry/revoke, auth API mock or refresh-token-expiry claim. Two settled screenshots, recovered screenshot visually inspected. Initial QR image retrieved from real API before expiry; QR disclosure after refresh was not separately clicked.

C: mounted authenticated receipt route, real controller/OrderService/NotificationService/template; owner A 200, buyer B 404, unpaid 400; exactly one inert sendMail capture to synthetic.test recipient. HTML script/img fixtures escaped, plain text preserved safely as text, trusted loopback /wallet link in both representations. Receipt metadata SENT only means inert local transport success. Sorted SQL financial projection equal (order ids/status/paymentStatus/totalAmount, full ticket rows, payment attempt/refund counts), Stripe uncalled. Full capture/projections in task-316-BC/receipt-capture.json.

Cleanup: task-316-cleanup-verification.json proves all 10 recorded PG/Redis/API/browser PIDs absent, all 10 recorded TCP ports closed, no profiles, sockets or postmaster pidfiles. Runtime roots mode0700. PostgreSQL shut down and Redis exact owned child stopped; DB ownership released. Six settled screenshots total. Fresh helper hashes retained in task-316-source-sha256.txt. No author evidence overwritten.

## Limits

Bounded local A/B/C acceptance only, not full W05 or deployment readiness. No inbox/provider delivery, target recovery SLA, lost-credential/support identity recovery, refresh-token expiry, device/staging, a11y, live purchase/refund or capacity acceptance. Observed USD fixture is schema default, not a commercial currency decision. No provider secrets, external network targets, AWS, spend, config, merge, deploy or production action. Independent technical acceptance remains separate (#317).
