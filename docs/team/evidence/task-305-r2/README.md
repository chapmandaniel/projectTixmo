# 305 R2 — scoped local acceptance PASS, independent review required

Product remains `4ec8594850eb547dafc145a14bb1b85cdeaa235c`, branch
`tixmo/task-305-browser-studio`. R1 failed evidence immutable. No product edits.

## A: actual Studio component → real mounted configuration API → SQL

Fresh `bash docs/team/evidence/task-305-r2/runtime.sh`: Jest1/1 PASS23.789s,
9 case combinations: America/St_Johns, UTC, America/Los_Angeles browser timezone
CDP overrides × Nov9 `2026-11-09T15:30:27.123Z`, first DST repeated hour
`2026-11-01T04:00:27.123Z`, second `2026-11-01T05:00:27.123Z`.

Each browser document obtains actual owner access token from real password login,
GETs event via mounted API, passes that unmodified real payload into unchanged
EventStudio, loads real ticket types/tiers, clicks unchanged Save Draft. Actual
9 configurationPUT200 audited (no response fulfillment). SQL pre/post comparisons
preserve event start/end/sale instants, ticket sale instants and total100,
available63,sold30,held7, tier instants/limit50/sold3/held1 and IDs. Snapshots
and request bodies retained. No counters sent by Studio; SQL exact equality.

This is a **test-only component entry**, not App/dashboard navigation proof.
No fabricated event shape or App normalization used: actual GET /events/:id
payload becomes initialData. It does not verify how EventsView selects/normalizes
its props. Nine CSS-rendered screenshots capture after fonts loaded, no finite
running animations and four identical stable geometry states; capture-states.json.
Author personally inspected studio-0.png. Browser external font request blocked;
qualified task288 local font/Chromium wrapper used.

R1 read-contract fault resolved narrowly after source inspection: GET ticket-tiers
requires fixture ticketTypeId and returns data array supported by extractCollection.
Reads/writes limited to known fixture event/type IDs and exact paths/methods;
no broad order/wallet/financial-write allowance in this Studio harness.

## B: actual App checkout, native elapsed, separate browser-only Date skew

Fresh `bash docs/team/evidence/task-305-r2-clock/runtime.sh`: Jest1/1
PASS34.855s (case28401ms), in separate disposable runtime. Actual App index route
`/checkout/:slug`, actual public API response; no CheckoutPage test-entry mount.
Document stayed mounted: performance.timeOrigin unchanged. Native timers and
server/SQL Date never mocked. Observed browser monotonic performance.now:
preopening1110.8ms disabled, native opening9716.2ms enabled, native closing
21763.6ms disabled (12.0474s observed enabled interval). Opening/closing are
native elapsed observations, not controlled equality-at-boundary claims.

Separate +11s browser Date constructor/now skew before actual opening enables
advisory selection, actual server POST /orders400; restore native Date + focus,
observe real opening/closing with native timers, then -11s browser Date skew after
actual closing enables advisory selection but actual server POST /orders400.
Native Date restored afterward. Both rejected bodies and five observations/screens
retained; early message sale not started, late message sale ended. No successful
reservation attempted. Whole inventory row + all order/ticket/paymentAttempt/
paymentRefund rows exactly equal before/after; financial SQL invariant, not all
DB invariance (real login updates user lastLogin). Stub Stripe methods uncalled.

Browser Date skew shows client eligibility is advisory, **not a client-clock
resilience guarantee**. Actual server rejects outside its windows. Browser
transport allows only exact public fixtureGET, auth loginPOST, and exact fixture
orderPOST body; every provider/other mutation blocked. stripe-js import attempted
external script load and Google font import attempted load; both intercepted and
failed before contacting external target. No provider operation exercised.

First clock attempt retained in task-305-r2-clock/initial: native closing wait
expired with original10s wait vs12s interval; source wait was edited during child
startup, so do not assign final30s wait to that historical failed execution.
One bounded repair rerun final fixed30s wait + persisted observations passed.
No product defect identified; no production source changes.

## Runtime, mocks and cleanup

Known0700 disk runtime/task305-r2, env-i scrub before imports, explicit owned
loopback PG18/Redis DB1 verified/client DB1 asserted. Exact PID/exe/loopback
listeners checked before DB/schema access. Real auth/password/JWT/session,
Prisma and Redis; Redis/rate-limit-redis unmocked. Standard logger mock; Stripe
constructor returns inert spy methods; entire notificationService mocked.
No email/provider/payment/secret/production/external target access or spend.

All owned PG/Redis/API/browser PIDs, TCP+DevTools listeners, Unix sockets,
postmaster/profile paths checked absent: cleanup.txt includes both successful
runs plus failed clock run. Dependency links removed; DB RELEASED.
Source sha256 files identify actual final harnesses. bash-n/node-check/diff-check
passed. Task requires independent QA and technical source review at delivered
SHA before PM closure; no full release/provider/staging readiness granted.
