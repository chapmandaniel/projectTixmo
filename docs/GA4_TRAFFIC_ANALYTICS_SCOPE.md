# GA4 Traffic Analytics Scope

Status: deferred from V1 beta

## Decision

GA4 Data API integration is not part of the V1 market-readiness release.

V1 analytics scope is:

- Tixmo ticket sales.
- Tixmo order volume.
- Tixmo tickets sold.
- Tixmo customers.
- Tixmo event-level sales reporting.
- Tixmo attendance/reporting data proven by the reports integration tests.

GA4 scope for V1 is limited to readiness and configuration language:

- Store or select organization-level GA measurement tags.
- Show whether a GA tag is selected or needed.
- Label web traffic metrics as GA4-only.
- Keep GA4 charts in an empty/not-synced state until a real Data API integration exists.

## Why

The launch checklist defines V1 around the core operator path: organization account, venue, event, ticket types, order/payment, orders/attendees, scanner validation, approvals, and asset sharing. Traffic analytics is useful, but it is not required to prove checkout trust, verification trust, or the V1 operator path.

Shipping partial GA4 Data API work before production credentials, consent posture, property ownership, and quota/error behavior are verified would create a market-readiness risk. The dashboard should not imply that live web traffic is available unless the Data API pipeline is implemented and tested end to end.

## Current Product Behavior

Current dashboard behavior matches this decision:

- `tdash/src/features/AnalyticsView.jsx` separates `Web traffic (GA4)` from `Ticket sales (Tixmo data)`.
- `tdash/src/lib/analyticsSources.js` stores GA tag metadata and metric/dimension blueprints.
- `buildEmptyTrafficAnalytics()` keeps traffic metrics in a not-synced state.
- `tdash/src/test/AnalyticsView.test.jsx` verifies the GA4/Tixmo sales language separation.

## Post-V1 Requirements

Do not start GA4 Data API implementation until these are assigned:

- Product owner for traffic analytics.
- Privacy/consent owner for GA4 collection and notice language.
- Google Cloud owner for GA4 Data API credentials.
- Tenant model for organization-specific GA properties and streams.
- Backend endpoint design for fetching GA4 metrics without exposing credentials to the browser.
- Cache, quota, retry, and failure-state policy.
- Tests for missing credentials, revoked credentials, empty properties, quota failures, date filters, organization scoping, and event filtering.

## Reopen Criteria

Reopen this work only when at least one launch customer explicitly needs traffic analytics before beta completion and the above owners are assigned.

