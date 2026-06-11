# Meta Social Integration Guide for Tixmo

Last reviewed: 2026-05-17

This guide covers the practical Meta process for connecting an existing music festival's Facebook Page and Instagram professional account to Tixmo so the social media dashboard can be developed against real platform data.

The lowest-friction path is read-only first: connect the festival's owned Meta assets, fetch account/media insights, and render a useful dashboard before adding publishing, comment moderation, or inbox workflows. Publishing and moderation require more App Review evidence and introduce more ways to be blocked.

## Target Outcome

For the first production-ready social dashboard, Tixmo should be able to:

- Connect a festival/promoter organization's Meta Business assets.
- Identify the selected Facebook Page and linked Instagram professional account.
- Store connection metadata at the Tixmo organization level.
- Store OAuth tokens server-side only, encrypted at rest.
- Sync Instagram profile, media, and insight metrics.
- Optionally sync Facebook Page profile, post, and insight metrics.
- Show provider status, follower/reach/engagement snapshots, recent posts, and sync health in `/social`.

Out of scope for the first pass:

- Publishing/scheduling posts.
- Replying to comments.
- Instagram DMs.
- Paid ads/Marketing API metrics.
- Public hashtag/search/trend scraping.

## Key Meta Concepts

### Business Portfolio

Meta's current business admin model uses a Business Portfolio in Meta Business Suite/Business Manager. The festival should have a business portfolio that owns or has full control over:

- The Facebook Page.
- The Instagram Business or Creator account.
- The domain used by the app, if domain verification is required for review.
- The Meta developer app, or at least a developer/admin who can connect it.

### Facebook Page

For the Facebook Login based Instagram Graph API flow, the Instagram professional account must be linked to a Facebook Page. This is still the most reliable route when Tixmo needs both Facebook Page data and Instagram account data.

### Instagram Professional Account

The Instagram account must be Business or Creator. Personal/consumer Instagram accounts are not suitable for Tixmo's social dashboard API use.

### App Mode

In development mode, the app generally works only for users who have a role on the Meta app or test assets. To connect real customer/festival accounts outside the development team, the app needs the relevant permissions approved through App Review and the app must be live.

## Recommended Tixmo Strategy

### Phase 1: Read-Only Dashboard

Use this first. It gets the dashboard moving while minimizing review complexity.

Needed capabilities:

- Account identity and selection.
- Instagram media list.
- Instagram account/media insights.
- Facebook Page identity and, if useful, Page post insights.

Likely permission families:

- Instagram Login flow: `instagram_business_basic`, `instagram_business_manage_insights`.
- Facebook Login flow: `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_manage_insights`.

Meta is actively shifting Instagram APIs toward the newer Instagram Login permission names. Verify the exact permission names in the Meta Developer dashboard at implementation time. If Tixmo needs Facebook Page selection plus linked Instagram lookup, the Facebook Login path is usually still the lower-risk operational route.

### Phase 2: Comments and Moderation

Add only after read-only sync is working.

Likely permission families:

- `instagram_manage_comments` or `instagram_business_manage_comments`.
- Page permissions if Facebook Page comments are included.

### Phase 3: Publishing

Add last.

Likely permission families:

- `instagram_content_publish` or `instagram_business_content_publish`.
- Facebook Page publishing permissions if posting to Facebook is included.

Publishing needs much stronger App Review evidence. Meta reviewers need to see the exact publish workflow, permission prompts, user intent, preview/review controls, and the resulting platform action.

## Festival Prerequisites Checklist

Ask the festival owner/admin to confirm these before engineering spends time debugging OAuth:

- The Instagram account is Business or Creator.
- The Instagram account is linked to the correct Facebook Page.
- The connecting user has full control/admin access to the Facebook Page.
- The connecting user can see the Instagram account in Meta Business Suite.
- The connecting user can access the relevant Business Portfolio.
- The Facebook Page is not owned by a different agency account without sharing access.
- Two-factor authentication is enabled if the business portfolio requires it.
- The Tixmo callback URL is available over HTTPS.
- The festival can provide a real Facebook Page and Instagram handle for App Review demos.

Common blocker: the user is an Instagram admin but not a Facebook Page admin, or the Page is owned by an agency business portfolio. In that case Meta may authenticate successfully but return no selectable Page/Instagram account.

## Tixmo Prerequisites Checklist

Before starting App Review, Tixmo should have:

- A production or staging URL with HTTPS.
- Privacy policy URL.
- Data deletion instructions or callback URL.
- Terms URL if available.
- App icon and app description.
- A stable OAuth callback route.
- A test user account for Meta reviewers.
- A demo organization with connected test or real festival assets.
- A screen recording showing each requested permission being used.
- Server-side logging for OAuth failures, token exchange failures, and sync failures.

Recommended environment variables:

```env
META_APP_ID=
META_APP_SECRET=
META_GRAPH_API_VERSION=v25.0
META_OAUTH_REDIRECT_URI=https://dashboard.tixmo.co/api/v1/social/meta/callback
META_WEBHOOK_VERIFY_TOKEN=
META_TOKEN_ENCRYPTION_KEY=
```

Use the Graph API version currently available in Meta's dashboard and pin it. Do not rely on Meta's unversioned default.

## Meta App Setup

### 1. Create or Select the Meta App

In Meta for Developers:

1. Create a new app or use an existing Tixmo production app.
2. Use a business-oriented app type/use case.
3. Attach the app to Tixmo's Business Portfolio where possible.
4. Add app domains for the dashboard/API hostnames.
5. Add the privacy policy URL.
6. Add the data deletion URL or data deletion instructions.
7. Add a website platform entry for the Tixmo dashboard URL.

Use a dedicated production app for real customers. Use a separate test app for local/staging work when possible.

### 2. Add Products

For the recommended read-only dashboard:

- Add Instagram API / Instagram Graph API product.
- Add Facebook Login for Business if using the Facebook Page-linked flow.
- Add Webhooks later only if Tixmo needs near-real-time changes. Polling is simpler for the first dashboard.

### 3. Configure OAuth Redirect URIs

Add every callback URL exactly as it will be used:

```text
https://dashboard.tixmo.co/api/v1/social/meta/callback
https://staging-dashboard.tixmo.co/api/v1/social/meta/callback
http://localhost:3000/api/v1/social/meta/callback
```

Use localhost only for development. Production review should use HTTPS.

OAuth redirect mismatches are a frequent source of confusing Meta errors. The `redirect_uri` passed from Tixmo must exactly match the configured URI.

## OAuth Flow for Tixmo

The backend should own the OAuth flow. Do not exchange or store long-lived tokens in the React app.

### 1. Start

`GET /api/v1/social/meta/start`

Inputs:

- Tixmo authenticated user.
- Organization ID from the user's tenant scope.
- Optional return path.

Server behavior:

- Verify the user can manage integrations for the organization.
- Generate a cryptographically random OAuth `state`.
- Store state with organization ID, user ID, requested scopes, and expiry.
- Redirect to Meta OAuth.

State payload should not be trust-only client data. Store state server-side or sign/encrypt it.

### 2. Meta Consent

The festival admin logs in with Facebook or Instagram, depending on the chosen flow, and grants the requested permissions.

For Facebook Login based Page selection, request only the permissions needed for the current phase. For the read-only phase, do not request publishing or comment permissions.

### 3. Callback

`GET /api/v1/social/meta/callback`

Server behavior:

- Validate `state`.
- Exchange `code` for a short-lived access token.
- Exchange for a long-lived token where supported.
- Fetch `/me` or equivalent identity data.
- Fetch available Pages if using Facebook Login.
- Fetch linked Instagram professional account for each selected Page.
- Persist a pending connection if the user still needs to choose a Page/account.
- Redirect back to `/social?connected=meta` or `/social?metaConnection=pending`.

### 4. Account Selection

If the user has multiple Pages or Instagram accounts, show a Tixmo account picker:

- Facebook Page name, ID, profile image if available.
- Linked Instagram username, ID, profile image if available.
- Permission status.

Persist only the selected account.

### 5. Sync

`POST /api/v1/social/meta/connections/:id/sync`

For the MVP, sync on demand from the dashboard and later add a scheduled job.

Minimum sync payload:

- Provider account identity.
- Follower/audience snapshot where available.
- Recent media.
- Media-level insight metrics.
- Account-level insight metrics.
- Last successful sync time.
- Last error code/message.

## Recommended Data Model

Do not store OAuth access tokens in `Organization.settings`. Settings are acceptable for non-secret display/config metadata, but tokens need a dedicated model with encryption and rotation.

Suggested Prisma models:

```prisma
model SocialConnection {
  id               String   @id @default(uuid())
  organizationId   String   @map("organization_id")
  organization     Organization @relation(fields: [organizationId], references: [id])
  provider         String
  providerUserId   String?  @map("provider_user_id")
  providerPageId   String?  @map("provider_page_id")
  providerAccountId String? @map("provider_account_id")
  displayName      String
  handle           String?
  scopes           String[]
  tokenCiphertext  String?  @map("token_ciphertext")
  tokenExpiresAt   DateTime? @map("token_expires_at")
  refreshMetadata  Json?    @map("refresh_metadata")
  status           String   @default("PENDING")
  lastSyncedAt     DateTime? @map("last_synced_at")
  lastError         Json?    @map("last_error")
  createdById      String?  @map("created_by_id")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  @@index([organizationId, provider])
  @@map("social_connections")
}

model SocialMetricSnapshot {
  id             String   @id @default(uuid())
  connectionId   String   @map("connection_id")
  provider       String
  metricDate     DateTime @map("metric_date")
  metrics        Json
  createdAt      DateTime @default(now()) @map("created_at")

  @@index([connectionId, metricDate])
  @@map("social_metric_snapshots")
}

model SocialPostSnapshot {
  id              String   @id @default(uuid())
  connectionId    String   @map("connection_id")
  providerPostId  String   @map("provider_post_id")
  provider        String
  permalink       String?
  mediaType       String?
  caption         String?
  mediaUrl        String?
  publishedAt     DateTime? @map("published_at")
  metrics         Json?
  raw             Json?
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@unique([connectionId, providerPostId])
  @@map("social_post_snapshots")
}
```

Use enums later if provider/status values stabilize. Strings make early integration work easier while Meta surfaces are still being tested.

## Token Storage Rules

- Access tokens stay on the API server.
- React receives connection status, not tokens.
- Encrypt token values with `META_TOKEN_ENCRYPTION_KEY`.
- Record scopes granted.
- Record expiry where Meta provides it.
- Provide disconnect/revoke behavior.
- Do not log tokens.
- Redact tokens from Sentry, request logs, and error objects.

Token encryption should use authenticated encryption, for example AES-256-GCM through Node `crypto`.

## App Review Plan

### Request Only What the Current UI Uses

For the first review, request only read-only permissions. A smaller permission request is easier to demonstrate and easier for Meta to approve.

Recommended first submission:

- Basic Instagram account access.
- Instagram insights access.
- Page list/read access only if using Facebook Login to resolve linked Instagram accounts.

Defer:

- Publishing.
- Comment management.
- Messaging.
- Ads/Marketing API.

### Build the Review Demo Before Submitting

Meta reviewers should be able to log in and reproduce the feature without talking to Tixmo.

Prepare:

- Reviewer username/password for Tixmo staging.
- Clear path from login to `/social`.
- A "Connect Meta" button.
- A connected account state.
- A dashboard panel that displays real returned Meta data.
- A disconnect button if requesting integration/account management access.
- Captions or short labels in the UI explaining why the data is shown.

### Screen Recording Structure

The App Review screen recording should be direct:

1. Log in to Tixmo as a festival admin.
2. Navigate to Social.
3. Click Connect Meta.
4. Complete Meta OAuth.
5. Select the Facebook Page/Instagram account if prompted.
6. Return to Tixmo.
7. Show the connected provider state.
8. Trigger sync or refresh.
9. Show the dashboard populated with profile/media/insight data.
10. Show where the user can disconnect the integration.

Do not submit a general product tour. Meta needs to see each requested permission being used.

### Written Permission Justification

Use plain, permission-specific language.

Example:

```text
Tixmo is an event management dashboard for music festivals and promoters. Festival administrators connect their owned Instagram professional account so Tixmo can display account and media performance in the Social dashboard. We use this permission to retrieve organic account/media insight metrics such as reach, views, and engagement for the connected festival account. Tixmo does not sell this data and does not expose it outside the authenticated organization dashboard.
```

For Page access:

```text
Tixmo uses Page access only to list Facebook Pages the authenticated festival admin manages and identify the Instagram professional account linked to the selected Page. The selected account becomes the organization's Meta social connection in Tixmo.
```

For publishing later:

```text
Tixmo uses publishing permission only when an authorized festival administrator explicitly schedules or publishes approved event marketing content from the Tixmo Social dashboard. The user previews the content, chooses the destination account, and confirms before Tixmo sends it to Instagram.
```

## Engineering Implementation Checklist

Backend:

- Add `social` API module: routes, controller, service, validation.
- Add `SocialConnection`, `SocialMetricSnapshot`, and `SocialPostSnapshot` models.
- Add token encryption utility.
- Add OAuth state storage with short expiry.
- Add Meta client wrapper with versioned Graph API URL.
- Add connection start/callback endpoints.
- Add account selection endpoint if needed.
- Add sync endpoint.
- Add disconnect endpoint.
- Add tenant authorization checks using the organization scope.
- Add tests for tenant isolation and OAuth state validation.

Frontend:

- Replace the `/social` placeholder with `SocialDashboardView`.
- Show provider cards: Meta/Facebook/Instagram.
- Add Connect, Refresh, Disconnect controls.
- Show account identity and sync health.
- Show empty, pending, connected, sync error, and expired token states.
- Keep publishing UI hidden until publishing permissions exist.

Operations:

- Add required env vars to staging and production.
- Add webhook verify token only when webhooks are implemented.
- Add logs around OAuth and sync failures.
- Add runbook entries for common Meta permission failures.
- Add dashboard-only feature flag if needed.

## Recommended API Shape

```http
GET    /api/v1/social/summary
GET    /api/v1/social/connections
GET    /api/v1/social/meta/start
GET    /api/v1/social/meta/callback
POST   /api/v1/social/meta/connections/:id/select-account
POST   /api/v1/social/meta/connections/:id/sync
DELETE /api/v1/social/connections/:id
```

`GET /social/summary` should be dashboard-friendly and provider-neutral:

```json
{
  "connections": [
    {
      "id": "connection-id",
      "provider": "meta",
      "label": "Instagram",
      "handle": "festivalhandle",
      "status": "CONNECTED",
      "lastSyncedAt": "2026-05-17T12:00:00.000Z"
    }
  ],
  "metrics": {
    "followers": 120000,
    "reach": 450000,
    "engagements": 38000,
    "engagementRate": 0.084
  },
  "posts": []
}
```

## Common Failure Modes

### No Pages Returned

Likely causes:

- User does not have Page admin/full control access.
- Page is owned by another Business Portfolio.
- Wrong Facebook account was used during OAuth.
- Required Page list/read permission was not granted.

### Instagram Account Missing

Likely causes:

- Instagram account is personal, not Business/Creator.
- Instagram account is not linked to the selected Facebook Page.
- User has Page access but not Instagram asset access in Business Suite.

### Permission Works for Developer but Not Customer

Likely causes:

- App is still in development mode.
- Permission has standard access only, not advanced access.
- Customer account is not assigned as an app tester.
- App Review has not approved the permission.

### OAuth Redirect Error

Likely causes:

- Callback URL does not exactly match Meta settings.
- HTTP/HTTPS mismatch.
- Trailing slash mismatch.
- Staging URL missing from valid redirect URIs.

### Insights Empty or Partial

Likely causes:

- Account/media is too new.
- Metric is not available for the media type.
- Requested period does not match metric support.
- Meta has privacy thresholds for demographic metrics.
- The account lacks enough audience/activity for some metrics.

## Security Requirements

- Never expose Meta tokens to the browser.
- Never store tokens in `Organization.settings`.
- Encrypt tokens at rest.
- Scope every social connection to `organizationId`.
- Enforce OWNER/ADMIN/MANAGER/PROMOTER access consistently with the analytics dashboard.
- Log provider errors without secrets.
- Provide disconnect/revoke.
- Keep App Review demos on staging data that the festival has authorized Tixmo to use.

## Useful Official References

- Meta Instagram Platform docs: https://developers.facebook.com/docs/instagram-platform/
- Instagram API with Facebook Login: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/
- Instagram API with Instagram Login: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/
- Instagram insights: https://developers.facebook.com/docs/instagram-platform/insights/
- Meta App Review: https://developers.facebook.com/docs/app-review/
- Meta permissions reference: https://developers.facebook.com/docs/permissions/reference/
- Meta Graph API changelog: https://developers.facebook.com/docs/graph-api/changelog/
- Meta official Postman workspace for Instagram API: https://www.postman.com/meta/workspace/instagram/

## Practical First Sprint

1. Build `/social` with mocked provider-neutral data.
2. Add organization-level non-secret Meta account metadata.
3. Add backend `social` routes returning the same shape the UI already uses.
4. Add real Meta OAuth for one internal/test festival account.
5. Persist encrypted tokens in `SocialConnection`.
6. Sync Instagram profile/media/insights on demand.
7. Record the exact App Review flow from the working staging implementation.
8. Submit only the read-only permissions used by the working dashboard.

This gives Tixmo a usable social dashboard surface while the Meta approval process runs in parallel.
