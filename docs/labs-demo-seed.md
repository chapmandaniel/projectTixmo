# Labs presentation demo data (T123)

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

Poster/brand images for the seeded assets are served by labs-dash from `tdash/public/demo-assets/`.
