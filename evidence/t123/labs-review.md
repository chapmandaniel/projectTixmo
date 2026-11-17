# T123 / T125 Labs presentation review (labs.tixmo.co)

DEMO ONLY. Branch `demo/labs-presentation` (PR #218, stacked on #201). Fake data only.

**How it was reviewed:** headless Chrome at 1440px (desktop) and 375px (mobile), clicking every nav tab plus the event workspace tabs (Overview, Orders, Attendees, Tickets) for one live and one past event. Console errors and failed requests were captured on each page.

T125 final smoke: dash `118e750b` (deploy `b520a9d2`), 50 page loads (desktop + mobile, including `/notifications` and `/analytics/classic`), **0 console errors and 0 failed requests**. Screenshots and crawl log: `evidence/t125/screens/`, `evidence/t125/crawl.out`.

## T123 original fix list (11) — unchanged
See the 15 Nov T123 write-up: dedicated demo owner, populated seed, Settings/Audit removed, Security tab, nav fit, demo assets, collapsed sales-pause bar, Home Security tile, hidden dev shortcut, completed test orders only.

## Every remaining T123 item, and the T124 thin list, marked FIXED or DEFERRED

1. **Analytics / Social "Mock data" chip and "Demo numbers only."** — **DEFERRED.** Daniel has not decided; T125 was told to leave these labels as they are.
2. **Labs banner ("Labs · demo/labs-presentation") on every page.** — **DEFERRED.** Same reason: it is the Labs safety marker and Daniel has not decided.
3. **`/analytics/classic` showed "Not synced / Not configured" GA4 panels.** — **FIXED.** That URL now redirects to the populated Analytics dashboard (`/analytics`). Not in the nav; a direct hit no longer shows an empty classic page.
4. **Notification panel "VIEW ALL" was a no-op.** — **FIXED.** It now opens `/notifications`, an inbox of the signed-in user's notifications (mark one or mark all as read). Seeded owner inbox: 24 items, 5 unread, including items from today.
5. **labs-dash SLEEPING after idle, first load is slow.** — **DEFERRED.** Operational, not a code fix. Open the site a minute before presenting.
6. **Social and Analytics headers showed a raw URL pill.** — **FIXED.** The pills were removed. Social now shows a relative "Updated N min ago" line instead. "Mock data" chips were left in place.
7. **At 375px the Tasks event filter was truncated to its first letter.** — **FIXED.** The filter is a full-width select on small screens (`w-full` / `sm:w-56`) and the action row stacks, so event names are readable.
8. **Seeded dates are relative to the seed run.** — **DEFERRED (accepted by design).** Dates stay relative so "today" sales and the live Kitchen Party line up. The T125 seed was re-run on 16 Nov 2026, 09:17 NST. Re-run again shortly before presenting (`docs/labs-demo-seed.md`).
9. **Security tab is a client-side demo report, not wired to real logs.** — **DEFERRED.** Intentional Labs preview with a "Labs preview report" footer. Wiring real logs is out of scope for a fake-data presentation.
10. **Below 1400px the pending-reviews badge sat on the hidden nav icon.** — **FIXED.** The count now sits next to the "Reviews" label at every width (still also in the mobile menu and on Home).

### T124 thin items
11. **Social mock window ended 10 Nov.** — **FIXED.** The mock clock shifts the authored snapshot so the window always ends today in America/St_Johns (`tdash/src/features/socialDashboard/demoClock.js`).
12. **Analytics covered only 4 events and rolled weekly (up to 6 days stale).** — **FIXED.** The event filter lists all 19 seeded events. The mock window ends today; weekday copy follows the shifted spike date.
13. **Staff-action (audit) history was not seeded.** — **DEFERRED.** The Audit tab was removed in T123 at Daniel's request; `/staff-actions` still redirects to Home, so a hidden log would not show in the presentation.
14. **Banner-format thumbnails were cropped in the Reviews grid.** — **FIXED.** Review grid and gallery cards use `object-contain` so wide banners are fully visible.
15. **Security feed order numbers are fixed strings.** — **DEFERRED.** They already match the current seed run's style (NL-######). Regenerating them from live order rows would need an API change that this Labs-only UI pass did not require.
16. **Home "Team Members" shortcut card is hidden by the product default.** — **DEFERRED.** A user can un-hide it; not a broken empty state.

## T125 deploys
- Branch `demo/labs-presentation`, PR #218 kept draft, head `118e750b3b01093333c1f8ae814491f0e27a551e`.
- labs-dash deploy `b520a9d2-3109-48df-92a8-441749904920` SUCCESS 09:17 NST, commit `118e750b`.
- labs-api unchanged: `d3a657fe` / `9f2c523`.
- Rollback: previous dash `367b2218-a8f6-4c92-aba1-f48d6ef3941e` @ `6e9dd81f`; original pre-T123 dash `1141fb05` @ `9c054d4a` (restore `VITE_APP_LABS_BRANCH=preview/social-analytics-combined`).
- Local: vitest 70 files / 518 tests pass; design:guard pass (no regressions).
- PR CI on 118e750b green: local-gates, configured-image-restore, guard-and-build; Railway labs-dash pass.
