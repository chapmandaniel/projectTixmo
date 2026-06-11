# Mobile QA Pass

Date: 2026-06-03

Scope:

- Event operations and event command center.
- Scanner setup and scan logs.
- Approvals dashboard and external review route.
- Asset library and shared asset links.

## Changes Made

- Event Command Center now uses stacked mobile navigation and keeps the collapsible side rail for large screens.
- Scanner Management now renders card-first mobile layouts for active scanners and scan logs, while preserving desktop tables at tablet/desktop widths.
- Scanner API response parsing now accepts both flat and nested response payloads.
- Scanner last-active display accepts `lastUsedAt`, matching the API model, with `lastActiveAt` as a fallback.

## Verification

Passed:

```bash
npm --prefix tdash test -- --run
npm --prefix tdash run design:guard
npm --prefix tdash run build
git diff --check
```

Screenshot-backed mobile sweep:

- Viewport: 390px wide, headless Chrome.
- Evidence folder: `docs/mobile-qa-screenshots/`.
- Routes checked:
  - `/events/:eventSlug`
  - `/events/:eventSlug/orders`
  - `/events/:eventSlug/attendees`
  - `/events/:eventSlug/tickets`
  - `/approvals`
  - `/assets`
  - `/scanners`
  - `/review/market-demo-approval-token`
  - `/assets/shared/market-demo-share-token`
- Result: every checked route reported `scrollWidth: 390`, `viewportWidth: 390`, and `overflow: false`.

Coverage added:

- `tdash/src/test/ScannersView.test.jsx` verifies scanner mobile card rendering.
- `tdash/src/test/ScannersView.test.jsx` verifies scan-log mobile card rendering.

Related existing coverage that stayed green:

- `SharedAssetFolderPage.test.jsx`
- `ExternalReviewPage.test.jsx`
- `ApprovalsDashboard.test.jsx`
- `ApprovalDetailView.test.jsx`
- `AssetLibraryView.test.jsx`
- `EventsView.test.jsx`

## Visual Signoff

The in-app browser runtime was unavailable, so the sweep used Playwright with system Chrome instead. This completes the screenshot-backed mobile QA pass for the selected beta operator, reviewer, and shared-link surfaces.

The remaining real-device checks stay covered by the separate scanner/offline field test and production-like external reviewer task.
