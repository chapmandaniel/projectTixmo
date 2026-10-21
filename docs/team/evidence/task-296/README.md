# Task 296 independent QA

## Exact source verdicts

- #294 `a48f0eeb064bc519f84d192aebae1083efc91abd`: PASS for the bounded API-first checkpoint ONLY. Product base `4ec8594850eb547dafc145a14bb1b85cdeaa235c` unchanged. Worktree review-296 branch tixmo/review-296. Exact author test/setup/guard/app bytes matched git objects before execution; source hashes retained.
- #295 `0cac3d60212e621607a22a5947816799d608525b`: PASS for documentation/static evidence index as a dated snapshot. Reviewed separately in detached review-296-doc. It is not current launch acceptance; its #294 doing/in-progress entry is superseded by the current author review/API-first-only result and this independent result. No full-stack PASS may be inferred.

## Actual fresh checks

Inspected runtime env-i bootstrap, owned executable/PID/listener and destructive target guards, Jest setup, explicit jest.unmock Redis/rate-limit-redis, mounted auth/ticket/order routes, actual password/JWT/session and QR generator imports before execution. Notification service and Stripe transports/constructor inert; standard logger mocked. No auth, Prisma, password, JWT, session, ownership or QR mocks. Actual Redis is used, but rate-limit saturation is not covered.

`bash -n docs/team/evidence/task-296/runtime.sh` exit0.
`bash docs/team/evidence/task-296/runtime.sh > docs/team/evidence/task-296/runtime.log 2>&1` exit0; fresh31-migration owned PostgreSQL18/Redis plus mounted app loopback HTTP, scrubbed env-i and synthetic credentials. Fresh run directory under QA runtime/task296 mode0700; no author artifact overwritten. One Jest test PASS,13.97s total (7503ms case). Real hash/password A/B login; wrong password401; correctly signed expiredJWT401; A wallet and actual qrcode library dataURL; B ticket/QR/order403or404 and no A ticket in B wallet; SQL sessionVersion increment invalidates token401; actual login restores order and wallet access. Order row and ticket/paymentAttempt/paymentRefund counts unchanged; all available stub provider functions uncalled. Source test only asserts PNG dataURL prefix, not decoded barcode scanning. QR generation can persist qrCodeUrl; “read-only” names refer to unchanged financial/order/count state, not absence of every database write.

Runtime wrapper copied verbatim except TASK296 identifiers/owned QA runtime directory, synthetic DB user/name, and artifact directory. Test source stayed unchanged (so its log labels retain TASK294). Existing matching dependency cache temporarily linked; removed after completion. API2694303, PG2694137, Redis2694150 absent after completion; ports42157/28215/47154 have no TCP listeners, postmaster.pid absent. No browser/profile launched. See cleanup.txt and raw logs.

#295 Python pathlib/re/subprocess checks exit0:14 Markdown local links exist;9 crossbranch SHA:path git objects exist;35 commit-index mappings match resolved commits;31 migration.sql files; git diff --check HEAD^ exit0; exactly3 changed task295 document files. Current board238–249 remains review/todo, not full package acceptance. The dated snapshot's historical independent test counts were not rerun and are not added as coverage totals. Canceled/duplicate tickets are not delivered features. Authority reread live250/73/61: BB250-20261021-LOCAL-ONSALE approves zero-exposure local synthetic work only; manual73 and remaining61/provenance/hardware/participants/commercial gates stay binding. Current scoped board copies retained.

## Limits / remaining NO-GO

Seeded PAID/SUCCEEDED/SOLD fixture is not a purchase/payment/webhook confirmation. Expiry is signed expiredJWT, revocation is SQL fixture change, not elapsed idle/logout/browser UX. No App-to-realAPI browser link, physical reload/return/relogin, browser isolation with real backend, optical barcode/device, inbox/email, lost credentials, process restart, provider/Stripe, staging/production, complete HTTP pressure or release acceptance. No network targets, secrets, external messages, spend, config, push, merge or deploy. No main checkout changes. FullW05 and W01–W12 release remain NO-GO. QA task review, not done; PM owns closure/integration decision and independent technical297 remains separately required.
