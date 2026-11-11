# Social Command Center v1 data design

Phase 1 is mock data, a local classifier, and pure rule functions. It does not migrate Prisma, poll Meta, or send live mail.

Sources, in order:

- The approved cut, including **Clarifications for QA (2026-11-11, PM)**. That section wins wherever an earlier line or a wireframe differs. Keyword lists and the severity matrix there are the source of truth.
- The binding security review (sections 1–3, findings M1–M7, L1–L4, I1–I5).
- UX rev 4 for layout only, except where the cut says otherwise.

`tixmoapi2/docs/META_SOCIAL_INTEGRATION_GUIDE.md` is **not** a source. Do not implement steps 4–6 of its first sprint (real OAuth, live token storage, live Graph calls).

## Confirmed product rules

Retention and alert email are confirmed. They are not pending, and retention is not a QA pass/fail gate for this cut.

- Comment text and handles are kept 14 days from `created_time` by default (`SOCIAL_COMMENT_RETENTION_DAYS`). Age `>=` the TTL expires the body and handle. Age `<` the TTL keeps them. A comment attached to an issue in `NEW` or `IN_PROGRESS` is held until that issue is no longer open. `HANDLED` and `DISMISSED` do not hold it. If any open issue remains, the hold stays.
- HIGH and digest email carry metadata and an "Open in Tixmo" link only. No comment text, handles, commenter names, avatars, or post captions. HIGH mail is on by default and can be turned off. The in-app badge and Overview strip stay on.
- `SOCIAL_EMAIL_CAPTURE=true` writes the rendered email to an in-memory store and exposes it at `GET /api/v1/social/email-captures` for `OWNER` and `ADMIN` of that organization only. The same capture runs when `RAILWAY_ENVIRONMENT_NAME=labs`. `NODE_ENV` is not the switch. With the flag unset and the process not in Labs, social mail uses the existing `email.ts` transporter and never throws into the request if that transporter fails. Other application mail is unchanged. The in-memory store does not survive a restart or a second instance; a later table can replace it. AC-11 stays blocked for a live Labs capture until this sink is deployed. The endpoint is the accepted proof path in this phase.

## Keyword lists and severity

Default phrases, whole word or phrase, longest match, then Safety, Ticketing, Refunds, Access/Entry, Lineup:

| Topic | Phrases |
|---|---|
| Ticketing | ticket, qr, transfer, resale, sold out, presale code |
| Refunds | refund, chargeback, money back, cancelled |
| Access/Entry | line, queue, entry, wristband, doors, bag policy |
| Lineup | set time, cancelled set, headliner, clash |
| Safety | injured, medical, crush, unsafe, harass, lost child |
| Other | no listed phrase; a question with no topic; a manual flag |

Reset to defaults restores this table. Org admins may edit lists per event later.

Severity, highest matching row:

| Label | When |
|---|---|
| HIGH | any Safety match; any wave in ON-SALE DAY or EVENT DAY; a wave whose count is `>=` 3× the opening threshold (the smallest integer that fires) |
| MED | a wave in NORMAL; a Refunds or Ticketing single; unanswered age `>=` 2× the mode limit |
| LOW | manual flags; Lineup or Other questions; unanswered under 2× that is not otherwise higher |

Sentiment sorts inside a severity. It does not open or escalate an issue. An empty label is valid (AC-17).

Spike math: B is comments per hour, the median of the previous 14 same clock hours, floor 1. Bucket length is 1 hour on NORMAL and ON-SALE DAY and 15 minutes on EVENT DAY. Bucket baseline b is B, or B/4 on EVENT DAY. A wave opens when `C >= min` and `C >= multiplier × b`.

## Polling (AC-18)

Phase 1 does not poll. There is no timer and no Graph fetch. The data-access layer plans the next interval and reports `running: false`.

| Env | Default |
|---|---|
| `SOCIAL_POLL_INTERVAL_MS` | 300000 (5 minutes), posts from the last 14 days |
| `SOCIAL_POLL_EVENT_DAY_INTERVAL_MS` | 60000 (1 minute) on EVENT DAY |
| `SOCIAL_POLL_LOOKBACK_MS` | 14 days |
| `SOCIAL_POLL_EVENT_DAY_LOOKBACK_MS` | 48 hours |

The dashboard reads `poll` from `GET /api/v1/social/config`. It does not use a `VITE_` flag.

## Environment

| Name | Role |
|---|---|
| `SOCIAL_COMMAND_CENTER_ENABLED` | Default false. The API still boots. Social routes report `enabled: false` and the dashboard shows the existing placeholder. |
| `SOCIAL_SANDBOX_BASE_URL` | Allowlisted host only: `meta-graph-sandbox-production.up.railway.app`. |
| `SOCIAL_SANDBOX_TEAM_ACCESS_KEY` | Present or absent in config. The value is never returned. |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | 32 bytes, 64 hex characters or standard base64. Hex is checked first. |
| `SOCIAL_TOKEN_ENCRYPTION_KEY_PREVIOUS` | Decrypt only. |
| `SOCIAL_ALERT_EMAIL_FROM` | Falls back to `EMAIL_FROM`. Left unset on Labs. |
| `SOCIAL_EMAIL_CAPTURE` | `true` captures social mail in memory. |
| `SOCIAL_COMMENT_RETENTION_DAYS` | Default 14. |
| Poll vars | Above. |

When the feature is enabled but the key or the sandbox host is missing, `ready` is false with `encryption-key` or `sandbox-host`. Token operations are refused. The process does not exit.

## Token envelope (M1, M2, L1, L2, I1)

Own module, `tixmoapi2/src/social/token-crypto.ts`. Do not extend the vendor-credential helper (L2).

- AES-256-GCM, random 12-byte nonce, 16-byte tag. Two encryptions of the same token differ.
- Envelope `v1:{keyId}:{iv}:{tag}:{ciphertext}` with base64url parts.
- HKDF-SHA256, salt `tixmo/social-token/v1`, info `tixmo/social-token/aes` and `tixmo/social-token/lookup`.
- AAD `tixmo:social-token:v1|{organizationId}|{connectionId}|{tokenKind}`. `tokenKind` is `sandbox` or `live`.
- `keyId` is the first 8 hex characters of SHA-256 of the raw root key.
- Labs and sandbox refuse live tokens and any non-allowlisted real Graph host (`graph.facebook.com`, `graph.instagram.com`, `*.facebook.com`, `*.instagram.com`, `fbcdn`), even if someone tries to allowlist them.
- Real-looking tokens (`EAA…`, `IG…`, `{app-id}|{app-secret}`) are refused before encrypt. Errors do not echo the token.
- Disconnect overwrites then clears `tokenCiphertext`, `refreshCiphertext`, and `lookupHmac`, and sets status `DISCONNECTED`.
- Config and API responses never include a token, ciphertext, or key.
- Key custody for sandbox is an env secret. KMS is a later gate before any live token (L1).

Scopes to record later, not to request now: `pages_show_list`, `pages_read_engagement`, `read_insights`, `pages_read_user_content`, `instagram_basic`, `instagram_manage_insights`, `instagram_manage_comments`, and `business_management` only if Pages are reached through Business Manager. Do not request `pages_manage_posts`, `pages_manage_engagement`, `instagram_content_publish`, or messaging scopes. `refreshCiphertext` stays empty in v1. There is no refresh call.

## Proposed tables

No migration in this phase. Shapes for the later schema:

- `SocialConnection`: organization id, `tokenKind`, `keyId`, `tokenCiphertext`, nullable `refreshCiphertext`, `lookupHmac`, `graphBaseUrl`, scopes, status, last sync. Not `Organization.settings` and not a raw JSON token column (I1).
- Event mapping: connection, event, source `automatic` or `override`, override actor (org admin). Override survives resync. A member cannot override. Range is the earliest of `Event.salesStart`, the earliest `TicketType.salesStart`, and `Event.startDatetime`, through `Event.endDatetime`, inclusive. Those sales fields are schedule dates only (M9).
- `SocialIssue`: topic, severity, state, rule text, mode, wave bucket, comment ids, assignee (org member), last alert time.
- Wave membership, internal notes, and an audit log of team actions. Audit rows do not keep a comment body after the comment expires.
- Thresholds and named mode holds: Hold NORMAL, Hold ON-SALE DAY, Hold EVENT DAY until a date. `TIGHT` is not a mode.
- `SocialComment`: provider ids, `created_time`, permalink, public handle and provider commenter id on this row only, body, and nullable classifier fields. Label may be empty.
- `NotificationType` value `SOCIAL_ALERT` is proposed and not added to the Prisma enum yet. Notification metadata must not store tokens or comment bodies.
- Optional later `SocialEmailCapture` if the in-memory sink has to survive restarts.

No foreign key, join, or identity column from these tables to orders, tickets, scans, refunds, gates, or buyer users (M6). The only Tixmo people references are org members: assignee, note author, connecting admin. Provider commenter ids are not Tixmo user ids. A later deletion callback can delete by provider user id and by connection; that callback is not live in sandbox v1.

The social module does not import `@prisma/client` or order, ticket, payment, scanner, or vendor stores. Commenter copy says "commenter" or the handle, never "customer", "buyer", or "ticket holder". Notes remind the team not to paste an email address or an order number (L4). Notes are not parsed into a lookup.

## Mail, logs, and telemetry (M7)

`buildHighAlertEmail` and `buildDigestEmail` throw if a forbidden key is present (`comment`, `handle`, `caption`, `body`, and the rest of the denylist). The rendered field is `text`, which is the metadata body.

Request logs for `/social` paths and token query parameters keep the path only. Graph hosts are reduced to a pathname. Sentry scrubbing removes social token fields and authorization material. Backups can outlive the TTL; the encryption key is not in the dump (L3). Shorten backup retention before any real Meta data.

## Classifier (I3, I4, I5, AC-17)

`CommentClassifier` returns a label (`positive`, `negative`, `neutral`, `urgent`, or empty), a topic, and a confidence. Invalid labels become empty. Invalid topics become Other with confidence 0 and cannot open an issue. The default implementation is `rule-keyword` / `social-v1`. It ignores `OPENROUTER_API_KEY` and does not call the network. There is no flag that enables a model call. OpenRouter zero-data-retention, a DPA, and a launch check of the live ZDR list stay later gates (I4, I5).

## Blocked and later

- Insights metric names (OC-CC-1) and an Instagram comment permalink stay blocked until a sandbox-repo document exists. The UI shows dashboard labels from mock data and does not claim Graph field names.
- Live Labs mail capture stays blocked until the sink is deployed.
- Privacy notice and counsel, backup retention, OpenRouter ZDR/DPA, and KMS before live tokens are later gates. They are not v1 blockers and they are not open retention or email questions.
