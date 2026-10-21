# Task314 R2 — elapsed expiry and local receipt transport capture

Product unchanged `4ec8594850eb547dafc145a14bb1b85cdeaa235c`; isolated branch
`tixmo/task-314-recovery`. Target A evidence remains immutable at840388fd.
Run: `bash docs/team/evidence/task-314-r2/runtime.sh` from this checkout.
Runtime scrubs inherited env, synthetic local keys, explicit loopback owned
PG18/RedisDB1/API/Vite, 0700 workspace runtime/task314-r2, not /tmp. No installs,
external target, provider credentials, AWS, deployment/config or product edits.

## Target B

Actual environment config JWT_EXPIRES_IN=10s and JWT_REFRESH_EXPIRES_IN=120s;
actual generateAccessToken/generateRefreshToken and mounted HTTP password login.
Actual App wallet/QR with browserfont288. Browser decodes only server-issued
claims for audit, never signs/injects tokens. Records iat/exp/userId, native
wall-clock and monotonic wait. Wait ends at least1200ms after absolute exp;
no fake Date, SQL session revocation or fabricated API responses. Real wallet
Refresh yields HTTP401, actual auth/refresh200 and newer same-owner JWT;
owned wallet restores. Explicit local signout then actual password login also
restores same existing owner. Audit allowlist excludes financial POSTs.
Screenshots wait fonts/visible opaque/stable UI. Browser result includes claims,
not credential strings. Global Stripe inert boundary asserted uncalled.

## Target C

Mounted POST /api/v1/orders/:id/receipt through actual actor-scoped controller,
OrderService, NotificationService.sendOrderConfirmation/sendEmail and actual
orderConfirmationEmail. ONLY config/email transporter.sendMail is replaced by
inert local capture. No whole-notification mock. No email network/inbox claim.
B denied403/404, owned unpaid blocked400, neither calls sender. A paid200 sends
exactly once to synthetic.test recipient; trusted loopback frontend /wallet
link in HTML+text. Script-like buyer name and image-like event name escaped
in HTML. ReceiptStatus becomes SENT (local stub acceptance only).
Order status/paymentStatus/totalAmount projection, full ticket rows and payment
attempt/refund counts identical before/after. Receipt metadata intentionally
changes and is not mistaken for financial mutation. Stripe methods uncalled.
Captured message and SQL projections in receipt-capture.json; no actual provider.

## Initial failure and limits

First combined run's B passed; C assertions passed through recipient/link/HTML/
receipt state then unordered SQL result rows reordered. Preserved initial-run/
shows only row-order delta. Added orderBy id to comparisons, never weakened any
value assertion; reran fresh owned runtime. See final acceptance/runtime logs.
Inherited TASK294 labels reflect harness reuse, not additional acceptance.

Only scoped LOCAL criteria. Token lifetime fixture is not production policy;
refresh token native expiration not tested. No lost credentials, support reset,
identity bypass, inbox/provider delivery, recovery SLA, target/device/staging,
spend, merge or deploy acceptance. Full W05/250/73/61 release NO-GO unchanged.
Independent exact-SHA QA and technical acceptance remain required.

Final actual result: exit0,1test26.211s; tokeniat1792568396 exp1792568406, wallwait9106ms/monotonic9105.487ms, wallend exp+1201ms; renewal iat1792568407 exp1792568417 same owner. C A200/B404/unpaid400, sendCount1, unchanged financial projection. SQL default USD fixture is observed, NOT commercial currency selection. Eight PIDs/eight listeners absent across both R2 runs, no sockets/profiles/postmaster pidfiles; DB RELEASED.
