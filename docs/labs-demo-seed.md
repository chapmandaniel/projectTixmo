# Labs presentation demo data (T123, expanded in T124)

DEMO ONLY. Labs (`labs.tixmo.co`) only. Fake people, fake org, test orders, no Stripe, no real money.

- Seed: `tixmoapi2/scripts/seed-labs-demo.cjs` (fictional org **Northlight Live**, slug `northlight-live-demo`).
- Runner: `tixmoapi2/scripts/run-seed-labs-demo.sh` hashes the demo owner password on your machine and runs the seed inside the
  Railway **labs** `labs-api` container. Both the runner and the seed refuse any target that is not the labs environment / labs Postgres host.
- Re-run any time (idempotent): it deletes only its own rows (the demo org's events, orders, tickets, scans, tasks, approvals, assets,
  and users with `@northlight.example.com` / `+nldemo@example.org` emails), then recreates them with dates relative to now.
  The org row and the demo owner keep their ids, so a signed-in session survives a reseed.

```bash
LOGIN_FILE=/path/to/labs-demo-owner.login \   # line 1 email (@northlight.example.com), line 2 password; mode 600
RAILWAY_BIN=/path/to/railway-4.40.0 \          # websocket ssh relay
BCRYPTJS=/path/to/node_modules/bcryptjs \      # bcryptjs@2.4.3
tixmoapi2/scripts/run-seed-labs-demo.sh
```

Poster/brand images for the seeded assets are served by labs-dash from `tdash/public/demo-assets/`. They are original,
code-drawn SVGs: regenerate them with `python3 tdash/scripts/generate-demo-assets.py` (deterministic).

What the seed creates (T124): 22 staff (3 pending invites), 1,400 fake customers, 7 venues, 19 events (past, live tonight,
on sale, sold out, announced, draft), about 6.5k test orders and 13k tickets spread over six months with orders today,
door scans for past events and tonight's live show, 14 scanners/devices, 8 promo codes, 58 library assets in 17 folders,
15 review requests (pending, changes requested, updated, approved, declined) with comment threads, 54 tasks across all four
board columns, and a recent notification feed.

**Re-run the seed shortly before a presentation.** Dates are relative to the moment it runs (for example "Kitchen Party Social"
starts 70 minutes before the seed runs, so it shows as live with door scans in progress). The Analytics page's GA4 mock
uses the same purchase counts per 7/28/90-day window and the revenue the seed produces for Aurora After Dark, Harbour Lights,
Fog City Strobe and Quiet Harbour Acoustic; if you change those events' orders, update `mockAnalytics.js` from the seed's
`ga bands` output line.
