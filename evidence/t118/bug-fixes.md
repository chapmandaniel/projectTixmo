# T118 bug fixes

Fixes the four T117 QA skips. Draft PR only. No merge, deploy, staging, branch-protection, force-push, `workflow_dispatch`, or retries/skips to get green. Kanban CLI was not available in this Cloud Agent session; assignment, SHA, checks, and wiring are recorded here and on the draft PR.

| | |
| --- | --- |
| Base | `cursor/t117-tasks-notifications-tests-f332` `9174a4c7` (PR #213) |
| Branch | `cursor/t118-qa-bug-fixes-16f2` |
| API command | `npx jest --runInBand` in `tixmoapi2/` with `NODE_OPTIONS=--max-old-space-size=8192` (default reporter) against disposable `tixmo_disposable_t118` + Redis `/1` |
| Dashboard | `npx vitest --run`, `npm run design:guard`, `npm run build` in `tdash/` |

## Bugs

### 1. Non-UUID mark-read returned 500

- **Cause:** `PUT /notifications/:id/read` had no param schema. `prisma.notification.findUnique` threw on `not-a-uuid`; `errorHandler` mapped that to 500.
- **Fix:** `markAsReadSchema` with `z.string().guid('Invalid uuid')` (same pattern as `tierIdSchema` / `approvalIdParamsSchema`) and `validate(validation.markAsReadSchema)` on the route. Invalid ids now 400 `Validation failed`.
- **Test:** `rejects a non-UUID notification id on mark-read (notifications/routes.ts:60)` in `tixmoapi2/tests/integration/notifications.http.test.ts` (un-skipped).

### 2. Bell `VIEW ALL` had no `onClick`

- **Cause:** The dropdown footer button was a no-op. There is no standalone notifications route/page (`App.jsx` has no `/notifications`); the bell is the notifications surface. `PUT /notifications/read-all` already existed.
- **Fix:** Wired `VIEW ALL` to that existing mark-all-read endpoint via a client handler `handleMarkAllRead` — `api.put('/notifications/read-all')`, then local `readAt` on listed items and `unreadCount = 0`. No new API surface.
- **Test:** `marks every notification as read from the bell (DashboardLayout.jsx:342-346)` in `tdash/src/test/NotificationBell.test.jsx` (un-skipped).

### 3. Mention suggestions crashed when `lastName` was null

- **Cause:** `CreateTaskModal.jsx` called `u.lastName.toLowerCase()` (and `u.firstName.toLowerCase()`) with no null guard.
- **Fix:** Match and display names with `String(part || '')` / `[firstName, lastName].filter(Boolean)`. Same for mention insert, initials, and the Assign To labels.
- **Test:** `does not crash mention suggestions when a user has no last name (CreateTaskModal.jsx:64)` (un-skipped). Locator is `getByRole('button', { name: /Riley/ })` so the suggestion is distinct from the Assign To option, which is also `Riley` after the null-safe label.
- **Not in this task:** `TaskDetailsModal.jsx` still has the same unguarded filter (T117 note). Left alone.

### 4. Details modal sent title-case priority

- **Cause:** Edit `<select>` used `High`/`Medium`/`Low`. `TodoView` PATCHes `updatedTask.priority` unchanged. API create validation only allows `LOW`/`MEDIUM`/`HIGH`.
- **Fix:** Option values `HIGH`/`MEDIUM`/`LOW`, labels `High`/`Medium`/`Low`. `toPriorityEnum` uppercases on change and save.
- **Test:** `sends API enum priority values when the operator edits priority (TaskDetailsModal.jsx:123)` (un-skipped). Query uses display `High` (friendly selected label) and change value `LOW` (enum option value). Assertion is still `priority: 'LOW'`.

## Local results

Node `v24.21.0`. Disposable Postgres `tixmo_disposable_t118` on `127.0.0.1`, Redis `/1`. Synthetic JWT/session/Stripe values from the market-readiness workflow. `TIXMO_BROWSER_PATH=/usr/bin/google-chrome`. No staging, production, or live Stripe traffic.

| Check | Result |
| --- | --- |
| `npx jest --runInBand` (`tixmoapi2`, default reporter, `NODE_OPTIONS=--max-old-space-size=8192`) | **184** suites / **1728** passed / **0** skipped (1728). T117 was 1727 passed / 1 skipped. |
| `npx vitest --run` (`tdash`) | **70** files / **519** passed / **0** skipped (519). T117 was 516 passed / 3 skipped. |
| `npm run design:guard` (`tdash`) | passed, **920** tracked baseline violations, **no new rows** |
| `npm run build` (`tdash`) | passed |

API delta vs T117: +1 passed, −1 skipped (the un-skipped UUID mark-read case). Dashboard delta vs T117: +3 passed, −3 skipped.

## What was not done

- No merge, deploy, staging, production, or live payment
- No lockfile or design-guard baseline edits
- No new API routes
- `TaskDetailsModal` mention filter still unguarded (out of T118’s four bugs)
