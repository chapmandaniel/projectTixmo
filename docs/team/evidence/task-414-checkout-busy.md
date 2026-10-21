# Task 414: marker-only busy feedback

Base: b46fd6490bcb4def2023ee883290c568c74fd134 (reviewed backend413).
Branch: tixmo/task-414-checkout-busy. Isolated worktree: task-414.

## Changes

- Axios emits waiting-room events only for HTTP503 with exact WAITING_ROOM_ACTIVE code. Numeric positive safe-integer retryAfter up to60 seconds accepted; malformed/missing delay falls back5. Stale-session guard and401 refresh remain before classification.
- App accepts generic503 errors and displays generic notifications on actual public checkout. Busy overlay lives outside route selection; authenticated shell and checkout remain mounted with inert background while busy. Small feedback component is eagerly imported so its first display cannot suspend/unmount the retained route.
- Busy wording describes contention, not queue placement/fairness. Countdown only enables manual dismissal. Dismissal never resends writes; buyer must manually submit again. CheckoutPage order/reservation/payment-session logic unchanged.
- Mock Axios integration covers both order and create-intent rejection, retained cart DOM/account/token/location, no writes during countdown/dismissal, explicit manual retry, and no duplicate order when retrying existing intent. Unmarked503 generic visibility and stale marked503/session-replacement tests included.

## Actual checks

No dependencies added/installed. Existing React/Axios/Vitest adequate; task315 and resolved task251 manifests and lockfiles byte-match this base. Selected installed versions matched lock: React18.3.1 Axios1.20.0 Vitest4.1.11 Vite6.4.3 testing-library/react16.3.2 jsdom27.4.0. Temporary node_modules symlink reused task251 only.

Commands run with `env -i PATH="$PATH" HOME=/home/daniel`:

- `npm --prefix tdash test -- --run src/test/api-session-races.test.js src/test/AppCheckoutBusy.test.jsx src/test/AppSession.test.jsx src/test/AppCheckoutReturn.test.jsx src/test/CheckoutPage.test.jsx src/test/session.test.js`: final exit0,6 suites54 tests PASS,4.61s. Earlier run exposed lazy overlay suspension; eager import repaired it without weakening assertions. Final rerun includes manual-submit count assertions.
- `npm --prefix tdash run build`: exit0 (final source), Vite production compilation.
- `npm --prefix tdash run design:guard`: exit1 solely two RESOLVED baseline violations in WaitingRoomView (legacy arbitrary bg colors removed); no new violations. Baseline intentionally unchanged as instructed. This remains a reported guard failure, not a pass.
- `git diff --check`: exit0.

Only mocked Axios/fetch/Stripe transports used; no listener, DB, Redis, provider, network, install, services, scheduler/config, push, merge or deploy. Not a browser/visual verification or full frontend/API gate. Real Redis/Lua, runtime throughput/capacity and full composed gate remain separate. No launch/capacity/queue fairness claim.

## Handoff

Author submits REVIEW only. Independent lead and QA must review exact resulting commit; PM owns closure. Guard resolved-baseline reconciliation requires separately authorized baseline handling; none altered here.
