# Independent QA #484: scoped SOURCE/DOCS PASS

Reviewed 2026-10-21 as tixmo-qa. Exact author/source SHA:
`839ff1934f1eb86b48f1227680deecc6835de388`; comparison base:
`56fbad5630df09fc3be304d480b38263f9c7130a`.
Independent new worktree `/home/daniel/projects/projectTixmo/worktrees/review-484`,
branch `tixmo/review-484`, created at the exact author SHA. Author delta is
only `docs/UPTIME_STATUS_MONITORING.md`: 23 insertions, 9 deletions.

Verdict: no blocking factual finding in this bounded documentation correction.
This is NOT deployed monitoring, alert delivery, on-call, full #248/W11 or
launch acceptance. #483 is left for PM disposition, not closed by this review.

## Independently traced source

- `package.json:14` maps status:check directly to the inspected Node script.
  `scripts/check-status.mjs:28-57` selects non-option CLI targets first,
  then nonempty TIXMO_STATUS_URLS, then origin-derived targets. Explicit modes
  replace origin mode, and the existing explicit example omits readiness.
  Origin mode uses TIXMO_API_BASE_URL before API_BASE_URL and
  TIXMO_DASHBOARD_URL before DASHBOARD_URL; it builds /ready, /health,
  /api/v1/health and the supplied dashboard URL. Both origins are not required
  by the standalone script. The doc does not claim the workflow has this leniency.
- Script lines 20-25,130-136 normalize/deduplicate and filter unparseable URLs;
  zero surviving targets exits 1. A mixture can omit invalid explicit entries,
  so a passing exit is not sufficient target-inventory evidence. This is URL
  parsing, not an HTTP-only scheme allowlist. Malformed API origin construction
  can throw before normalization; the correction appropriately limits its
  filtering statement to explicit URLs, not a universal validation guarantee.
- Script lines 66-92 follow redirects, require final status 200-399, parse
  advertised application/json, and assert status=ready plus strict boolean
  database/redis only when the supplied URL pathname is exactly /ready.
  /ready/ or other paths are not equivalent assertions. Query strings do not
  change pathname. A redirect does not change the originally selected path
  predicate. Other paths do not receive health-body assertions; invalid
  advertised JSON still fails. These are source properties, not exercised tests.
- `tixmoapi2/src/app.ts:100-122`: /health is cheap liveness; /ready returns
  no-store JSON, 200 only for both checks strictly true, otherwise 503.
  `src/services/readiness.service.ts:9-59` probes Prisma SELECT 1 and ready
  Redis PING/PONG, sharing active probes with a bounded response wait and a
  short cache. Null/pending checks are not success. No dependency-fault
  injection or current runtime behavior was established by this inspection.
- Script defaults are 8000 ms and one retry per URL; lines 103-127 implement
  per-invocation retry, not consecutive scheduled incident counting.
- `.github/workflows/uptime-status.yml:3-6,13-19,28-52`: manual trigger and
  15-minute schedule in source; each environment requires BOTH origins with
  OR missing-value condition and explicit exit 1. Staging precedes production;
  no always()/continue-on-error overrides make production run after ordinary
  staging failure. Each configured step supplies origin variables. Repository
  source cannot establish enabled schedule, configured secrets, or actual runs.

## Evidence and policy boundaries

The correction explicitly requires actual received failure/recovery receipts,
linked run URLs and timestamps, recipient/acknowledgement latency and accepted
human primary/backup ownership. It does not mistake workflow failure, logs,
attempted sends or a green run for notification delivery. Launch/support,
monitoring/on-call primary/backup and incident commander remain UNASSIGNED.
Hosted-provider settings and incident thresholds are unchanged proposals,
pending authorized rehearsal/calibration; the workflow does not implement
those hosted alert/recovery settings. All launch checkboxes remain unchecked.

Read accepted #481/#482 board context, the #481 handoff at the comparison
base, and immutable #482 evidence
`9a4b565a3276aeb9f839824ca7c42720ec092799:docs/team/evidence/task-482/QA.md`.
These identify historical monitoring-document drift; they are contextual
source only, not new runtime approval. The new relative W11 handoff link
resolves. #248, alerts, on-call and launch remain OPEN/unqualified.

## Actual checks and limits

Read required role/repository/team instructions; board list --mine, inbox,
show/claim exact484 without force; show481/482. Read-only cat/sed/rg/nl and
Git source/diff inspection. `git rev-parse HEAD` matched exact author SHA.
`git diff --stat` and `git diff --name-only BASE..AUTHOR` confirmed one Markdown
file. `git diff --check BASE..AUTHOR` exited 0. Worktree was clean before
adding this evidence. An initial rg probe included nonexistent
`tixmoapi2/src/server.ts` and returned exit 2; corrected inspection used the
actual app.ts and readiness.service.ts. This was not a test failure.

No tests/builds, network, product runtime, services, DB, provider operations,
environment/secret reads, configuration/scheduler changes, install, spend,
push, merge or deploy. Only local Git worktree/evidence creation and board
updates. Evidence commit uses command-local Git identity and disabled hooks
to preserve the source/static-only boundary. Any changed author SHA requires
fresh review; this report approves only the exact scoped correction above.
