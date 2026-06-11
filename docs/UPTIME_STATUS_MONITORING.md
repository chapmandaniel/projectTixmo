# Tixmo Uptime And Status Monitoring

Status: monitoring script and scheduled workflow template added. Production monitoring is not complete until the target URLs are configured and at least one scheduled run passes.

## What To Monitor

Required launch monitors:

| Target | URL | Frequency | Expected result |
| --- | --- | ---: | --- |
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

The command checks:

- `/health`
- `/api/v1/health`
- dashboard root when `TIXMO_DASHBOARD_URL` is set

It exits non-zero if any configured target fails, times out, or returns a non-2xx/3xx response.

## GitHub Scheduled Monitor

Workflow: `.github/workflows/uptime-status.yml`

Schedule: every 15 minutes, plus manual `workflow_dispatch`.

Required repository or environment secrets:

- `STAGING_API_BASE_URL`
- `STAGING_DASHBOARD_URL`
- `PRODUCTION_API_BASE_URL`
- `PRODUCTION_DASHBOARD_URL`

The workflow skips an environment when both URLs for that environment are missing. A configured environment fails the workflow if any status target fails.

Launch evidence to capture:

- First passing manual workflow run URL.
- First passing scheduled workflow run URL.
- The configured API and dashboard origins.
- The alert destination for failed workflow runs.

## Hosted Uptime Monitor Option

If using a dedicated uptime provider instead of GitHub Actions, configure the same targets:

- `GET /health`
- `GET /api/v1/health`
- `GET /`

Use:

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
- [ ] Failed monitor alerts route to the launch owner or support owner.
- [ ] Sentry test alert routes to the launch on-call destination.
