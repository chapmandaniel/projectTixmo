# Tixmo Uptime And Status Monitoring

Status: existing monitoring script and scheduled workflow template are source-backed, not evidence of configured or deployed monitoring. Launch qualification remains open until target runs, received failure/recovery notifications and accepted human ownership are evidenced. See [W11 incident handoff](W11_SALES_PAUSE_INCIDENT_HANDOFF.md) for broader control and evidence gaps; #248 and launch remain OPEN.

## What To Monitor

Required launch monitors:

| Target | URL | Frequency | Expected result |
| --- | --- | ---: | --- |
| API dependency readiness | `https://<api-origin>/ready` | 1 to 5 minutes | HTTP 200 JSON with `status: ready`, `checks.database: true` and `checks.redis: true` |
| API root health | `https://<api-origin>/health` | 1 to 5 minutes | HTTP 200 with `status: ok` |
| API version health | `https://<api-origin>/api/v1/health` | 1 to 5 minutes | HTTP 200 JSON response |
| Dashboard | `https://<dashboard-origin>/` | 1 to 5 minutes | HTTP 200 to 399 |
| Sentry test event | `/api/v1/debug/sentry` in staging only | Per release | Event arrives with release and alert-route tags |
| Full V1 smoke | `docs/PRODUCTION_LAUNCH_CHECKLIST.md` Section 7 | Per release | Human or scripted smoke passes |

Recommended after beta:

- Synthetic checkout against a non-production payment/test event.
- External review link smoke against a staging token.
- Shared asset link smoke against a staging token.
- Scanner sync/scan smoke against a staging scanner key.
- Read-only seeded market-demo smoke with `npm run smoke:external`.

Do not run destructive or paid production checkouts from a frequent uptime monitor.

## Local Or CI Status Check

Run against explicit URLs:

```bash
TIXMO_STATUS_URLS=https://api.example.com/health,https://app.example.com npm run status:check
```

Run against API and dashboard origins:

```bash
TIXMO_API_BASE_URL=https://api.example.com \
TIXMO_DASHBOARD_URL=https://app.example.com \
npm run status:check
```

In origin mode, `scripts/check-status.mjs` builds these targets:

- `/ready` (dependency readiness)
- `/health` (liveness)
- `/api/v1/health` (liveness)
- dashboard root when `TIXMO_DASHBOARD_URL` is set

CLI URL arguments take precedence over `TIXMO_STATUS_URLS`; either explicit mode replaces, rather than supplements, origin-derived targets. The explicit example above omits `/ready` and version health, so its success alone is not readiness evidence. Include the exact `/ready` path explicitly or use origin mode for dependency coverage. A standalone invocation does not require both API and dashboard origins; it checks whichever targets are supplied.

The API `/ready` handler returns 200 only when database and Redis are both true, otherwise 503. The script requires a 2xx/3xx response and, for a supplied URL whose pathname is exactly `/ready`, parsed JSON with `status: ready` and both dependency checks true. Other paths receive HTTP-status checking, not health-body assertions; advertised JSON must still parse. `/health` success is not dependency readiness.

The command exits non-zero after configured retries if any valid target fails, times out, or fails those checks. Defaults are an 8-second request timeout and one retry per URL, not a persistent cross-run incident counter. Invalid explicit URLs are filtered out; zero valid targets fails. Inspect the actual target inventory, not only exit status.

## GitHub Scheduled Monitor

Workflow: `.github/workflows/uptime-status.yml`

Schedule: every 15 minutes, plus manual `workflow_dispatch`.

Required repository or environment secrets:

- `STAGING_API_BASE_URL`
- `STAGING_DASHBOARD_URL`
- `PRODUCTION_API_BASE_URL`
- `PRODUCTION_DASHBOARD_URL`

Each environment step requires BOTH its API and dashboard URL. If either or both are missing, that step emits an error and exits 1; there is no skip-missing-environment success. Staging runs first; a failed staging step normally prevents the production step from running. With both URLs present, each step invokes origin mode and fails if any status target fails. Source presence does not prove the workflow is enabled or targets configured.

Launch evidence to capture:

- First passing manual workflow run URL.
- First passing scheduled workflow run URL.
- The configured API and dashboard origins.
- The alert destination and actual received failure notification, with run URL, timestamp, recipient and acknowledgement latency.
- The corresponding received recovery notification and acknowledgement, linked to a fresh passing run; a green run alone is not a delivery receipt.
- Accepted primary and backup human ownership; source/log messages and attempted sends are not receipts.

No failure/recovery receipt or accepted on-call assignment is established by this source-only correction. Named launch owner, support owner, monitoring/on-call primary, backup and incident commander remain UNASSIGNED until humans accept them. Retain receipts in the authorized rehearsal evidence; do not infer delivery from workflow failure alone.

## Hosted Uptime Monitor Option

If using a dedicated uptime provider instead of GitHub Actions, configure the same targets:

- `GET /ready` with dependency JSON assertions above (HTTP-only monitoring is insufficient)
- `GET /health`
- `GET /api/v1/health`
- `GET /`

Proposed hosted-provider settings, pending authorized rehearsal/calibration (not implemented by the GitHub workflow):

- 60-second or 5-minute check interval.
- 8-second timeout.
- Alert after 2 consecutive failures.
- Recovery notice after 1 successful check.
- Notification to the launch owner and support owner.

## Sentry Alerting

Sentry is already expected to include:

- `service`
- `deployment_environment`
- `release`
- `alert_route`

Before launch:

1. Configure `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` or `RELEASE`, and `SENTRY_ALERT_ROUTE`.
2. Deploy staging.
3. Trigger `/api/v1/debug/sentry` in staging only.
4. Confirm the event reaches Sentry with the required tags.
5. Confirm the alert rule routes to the launch on-call destination.

## Incident Thresholds

Existing proposed incident thresholds below are unchanged and require rehearsal/calibration and accepted escalation/recovery ownership. They are not proof of configured alert rules; script retries do not implement a two-consecutive-scheduled-check threshold. Dependency readiness failures also require incident triage, not dismissal because liveness passes.

Create an incident when any of these happen:

- API health fails for 2 consecutive checks.
- Dashboard health fails for 2 consecutive checks.
- Checkout, payment webhook, scanner validation, or public review/share route fails during launch smoke.
- Sentry receives repeated 5xx errors on checkout, orders, payments, scanners, approvals, assets, or auth.
- Admin alert email reports paid-order confirmation retry exhaustion.

## Launch Checklist

- [ ] `npm run status:check` passes against staging.
- [ ] `npm run status:check` passes against production or production-like environment.
- [ ] GitHub monitor secrets are configured or hosted uptime provider targets are configured.
- [ ] One manual monitor run passes.
- [ ] One scheduled monitor run passes.
- [ ] Actual failure and recovery notifications are received and acknowledged, with linked run/timestamp receipts.
- [ ] Launch/support owners, monitoring/on-call primary and backup, and incident commander accept named assignments (currently UNASSIGNED).
- [ ] Sentry test alert routes to the launch on-call destination.
