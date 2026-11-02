# Brand checker

Signed-out daily checker for Tixmo brand protection. It looks for public social posts and profiles that impersonate a client organization, fake contests and giveaways, false claims of association, and lookalike domains.

It does not monitor ticket resale or marketplace sites. Kijiji, Craigslist, and Facebook Marketplace URLs are dropped and never requested.

The checker has no database access. It submits to the Tixmo API over HTTP:

- `POST /api/v1/brand-protection/ingest/matches`
- `POST /api/v1/brand-protection/ingest/status`
- `POST /api/v1/brand-protection/ingest/verifications`

The bearer token is a `gwc_…` checker token. One run does the day's pass and exits. Running it again is safe: the API keeps a single row per organization and source URL.

## Sources

| Source | How it is read | Stop condition |
| --- | --- | --- |
| X | Official API v2 only (`/2/users/by`, `/2/tweets/search/recent`) with `X_BEARER_TOKEN` | HTTP 4xx/5xx stops X for that run. No tight retry. |
| Reddit | Official OAuth API only (`client_credentials`, then `oauth.reddit.com`) | HTTP 4xx/5xx stops Reddit for that run. |
| Facebook | Signed-out public page HTML, slow interval, identifying User-Agent | First login wall, captcha, or block stops Facebook for that run. |
| Instagram | Same as Facebook, on `instagram.com` profile URLs only | Same stop rule. |
| Lookalike domains | `crt.sh` JSON with a file cache and backoff, plus an optional official search API | Search-engine hosts are refused. The stored value is the hostname only. |

Reddit's commercial API terms have to be registered before this checker is offered as a paid feature. The `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` used here are for that registered app, not a personal logged-in account.

Facebook and Instagram use no account at all. The User-Agent is `TixmoBrandChecker/1.0 (+CHECKER_CONTACT_URL)`. The default gap between page reads is 15 seconds (`PUBLIC_PAGE_INTERVAL_MS`). A login page, captcha, or block is reported with `ingest/status` (`LOGIN_PROMPT`, `CAPTCHA`, or `BLOCKED`) and that platform is not requested again in the same run. The checker does not retry around the wall, rotate addresses, or change its User-Agent.

Phone numbers and email addresses are sent only in `evidencePhones` and `evidenceEmails`. They are not written to the checker log. Checker tokens are not written to the log.

If the Tixmo API returns HTTP 429, 401, or 404, the checker writes a failed run report, prints an `ALERT` line, and exits. It does not retry.

## Targets

`GET /api/v1/brand-protection/ingest/targets` returns verified official accounts for active organizations when the checker token includes `targets:read`. That scope is not on ingest-only tokens, and the API grants it only to a platform admin. Outside `--fixtures`, a token with the scope loads those accounts from the API, at most 20 pages. A full 20th page logs a warning and stops. Names and domains still come from the watchlist file when it exists. A `403` means the token lacks the scope, and the checker uses the watchlist file. `--fixtures` always uses the watchlist file and does not call the route. HTTP 401, 404, or 429 from the targets route stops the run the same way an ingest error does.

`TIXMO_WATCHLIST_PATH` points at a JSON file used for fixtures, for tokens without `targets:read`, and for names and domains:

```json
{
  "organizations": [
    {
      "organizationId": "uuid",
      "names": ["Harbour Fest"],
      "domains": ["harbourfest.example"],
      "accounts": [
        {
          "platform": "X",
          "platformAccountId": "1000000001",
          "handle": "harbourfest",
          "profileUrl": "https://x.com/harbourfest",
          "displayName": "Harbour Fest"
        }
      ]
    }
  ]
}
```

`platform` is `X`, `REDDIT`, `FACEBOOK`, or `INSTAGRAM`. A post from an account whose `platformAccountId` is in this list is treated as official and is not ingested. A matching handle with a different id is still a suspect.

## Local fixtures

`--fixtures` uses the bundled files in `fixtures/` instead of X, Reddit, Facebook, Instagram, and crt.sh. It still posts to `TIXMO_API_URL`, and that URL must be loopback (`127.0.0.1`, `::1`, or `localhost`). The production image does not contain the sample files, so `--fixtures` fails if they are missing. No platform keys are required. See `docs/brand-protection-local-testing.md`.

Public page and certificate fetches use https, follow only same-site https redirects, and refuse private, loopback, and link-local addresses. The Tixmo API client does not follow redirects. crt.sh HTTP 429 and 403 stop that source without a retry. HTTP 5xx is retried with backoff. X and Reddit send an identifying User-Agent; set `REDDIT_CONTACT` to a Reddit username when you have one.

Do not point a fixtures run at a production API, and do not put a production token in `.env`.

## Environment

Copy `.env.example` to `.env`. The local demo script does that for `127.0.0.1` and a token minted on the local disposable database. `.env` is gitignored.

| Variable | Required | Purpose |
| --- | --- | --- |
| `TIXMO_API_URL` | yes | API origin, no path. `https` except on localhost. |
| `TIXMO_CHECKER_TOKEN` | yes | `gwc_…` token for this environment. |
| `TIXMO_WATCHLIST_PATH` | no | Defaults to `.local/watchlist.json`. |
| `CHECKER_CONTACT_URL` | yes for live runs | Contact URL inside the User-Agent. |
| `X_BEARER_TOKEN` | no | Skips X when empty (live mode). |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | no | Skips Reddit when either is empty (live mode). |
| `PUBLIC_PAGE_INTERVAL_MS` | no | Facebook/Instagram gap. Default 15000. |
| `CRTSH_CACHE_PATH` | no | Defaults to `.cache/crtsh.json`. |
| `LOOKALIKE_SEARCH_API_URL` / `LOOKALIKE_SEARCH_API_KEY` | no | Optional official search API. Not a search engine. |
| `BRAND_CHECKER_REPORT` | no | Defaults to `.local/last-run.json`. |

## Run

```bash
npm ci
npm test
npm run lint
npm run typecheck
npm run build
node dist/index.js
```

Fixtures against a local API, after `.env` exists:

```bash
npm run check:fixtures
```

The process runs once and exits. A daily Railway cron can start the container with the same command. Put the token and platform keys in the service variables, not in the image. This repository change does not deploy anything.

```bash
docker build -t tixmo-brand-checker brand-checker
docker run --rm --env-file brand-checker/.env tixmo-brand-checker
```

Railway start command: `node dist/index.js`

## Open questions

- The targets route does not include display names or domains. The watchlist file still supplies those when it is present.
- Live Facebook and Instagram pages often answer with a login wall. The checker reports that and stops the platform. It will not try to get past the wall.
- A verification code that does not match a pending account is an HTTP 404 from the API, which ends the run. The checker only submits a code it saw on the official account's own public text.
