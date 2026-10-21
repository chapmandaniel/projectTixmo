# Task 417 independent lead review

## Identity and exact scope

Reviewer: tixmo-lead; implementation author: tixmo-frontend (independent).
Reviewed commit: `4dde80623f21272f011fed3ff05c9ebb86bfb071`.
Parent: `b46fd6490bcb4def2023ee883290c568c74fd134`.
Evidence branch/worktree: `tixmo/task-417-independent-review`, `worktrees/task-417`.
Read assigned role/workflow documents and tasks 406, 414, 415, 416, 417.
Main's existing untracked AGENTS.md/docs/team left untouched. Own changes: this evidence only.

## Verdict

PASS scoped architecture/payment-write/session review, with explicitly justified removal-only guard disposition below. No blocking source finding. This does not label design:guard PASS, close implementation414, approve integration, or replace independent QA418. PM owns414 closure and final acceptance of the documented removal-only disposition.

## Contract and source evidence

- `tdash/src/lib/api.js:87-157`: stale-generation rejection precedes error classification; existing 401 refresh/retry handling unchanged. Only HTTP503 with exact `WAITING_ROOM_ACTIVE` emits busy feedback; other statuses/markers emit generic errors. Numeric safe integer 1..60 accepted, all other delays fall back5. No retry call is introduced in the503 branch; original promise rejects.
- `tdash/src/App.jsx:151-164,277-308`: generic503 no longer filtered; actual `/checkout/:slug` renders visible generic notification. Eager feedback import avoids first-display Suspense replacement. Overlay is a sibling of retained Routes, not a conditional route replacement; inert background prevents normal interaction. Checkout identity/session key and auth lifecycle remain unchanged. Busy state itself does not navigate or change user/session keys.
- `tdash/src/features/WaitingRoomView.jsx:4-18`: interval only decrements state; enables manual button at zero; callback only clears overlay. No order/intent/Stripe call, navigation, automatic dismissal or queue-place promise. Input delay independently validated here too.
- `tdash/src/pages/CheckoutPage.jsx:339-367,431-463` unchanged: existing resume path can prepare an intent for a restored cart, but overlay countdown/dismissal creates no new mount or effect dependency. Manual payment preparation reuses an already-held PENDING order; busy failure preserves reservation/selection. Existing order-status polling is read-only, not automatic payment replay. Broader existing resume behavior is not misrepresented as absent.
- Inspected actual `AppCheckoutBusy.test.jsx`, not a stubbed CheckoutPage integration: real App + lazy real CheckoutPage, actual Axios instance/interceptors with mock adapter, mocked fetch/auth/Stripe transports. Both order and intent rejection retain original selected control DOM/account/token/path; assert unchanged POST count during delay and dismissal, subsequent explicit submit sends one write, intent case creates only one order; Stripe confirmation never called. Unmarked503 test reaches actual checkout generic UI. Separate session-races tests cover marked503 stale generation, valid/malformed delay and non503 marker. Existing CheckoutPage/session/checkout-return regression bodies inspected and executed.
- Coverage boundaries: browser-native inert, focus/visual behavior and real authentication/provider semantics are not established by jsdom. Busy tests retain an already-authenticated cart, not separately typed guest-auth form fields; source preservation supports the mounted-form claim. Missing/noninteger/unsafe delay fallback follows direct safe-integer predicate, not exhaustive executable permutations.

## Guard disposition (FAIL retained; no baseline change)

Independently ran guard, exit1: exactly two removed `arbitrary-color-utility` fingerprints in WaitingRoomView: `bg-[#0a0a0a]` and `bg-[#1a1a1a]`. No new violations. Inspected complete guard implementation: fingerprints include whole source snippets (lines63-66); current and baseline set equality is enforced, including removed entries (lines104-130). Baseline entries at6615-6625 correspond to deleted old markup. Guard and baseline both unchanged in exact implementation diff.

Recommended scoped disposition: accept these two removals as design-system debt reduction, explicitly retaining the nonzero mechanical gate result. New component uses existing DashboardSurface/DashboardButton and semantic theme utilities. Restoring legacy arbitrary colors or adding inert matching snippets to satisfy equality would reintroduce debt or game the guard; weakening guard/tests is not acceptable. No source repair is needed for this removal-only discrepancy. This is not authority to change the baseline, guard algorithm, or treat a future full release gate as green. The author's handoff sentence suggesting baseline authorization is the necessary next step should instead be understood/reworded as this removal-only disposition; no baseline update is requested. If any product change is made later, fresh exact-SHA lead/QA review is required.

## Independent actual checks

Dependency preflight: package.json and package-lock.json byte-identical against both task315 and resolved task251; task315 node_modules resolves task251. Selected installed versions match candidate lock: React18.3.1, Axios1.20.0, Vitest4.1.11, Vite6.4.3, testing-library/react16.3.2, jsdom27.4.0. Reused only isolated local symlink; no install. Inspected Vitest setup (jest-dom only), tests and mocked transports; no DB bootstrap/listener.

All npm commands used `env -i PATH="$PATH" HOME=/home/daniel`:

- `npm --prefix tdash test -- --run src/test/api-session-races.test.js src/test/AppCheckoutBusy.test.jsx src/test/AppSession.test.jsx src/test/AppCheckoutReturn.test.jsx src/test/CheckoutPage.test.jsx src/test/session.test.js`: exit0, six suites54 tests PASS,5.42s.
- `npm --prefix tdash run build`: exit0,2137 modules transformed,15.75s.
- `npm --prefix tdash run design:guard`: exit1, two REMOVED legacy violations only; **FAIL**, not PASS.
- `git diff HEAD^ HEAD --check`: exit0 for exact implementation.
- Staged/final evidence diff-check: exit0; temporary dependency symlink removed; final tracked/untracked status clean after evidence commit.

No DB, Redis, real service/provider, network, install, persistent configuration/scheduler, spend, push, merge or deployment. No full frontend/API market gate, browser visual/a11y gate, runtime/capacity or launch claim. Backend415/416 evidence was read, not rerun. QA416's separate test-only harness remains separate from this exact frontend base.

## Handoff

No required product-code author fix for this scoped review. Author should preserve manual retry/session behavior and not alter baseline or weaken assertions. PM can resolve414's guard bookkeeping with the explicit removal-only disposition above, after independent QA418. Any subsequent author edit requires fresh exact-commit reviews; do not confuse this evidence commit with the reviewed implementation commit.
