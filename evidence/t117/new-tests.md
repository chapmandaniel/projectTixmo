# T117 new tests

Tests only. QA, T90 follow-up. No app-code, lockfile, workflow, or guard-baseline changes. No staging, production, Stripe, or other external network traffic. Fake data only. Kanban CLI was not available in this Cloud Agent session; assignment, SHA, checks, and bugs are recorded here and on the draft PR.

| | |
| --- | --- |
| Base | `origin/main` `aee54592` (merge of PR #195) |
| Branch | `cursor/t117-tasks-notifications-tests-f332` |
| Head | `2c93dccb99dac9ddf30ea8b11384d98e751b3ee4` (tests + evidence; CI below is this SHA) |
| API command | `npx jest --runInBand` in `tixmoapi2/` against disposable `tixmo_disposable_t117` + Redis `/1` |
| Dashboard command | `npx vitest --run` in `tdash/` |
| Coverage | API Jest `--collectCoverageFrom` for `src/api/tasks/**` and `src/api/notifications/**`; dashboard `@vitest/coverage-v8@4.1.12` `--no-save --no-package-lock` with `--coverage.include` limited to the four UI files |

## Chosen features and why

Re-checked current `main` (`aee54592`) against the T90 map (`7f9eaa9`). Ticket sales, checkout, payments, refunds, orders, and promo codes were skipped (backlogged). T92 / T98 / T101 / T106 / T113 coverage is not on `main` yet, and none of those tasks targeted Tasks or Notifications.

| # | Feature | Current main | Why chosen |
| --- | --- | --- | --- |
| 36 | Tasks / Todo | Still Partial. Only `vendor-import.test.ts` create + `eventId` list. `tasks/service.ts` **23.72%** statements / **17.24%** branches; `controller.ts` **25.71%**. `TodoView`, `CreateTaskModal`, `TaskDetailsModal` **0%** (never loaded). | Weakest remaining operator Partial by coverage. |
| 34 | Notifications list / unread / mark-read / bell | Still Partial for these paths. `#195` covered **preferences** (feature 35), which raised `notifications/service.ts` to **73.07%** overall, but `markAsRead` (`service.ts:47-59`, `controller.ts:22-26`) was unexecuted. No HTTP test of pagination, `unreadOnly`, user scoping, or `PUT /:id/read`. Bell unread badge / mark-read click untested. | Next weakest non-sales operator Partial after Tasks. Preferences were **not** substituted in. |

No substitution: both rows were still the weakest remaining operator Partials. Feature 35 is now Covered on `main` via `#195` and was left alone. Ticket-tiers remain weaker on paper (**30%** statements) but are sales inventory, out of scope.

## Counts

| Suite | Before (`origin/main` `aee54592`) | After |
| --- | --- | --- |
| API Jest | 182 suites / **1711** passed / 0 skipped | 184 suites / **1727** passed / **1** skipped (1728) |
| Dashboard Vitest | 66 files / **500** passed / 0 skipped | 70 files / **516** passed / **3** skipped (519) |

API delta: +2 files, +16 passed, +1 skipped. Dashboard delta: +4 files, +16 passed, +3 skipped.

The one full API run without `dist/` failed 8 tests in `payment-recovery-backlog` and `showpass-seed` with `Fresh API build required`. Those 8 passed after `npm run build` (2 suites, 8 tests). Combined with the 1719 already passing in that run (including both browser suites and the new T117 files): **1727** passed. Before counts subtract the 16 new passing API cases from that total. `scanner-browser` and `wallet-browser-recovery` both **passed** in the full run; no flake, no re-run.

## Coverage of the targeted files

### API (`src/api/tasks/**`, `src/api/notifications/**`)

Before: existing suites that already load these modules (`vendor-import`, `apiRateLimit`, `notification-preferences`, `zod-v4-contract`). After: those plus the two new HTTP files. Unrelated suites do not execute these files.

| File | Metric | Before | After |
| --- | --- | ---: | ---: |
| `tasks/service.ts` | statements | 23.72 | 94.91 |
| | branches | 17.24 | 75.86 |
| | lines | 24.56 | 94.73 |
| `tasks/controller.ts` | statements | 25.71 | 83.80 |
| | branches | 20.83 | 77.77 |
| | lines | 26.26 | 83.83 |
| `tasks/routes.ts` | statements | 100 | 100 |
| `tasks` module | statements / branches | 30.89 / 19.80 | 88.76 / 77.22 |
| `notifications/service.ts` | statements | 73.07 | 96.15 |
| | branches | 40.00 | 80.00 |
| | lines | 73.07 | 96.15 |
| `notifications/controller.ts` | statements | 84.61 | 100 |
| | branches | 50.00 | 100 |
| | lines | 84.61 | 100 |
| `notifications/routes.ts` | statements | 100 | 100 |
| `notifications` module | statements / branches | 83.82 / 42.10 | 98.52 / 84.21 |

Remaining task controller misses are the dead `!userId` branches behind `authenticate` and `next(error)` Prisma failures. Remaining notification service miss is `updatePreferences` create-when-missing (`service.ts:112`), a feature-35 path.

### Dashboard (four UI files)

| File | Metric | Before | After |
| --- | --- | ---: | ---: |
| `TodoView.jsx` | statements | 0.00 | 69.15 |
| | branches | 0.00 | 56.92 |
| | lines | 0.00 | 70.87 |
| `CreateTaskModal.jsx` | statements | 0.00 | 88.88 |
| | branches | 0.00 | 63.82 |
| | lines | 0.00 | 90.90 |
| `TaskDetailsModal.jsx` | statements | 0.00 | 74.60 |
| | branches | 0.00 | 50.80 |
| | lines | 0.00 | 74.19 |
| `DashboardLayout.jsx` | statements | 75.22 | 91.15 |
| | branches | 50.98 | 70.58 |
| | lines | 79.61 | 92.23 |

TodoView remainder is drag-and-drop status changes and the details-update PATCH path (covered at the modal). TaskDetailsModal remainder is mention suggestions and attachment chrome.

## Tests

### `tixmoapi2/tests/integration/tasks.http.test.ts` (new)

| Name | Status |
| --- | --- |
| creates, lists, reads, patches, comments on, and deletes a task | new, passing |
| rejects unauthenticated task reads and writes | new, passing |
| rejects a user with no organization | new, passing |
| does not let another organization read, change, comment on, or delete a task | new, passing |
| assigns, then unassigns a teammate and event on patch | new, passing |
| returns 404 for a missing task id on get, patch, delete, and comment | new, passing |
| rejects missing title, invalid enums, invalid ids, and empty comments | new, passing |
| notifies an org teammate mentioned in a comment and not a user in another org | new, passing |

Routes expose **PATCH** `/tasks/:id`, not PUT. The dashboard uses PATCH. PUT was not treated as a product bug.

### `tixmoapi2/tests/integration/notifications.http.test.ts` (new)

| Name | Status |
| --- | --- |
| lists only the caller’s notifications and paginates newest first | new, passing |
| filters unreadOnly and leaves read rows off the unread page | new, passing |
| marks one notification as read for the owner and leaves others unread | new, passing |
| marks only the caller’s unread notifications as read | new, passing |
| refuses to mark another user’s notification as read, including a teammate in the same org | new, passing |
| returns 404 for a missing notification id on mark-read | new, passing |
| rejects unauthenticated list, mark-read, and mark-all-read | new, passing |
| rejects invalid pagination and unreadOnly values | new, passing |
| rejects a non-UUID notification id on mark-read (notifications/routes.ts:60) | **new, skipped** |

### `tdash/src/test/TodoView.test.jsx` (new)

| Name | Status |
| --- | --- |
| loads tasks into To Do and In Progress columns | new, passing |
| creates a task from the modal after a title is provided | new, passing |
| keeps the create modal open and alerts when the API refuses the create | new, passing |
| deletes a task after confirmation and skips delete when cancelled | new, passing |
| refetches the board when delete is forbidden | new, passing |
| opens task details from a card View control | new, passing |
| refetches tasks when the event filter changes | new, passing |

### `tdash/src/test/CreateTaskModal.test.jsx` (new)

| Name | Status |
| --- | --- |
| does not call onCreate without a title and closes from Cancel | new, passing |
| creates with event, assignee, priority, and a mention in the description | new, passing |
| does not crash mention suggestions when a user has no last name (CreateTaskModal.jsx:64) | **new, skipped** |

### `tdash/src/test/TaskDetailsModal.test.jsx` (new)

| Name | Status |
| --- | --- |
| posts a comment and does not post blank comments | new, passing |
| alerts and keeps the comment when the API refuses it | new, passing |
| saves an edited title through onUpdate | new, passing |
| assigns a teammate through onUpdate | new, passing |
| sends API enum priority values when the operator edits priority (TaskDetailsModal.jsx:123) | **new, skipped** |

### `tdash/src/test/NotificationBell.test.jsx` (new)

| Name | Status |
| --- | --- |
| shows an unread badge, lists the bell items, and marks one as read on click | new, passing |
| does not show an unread badge when every notification is already read | new, passing |
| does not mark read when the mark-read request is forbidden | new, passing |
| marks every notification as read from the bell (DashboardLayout.jsx:342-346) | **new, skipped** |

`NotificationResilience.test.jsx` on `main` is unchanged (non-array shell crash only).

## Bugs found (not fixed)

App code was not changed. Each bug is an `it.skip` with file:line in the test name.

### 1. Non-UUID mark-read returns 500

- Severity: **medium**
- File: `tixmoapi2/src/api/notifications/routes.ts:60` (`PUT /:id/read` has no UUID param validation); `tixmoapi2/src/api/notifications/service.ts:47-48` (`findUnique`); `tixmoapi2/src/middleware/errorHandler.ts:20-28` (non-`ApiError` → 500)
- Repro: `PUT /api/v1/notifications/not-a-uuid/read` with a valid session
- Expected: 400 validation failure
- Actual: Prisma throws on the invalid UUID; handler returns 500 Internal Server Error
- Test: `rejects a non-UUID notification id on mark-read (notifications/routes.ts:60)`

### 2. Bell has no mark-all-read control

- Severity: **medium**
- File: `tdash/src/layouts/DashboardLayout.jsx:342-346` (`VIEW ALL` has no `onClick`). Product docs `docs/TIXMO_DESCRIPTION_AND_FEATURES.md` §13 require mark-as-read **and** read-all. API `PUT /notifications/read-all` exists and is covered over HTTP.
- Repro: open the notification bell and look for a control that marks every item read
- Expected: a click that `PUT /notifications/read-all` and clears unread badges
- Actual: `VIEW ALL` is a no-op; there is no mark-all-read click
- Test: `marks every notification as read from the bell (DashboardLayout.jsx:342-346)`

### 3. Mention suggestions crash when `lastName` is null

- Severity: **medium**
- File: `tdash/src/features/CreateTaskModal.jsx:64` (`u.lastName.toLowerCase()` with no null guard). Same pattern in `TaskDetailsModal.jsx:101-102`.
- Repro: open Create Task, type `@Ri` in the description, with a teammate `{ firstName: 'Riley', lastName: null }`
- Expected: match on firstName (or skip a missing lastName)
- Actual: `TypeError` on `toLowerCase`
- Test: `does not crash mention suggestions when a user has no last name (CreateTaskModal.jsx:64)`

### 4. Details modal sends title-case priority, not the API enum

- Severity: **low**
- File: `tdash/src/features/TaskDetailsModal.jsx:123-130` (edit `<select>` values `High`/`Medium`/`Low`); `tdash/src/features/TodoView.jsx:207` PATCHes `updatedTask.priority` unchanged. Create path uppercases (`TodoView.jsx:181`). API create validation (`tasks/routes.ts:87`) only allows `LOW`/`MEDIUM`/`HIGH`. PATCH has **no** body enum check, so Prisma can 500.
- Repro: open a task, Edit, change Priority to Low, Save
- Expected: `PATCH /tasks/:id` with `priority: 'LOW'`
- Actual: `onUpdate` receives `priority: 'Low'`
- Test: `sends API enum priority values when the operator edits priority (TaskDetailsModal.jsx:123)`

## CI

All checks on `2c93dccb99dac9ddf30ea8b11384d98e751b3ee4` finished with no failures. `scanner-browser` and `wallet-browser-recovery` did not flake (they passed inside `local-gates`). Draft PR: https://github.com/chapmandaniel/projectTixmo/pull/213

| Check | Conclusion | Link |
| --- | --- | --- |
| local-gates (required) | success, 13m50s | https://github.com/chapmandaniel/projectTixmo/actions/runs/43718018762/job/132823659020 |
| configured-image-restore (required) | success, 3m19s | https://github.com/chapmandaniel/projectTixmo/actions/runs/43718018762/job/132823659255 |
| guard-and-build | success, 1m13s | https://github.com/chapmandaniel/projectTixmo/actions/runs/43718018793/job/132823659159 |
| http-soak | skipped | https://github.com/chapmandaniel/projectTixmo/actions/runs/43718019030/job/132823661265 |

## What was not done

- No application code, lockfile, or design-guard baseline edits
- No merge
- No live payment, staging, production, or Stripe requests
- Task drag-and-drop status changes were not asserted (no HTML5 `dataTransfer` in the main path tests)
- `PUT /tasks/:id` is not registered; only PATCH was tested
