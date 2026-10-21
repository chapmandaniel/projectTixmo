# Task #315: complete frontend regression evidence

- Product/base SHA: `4ec8594850eb547dafc145a14bb1b85cdeaa235c` (exact candidate, unchanged).
- Evidence branch: `tixmo/task-315-frontend-regression`.
- Worktree: `/home/daniel/projects/projectTixmo/worktrees/task-315`.
- Fresh execution UTC: 2026-10-21T07:33:39.797000+00:00.
- Runtime: Node v24.21.0. Existing dependency source: `/home/daniel/projects/projectTixmo/worktrees/task-251/tdash/node_modules`, linked only as untracked `tdash/node_modules`; candidate package-lock byte-matched task-268, whose dependency link resolves to that source. No installation, lock change, Prisma generation or global configuration change.

## Scope and safety

Inspected package scripts, Vitest/Vite/PostCSS configuration, jsdom setup and test imports/network boundaries before execution. Vitest uses jsdom; API requests are module-mocked or use in-memory Axios adapters, fetch paths are mocked, Stripe checkout is mocked, and static example URLs are assertions rather than external targets. Non-network component tests use callbacks only. No backend command, DB, ports, dev server, provider/email, environment-secret access, cloud/spend, push, merge or deployment. Release #314 retained exclusive DB ownership. `--cache=false` disables Vitest cache; `--configLoader runner` avoids bundled config temp writes to shared dependencies. No product/tests/assertions/guard-baseline changes or harness repairs.

## Results

| Gate | Exit | Current result |
| --- | --- | --- |
| Full tdash Vitest, no file filters | 0 | 33/33 files passed; 239/239 tests passed; 0 failed, 0 skipped/pending, 0 todo |
| Design-system guard | 0 | 926 tracked baseline violations, no regressions; baseline unchanged |
| Production Vite build | 0 | Passed, 12.84 s reported build time |

Vitest JSON counts 73 passed suites (nested describe groups), not 73 files. All 33 file results are present. Snapshots: 21 matched, 0 added/updated/unmatched/unchecked. Unhandled errors/rejections reported: 0 (no unhandled-error section; successful exit). Two expected caught validation errors are printed to stderr by passing EventStudio negative-path tests: invalid/missing ticket total and nonexistent DST wall time. These are not unhandled failures.

This is fresh **complete frontend regression** evidence, not the historical focused 76-test subset. It is not `verify:market`, API/DB, real-browser, live provider/email evidence, deployment acceptance or launch/readiness GO. No failure repair task is needed for these three local gates.

## Exact commands and raw artifacts

Commands executed from the worktree root; exit status and wall durations are in [commands.json](commands.json).

```sh
npm --prefix tdash test -- --run --cache=false --configLoader runner --maxWorkers=2 --reporter=default --reporter=json --outputFile.json=/home/daniel/projects/projectTixmo/worktrees/task-315/docs/evidence/task-315/vitest-results.json
npm --prefix tdash run design:guard
npm --prefix tdash run build -- --configLoader runner
```

- [Full Vitest console](vitest-full.log)
- [Full machine-readable test results](vitest-results.json)
- [Design guard](design-guard.log)
- [Build](build.log)

## Complete file inventory

- `tdash/src/test/AcceptInvitationView.test.jsx`
- `tdash/src/test/AnalyticsView.test.jsx`
- `tdash/src/test/AppCheckoutReturn.test.jsx`
- `tdash/src/test/AppSession.test.jsx`
- `tdash/src/test/AppWalletSession.test.jsx`
- `tdash/src/test/ApprovalCard.test.jsx`
- `tdash/src/test/ApprovalDetailView.test.jsx`
- `tdash/src/test/ApprovalsDashboard.test.jsx`
- `tdash/src/test/AssetLibraryView.test.jsx`
- `tdash/src/test/AssetUploader.test.jsx`
- `tdash/src/test/CheckoutPage.test.jsx`
- `tdash/src/test/DashboardPlaceholderView.test.jsx`
- `tdash/src/test/DashboardTruth.test.jsx`
- `tdash/src/test/EventCommandCenter.test.jsx`
- `tdash/src/test/EventStudio.test.jsx`
- `tdash/src/test/EventsView.test.jsx`
- `tdash/src/test/ExternalReviewPage.test.jsx`
- `tdash/src/test/LoginView.test.jsx`
- `tdash/src/test/NotificationResilience.test.jsx`
- `tdash/src/test/OperationalPages.test.jsx`
- `tdash/src/test/ScannersView.test.jsx`
- `tdash/src/test/SharedAssetFolderPage.test.jsx`
- `tdash/src/test/Smoke.test.jsx`
- `tdash/src/test/StatCard.test.jsx`
- `tdash/src/test/StatusBadge.test.jsx`
- `tdash/src/test/TeamView.test.jsx`
- `tdash/src/test/TicketBuilder.test.jsx`
- `tdash/src/test/WalletPage.test.jsx`
- `tdash/src/test/api-session-races.test.js`
- `tdash/src/test/checkoutEligibility.test.js`
- `tdash/src/test/eventTime.test.js`
- `tdash/src/test/runtimeConfig.test.jsx`
- `tdash/src/test/session.test.js`

## Evidence commit mechanics

The checkout has no configured Git author identity and its inherited pre-commit hook references missing `tixmoapi2/.husky/_/husky.sh`. The documentation-only evidence commit used command-local `-c user.name='Tixmo QA' -c user.email='tixmo-qa@localhost' -c core.hooksPath=/dev/null`; no persistent/local/global Git configuration or backend dependency generation was performed. This hook limitation does not replace or weaken the three recorded frontend checks. `git diff --check` passed.
