# Task 420 independent lead review

Reviewer: tixmo-lead; independent of frontend author. Date: 2026-10-21.
Exact reviewed/tested candidate: `8aae387bcd4290edd259fd75aa11baaa1f62ca63`.
Exact parent: `4dde80623f21272f011fed3ff05c9ebb86bfb071`.
New isolated branch `tixmo/review-420`, worktree `worktrees/review-420`.
Read role/workflow, tasks420/419/414/417/418, historical lead report09e440c9
and QA report07db2e7c. Historical results are context, not fresh runs.

## Verdict

APPROVE exact419 cleanup and composed414 scoped source/frontend acceptance.
No blocking finding. The prior guard discrepancy is resolved on this NEW
candidate by authorized intentional obsolete-debt accounting, not a waiver.
Original4dde guard FAIL remains historical fact. Tasks419/414 remain REVIEW:
fresh separate independent QA on exact8aae is still required; PM owns closure.
Task420 is submitted REVIEW as a report, not implementation closure.

## Independent cleanup proof

Contract: tdash/docs/dashboard-design-system.md Guardrail allows baseline
updates only when intentionally accepting or clearing tracked baseline.
Task419 specifically authorizes two obsolete allowance removals. Inspected
full unchanged strict checker: it compares both new and removed fingerprint
sets, so this cleanup tightens obsolete allowances without accepting new debt.

Independent Python assertions against git HEAD^ and candidate established:
926 ->924 records; exactly two removals and zero additions, both
arbitrary-color-utility in src/features/WaitingRoomView.jsx, matches
bg-[#0a0a0a] and bg-[#1a1a1a]. Both absent from current source. All other
metadata including generatedAt/rules equal; filtered original violation list
exactly equals candidate with original entry fields/order. Reconstructed
candidate by removing only those two original literal record blocks and
asserted byte equality: every remaining baseline byte preserved.
Git changed-file assertion: only baseline plus author evidence. Explicit
source/scripts/package/lock/Vite/Vitest diff versus exact parent exited0:
checker, rules, implementation, tests and assertions unchanged by419.
No review product/baseline/assertion edits.

## Composed checkout/session review

Independently read api.js, App.jsx, WaitingRoomView and CheckoutPage paths,
actual AppCheckoutBusy test and adapter/session matrix. Exact503 plus exact
WAITING_ROOM_ACTIVE alone emits busy feedback. Safe-integer delays1..60,
otherwise5; stale-session rejection precedes classification. Unmarked503 and
non503 marker produce generic error. Existing401 refresh remains distinct.
App retains mounted route/form/auth/session identity under sibling overlay;
actual checkout generic error is reachable. Countdown only changes remaining
state; zero enables manual dismissal, which only clears overlay. No automatic
order/intent replay or payment confirmation. Pending order is reused on explicit
manual intent retry, avoiding duplicate order. Existing cart-resume intent
preparation and read-only order polling are not new busy retry behavior:
setting held order before cart query change prevents duplicate resume work.
No queue-position/fairness guarantee in wording.

Tests import real App and real lazy CheckoutPage, actual Axios/interceptors
with mocked adapter; fetch/auth/Stripe are mocked. Both busy write targets
retain cart DOM/auth/token/path and assert no POST during countdown/dismissal,
then exactly one explicit retry; intent case has one order. Actual checkout
unmarked503 visible; malformed-delay/non503/stale matrix adapter-level.
Source supports mounted typed-form retention; focused busy cases use an
already-authenticated cart, not a separately typed guest-auth scenario.

## Fresh checks and setup

Read package scripts, full guard, Vite/Vitest configs and jest-dom-only setup
before execution. Byte-matched package.json and package-lock.json against BOTH
task315 and task251; task315 node_modules resolves task251. Installed selected
versions matched candidate lock: react18.3.1, axios1.20.0, vite6.4.3,
vitest4.1.11, testing-library/react16.3.2, jsdom27.4.0. Temporary local symlink
reused existing task251 dependencies only; removed after checks. No install.

All npm commands used `env -i PATH="$PATH" HOME=/home/daniel`:

- `npm --prefix tdash run design:guard`: exit0, strict PASS924, no regressions.
- `npm --prefix tdash test -- --run src/test/api-session-races.test.js src/test/AppCheckoutBusy.test.jsx src/test/AppSession.test.jsx src/test/AppCheckoutReturn.test.jsx src/test/CheckoutPage.test.jsx src/test/session.test.js`: exit0,6 suites54 tests PASS,4.46s.
- `npm --prefix tdash run build`: exit0, production build12.34s.
- `git diff --check`: exit0 before evidence; staged evidence checked too.

No full frontend/API, real Redis/Lua, browser/native inert/focus/a11y,
capacity/throughput/race or provider gate claimed. No DB, services, network,
install, credentials, config/scheduler, spend, push, merge or deploy.
Shared main untracked files untouched. Only this evidence file is committed.
