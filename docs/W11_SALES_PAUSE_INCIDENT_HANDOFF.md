# W11 source-backed sales-pause and incident handoff (#481)

Source baseline: `8aae387bcd4290edd259fd75aa11baaa1f62ca63`.
Prepared 2026-10-21; source-only, not a deployed or rehearsed control.
This bounded handoff does not accept #248, #243, launch, or live monitoring.
Existing Express/Prisma routes, recovery jobs and monitoring scripts are reused;
no new framework, product change, provider action or operational execution.

## Non-cancelling source affordance, not a qualified pause

Mounted routing: `tixmoapi2/src/app.ts:144` mounts `/api`;
`src/api/index.ts` mounts the configured version and `/events`. With version
`v1`, the actual control is `POST /api/v1/events/:id/status`, not a `/pause`
endpoint. Route `src/api/events/routes.ts:531` requires authentication and
OWNER, ADMIN, MANAGER or PROMOTER. Controller `controller.ts:181` resolves the
actor and calls `assertEventAccess` before transition; role alone is insufficient.
Check actual deployed API version and event/organization scope before use.

`src/api/events/service.ts:62` allows ON_SALE -> SOLD_OUT -> ON_SALE.
`transitionEventStatus` at line 494 updates only event status; it does not
zero inventory, cancel orders, invalidate tickets, or initiate refunds.
There is no PAUSED state. SOLD_OUT is a stock-facing semantic workaround,
not an approved customer-facing incident policy or proof of exhausted inventory.
Generic event PUT is not the status-transition control.

Conditional operator sequence for a separately authorized rehearsal:

1. Record event ID, organization, prior status, available/held/sold inventory,
   incident ID, timestamps in America/St_Johns plus UTC, and approvers. Read
   event through authenticated `GET /api/v1/events/:id` with scoped access.
2. For an ON_SALE event only, submit the status route with
   `{"status":"SOLD_OUT"}`; retain response and read-back evidence.
   `orders/service.ts:90` rejects new orders unless PUBLISHED or ON_SALE,
   so subsequent creation sees SOLD_OUT as unavailable. Existing PENDING
   orders are not cancelled by this change and may still complete.
3. Verify refusal of new orders and continued paid access in an authorized
   synthetic rehearsal, not by creating live paid orders. This task did not
   execute either action. Do not stop the whole API, webhook, recovery job,
   receipt delivery or scanner to simulate a new-sales-only pause.
4. Resume/rollback via the same scoped POST with `{"status":"ON_SALE"}`,
   only after incident approval, inventory/recovery review and read-back.
   This restores ON_SALE, not an arbitrary saved state; never resume a truly
   sold-out event blindly. Windows, stock, start time and waiting-room checks
   still apply. There is no dedicated atomic pause/resume audit control.

Unsupported edges: PUBLISHED can create orders but cannot transition directly
to SOLD_OUT. A two-hop PUBLISHED -> ON_SALE -> SOLD_OUT is not a qualified
atomic pause and changes semantics; do not prescribe it as such. DRAFT,
CANCELLED, COMPLETED and DELETED are not pause substitutes. Cancellation is
terminal and `cancelEvent` includes order cancellation, unlike the status-only
SOLD_OUT path. Do not call `/cancel`, delete, refund, change ticket statuses,
or manipulate inventory to pause sales.

Concurrency limitation: createOrder takes an event row lock before checking
state (`orders/service.ts:85`), while generic transition reads then updates
without a shared explicit transition transaction/lock. Update may wait for a
checkout already holding that row; orders accepted before the update commits
can complete. Concurrent status writers can race stale transition validation.
No instantaneous ingress barrier, dedicated pause flag, or concurrent rehearsal
is established here. Treat the acknowledged/read-back state as the boundary,
not the operator's button-click time.

Minimal repair recommendation (separate scoped backend task, not implemented):
add an explicit event sales-paused control independent of lifecycle/stock,
with existing scoped authorization; serialize pause/resume and checkout eligibility
on the existing event row lock, retain actor/reason/prior state audit evidence,
and leave paid fulfillment/receipt/scanner/reconciliation eligibility unchanged.
Define in-flight-order policy and customer wording with product authority.
Independent mounted-route, tenant, concurrent checkout and paid-access tests
must qualify that control before claiming a general-purpose operational pause.

## Paid access and reconciliation preservation

`orders/service.ts:341` returns already PAID orders and confirms eligible
PENDING orders for PUBLISHED/ON_SALE/SOLD_OUT. Payment intent creation and
success reconciliation also allow SOLD_OUT (`payments/service.ts:64,350`).
Thus this workaround blocks NEW order creation, not every new payment for an
existing order. No assertion is made that all in-flight purchases stop.

Authenticated `/api/v1/tickets/mine`, `/:id`, `/:id/qr`, and
`/api/v1/orders/mine`, `/:id`, `POST /:id/receipt` remain mounted by their
routes. Existing ownership/tenant checks still apply; no access bypass is
introduced. Scanner `/api/v1/scanners/sync`, `/scan`, `/validate` use
`authenticateScanner` rather than operator roles. `scanners/service.ts:440`
retains ticket status only for PAID orders, non-PROCESSING refunds, undeleted
events in PUBLISHED/ON_SALE/SOLD_OUT; unpaid/refund-processing tickets are not
promised entry. Offline freshness/field acceptance remains a separate gate.

Keep webhook processing and existing recovery enabled. Use
[late-paid reconciliation policy](LATE_PAID_MANUAL_RECONCILIATION.md):
LATE_PAYMENT rows are manual exceptions, excluded from automatic refunds;
a REQUESTED row is not permission to execute money movement. Do not reconfirm
inventory to fix a receipt failure. No live retry/refund permission is granted.

## Monitoring inventory and incident handoff

- `src/app.ts:110`: `/ready` returns 200 only when database and Redis are true,
  otherwise 503, with no-store. `/health` and version `/health` are liveness,
  not equivalent dependency checks. `scripts/check-status.mjs:48,92` includes
  `/ready` for API-origin mode and validates dependency JSON; explicit URL
  mode covers only supplied targets. Check target inventory, not just exit 0.
- `.github/workflows/uptime-status.yml` and
  [monitoring runbook](UPTIME_STATUS_MONITORING.md) are existing mechanisms.
  The runbook's older target table omits readiness, unlike current script.
  Configuration, scheduled execution and failed/recovery alert receipt are
  NOT evidenced by source availability. No schedule/config was changed here.
- `jobs/payment-recovery.job.ts`: immediate then 60-second recovery loop,
  process-local overlap guard and error logging; not proof the job runs on target.
- `payments/service.ts:759`: PAID unsent receipts with PENDING or stale
  PROCESSING receipt state; oldest-updated batch of 50, per-item error logs.
- `payments/service.ts:785`: webhook RECEIVED/FAILED or stale PROCESSING
  recovery, bounded batch 50 with backoff; lost payment attempts and unresolved
  orders also reconciled later in this function. Capture count, oldest age,
  state and progress, not merely job heartbeat.
- `payments/service.ts:721`: refund REQUESTED/PROCESSING/FAILED and selected
  succeeded-but-unfinalized cases; batch 50/backoff, excluding LATE_PAYMENT.
  Manual late-paid exception counts/age need separate ownership.
- Recovery exception text naming `tixmo-backend` is a source diagnostic string,
  NOT evidence a person accepted on-call. Error logs/admin-alert attempts
  (`payments/service.ts:378,388`) do not prove delivered notification.
  No authenticated operational backlog dashboard/count endpoint or delivered
  alert/recovery path is established by this inspection. Do not run ad hoc SQL
  or provider operations under this document's source-only authorization.

Incident sequence: capture exact candidate/environment, impacted event and
symptoms, readiness/liveness distinction, backlog state/age and last progress;
assign the slots below; decide whether the conditional control is applicable;
record every action and financial exceptions. Preserve paid access, webhook
and reconciliation processing. After recovery, require fresh readiness,
new-sales refusal/resume evidence, paid QR/scanner access, backlog drain and
received recovery notification before incident closure. Escalate missing
control rather than claim cancellation is a pause.

Named responsibility slots (no invented assignments):

- Incident commander: UNASSIGNED.
- Sales-control operator: UNASSIGNED.
- Support/customer communications owner: UNASSIGNED.
- Payment/refund/manual-reconciliation owner: UNASSIGNED.
- Monitoring/on-call recipient and backup: UNASSIGNED.
- Second approver for recovery/resume: UNASSIGNED.
- Release go/no-go authority signoff: UNASSIGNED.

Thresholds in the existing monitoring runbook (two failed checks; checkout,
scanner or webhook smoke failure; repeated 5xx; confirmation retry exhaustion)
are proposals pending rehearsal calibration. Backlog oldest-age/count/drain
thresholds and escalation/recovery windows remain UNASSIGNED decisions; no
fabricated numeric SLO or delivered-alert claim. Record actual failure and
recovery receipts and acknowledgement latency in the authorized drill.

## Evidence boundaries and required next review

#298's historical harness `05f2f42fc9a3969c7c10e11250d83ce099b500ef`
(product `4ec8594850eb547dafc145a14bb1b85cdeaa235c`) and independent #300/#301
proved a bounded LOCAL Redis SIGSTOP/CONT readiness scenario only. They are
not current-candidate tests, Postgres-fault qualification, target deployment,
alert delivery, on-call acknowledgement, sales-pause drill or full W11 acceptance.
#248 remains open and #243 acceptance is not supplied by this handoff.

Actual #481 checks: source/route/state/call-path inspection and
`git diff --check`; only this new Markdown file is changed. No tests, builds,
services, DB, network, provider, environment/secret reads, installs, configuration,
scheduler, spend, push, merge or deployment. Search probes against guessed
paths returned missing-path errors; corrected to the mounted `src/api` tree.
Independent QA must review this document's exact committed SHA against the
baseline, especially SOLD_OUT semantics, authorization, in-flight limits,
readiness drift and absent delivered alert evidence. All runtime/target
qualification and named-owner acceptance remain open; this is not launch GO.
