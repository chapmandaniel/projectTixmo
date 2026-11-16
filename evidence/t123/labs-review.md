# T123 Labs presentation review (labs.tixmo.co)

DEMO ONLY. Branch `demo/labs-presentation` (PR #218, stacked on #201). Fake data only.

**How it was reviewed:** headless Chrome at 1440px (desktop) and 375px (mobile), clicking every nav tab plus the event workspace tabs (Overview, Orders, Attendees, Tickets) for one live and one past event. Console errors and failed requests were captured on each page.
1. Before: dash 9c054d4a with the labs-swe login, unseeded.
2. After the seed: same dash, with the new demo owner.
3. Final smoke: dash `cbc22001`.

## Final smoke (dash cbc22001, 2026-11-15 ~20:40 NST)
- 44 page loads (22 desktop, 22 mobile) had **0 console errors and 0 failed requests**.
- Nav at 1440px and 1280px: all 9 tabs fit with no overflow. They are Home, Events, Tasks, Team, Assets, Reviews, Analytics, Security, Social.
- The mobile menu has the same 9 entries and no Settings or Audit.
- `/settings`, `/settings/integrations` and `/staff-actions` all redirect to Home.
- The Security tab renders "All systems healthy", "Last scanned N min ago", 6/6 healthy sources and the activity feed.

## Fixed (11)
1. **Wrong demo login.** The demo login (labs-swe) is a TEAM_MEMBER, not an owner. That caused:
   - Tasks: "Insufficient permissions / Error Code 403" modal.
   - Team: "Failed to load team members", 0 members.
   - Scanners: "Unable to load scanners" plus a 403 modal.
   - Events: a 403 on /scanners.
   - Analytics classic: 3× 403.
   - Console errors on 4 pages.

   **Fix:** a dedicated demo OWNER (Avery Quinlan, Northlight Live) and a seeded org.
2. **Every data page was empty.** Events, Orders ("No transactions found"), Venues, Approvals, Assets (0), Tasks (all 0), Team and Notifications were all empty. **Fix:** an idempotent demo seed with:
   - 7 events, 16 ticket types, about 2.3k test orders and about 5.9k tickets
   - 1.9k door scans, 6 scanners and 4 venues
   - 9 team members, 14 tasks, 5 approvals, 10 assets and 7 notifications
3. **Settings tab** showed only a recycle bin and "Owner or administrator access required". Removed from desktop and mobile nav; the routes redirect to Home.
4. **Audit tab** showed "Only an owner or admin can read this log" or "No staff actions yet". Removed from the nav; `/staff-actions` redirects to Home.
5. **No Security story.** Added a Security tab: a log analysis and activity report with green Healthy indicators per source (sign-ins, API, payments, admin, door scanning, infrastructure). It shows events analyzed, small "threats blocked" counts, a last-scanned time relative to now, and the recent activity feed.
6. **Nav overflow.** Once Security was added, "Social" was cut off at 1440px, and at 1280px the nav overflowed by about 210px. **Fix:**
   - "Review Portal" renamed to "Reviews" in the nav.
   - Tighter padding.
   - Icons shown only from 1400px up.
7. **Broken images.** Approvals and asset thumbnails pointed at missing files. **Fix:** demo posters and brand SVGs are now served from `/demo-assets/`.
8. **Event workspace** opened on an emergency "Pause / Resume new sales … requires incident review" form. It is now collapsed into a one-line "New ticket sales: not paused · Sales controls" bar.
9. **Home** had a Settings tile. It is now a Security tile.
10. **Header** had a `>_` developer-terminal shortcut. It is now hidden (the `/dev` route still exists).
11. **Orders** opened on "Pending" checkouts in the first seed. The seed now creates only completed test orders (plus a few refunds).

## Remaining (10), with no fix made
1. Analytics and Social still show a "Mock data" chip and "Northlight Live (demo). Demo numbers only." I left these on purpose as honest labelling of fabricated numbers. Removing them is a decision for Daniel or the PM.
2. The Labs banner ("Labs · demo/labs-presentation") is on every page. It is the Labs safety marker, so I kept it.
3. `/analytics/classic` (not in the nav; direct URL only) shows "Not synced / Not configured" GA4 panels.
4. The notification panel's "VIEW ALL" does nothing on this stack. It is fixed in #214, which is not part of #201.
5. labs-dash was SLEEPING before deploy, so the first load after idle can be slow. Open the site a minute before presenting.
6. Social and Analytics headers show a raw URL pill (for example `https://labs.tixmo.co/social`). This is cosmetic.
7. At 375px the Tasks event filter select is truncated to its first letter. This is cosmetic.
8. Seeded dates are relative to the seed run. Re-run the seed shortly before the presentation (see `docs/labs-demo-seed.md`) so "today" sales and upcoming/past events line up.
9. The Security tab is a client-side demo report, not wired to real logs. A small footer reads "Labs preview report".
10. Below 1400px the nav hides icons, so the pending-reviews badge sits on the hidden icon and is not visible there. It still shows on Home and in the mobile menu.
