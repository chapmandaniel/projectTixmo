# Showpass fixture import, local and Railway

Branch: `cursor/vendor-import-showpass-5658`.

This is the fixture-only Showpass import. `SHOWPASS_ADAPTER=live` is a stub and throws before any network call. Nothing in the API, tests, seed, or CI fetches `showpass.com`.

## Local run

Node must be `>=24.21.0 <25` (`engines` in `tixmoapi2/package.json` and `tdash/package.json`). npm 11 may warn that install scripts for `prisma`, `@prisma/client`, `@prisma/engines`, `@parcel/watcher`, `unrs-resolver`, and `@scarf/scarf` are not covered by `allowScripts`. `npm run build` still runs `prisma generate`.

Postgres and Redis come from `tixmoapi2/docker-compose.yml`. From the repo root:

```bash
npm run dev:services
```

That starts compose services `postgres` (`postgres:14-alpine`, container `tixmo_postgres`, user `tixmo`, password `tixmo_dev_password`, database `tixmoapi`, host port `5432`) and `redis` (`redis:7-alpine`, container `tixmo_redis`, host port `6379`, no password). Those match `tixmoapi2/.env.example`.

```bash
cp tixmoapi2/.env.example tixmoapi2/.env
cp tdash/.env.example tdash/.env
```

In `tixmoapi2/.env`, set `SHOWPASS_ADAPTER=fixture` and `SHOWPASS_SYNC_INTERVAL_MINUTES=5`. Generate secrets and paste them into that file. Do not commit them:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run that once each for `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`, and `VENDOR_CREDENTIAL_KEY` (the last one must stay 64 hex characters). `DATABASE_URL` and `REDIS_URL` can stay as copied from `.env.example`. `tdash/.env` keeps `VITE_API_URL=/api/v1`.

```bash
npm ci --prefix tixmoapi2
npm --prefix tixmoapi2 run build
npm ci --prefix tdash
npm --prefix tixmoapi2 run migrate
npm --prefix tixmoapi2 run db:seed:showpass
```

The default seed mode is `fresh-org` (QA). It creates organization `fixture-festival` and, when that login does not already exist, user `organizer@example.test` with password `FixtureOrganizer1!`. It does not connect Showpass and does not import events. It does create the Polygon collider, the scanner key file, and the webhook secret file. `GET /api/v1/organizations/{id}/showpass` is `{ "success": true, "data": null }`.

Demo data is a separate mode. It connects `sp_demo_valid_key` and imports Dublin, Mardi Gras, and Giants:

```bash
SHOWPASS_SEED_MODE=connected npm --prefix tixmoapi2 run db:seed:showpass
```

`node dist/scripts/seed-showpass.js --connected` is the same mode. `--fresh-org` forces the QA mode.

API: `npm --prefix tixmoapi2 start` listens on port `3000` (`PORT` in `.env.example`). Dashboard: `npm --prefix tdash run dev` at `http://localhost:5173`. Vite proxies `/api` to `http://localhost:3000`. Sign in and open `http://localhost:5173/settings/integrations`.

QA should use `fresh-org`, then connect `sp_demo_valid_key` with venue id `fixture` in the UI. Use `connected` only when you want the imported demo already stored.

## What you need

API process:

- `DATABASE_URL` for the database you mean to change
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`
- `VENDOR_CREDENTIAL_KEY`: 64 hex characters. Generate it and put it only in the environment:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- `SHOWPASS_ADAPTER=fixture` so the admin fixture switch is mounted. Any value other than exactly `fixture` (including unset) makes that route return **404** `FIXTURE_CONTROL_DISABLED`. The import adapter itself still uses the fixture files unless the value is `live`.
- `SHOWPASS_SYNC_INTERVAL_MINUTES`: integer minutes from 1 to 10080. Sandbox value `5`. Default 60 when unset or invalid. Applied when a connection is created. `PUT .../config` can change it later. `POST .../sync` runs one cycle immediately.
- `REDIS_URL` when you sync or run `db:seed:showpass` (the seed runs one sync to store sold counts). Connect, preview, and import do not take the Redis lock.
- `PAYMENT_CURRENCY=cad` on a production boot. Stripe keys are not required for this flow.

Dashboard process:

- `VITE_API_URL` (see `tdash/.env.example`). Local Vite proxies `/api` to the API. No Showpass secret belongs in the dashboard.

Optional for this flow: `SENTRY_DSN`, `POSTMARK_SERVER_TOKEN`, `STRIPE_SECRET_KEY`, `SHOWPASS_FIXTURE_REVISION`, `SHOWPASS_FIXTURE_REVOKED_KEYS`, `SHOWPASS_FIXTURE_SHIFT_DAYS`, `RELEASE`.

## Railway command order

Run these in the API container, in this order. `npm run db:seed` is a no-op (`prisma/seed-minimal.js`) and does not load fixtures.

1. `npm run migrate` (`prisma migrate deploy`). The image start script also migrates before listen. Run it yourself before bootstrap so the owner tables exist.
2. `npm run db:bootstrap` with `BOOTSTRAP_ALLOW_PRODUCTION=true` in production, plus `BOOTSTRAP_OWNER_EMAIL`, `BOOTSTRAP_OWNER_PASSWORD` (12+ characters with upper, lower, digit, and symbol), `BOOTSTRAP_OWNER_FIRST_NAME`, `BOOTSTRAP_OWNER_LAST_NAME`, `BOOTSTRAP_ORGANIZATION_NAME`, `BOOTSTRAP_ORGANIZATION_SLUG`. Bootstrap refuses a second owner. It does not print the password.
3. `npm run db:seed:showpass` (`node dist/scripts/seed-showpass.js`). Build the image first so `dist/scripts/seed-showpass.js` exists. Requires `VENDOR_CREDENTIAL_KEY` and `SHOWPASS_ADAPTER` not set to `live`. The seed sets `fixture` for its own process. `connected` mode calls `connectRedis()` before the sold-count sync. Either mode disconnects Redis and Prisma and exits.

Default mode is `fresh-org`: organization `fixture-festival` is not connected and nothing is imported. `SHOWPASS_SEED_MODE=connected` (or `--connected`) connects and imports on that same QA organization, not on a bootstrapped owner organization. The QA login password `FixtureOrganizer1!` is not printed. A bootstrapped owner stays a separate organization. If an owner already exists, the QA user is `ADMIN` on `fixture-festival`.

It writes two files and prints only their paths:

- Scanner API key: `SHOWPASS_QA_SCANNER_KEY_FILE` or `tmp/showpass-qa-scanner.key`
- Webhook secret: `SHOWPASS_QA_WEBHOOK_SECRET_FILE` or `tmp/showpass-qa-webhook-secret`

Re-running the seed keeps the webhook secret already in that file, rewrites the scanner key file from the existing QA scanner, resets the stored fixture revision to `baseline`, and clears stored revoked keys.

Stdout JSON includes the collider id and slug, the Dublin event id, shifted start and end times, and per-fixture sold counts. It does not include the API key, webhook secret, scanner key, password, or `VENDOR_CREDENTIAL_KEY`.

Demo API key for connect and for the seed: `sp_demo_valid_key`. `sp_demo_revoked_key` is revoked in `fixtures/showpass/auth.json`.

## Boot when Sentry, Postmark, or Stripe is unset

- **Sentry.** Unset or placeholder `SENTRY_DSN` skips `initSentry`. The process still boots. Connect, preview, import, sync, and webhooks do not need Sentry.
- **Postmark.** Unset `POSTMARK_SERVER_TOKEN` does not stop boot. In production, sending mail throws `MailDeliveryError` ("No production email provider is configured."). Fixture sync failures write a `Notification` row. They do not send email.
- **Stripe.** Unset `STRIPE_SECRET_KEY` does not stop boot and is not read by connect, preview, import, or sync. Checkout on an `EXTERNAL` event is refused with `EXTERNAL_TICKETING` before Stripe. Production boot still requires `PAYMENT_CURRENCY` (use `cad`). That is separate from the Stripe secret.

Redis down: boot continues after a short wait. Sync and the backup sync job fail with **503** "Unable to acquire a consistency lock while Redis is unavailable" when the lock cannot be taken. Connect, preview, and import do not take that lock.

`GET /ready` does not include a commit. `GET /health` returns `release` from `RELEASE`, then `RAILWAY_GIT_COMMIT_SHA`, or `null` when both are empty. `GET /api/v1/health` does not include the commit.

## Fixture control

`PUT /api/v1/organizations/{organizationId}/showpass/fixtures`

Authenticated `OWNER` or `ADMIN` only (same gate as the other Showpass org routes). Another role is **403**. Missing auth is **401**.

When `SHOWPASS_ADAPTER` is not exactly `fixture`, the response is **404** and the body code is `FIXTURE_CONTROL_DISABLED`:

```json
{ "success": false, "message": "Showpass fixture control is disabled", "code": "FIXTURE_CONTROL_DISABLED" }
```

Request body (at least one field):

```json
{ "revision": "baseline", "revokedKeys": ["sp_demo_valid_key"] }
```

`revision` is `baseline` or `current`. `revokedKeys` replaces the stored list. The boot list `SHOWPASS_FIXTURE_REVOKED_KEYS` is always unioned with it and is not cleared by this call.

Success **200**:

```json
{ "success": true, "data": { "revision": "baseline", "revokedKeys": [], "shiftDays": 0 } }
```

`SHOWPASS_FIXTURE_REVISION`, when set, wins over the stored revision. Leave it unset on Railway so this endpoint and the seed default (`baseline`) apply. A fresh seed stores `baseline`.

Dates shift by `shiftDays` whole local days so each event keeps its wall clock and timezone. The seed stores that shift. Fingerprints stay stable until the shift row changes.

## AC-1 connection

`GET /api/v1/organizations/{organizationId}/showpass` with no stored connection:

```json
{ "success": true, "data": null }
```

An invalid key such as `sp_demo_revoked_key` is **400** `{ "message": "Invalid token." }` and does not create a row. The UI treats 401 as a logged-out session, so credential failure stays 400.

## AC-2 changed revision

`fixtures/showpass/events/mardi-gras.changed.json` compared with `events/mardi-gras.json` (`sp-evt-1563243`):

- name becomes `George Street Association Presents: MARDI GRAS 2026 — Late Show`
- `starts_on` moves from `2026-10-31T21:30:00Z` to `2026-10-31T22:30:00Z`
- ticket `4581610` price moves from `25.00` to `30.00`
- ticket `4581610` name in the file also changes to `General Admission - 19+ (Revised)`
- timezone stays `Canada/Newfoundland`
- `ends_on` stays `2026-11-01T06:30:00Z`
- VIP ticket `4581612` name and price stay the same

The preview `diff` object includes `name`, `startsOn`, and `ticket:4581610` (the price). It does not include the ticket name. It does not include timezone, because the timezone id did not change.

## AC-7 sync

`SHOWPASS_SYNC_INTERVAL_MINUTES` sets the interval used for the next automatic run (sandbox: `5`).

One manual cycle, organizer-facing (`OWNER` or `ADMIN`):

`POST /api/v1/organizations/{organizationId}/showpass/sync`

The dashboard button **Sync now** calls that path. One call is one sync. After the key is revoked, that one call records `REVOKED` and a notification. It does not keep looping inside the request.

## AC-8 collider and Dublin

The seed creates a Tixmo event with slug `halloween-at-the-polygon-gallery` so importing fixture `sp-evt-1543494` takes `halloween-at-the-polygon-gallery-1`. The seed JSON prints that row as `collider.id` and `collider.slug`.

Dublin is fixture `sp-evt-1545631`, file `fixtures/showpass/events/pumpkins-dublin.json`, timezone `Europe/Dublin`, local start **17:15**. The seed JSON prints the shifted `startsOn` and `endsOn` actually stored.

## AC-9 lists on an external event

The seed does not create a ticket, order, or waitlist row on a vendor event. Reads scoped to that event are refused with **403** `data.code` `EXTERNAL_TICKETING`:

- `GET /api/v1/orders?eventId={dublin}` capability `orders`. Commit `33b0760b` removed this guard, so the list returned an empty 200. The guard is restored.
- `GET /api/v1/tickets?eventId={dublin}` capability `attendees`
- `GET /api/v1/promo-codes?organizationId={org}&eventId={dublin}` capability `promo_codes`
- `GET /api/v1/waitlists/status?eventId={dublin}` capability `waitlists`
- `GET /api/v1/scanners/logs?eventId={dublin}` capability `scan`

`POST /api/v1/orders`, promo create, waitlist join, and registering a scanner bound to the event are the same 403.

## Currencies and shifted Mardi Gras starts

Fixture `venue.currency` is `EUR` only on `events/pumpkins-dublin.json`. Polygon, Giants, and both Mardi Gras files are `CAD`. A 92-day shift keeps Newfoundland wall time: baseline `2026-10-31T21:30:00Z` (19:00 NDT, UTC−2:30) becomes `2027-01-31T22:30:00.000Z` (19:00 NST, UTC−3:30). The current revision `2026-10-31T22:30:00Z` (20:00 NDT) becomes `2027-01-31T23:30:00.000Z` (20:00 NST). The preview diff of those shifted instants is `22:30Z` to `23:30Z`. `connected` seed stores one festival `currency` from the first imported catalog event. Catalog order puts Dublin first, so that value is `EUR`. Event rows do not have their own currency column.

## AC-9-S scan and validate

Header name: `Authorization`. Value: `Bearer ` plus the scanner key from the seed file (the raw `sk_scanner_...` key is also accepted).

Made-up code, no ticket row (use the Dublin event id from the seed JSON):

`TICKET:00000000-0000-4000-8000-000000000000:MADE-UP:{dublinEventId}`

Scan:

`POST /api/v1/scanners/scan`

```json
{ "qrData": "TICKET:00000000-0000-4000-8000-000000000000:MADE-UP:{dublinEventId}", "scanType": "ENTRY" }
```

Validate (offline batch). The external-ticketing refusal is the HTTP status, not a per-row 200:

`POST /api/v1/scanners/validate`

```json
{
  "scans": [
    {
      "qrData": "TICKET:00000000-0000-4000-8000-000000000000:MADE-UP:{dublinEventId}",
      "scannedAt": "2026-11-02T12:00:00.000Z",
      "scanType": "ENTRY"
    }
  ]
}
```

Both return **403**:

```json
{
  "success": false,
  "message": "This event is sold by an external ticketing vendor. Tixmo does not offer this action for vendor-sold events.",
  "data": { "code": "EXTERNAL_TICKETING", "capability": "scan" }
}
```

## Webhook secret

The secret is not an environment variable. It is stored on the organization row `vendor_connections.webhook_secret_ciphertext` (AES-256-GCM with `VENDOR_CREDENTIAL_KEY`). The API never returns the secret or the ciphertext.

Create it on `POST /api/v1/organizations/{organizationId}/showpass/connection` with body field `webhookSecret`. Rotate it with `PUT /api/v1/organizations/{organizationId}/showpass/config` and a new `webhookSecret`. Each write replaces the ciphertext.

The seed creates a test-only secret unique to that database, writes it to the webhook secret file above, and stores the ciphertext on the owner organization. Showpass signs `HMAC-SHA1` of the invoice `id` only. Header: `X-SHOWPASS-SIGNATURE`. Replay of the same invoice id and event type is idempotent. A later body with a different quantity and the original signature is **409** and does not change the sold count. Quantities are taken only from signed `invoice_items`.

`POST /api/v1/vendors/showpass/webhook` is the receiver.

## Giants have no count

`sp-evt-1530323` is not in `fixtures/showpass/sold-counts.unverified.json`. `GET .../showpass/sold-counts?eventId={giantsEventId}` returns one row per imported ticket type with `soldCount: null`. The dashboard prints `no count`. A stored `0` would print `0`. The seed imports this event so those null rows exist.

## Category and event list paging

`PUT /api/v1/events/{id}` with `{ "category": "festival-notes" }` updates an `EXTERNAL` event. Category is Tixmo-owned. Sync does not clear it. Ticketing mode stays `EXTERNAL`.

Organizer list `GET /api/v1/events`:

- `page` default 1, integer, minimum 1
- `limit` default 20, integer, maximum 100
- `organizationId`, `venueId` (uuid)
- `status`: `DRAFT`, `PUBLISHED`, `ON_SALE`, `SOLD_OUT`, `CANCELLED`, `COMPLETED`, `DELETED`
- `search` (title and description, max 200 characters)

Response `data.pagination` is `{ page, limit, total, pages }`.

Public list `GET /api/v1/events/public`:

- `page` default 1
- `limit` default 20, maximum 100
- `category` (max 100)
- `search` (max 200)

Only `PUBLISHED`, `ON_SALE`, and `SOLD_OUT` events whose `endDatetime` is still in the future. A null end is hidden. `GET /api/v1/events/public/{slug}` is not date-filtered.

Deleted list `GET /api/v1/events/deleted`: `organizationId`, `page` default 1, `limit` default 20 maximum 100, `search`.

Fixture files live in the image at `/app/fixtures/showpass` (`COPY fixtures/showpass` in the final stage). The compiled adapter reads that directory from `dist/services/vendors`.
