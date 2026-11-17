# T114 bug fixes from T113 skipped tests

Stacked on PR #211 (`cursor/t113-dashboard-tests-a680`, `dd187696`). Must merge with or after #211. Draft only; no merge, deploy, staging, or `workflow_dispatch`.

| | |
| --- | --- |
| Base of this branch | PR #211 head `dd187696` |
| Branch | `cursor/t114-bug-fixes-0ac3` |
| Head | recorded after commit |
| Local Node | `v22.23.4` (CI uses `24.21.0`) |
| Commands | `npx vitest --run`, `npm run design:guard`, `npm run build` in `tdash/` |

## Root causes

### 1. Medium — silent redirect on event fetch failure

`tdash/src/features/EventManagementDashboard.jsx` catch block (T113: lines 34–36) called `navigate('/events')` after `console.error` when `GET /events/:id` rejected. A 403/404/500 on a hard reload or deep link looked like an empty events list, with no explanation and no retry.

A successful response whose payload has no `id` is a different path (the `else` after `event?.id`). That still falls back to `/events`. A genuine HTTP 404 now stays on the event route and shows a visible not-found/error state instead of navigating away.

### 2. Low — title-only events drop the friendly slug

`tdash/src/features/EventCommandCenter.jsx` tab navigation (T113: line 232) called `generateEventSlug(event.name, event.id)`. EventsView router state uses `title` (`getEventName` prefers `title` then `name`). An event that only has `title` produced `/events/<uuid>/orders` instead of `/events/<slug-from-title>-<uuid>/orders`. Checkout links already used `event.name || event.title`; tab URLs did not.

## Fix summary

1. **Fetch errors stay on the event route.** Catch sets `fetchError` from `error.response?.data?.message`, then `error.message`, then a 404-specific or generic fallback. The screen uses the existing `DashboardPage` / `DashboardEmptyState` / `DashboardButton` pattern (same as ScannersView / AnalyticsView): `role="alert"`, title “Unable to load event”, the server message, **Try again**, and **Back to events**. No new design-guard baseline rows. `design:guard` reported 920 tracked baseline violations and no regressions.
2. **Tab slugs use title when name is missing.** `generateEventSlug(event.name || event.title, event.id)`. When `name` is present, behaviour is unchanged.

Both T113 `it.skip` cases are now `it`. The old passing test that asserted the silent redirect was replaced with retry and back-control coverage so the new UI is locked in.

## Test counts

`npx vitest --run` in `tdash/` (exit 0).

| | Files | Passed | Skipped | Total |
| --- | ---: | ---: | ---: | ---: |
| #211 (`dd187696`) | 67 | 524 | 2 | 526 |
| T114 local | 67 | 527 | 0 | 527 |
| Delta vs #211 | 0 | +3 | **-2** | +1 |

Skipped dropped by 2 as required. The extra passing test is the split of the old silent-redirect case into retry + back-control. Focused file: `EventManagementDashboard.test.jsx` 18 passed / 0 skipped.

Other local checks (both exit 0):

- `npm run design:guard` — passed, 920 baseline, no regressions
- `npm run build` — Vite production build + buyer policy / robots html checks passed

## CI

Filled after GitHub Actions complete on this head. Required checks: `guard-and-build`, `local-gates`, `configured-image-restore`. Target `mergeStateStatus` CLEAN.

| Check | Run id | Conclusion | Re-runs |
| --- | --- | --- | --- |
| guard-and-build | pending | pending | none |
| local-gates | pending | pending | none |
| configured-image-restore | pending | pending | none |

## What was not done

- No merge, deploy, staging, production, or Stripe traffic
- No `workflow_dispatch`
- No lockfile or design-guard baseline edits
- Malformed payload without `id` still redirects to `/events` (not a fetch rejection)
