# Task 418: independent checkout busy acceptance

Reviewer: tixmo-qa, 2026-10-21. Tested exact source
`4dde80623f21272f011fed3ff05c9ebb86bfb071`, parent
`b46fd6490bcb4def2023ee883290c568c74fd134`.
Isolated branch `tixmo/task-418-independent-qa`, worktree `task-418`.
Only this evidence document is owned/changed by QA.

## Disposition

Scoped functional acceptance PASS; overall acceptance HOLD pending PM/lead
disposition of the failing design guard. No new blocking product defect found
in the bounded review. This is not an all-gates-green result. Task 414 must
remain review until both independent reviews and guard resolution are accepted
by PM. Task 418 is submitted review, not closed as an unconditional pass.

## Independently inspected evidence

- App.jsx:37,40,277-286 eagerly imports feedback but lazy-loads the actual
  pages/CheckoutPage. AppCheckoutBusy.test.jsx imports real App and does not
  stub CheckoutPage: Axios create is wrapped with the actual implementation;
  adapter, public-event fetch and Stripe transports alone are mocked.
- Real order and create-intent rejection tests retain original cart DOM,
  signed-in display, access token and checkout pathname. Countdown disables
  dismissal; writes stay unchanged through waiting and dismissal. A subsequent
  explicit submit issues exactly one further write to the failed target.
  Intent retry has exactly one original order write, preventing duplicate order.
- Actual checkout unmarked503 test verifies visible generic notification and
  no busy dialog. Axios matrix verifies exact503+WAITING_ROOM_ACTIVE only,
  non503 marker classification, malformed string/negative/zero/over60 delay
  fallback5, one adapter invocation and retained auth. Separate stale marked503
  rejects with sessionChanged and emits no busy event after account replacement.
- Existing App/session/checkout suites cover related recovery regressions.
  Malformed/non503/stale cases are adapter-level, not full real-App scenarios;
  real-App integration covers both busy writes and unmarked503 specifically.
- Source CheckoutPage.jsx:432-459 retains the pending order and explicitly
  reuses it on manual retry; busy dismissal only clears App overlay state.
  No automatic busy write replay was introduced. The unchanged401 token-refresh
  path remains distinct from this busy behavior.

## Fresh checks and setup

Before execution read package scripts, Vite/Vitest configuration, test setup
(jest-dom only), and design guard implementation. No DB bootstrap involved.
`cmp` package.json and package-lock.json against BOTH task315 and task251:
exit0 for all four comparisons. task315 node_modules resolves to task251.
Installed React18.3.1, Axios1.20.0, Vitest4.1.11, Vite6.4.3,
testing-library/react16.3.2 and jsdom27.4.0 matched this lockfile. Reused that
existing node_modules with a temporary local symlink, removed after checks;
no install or manifest/lockfile change.

Commands below ran with `env -i PATH="$PATH" HOME=/home/daniel`:

1. `npm --prefix tdash test -- --run src/test/api-session-races.test.js src/test/AppCheckoutBusy.test.jsx src/test/AppSession.test.jsx src/test/AppCheckoutReturn.test.jsx src/test/CheckoutPage.test.jsx src/test/session.test.js`
   - exit0; 6 suites,54 tests PASS;5.83s.
2. `npm --prefix tdash run build`
   - successful Vite production build;2137 modules;12.81s. Shell proceeded to
     the following guard command after build completed; no build error emitted.
3. `npm --prefix tdash run design:guard`
   - exit1, NOT PASS. Only removed baseline arbitrary-color violations:
     WaitingRoomView.jsx baseline line6 bg-[#0a0a0a] and line10 bg-[#1a1a1a].
     No new violations reported. Guard compares both new and resolved
     fingerprints and intentionally fails on either. Baseline diff against
     parent is empty; QA did not update baseline, weaken guard or tests.
     tdash/docs/dashboard-design-system.md:33-35 describes intentional baseline
     clearing, but this assignment explicitly forbids QA baseline mutation.
     PM must resolve via authorized original-author baseline reconciliation or
     explicitly document a scoped exception; do not describe guard as green.
4. `git diff HEAD^ HEAD --check`:exit0. Initial/final tracked tree clean before
   adding this evidence; shared main untracked files untouched.

## Limitations and handoff

Full frontend suite NOT RUN. Full API gate NOT RUN. Real Redis/Lua NOT RUN.
Capacity/throughput/races NOT RUN. Browser/visual/accessibility interaction
NOT RUN; jsdom does not establish browser inert/focus behavior. No services,
listeners, DB, provider/network, install, credentials, config/scheduler, spend,
push, merge or deploy. No launch, capacity or queue-fairness claim.
Only mocked frontend integration evidence is approved by this review.
