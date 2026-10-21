# Task306 independent QA — scoped local L2 PASS

Reviewed author `6d0de5f4f998498ec644be4905708b54386fe51f`; product
`4ec8594850eb547dafc145a14bb1b85cdeaa235c` unchanged (src diff empty).
Reviewer branch `tixmo/task-306-independent-qa`, isolated worktree task-306.
Author artifacts unchanged. Four existing harness/test edits change **only** output
paths task305-r2 → task306-A/B; test behavior/entrypoint/helpers unchanged.
New runtime scripts change only owned runtime/artifact paths and synthetic DB identity.
Before execution sha256sum -c of both305 source manifests passed. Independently
checked every recorded author PID absent and every recorded TCP port closed.

## Fresh commands and results

Both commands exit0, in order (never concurrent DB ownership):

- `bash docs/team/evidence/task-306-A/runtime.sh > docs/team/evidence/task-306-A/runtime.log 2>&1`
- `bash docs/team/evidence/task-306-B/runtime.sh > docs/team/evidence/task-306-B/runtime.log 2>&1`

Runners env-i scrub inherited credentials before imports; fresh0700 disk runtime,
explicit loopback PG18/RedisDB1, executable/PID/listener ownership assertions before
DB access, disposable-target guard, migrate deploy then global setup db push.
Each invokes `timeout --signal=TERM --kill-after=5s 100s npm --prefix tixmoapi2 test -- --cacheDirectory "$owned_run/jest-cache" --runInBand --runTestsByPath` with
`tests/integration/studio-browser.local.test.ts` (A) or
`tests/integration/checkout-clock-browser.local.test.ts` (B).
Task235 cached dependencies have byte-identical API/UI lockfiles; links removed.
No installation or shared generated-client mutation.

A: **1/1 Jest PASS,24.398s** (case17981ms). Nine separate combinations:
Nov9 `2026-11-09T15:30:27.123Z`, DST first `2026-11-01T04:00:27.123Z`,
DST second `2026-11-01T05:00:27.123Z` × St_Johns/UTC/Los_Angeles CDP timezone.
Nine actual unchanged Save Draft configuration PUT200, nine SQL before/after
snapshots equal for event start/end/sale times, ticket sale times and IDs,
total100/available63/sold30/held7, tier times/limit50/sold3/held1.
No counter/reset or dropped schedule. Millisecond JS instant precision only.
Nine screenshots have loaded fonts, zero finite running animations and four stable
geometry states; capture-states.json. Reviewer visually inspected studio-0.png.
Inventory evidence is SQL, not Studio preview capacity/remaining labels.

Actual real password owner login, mounted eventGET payload passed **unmodified**
to unchanged EventStudio initialData, real ticket/type/tier reads and PUTs.
This is **test-only component entry**, not App dashboard navigation or proof of
EventCommandCenter route/prop selection. Source was inspected: command center
edit modal passes its event prop; EventsView create entry is a different path.
No fulfilled API-response mocks in this claimed SQL proof. Exact fixture IDs and
methods allowlisted; non-allowlisted APIs and all foreign origins fail closed.

B: **1/1 Jest PASS,34.947s** (case28456ms), actual App /checkout/:slug,
not component test entry. Native performance.now observations: preopening1121.5ms
disabled, opening9714.2ms enabled, closing21766.9ms disabled: observed enabled
interval12.0527s. performance.timeOrigin equality asserts same document throughout.
Native timers/server SQL Date never replaced. This is elapsed opening/closing
observation, **not equality-at-boundary** proof.

Separately only browser Date constructor/now skew +11000ms before opening and
−11000ms after closing enabled advisory selection. Actual authenticated direct
POST /orders returned400 both times, actual message `Event is not available for purchase`.
Native Date restored between and afterward. Five observations/screenshots and
full audit retained; reviewer visually inspected skew-late-server-reject.png.
Order POST is direct authenticated fetch while UI quantity button is enabled,
**not** successful payment-button submission (policy URLs are unconfigured).
Whole target inventory row plus all order/ticket/paymentAttempt/paymentRefund
rows exactly equal before/after; login lastLogin may change, not whole-DB invariance.
No successful reservation attempted. No client-clock resilience guarantee: UI is
advisory, server rejects actual early/late requests.

## Mocks, confinement, cleanup

Real auth/JWT/password/session, mounted API, Prisma and Redis DB1; both global
Redis and rate-limit-redis mocks explicitly undone. Existing logger mock;
Stripe constructor inert method spies all asserted uncalled; notificationService
mocked. API response bodies are real. Task288 cached font/browser wrapper has
dead proxy, exact loopback bypass, wildcard DNS failure and background disabling.
Browser external Google font and Stripe JS requests blocked before target; no
provider call. This is application-level confinement, not OS network namespace.

cleanup-verification.json independently checks all8 PG/Redis/API/browser PIDs absent,
all10 TCP/API/Vite/DevTools ports closed, PG postmaster/socket and Redis socket
absent, browser profiles absent, both run directories0700. DB RELEASED.
Source manifest stored; bash -n both runners, node --check both browser modules,
git diff --check source/docs pass. No product changes, env secrets, external targets,
provider/email, spend, config, push/merge/deploy. Full release NO-GO.

## Criterion reconciliation / PM recommendation

This fresh L2 evidence fills the remaining bounded runtime criteria identified by
299 at12faf2f. Prior evidence remains dated, not rerun here:

- W01 original238: source/contract252/253; exact same product L1 reviewed302/303
  (31fa0371/107e2320):67 real SQL/HTTP tests,64 matrix20admit44reject including
  exact T−1/T/T+1, narrower ticket, empty/inverted/lifecycle; unchanged native
  elapsed PG lock-wait1726ms. Controlled API Date equality is distinct from this
  browser elapsed/skew evidence. Cap/tenant isolation preserved there.
- W02 original239:264/265/266 three-zone14 focused tests,268/269/270 DTO/tier/cap
  eligibility tests;275 exact4ec85948 accepted by independent277 technical and278
  QA98API76UI5DTO, API typecheck/compiler, UI build/design guard. Those are
  recorded candidate checks, not fresh306 executions. Product src unchanged here.
- Fresh A proves real Studio SQL roundtrip/timezones/DST/stock; fresh B proves
  real App open-page transitions and authoritative server rejection under skew.

Recommend PM closure of **LOCAL W01/W02 only**, contingent on required independent
technical307 acceptance of exact305 SHA and PM reconciliation of above evidence.
Component entry limitation does not claim dashboard navigation; provider purchase
is not an original local W02 prerequisite. No full candidate verify:market,
provider/inbox, staging, physical scanner or release readiness is established.
305 and306 are review, not self-done; no integration authority granted.
