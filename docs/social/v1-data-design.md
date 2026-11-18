# Social Command Center v1 data design

Phase 2 adds additive Prisma tables, sandbox connect/disconnect, sync/poll, live social APIs, a guarded email-capture trigger, retention purge, and structured logs. Phase 1 mock UI scenes (`?scene=`) remain for screenshots.

Sources, in order:

- The approved cut, including **Clarifications for QA (2026-11-11, PM)**.
- The binding security review (sections 1–3, findings M1–M7, L1–L4, I1–I5).
- UX rev 4.1 for layout only, except where the cut says otherwise.

`tixmoapi2/docs/META_SOCIAL_INTEGRATION_GUIDE.md` is **not** a source.

## Schema (additive)

New enums: `SocialTokenKind`, `SocialConnectionStatus`, `SocialPlatform`, `SocialIssueState`, `SocialSeverity`, `SocialThresholdMode`, `SocialMappingSource`.

New enum value on existing enum: `NotificationType.SOCIAL_ALERT` (additive).

| Table | Purpose |
|---|---|
| `social_connections` | Sandbox Page / IG account rows. Encrypted token envelope fields. Org-scoped. |
| `social_org_settings` | Thresholds JSON, keywords JSON, HIGH mail / digest flags. |
| `social_mode_holds` | Named mode holds until a date (NORMAL / ON-SALE DAY / EVENT DAY). |
| `social_event_mappings` | Automatic or admin override post→event mapping. |
| `social_posts` | Synced posts/media. Caption excerpt only. |
| `social_comments` | Synced comments. Body + handle; purge tombstones them. |
| `social_issues` | Waves / singles / unanswered / manual. Assignee is an org member only. |
| `social_issue_comments` | Issue↔comment membership. |
| `social_issue_notes` | Internal notes (not posted to Meta). |
| `social_issue_activities` | Audit trail (no comment bodies after purge). |
| `social_sync_runs` | Sync/poll run counters and error codes (no secrets). |

No foreign keys to orders, tickets, scans, refunds, gates, or buyer users. The only people FKs are org members (assignee, note author, connecting admin, hold/mapping actor).

## Migration list

| Migration | Notes |
|---|---|
| `20261111193000_add_social_command_center_v1` | Creates all Social* enums/tables and adds `NotificationType.SOCIAL_ALERT`. Additive only. |

## Environment flags (names only for DevOps / Labs)

| Name | Role |
|---|---|
| `SOCIAL_COMMAND_CENTER_ENABLED` | Must be `true` to enable routes/UI. |
| `SOCIAL_SANDBOX_BASE_URL` | Allowlisted sandbox Graph origin. |
| `SOCIAL_SANDBOX_TEAM_ACCESS_KEY` | Present for sandbox admin/seed calls; never returned. |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | 32-byte root (64 hex or standard base64). |
| `SOCIAL_TOKEN_ENCRYPTION_KEY_PREVIOUS` | Optional decrypt-only previous root. |
| `SOCIAL_POLL_ENABLED` | `true` to run the in-process poller (off by default). |
| `SOCIAL_POLL_INTERVAL_MS` | Default 300000. |
| `SOCIAL_POLL_EVENT_DAY_INTERVAL_MS` | Default 60000. |
| `SOCIAL_POLL_LOOKBACK_MS` | Default 14 days. |
| `SOCIAL_POLL_EVENT_DAY_LOOKBACK_MS` | Default 48 hours. |
| `SOCIAL_EMAIL_CAPTURE` | `true` captures HIGH/digest mail in memory (also auto on Labs). |
| `SOCIAL_ALERT_EMAIL_FROM` | Optional; falls back to `EMAIL_FROM`. Leave unset on Labs. |
| `SOCIAL_COMMENT_RETENTION_DAYS` | Default 14. |
| `RAILWAY_ENVIRONMENT_NAME` | `labs` enables capture without `SOCIAL_EMAIL_CAPTURE`. |

When enabled but key or sandbox host is missing, `ready` is false (`encryption-key` / `sandbox-host`). The process does not exit.

## APIs (`/api/v1/social`)

| Method | Route | Auth |
|---|---|---|
| GET | `/config` | public |
| POST | `/classify` | authenticated |
| GET | `/email-captures` | OWNER/ADMIN |
| POST | `/email-captures/trigger` | OWNER/ADMIN; capture-only |
| GET | `/workspace` | authenticated |
| GET | `/overview` | authenticated |
| GET | `/posts` | authenticated |
| GET | `/posts/:id` | authenticated |
| GET | `/issues` | authenticated |
| GET | `/issues/:id` | authenticated |
| PATCH | `/issues/:id` | authenticated |
| POST | `/issues/bulk` | authenticated |
| GET | `/waves` | authenticated |
| GET | `/unanswered` | authenticated |
| GET | `/settings` | authenticated |
| PATCH | `/settings/thresholds` | OWNER/ADMIN |
| POST | `/settings/hold` | OWNER/ADMIN |
| POST | `/settings/keywords` | OWNER/ADMIN |
| POST | `/settings/mapping` | OWNER/ADMIN |
| GET | `/accounts` | authenticated |
| POST | `/accounts/discover` | OWNER/ADMIN |
| POST | `/accounts/connect` | OWNER/ADMIN |
| POST | `/accounts/:id/disconnect` | OWNER/ADMIN |
| POST | `/sync` | OWNER/ADMIN |
| POST | `/retention/purge` | OWNER/ADMIN |

Tokens, ciphertext, and keys never appear in responses. Graph outbound calls use the sandbox host only.

## Token envelope

Unchanged from phase 1 module `token-crypto.ts` / `token-policy.ts`:

- AES-256-GCM, unique 12-byte nonce, `v1:{keyId}:{iv}:{tag}:{ciphertext}`
- HKDF-SHA256 labels `tixmo/social-token/aes` and `tixmo/social-token/lookup`
- AAD `tixmo:social-token:v1|{organizationId}|{connectionId}|{tokenKind}`
- Live tokens and real Graph hosts refused; real-looking `EAA…` / `IG…` refused before encrypt
- Disconnect overwrites then clears ciphertext / lookup HMAC

## Polling and retention

- Poller starts only when `SOCIAL_POLL_ENABLED=true`. Cadence follows AC-18 defaults.
- Retention job hourly: comment body + handle purged when age `>=` TTL unless an issue in `NEW` or `IN_PROGRESS` holds them.

## Mail

`POST /email-captures/trigger` delivers HIGH or digest into the capture sink when capture is on. Bodies are metadata + dashboard link only.

## Rollback / Labs return to `45132d7`

New tables are **harmless if left in place** after rolling the app back to `45132d7`: older code does not read them. Prefer leaving them.

If DevOps must drop them to match a clean pre–phase-2 schema:

```sql
DROP TABLE IF EXISTS "social_sync_runs";
DROP TABLE IF EXISTS "social_issue_activities";
DROP TABLE IF EXISTS "social_issue_notes";
DROP TABLE IF EXISTS "social_issue_comments";
DROP TABLE IF EXISTS "social_issues";
DROP TABLE IF EXISTS "social_comments";
DROP TABLE IF EXISTS "social_posts";
DROP TABLE IF EXISTS "social_event_mappings";
DROP TABLE IF EXISTS "social_mode_holds";
DROP TABLE IF EXISTS "social_org_settings";
DROP TABLE IF EXISTS "social_connections";

DROP TYPE IF EXISTS "SocialMappingSource";
DROP TYPE IF EXISTS "SocialThresholdMode";
DROP TYPE IF EXISTS "SocialSeverity";
DROP TYPE IF EXISTS "SocialIssueState";
DROP TYPE IF EXISTS "SocialPlatform";
DROP TYPE IF EXISTS "SocialConnectionStatus";
DROP TYPE IF EXISTS "SocialTokenKind";
-- Do not remove NotificationType.SOCIAL_ALERT from Postgres enum values in place;
-- unused enum values are harmless. Recreating the enum is unnecessary for app rollback.
```

Also remove migration history row `20261111193000_add_social_command_center_v1` only if re-applying from scratch on a disposable DB.

## Confirmed product rules

- Comment text and handles: 14 days default; held while an issue is `NEW` or `IN_PROGRESS`.
- HIGH / digest email: metadata + link only.
- Local classifier only; no OpenRouter.
- No publishing / auto-reply from Tixmo.
- AC-16 `fast-xml-parser` advisory stays until #185 merges; this branch does not copy that override.
