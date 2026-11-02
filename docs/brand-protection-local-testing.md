# Brand protection local testing

Do not use production tokens, production URLs, or copies of production data. This stack uses only a local Postgres database and a checker token minted on that database.

Nothing here merges to main or deploys. The API, dashboard, and checker stay on your machine.

## What you need

- Node.js 24.21
- Docker with Compose v2

From the repository root, on the branch that contains this file.

## 1. Start the local stack

```bash
npm run brand:local
```

That command:

1. Starts Postgres from `docker-compose.brand-protection.yml` on `127.0.0.1:54329`.
2. Creates the database `tixmo_disposable_brandcheck`. The database user and password exist only for this local database (`tixmo` / `tixmo_local_only`).
3. Applies the Prisma migrations, including brand protection.
4. Starts the API with `FEATURE_GIVEAWAY_PROTECTION=true`.
5. Seeds the Harbour Fest demo organization, owner login, official X account, and a new checker token.
6. Writes gitignored local files only: `tixmoapi2/.env.brand-protection.local`, `tdash/.env.development.local`, `brand-checker/.env`, and `brand-checker/.local/watchlist.json`.
7. Starts the dashboard at http://127.0.0.1:5173 pointed at the local API.

The checker token is printed once in that terminal and saved in `brand-checker/.env`. It is not a production secret and cannot be used against any other database. Running the command again revokes the previous local token and prints a new one.

Leave this terminal open. Ctrl+C stops the API and the dashboard. Postgres keeps the local data until you run:

```bash
npm run brand:local:down
```

## 2. Log in

Open http://127.0.0.1:5173

| Field | Value |
| --- | --- |
| Email | `harbourfest.owner@localhost.test` |
| Password | `LocalHarbour-1!` |

The password is a local demo password for this disposable database. It is not a Tixmo production credential.

You land on the dashboard. **Brand protection** is in the top navigation. The feature flag is on only for this local process.

## 3. Official account before the checker

Open **Brand protection**. The first tab is **Official accounts and giveaways**.

You should see:

- One official account: X, handle `harbourfest`, platform account id `1000000001`, display name Harbour Fest.
- Status `PENDING`, plus a one-time verification code. The fixtures do not post that code, so the account stays pending.
- No official giveaways.
- Checker chips for X, Reddit, Facebook, Instagram, and Lookalike domain all say **No report**.

## 4. Run the checker offline

In a second terminal, from the repository root:

```bash
npm run brand:check
```

That runs `brand-checker` with `--fixtures`. It does not call X, Reddit, Facebook, Instagram, or crt.sh. It posts the bundled sample findings to `http://127.0.0.1:3000`. No platform API keys are required.

The command prints a JSON summary. `ok` is true, and `matches` is greater than zero. Running it again is safe: the same source URLs update the same rows.

## 5. What to look at after the checker

Refresh **Brand protection**.

Checker chips should all say **OK**.

Open **Suspicious profiles and contests**. The **New** count matches the rows below. Source addresses are shown defanged (for example `hxxps://x[.]com/...`) and are not links. You should see:

| Source | Category | What it is |
| --- | --- | --- |
| X `@harbourfest_gw` | Impersonation profile | Display name Harbour Fest, account id `999000111` (not the official id) |
| X post by `@not_harbour` | Fake contest | "Harbour Fest is giving away two free tickets. Enter our contest." |
| Reddit user `harbourfest_prizes` | Impersonation profile | Profile presenting itself as Harbour Fest |
| Reddit post by `fest_helper` | False association | "We are the official Harbour Fest account" |
| Facebook `harbourfesttickets` | Impersonation profile | Public page titled Harbour Fest, account id `888001` |
| Instagram `harbourfest_prizes` | Fake contest | Giveaway text with a sample phone number and `prizes@scam.example` |
| Lookalike domain | Lookalike domain | `harbourfest-tickets.example` and nothing else (no page text) |

You should not see a row for the official account id `1000000001`, and you should not see Kijiji, Craigslist, or Facebook Marketplace.

The Instagram row shows the sample phone and email because you are a member of Harbour Fest. Those values are fixture data, not real contact details.

Mark scam, false positive, and official are the review actions on each row. They only change this local database.

## Stop

Ctrl+C in the first terminal, then:

```bash
npm run brand:local:down
```

Do not copy the printed checker token, the demo password, or the local database into Railway, production, or any hosted environment.
