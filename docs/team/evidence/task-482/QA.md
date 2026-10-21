# Independent QA #482: scoped SOURCE/DOCS PASS

Reviewed exact author commit `56fbad5630df09fc3be304d480b38263f9c7130a`
against `8aae387bcd4290edd259fd75aa11baaa1f62ca63`, 2026-10-21.
Independent worktree `/home/daniel/projects/projectTixmo/worktrees/review-482`,
branch `tixmo/review-482`. Only author delta: 168-line
`docs/W11_SALES_PAUSE_INCIDENT_HANDOFF.md`. No blocking factual finding within
this bounded documentation scope; NOT runtime, tenant penetration-test, sales
pause qualification, delivered-alert, on-call, W11 #248, #243 or launch approval.

## Independently inspected source and conclusions

- `tixmoapi2/src/app.ts:144`, `src/api/index.ts:46,66`: `/api` plus configured
  version plus `/events`. `events/routes.ts:11,531` authenticates and role-gates
  POST `/:id/status` to OWNER/ADMIN/MANAGER/PROMOTER; controller:181-188 resolves
  current actor and asserts event scope. `utils/tenantScope.ts:14,83-105` permits
  the explicit platform-admin exception, otherwise requires matching organization.
  This is source tracing, not exercised auth evidence.
- `events/service.ts:62-70,494-518`: ON_SALE -> SOLD_OUT -> ON_SALE supported;
  PUBLISHED -> SOLD_OUT absent. Only status updated on this path, no stock,
  ticket, order or refund mutation. Read/validate/write is not a serialized
  state-machine transaction; stale writers can validate old status. SOLD_OUT
  remains a misleading stock semantic if used as incident pause, accurately
  disclosed rather than approved as policy.
- `orders/service.ts:85-101,110-160`: event row lock precedes reread and
  eligibility; only PUBLISHED/ON_SALE can create, with sales/start windows,
  type status, stock and tier checks. A transition update can wait on held row
  locks. Existing accepted orders survive; no instantaneous button-click
  cutoff is established. Resume cannot guarantee stock availability.
  `orders/routes.ts:61` retains waiting-room middleware.
- `orders/service.ts:341-363`: already PAID returns; eligible PENDING can
  confirm under SOLD_OUT with HELD -> SOLD accounting. `payments/service.ts:64-70,
  345-358` accepts SOLD_OUT for intent and fulfillment. Thus NEW orders stop,
  not all new payments. `events/service.ts:585-605` cancellation additionally
  invalidates paid tickets/cancels pending orders: cancellation is not pause.
- `tickets/routes.ts:11-12,258`, tickets/controller and service:113,290-330:
  authenticated buyer ownership/read and QR paths are not disabled merely by
  SOLD_OUT. Existing manager exceptions are unchanged, not independently
  certified secure by this review. `orders/routes.ts:12-14` and controller
  getOrder/resendReceipt preserve existing order-access checks.
- `scanners/routes.ts:119-120,166-167,257-258`: scanner authentication protects
  sync/validate/scan. `scanners/service.ts:426-452` binds sync to active scanner
  organization/event and preserves status only for PAID, non-PROCESSING refund,
  undeleted PUBLISHED/ON_SALE/SOLD_OUT events. This does not guarantee admission
  for every ticket or qualify offline freshness/field operation.
- `payments/service.ts:354,574-578,721-752`: late-paid exceptions remain manual,
  explicitly excluded from refund recovery and defensive provider ingress.
  `docs/LATE_PAID_MANUAL_RECONCILIATION.md` agrees: REQUESTED is not authority
  for financial execution. Receipt failure must not reconfirm inventory.
- `jobs/payment-recovery.job.ts:3-22`: immediate/60-second process-local guard.
  `payments/service.ts:759-783` receipt batch 50, oldest updated, PENDING/stale
  PROCESSING PAID-unsent; :785 onward webhook backoff batch, lost attempts,
  unresolved orders and per-item diagnostics. Diagnostic owner text is not
  accepted operational ownership or delivered alert evidence.
- `app.ts:100-122` readiness requires database AND Redis and sends no-store;
  health is liveness. `scripts/check-status.mjs:35-52,92` origin-mode includes
  readiness and validates dependency JSON; explicit URLs can omit readiness.
  Workflow YAML has a schedule/template, not proof of configured targets or
  delivery. `docs/UPTIME_STATUS_MONITORING.md` omits readiness and also has
  older skip-missing-target wording while current workflow requires both URLs.
  The handoff does not claim this historical text is deployed behavior.
- Board #298 read in full: historical harness05f2f42 and independent QA300/
  technical301 only bounded LOCAL Redis SIGSTOP/CONT. Handoff correctly
  excludes current-candidate, Postgres, deployment, alert/oncall and full W11.
  All incident/operator/payment/monitoring/approval slots remain UNASSIGNED.

## Checks and limits

Read-only `sed`, `cat`, `rg` source inspection, board481/482/298 acceptance and
history, and Git diff inspection. `git diff --check BASE..56fbad5`: exit 0.
`git diff --stat BASE..56fbad5`: exactly one Markdown file, 168 insertions.
No tests/builds, product runtime, services, DB, network/provider, .env or secret
reads, configuration/scheduler changes, installs, spend, push/merge/deploy.
Evidence-only local commit uses command-local Git identity and hooks disabled
so no repository hook executes outside the static-only authorization.

Verdict: scoped documentation PASS, general operational pause and launch remain
unqualified. Preserve exact author SHA; any revised document needs review.
