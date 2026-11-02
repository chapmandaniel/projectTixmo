# Brand protection

Organizers use this to record the social accounts and giveaways that are actually theirs, and to review public posts that may impersonate them. It is not a resale or marketplace monitor. It does not police ticket sales.

Supported sources are X, Reddit, Facebook (pages, posts, and groups), Instagram, and lookalike domains. Kijiji, Craigslist, and Facebook Marketplace are rejected.

The checker is a separate signed-out tool. It is not in this repository. Its platform credentials and the ingest token live in that service's Railway variables only. Do not commit them.

## Flag

The feature is off unless `FEATURE_GIVEAWAY_PROTECTION` is exactly `true`.

- API routes under `/api/v1/brand-protection` respond `404` when the flag is off, including ingest.
- The dashboard reads runtime `giveawayProtection` (`"true"` or `"false"`) and otherwise `VITE_FEATURE_GIVEAWAY_PROTECTION`. The default runtime value is `"false"`. The navigation item and route are omitted when it is off.
- While the flag is off, any request carrying a `gwc_` token responds `404`, on every path, including a different letter case or repeated slashes. The token is not looked up.
- While the flag is on, a checker token does not authenticate any other route. The guard matches checker paths after lowercasing, collapsing repeated slashes, and stripping a trailing slash, and a failed token still consumes the failed-token limiter on those paths.
- The 30-day match cleanup still runs when the flag is off. It has no route and no page. That keeps evidence from outliving the window after the flag is turned off.

## Who can do what

Org owners, admins, and managers manage accounts, giveaways, and match reviews for their own organization. A platform admin (`ADMIN` with `isPlatformAdmin`, and no organization) can resolve a disputed account and issue or revoke checker tokens. Platform admins do not receive evidence phone numbers, evidence emails, or pending verification codes.

Checker tokens carry scopes. Existing tokens, and any token issued without an explicit scope list, have `ingest:write` only. `targets:read` is added only when the issuer sets it. It is not granted by default.

`targets:read` is a platform-operator scope for Tixmo's own checker. It is never issued to a client organization. Only a platform admin (`ADMIN` with `isPlatformAdmin`, and no organization) may create a checker token that includes it. `POST /api/v1/brand-protection/admin/checker-tokens` returns `403` and creates no token when an org owner, an org admin, or any other non-platform-admin role asks for that scope. The issue service applies the same refusal before it writes a row.

`ingest:write` can call only:

- `POST /api/v1/brand-protection/ingest/matches`
- `POST /api/v1/brand-protection/ingest/status`
- `POST /api/v1/brand-protection/ingest/verifications`

`targets:read` can call:

- `GET /api/v1/brand-protection/ingest/targets`

That read returns `platform`, `platformAccountId`, `handle`, and `organizationId` for official accounts whose status is `VERIFIED`, whose verified platform account key is set, and whose organization status is `ACTIVE`. Pending, disputed, revoked, and unverified accounts are omitted, as are accounts on a suspended or pending organization. The response has no evidence, match text, verification codes, profile URLs, or timestamps. `page` (max 10000) and `limit` (max 100) paginate it. The targets route has its own rate limiter, separate from ingest. A live token without `targets:read` receives `403`. A missing, unknown, or revoked token is handled the same way as on the ingest writes, including the failed-token limit. The feature flag off still responds `404`.

While the flag is on, `GET` on the ingest write paths, and every other route, responds `403` for a live token or `401` for a revoked one. User sessions cannot call ingest or targets.

Tokens are stored as sha256 hashes in `giveaway_checker_tokens` (`createdAt`, `lastUsedAt`, `revokedAt`). The plaintext is shown once by:

```bash
npm --prefix tixmoapi2 run giveaway:issue-checker-token -- label
npm --prefix tixmoapi2 run giveaway:issue-checker-token -- label --targets-read
```

Without `--targets-read` the token can ingest and cannot read targets. With the flag it receives both `ingest:write` and `targets:read`. That flag is only for the platform operator on a disposable local database. The script refuses production and any database that is not a loopback database named `tixmo_disposable_*`. A platform admin can also `POST /api/v1/brand-protection/admin/checker-tokens` with `{ "label": "nightly" }` or `{ "label": "nightly", "scopes": ["ingest:write", "targets:read"] }`. Omitting `scopes` stores `ingest:write` only. An org owner, org admin, or any other non-platform-admin who includes `targets:read` receives `403` and no token is stored. The response token is not stored and is not recoverable. Revoke with `POST /api/v1/brand-protection/admin/checker-tokens/:id/revoke`. Revocation is read from the row on the next request.

Send the token as `Authorization: Bearer gwc_...`.

## Official accounts

`POST /api/v1/brand-protection/accounts`

```json
{
  "platform": "X",
  "platformAccountId": "1234567890",
  "handle": "harbourfest",
  "profileUrl": "https://x.com/harbourfest",
  "displayName": "Harbour Fest"
}
```

`platform` is `X`, `REDDIT`, `FACEBOOK`, or `INSTAGRAM`. `platformAccountId` is the platform's permanent account id. `handle` is display only and may change.

New accounts are `PENDING`. The response includes a one-time `verificationCode` for members of that organization, and that code expires 48 hours after it is issued. `POST /api/v1/brand-protection/accounts/:id/verification-code` replaces it and invalidates the previous code. Post the current code in the account bio or a public post. The checker's next pass submits:

`POST /api/v1/brand-protection/ingest/verifications`

```json
{
  "platform": "X",
  "platformAccountId": "1234567890",
  "code": "AB7K-2M9Q",
  "verificationMethod": "ONE_TIME_CODE"
}
```

`verificationMethod` defaults to `ONE_TIME_CODE`. `PLATFORM_OAUTH` is reserved and returns `400` with `Platform OAuth verification is not implemented`. The confirm function branches on the method so OAuth can be added later without changing the route.

Only `VERIFIED` accounts auto-mark matches `OFFICIAL`, and only when the suspect's `platformAccountId` equals that account's id. A matching handle with a different or missing id does not. Renaming the handle does not change the id.

There is one `VERIFIED` row per `(platform, platformAccountId)` across organizations (`verifiedPlatformAccountKey`). A second organization's claim is still `PENDING` and does not change the verified owner. The response for every new claim has the same shape and `PENDING` status. Both sides become `DISPUTED`, and auto-`OFFICIAL` stops, only after the second organization proves its one-time code. A platform admin resolves it:

`POST /api/v1/brand-protection/admin/disputes/resolve`

```json
{ "winnerAccountId": "uuid" }
```

The winner becomes `VERIFIED`. Other claims on that platform account become `REVOKED`. A revoked organization cannot claim that platform account id again until a platform admin lifts the block with `POST /api/v1/brand-protection/admin/accounts/:id/lift`. Changing a verified account's handle or profile URL returns it to `PENDING` and requires a new code. Profile and post URLs must use the platform's hosts, including `www`, `m.`, `mobile.x.com`, `mobile.twitter.com`, `old.reddit.com`, `new.reddit.com`, and `web.facebook.com`. Stored URLs are canonical: `twitter.com` becomes `x.com`, `www` and `m.` are removed, tracking parameters and fragments are dropped, and trailing slashes are trimmed. A losing organization's re-claim block is a separate row. Deleting the revoked account does not remove it; only `POST /api/v1/brand-protection/admin/accounts/:id/lift` does. One bad ingest item returns a per-item error and does not roll back the rest of the batch. Verification, dispute, resolve, and revoke changes are written to the staff-action audit without the code or any match evidence.

## Official giveaways

`POST /api/v1/brand-protection/giveaways`

```json
{
  "title": "Win two tickets",
  "platform": "INSTAGRAM",
  "officialPostUrl": "https://www.instagram.com/p/example",
  "accountHandle": "harbourfest",
  "startsAt": "2026-11-01T15:00:00.000Z",
  "endsAt": "2026-11-08T15:00:00.000Z",
  "notes": "Posted from the verified account",
  "eventId": "optional-uuid"
}
```

A match whose normalized source URL equals `officialPostUrl` for the same organization is marked `OFFICIAL` and linked to that giveaway. The giveaway handle is not used for that decision.

`PUT` and `DELETE` exist for accounts and giveaways. Lists accept optional `eventId`.

## Ingest contract

`POST /api/v1/brand-protection/ingest/matches`

Every field is length-capped. Unknown fields and unknown platform values are `400`. Each match must include an `organizationId` that already exists.

```json
{
  "matches": [
    {
      "organizationId": "uuid",
      "eventId": "optional-uuid",
      "platform": "X",
      "category": "IMPERSONATION_PROFILE",
      "sourceUrl": "https://x.com/fake/status/1",
      "platformAccountId": "999",
      "accountHandle": "harbourfest_giveaway",
      "suspectDisplayName": "Harbour Fest",
      "matchedText": "we are giving away tickets",
      "matchedRule": "impersonation-name",
      "detectedAt": "2026-11-02T12:00:00.000Z",
      "imitatedPlatformAccountId": "1234567890",
      "evidencePhones": ["+17095550100"],
      "evidenceEmails": ["claim@example.test"]
    }
  ]
}
```

| Field | Limit |
| --- | --- |
| `matches` | 1 to 50 |
| `sourceUrl` | 500, `https` for social sources |
| `platformAccountId`, `imitatedPlatformAccountId` | 200 |
| `accountHandle` | 100 |
| `suspectDisplayName` | 200 |
| `matchedText` | 500 |
| `matchedRule` | 200 |
| `evidencePhones` | up to 5, each 3–40 characters |
| `evidenceEmails` | up to 5, each a 120-character email |
| `detail` on status reports | 200 |

`platform`: `X`, `REDDIT`, `FACEBOOK`, `INSTAGRAM`, `LOOKALIKE_DOMAIN`.

`category`: `IMPERSONATION_PROFILE`, `FAKE_CONTEST`, `FALSE_ASSOCIATION`, `LOOKALIKE_DOMAIN`.

`LOOKALIKE_DOMAIN` requires both `platform` and `category` to be `LOOKALIKE_DOMAIN`. The stored value is the hostname only. Paths, queries, page text, handles, account ids, and evidence are rejected. `https://evil.example/phish?id=1` is stored as `evil.example`.

Facebook Marketplace URLs (`facebook.com` paths containing `/marketplace`), Kijiji hosts, and Craigslist hosts are rejected even if the platform is `FACEBOOK`.

`imitatedPlatformAccountId` is who the post appears to imitate. It is not the suspect id. Auto-`OFFICIAL` compares only the suspect `platformAccountId` (and, separately, an exact official post URL). If `imitatedOfficialAccountId` is sent, it must be an account in the same organization.

The unique key is `(organizationId, sourceUrl)` after normalization. A repeat ingest returns the same id. `detectedAt` stays at the first detection and cannot be more than five minutes in the future. Retention uses the server `createdAt`, not `detectedAt`. A human review is left as-is. Content and evidence are updated only while the status is still `NEW`. A `NEW` row becomes `OFFICIAL` on a later ingest when a verified account id or official post URL now matches.

The ingest response is an acknowledgement, not a read:

```json
{ "success": true, "data": { "results": [{ "id": "uuid", "status": "NEW", "created": true }] } }
```

Evidence, post text, and the verification code are not returned to the checker.

### Checker status

`POST /api/v1/brand-protection/ingest/status`

```json
{ "platform": "X", "state": "CAPTCHA", "detail": "checkpoint" }
```

`state` is `OK`, `BLOCKED`, `LOGIN_PROMPT`, or `CAPTCHA`. One row is kept per platform. Org members see `platform`, `state`, and `reportedAt` only. The free-text `detail` is stored for platform admins and is not returned to organizations. The checker cannot read the status list back.

## Matches

`GET /api/v1/brand-protection/matches?eventId=&platform=&category=&status=&page=&limit=`

`newCount` is the number of `NEW` rows for the same organization and filters, ignoring the status filter.

`POST /api/v1/brand-protection/matches/:id/review`

```json
{ "status": "CONFIRMED_SCAM" }
```

`status` is `CONFIRMED_SCAM`, `FALSE_POSITIVE`, or `OFFICIAL`. Optional `officialGiveawayId` must belong to the same organization.

`evidencePhones` and `evidenceEmails` are returned only to a member of the match's organization. They are omitted for platform admins and are never included in another organization's list or detail. Request logs and API error logs redact `evidencePhones`, `evidenceEmails`, `verificationCode`, and `gwc_` tokens.

## Retention

Rows whose server `createdAt` is older than 30 days are deleted, including evidence columns, by `purgeExpiredScamMatches`. The API process runs that on startup and every six hours (`startGiveawayRetentionJob`). A second run deletes nothing new. Deleting a row does not log its contents.

## Dashboard

The page is **Brand protection**.

- Official accounts and giveaways: list, add, edit, delete. Pending accounts show the verification code to the owning org.
- Suspicious profiles and contests: filters, `NEW` count, and review actions. The event selector uses the same `/events?limit=100` list as the rest of the dashboard.
- Checker text is React text, not HTML or markdown. Source URLs are defanged (`hxxps://evil[.]example`) with a copy button that copies the defanged text. They are not `<a href>` links. The page does not load images, favicons, previews, or frames from checker content.
- The dashboard Content-Security-Policy is unchanged. `img-src` still allows HTTPS because event artwork and the product mark use it. This page does not add a host and does not put a checker URL in an image, frame, or link.

## Data

Migration `20261102120000_brand_protection` adds `official_accounts`, `official_giveaways`, `scam_matches`, `giveaway_checker_tokens`, and `checker_platform_statuses`. Apply it only to a disposable database. Do not run it against production from this change.
