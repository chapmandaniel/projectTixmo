# T129 — Moose chat on the Analytics dashboard (Labs presentation)

Draft PR https://github.com/chapmandaniel/projectTixmo/pull/218 (DEMO ONLY, do not merge).
Branch `demo/labs-presentation`. Fake Northlight data only. No LLM, no API keys, no network calls for answers. Mock-data chips and Labs banner left unchanged.

## Commits and deploy

- Deployed code: `a6bb6b591e683384e943e71da971eaa121fa772f` (`DEMO T129: keep Analytics chart and Moose the same height`), on top of `dc5f2b54a9141cc8a40ad6aa757ec45595b1a2a1` (Moose chat + layout).
- labs-dash deploy **`fcb2408e-3cac-4e23-a2fa-9418c4113697`** SUCCESS @ `a6bb6b59` at 11:35:43 NST (America/St_Johns), `VITE_APP_LABS_BRANCH=demo/labs-presentation`.
- labs-api unchanged `d3a657fe-4abf-4a56-9429-766f32ccda25` / `9f2c523bb3c37f852123668a007b34fa88e7d8f9`.
- Rollback (T128): dash `94c93b99-a81a-43c0-a50e-568b9ba1c18d` @ `12b4d8a106cf9cdb5f0954020fe83dee258bfdb2`. Original restore remains `1141fb05` @ `9c054d4a` + `VITE_APP_LABS_BRANCH=preview/social-analytics-combined`.

## What /analytics now shows

- Moose, Tixmo's AI assistant, sits in a chat card with four suggested-question chips and a free-text input.
- Desktop: the large graph is on the left and Moose is on the right, same height, at the top of the page. The four stat blocks (Visitors, Page views, Avg time on site, Purchases) sit in one horizontal row below the chart area.
- Mobile (375): graph first, then Moose, then the four blocks in a 2x2 grid.
- Answers are generated on the client by a rule/template engine over the currently loaded analytics (page + date-range filters). A short typing delay is used. Unmatched questions fall back to a helpful summary that cites the visible numbers (e.g. "How many visitors do we have?" → 1,180 visitors, 2,460 page views, 118 purchases on Aurora After Dark for the last 28 days).
- Chip answers on the default view: Harbour Lights Festival is selling fastest (540 purchases); last weekend (Sat Nov 14–Sun Nov 15) compared with the weekend before; buyers are coming mainly from Organic Social and St. John's; next promotion starts at the ticket-path drop-off to Added to cart.

## Tests, CI, smoke

- Local: tdash vitest 71 files, 527 passed (includes mooseAnswers unit tests + dashboard UI coverage); design:guard passed (920 baseline, no regressions).
- CI on `a6bb6b59`: guard-and-build pass, configured-image-restore pass, Railway labs-dash pass (deploy fcb2408e). http-soak skipped. local-gates run 43892430149 was still running at first write.
- Smoke 50/50 routes at 1440 and 375, console 0, failed requests 0 (after a cooldown; an earlier pass hit labs-api 429s on the mobile half). Each chip plus one free-text question was asked on both viewports.
- Screenshots in `evidence/t129/screens/`, including:
  - `desktop-analytics-hero.png` / `mobile-analytics-hero.png` (layouts)
  - `desktop-analytics-stats.png` / `mobile-analytics-stats.png` (four blocks)
  - `desktop-analytics-moose-q1.png` … `q4.png` and `-free-text.png` (and mobile equivalents)

## Deferred

- Moose is deliberately not a real LLM. It only answers from the analytics already on the page (plus a client-side comparison across seeded events for "which event is selling fastest?").
