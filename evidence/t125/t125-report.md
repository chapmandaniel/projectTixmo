# T125 — Finish the Labs presentation demo (Lead SWE)

Scope: Labs only, branch `demo/labs-presentation` (draft PR #218). Fake data only (Northlight Live, `*.example.com`). Mock-data chips and the Labs banner left unchanged.

## Code
- Commit: `118e750b3b01093333c1f8ae814491f0e27a551e` (`DEMO T125: finish the Labs presentation demo surfaces`).
- PR #218 remains draft; not merged. main / staging / prod untouched. labs-api not redeployed.

## Deploys
- labs-dash **`b520a9d2-3109-48df-92a8-441749904920`** @ `118e750b` SUCCESS 09:17 NST (America/St_Johns).
- `VITE_APP_LABS_BRANCH=demo/labs-presentation` re-asserted with skipDeploys before the pin.
- labs-api unchanged: `d3a657fe-4abf-4a56-9429-766f32ccda25` / `9f2c523`.
- Rollback: dash `367b2218-a8f6-4c92-aba1-f48d6ef3941e` @ `6e9dd81f`; original `1141fb05` @ `9c054d4a` + `VITE_APP_LABS_BRANCH=preview/social-analytics-combined`.

## Tests / CI
- Local tdash: vitest 70 files / 518 tests pass; design:guard pass (920 baseline, no regressions).
- No tixmoapi2 code change; API Jest not re-run.
- PR checks on `118e750b` all green: local-gates pass (13m24s, run 43869410045), configured-image-restore pass, guard-and-build pass, Railway labs-dash pass (deploy b520a9d2). http-soak skipped by design.

## Seed (re-run with Railway CLI 4.40.0 after a failed 5.x ssh attempt)
`seed-run-1.log` is the refused 5.x SSH (no keys). `seed-run-2.log` rc=0.
Counts vs T124 (identical structure; "today" shifted to this run):

| | T124 | T125 |
|---|---|---|
| team / pending / customers / venues | 22 / 3 / 1,400 / 7 | same |
| events (by status) | 19 (ON_SALE 8, COMPLETED 6, SOLD_OUT 1, PUBLISHED 2, DRAFT 2) | same |
| ticket types / orders / tickets / scans | 41 / 6,565 / 13,030 / 6,476 | same |
| orders today / scans today | 156 / 216 | **115** / 216 |
| paid orders / test revenue CAD | 6,437 / 986,106.03 | 6,437 / **986,180.90** |
| scanners / promo / assets / reviews / tasks / notifications | 14 / 8 / 58 / 15 / 54 / 36 (owner unread 5) | same |

Owner inbox on `/notifications` shows 24 of those 36 (the rest belong to other seeded staff).

## Smoke
50 route×viewport loads at 1440 and 375, including `/notifications` and `/analytics/classic` (redirects to `/analytics`): **console 0, failed 0**. `crawl.out`, `screens/crawl.json`, 51 PNGs in `screens/` (incl. `mobile-menu.png`). Mobile menu: Home, Events, Tasks, Team, Assets, Reviews (badge 5), Analytics, Security, Social. Settings and Audit still redirect to Home.

## Still thin / deferred
- "Mock data" chips and the Labs banner (Daniel's call).
- Security report remains a client-side Labs preview.
- Audit history not seeded (Audit tab removed).
- labs-dash may sleep when idle; open a minute before presenting.
- Seeded dates are relative — re-run the seed shortly before presenting.
- Home "Team Members" shortcut still hidden by the product default.
