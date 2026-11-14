# T113 new dashboard tests

Tests only. Local/CI Vitest against mocked API responses. No staging, production, or Stripe traffic. No app-code changes.

| | |
| --- | --- |
| Base | `origin/main` `aee54592` (merge of PR #195) |
| Head | recorded after commit on `cursor/t113-dashboard-tests-a680` |
| Command | `npx vitest --run` in `tdash/` with Node `v24.21.0` |
| Coverage | `@vitest/coverage-v8@4.1.12` installed with `--no-save --no-package-lock`; lockfile unchanged |

## Counts

| | Files | Passed | Skipped | Total |
| --- | ---: | ---: | ---: | ---: |
| Before | 66 | 500 | 0 | 500 |
| After | 67 | 524 | 2 | 526 |
| Delta | +1 file | +24 | +2 | +26 |

The +2 skipped cases are documented product bugs, not flakes. They live in the new `EventManagementDashboard.test.jsx`.

## Coverage of the two target components

Measured with `--coverage.include` limited to the two files. Historical T90 figures (`TeamMemberWizard` 1.56 % lines) were from `7f9eaa9` before PR #195. The before column below is this checkout of `main` after #195.

| File | Metric | Before | After |
| --- | --- | ---: | ---: |
| `EventManagementDashboard.jsx` | statements | 0.00 | 100.00 |
| | branches | 0.00 | 94.11 |
| | lines | 0.00 | 100.00 |
| `TeamMemberWizard.jsx` | statements | 85.71 | 100.00 |
| | branches | 92.51 | 96.59 |
| | lines | 87.50 | 100.00 |

Remaining uncovered branches are optional chaining / role-card styling, not untested user paths.

## Tests

Legend: **new** = added in T113. **existing** = already on `main` from PR #195; kept, not duplicated.

### `tdash/src/test/EventManagementDashboard.test.jsx` (new file)

All cases are **new**. Child panels (`ECC_Overview`, `ECC_Orders`, `ECC_Attendees`, `ECC_Tickets`) are stubbed so tab navigation is asserted without repeating those suites. `ECC_Settings` and `EventStudio` stay real for form checks. `GET`/`PUT`/`DELETE` use fake event/ticket/venue payloads.

| Name | What it proves | Status |
| --- | --- | --- |
| shows a loading spinner until a valid event fetch resolves | `/events/:eventId` without router state shows the spinner, calls `GET /events/:uuid` extracted from the friendly slug, then renders the event | new, passing |
| renders immediately from router state without fetching the event | location.state.event skips `GET /events/:id` and still renders | new, passing |
| accepts an event nested under data.event | fetchEvent reads `response.data.event` | new, passing |
| sends the operator back to /events when the event fetch fails | rejected GET navigates to the events list (current error handling) | new, passing |
| sends the operator back to /events when the payload has no event id | payload without `id` uses the same fallback | new, passing |
| shows a fetch error instead of silently leaving the event dashboard | desired error UI; current code only redirects. See Bugs | **new, skipped** |
| navigates between command-center tabs | Overview → Orders → Attendees → Tickets → Settings → Overview, including the `/events/:slug/orders` URL | new, passing |
| opens a nested event route on the matching tab | `/events/:slug/tickets` lands on the tickets panel | new, passing |
| falls back to overview for an unknown sub-route | `/events/:slug/not-a-tab` shows overview | new, passing |
| returns to the events list from the back control | header back control calls `navigate('/events')` | new, passing |
| renders a title-only router-state event from the events list payload | EventsView-shaped `{ title, id }` still renders and can change tabs | new, passing |
| keeps the friendly slug when the event only has a title | desired URL; `generateEventSlug` currently ignores `title`. See Bugs | **new, skipped** |
| applies an in-place event update from a child | `onUpdate(event)` replaces dashboard state without a refetch | new, passing |
| refetches the event when a child update has no id | `onUpdate()` with no id calls `GET /events/:id` again | new, passing |
| requires deletion confirmation on the settings tab | Delete Event does not call the API until confirm; Keep event cancels | new, passing |
| surfaces Event Studio publish validation from the settings tab | Settings → Edit Event → empty title → Publish Event shows `Cannot Publish. Missing: Title` and does not PUT/POST | new, passing |
| keeps a settings deletion error on the event dashboard | confirmed delete that the API rejects stays on the event and shows the server message | new, passing |

### `tdash/src/test/TeamMemberWizard.test.jsx` (extended)

| Name | What it proves | Status |
| --- | --- | --- |
| does not offer a role at or above an admin caller | admin cannot pick Owner/Admin | existing (#195) |
| lets an owner invite a team member through the wizard | happy path `POST /users` with TEAM_MEMBER + `manageEvents` | existing (#195) |
| blocks continuing with an incomplete identity step | empty step 1 shows required-fields error, no POST | existing (#195) |
| only offers Team Member when the caller has no role | `canAssignRole` fallback when `currentUser.role` is missing | **new** |
| blocks continuing with an invalid email address | filled names + `not-an-email` stay on step 1 | **new** |
| goes back from role selection to identity and keeps the filled fields | Back from step 2 restores Jane / jane@example.com | **new** |
| goes back from review to role selection | Back from Send Invite returns to role cards | **new** |
| closes from the first step without posting | Cancel calls `onClose`, no POST | **new** |
| invites a manager without custom permissions | Manager hides permission checkboxes; POST role is `MANAGER` with all flags false | **new** |
| surfaces the API error and stays open when invite fails | `Email already invited` shown; wizard not closed | **new** |
| surfaces a generic failure when the API has no message | fallback `Failed to create team member` | **new** |

### `tdash/src/test/TeamView.test.jsx` (one new case)

| Name | What it proves | Status |
| --- | --- | --- |
| renders TeamMemberWizard from the Add member action | TeamView mounts the wizard heading, identity fields, and Basic Info step without posting | **new** |
| opens the invite wizard and posts a new member | TeamView → wizard → `POST /users` | existing (#195); not duplicated |

The other TeamView cases (role edit, resend, remove visibility) were already on `main` and were not changed beyond inserting the new render test.

## Bugs found (not fixed)

No app files were edited. Both bugs are pinned with `it.skip` and a comment that names file:line, repro, and severity.

### 1. Event fetch failure is a silent redirect

- File: `tdash/src/features/EventManagementDashboard.jsx:34-36`
- Repro: open `/events/:eventId` without `location.state` while `GET /events/:id` rejects (500/403/404).
- Expected: an error on the event dashboard (alert or message).
- Actual: `navigate('/events')` with only `console.error`. The operator sees the events list and no reason.
- Severity: medium
- Test: `shows a fetch error instead of silently leaving the event dashboard`

A passing test documents the current redirect so a later fix cannot drop the fallback without notice.

### 2. Tab URLs drop the friendly slug for title-only events

- File: `tdash/src/features/EventCommandCenter.jsx:232`
- Repro: open an event from EventsView (router state uses `title`, not `name`) and click Orders.
- Expected: `/events/<slug-from-title>-<id>/orders`
- Actual: `generateEventSlug(event.name, event.id)` ignores `title`, so the path becomes `/events/<id>/orders`. Tabs still work.
- Severity: low
- Test: `keeps the friendly slug when the event only has a title`

A passing test (`renders a title-only router-state event…`) proves the EventsView payload still renders.

## What was not done

- No dashboard, API, lockfile, or design-guard baseline edits
- No merge
- No live payment, staging, or production requests
- `ECC_*` panel internals were not re-tested here; they already have their own files
