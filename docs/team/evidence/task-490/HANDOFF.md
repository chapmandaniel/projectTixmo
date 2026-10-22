# Task 490 source-only author checkpoint

Base 434bb2fda62ab0d9645896e2020e8a96202ee612; isolated branch
`tixmo/task-490-sales-pause-ui`, worktree `/home/daniel/projects/projectTixmo/worktrees/task-490`.
Existing React/API/dashboard primitives reused; no dependencies or framework added.
Read full task248 proxy decision and audit clarification, 485 contract, 487 handoff,
team workflow, existing API wrappers/checkout/order continuation and scripts/imports.

Explicit existing-role organizer pause/resume requires trimmed bounded reason and
browser UUID, retains identical request across ambiguous failures/retry. Server
still enforces actual event tenant scope. No lifecycle/stock toggle. Successful
acknowledgement must match event/key/desired state, then GET current event; replay
historical state is not displayed as current. Failed refresh reports acknowledged
request but no current-state success. Existing-order/payment/receipt/wallet paths
are not modified. NEW checkout eligibility blocks pause for both sale lifecycles;
strict existing errors.code SALES_PAUSED handling only. Applicable cached pause
wording yields to existing error/order state and lifecycle/window/ticket eligibility.
No automatic retry/order/payment or public audit information added.

Actual check: `node docs/team/evidence/task-490/inert-checks.mjs` PASS: inert helper
mocks cover historical replay vs current refresh, identical request retry, denial,
refresh failure, invalid acknowledgement, exact error envelope, both lifecycles and
cancellation. `git diff --check` PASS. These imports contain ONLY pure local helper
source via data URLs; no application imports, React rendering or services. Package,
Vite and test setup inspected first. UI rendering/compilation/accessibility/design
guard and mounted auth/tenant/payment/concurrency/rollback regression UNVERIFIED.
No app/browser/runtime/services/DB/generation/migrations/network/install/env/secrets/
config/scheduler/provider/production/spend/push/merge/deploy. Four-minute bounded
checkpoint; independent lead and QA exact-SHA review mandatory. Author does not close.
Full248/243/launch and later separately authorized synthetic acceptance remain OPEN.

## Repair checkpoint after independent QA491

Read immutable QA findings at4459bcd530878600cc765a7cd178bfae82cfb2f9,
including both blocking P2 issues and bounded unmount gap. Inspected actual mounted
EventManagementDashboard callback: onUpdate(updatedEvent) replaces parent eventData
when id exists; otherwise fetches. The control now displays authoritative event props
rather than an independently captured snapshot and passes freshly GET-fetched current
event to that callback. A newer event/user object or unmount invalidates old async
completion before any response-driven state update or parent callback. Parent key
includes actor id/role as well as event id. Pending ambiguous requests keep their
original intent/reason/UUID; definitive HTTP400/401/403/404/409/422 allows an explicit
Discard rejected request action that only clears local input/request. It does not
submit a mutation or automatically generate a replacement key. Server/transport or
acknowledged-but-refresh failures remain retry-with-same-request.

Added `node docs/team/evidence/task-490/repair-checks.mjs`: PASS actual extracted
submit/discard bodies with inert setter/API ports: 403/409 rejection and explicit
reset without mutation, transport retry retaining identical key+intent, late
completion suppression after simulated unmount/same-id event replacement/user
replacement, valid current snapshot parent propagation, plus authoritative-prop and
callback source assertions. Original inert-checks rerun PASS unchanged. Diffcheck
PASS. These are inert models/extraction, NOT mounted React lifecycle or tenant proof.
No additional runtime authority used; prior limitations remain. New exact commit
supersedes913b90d6 for independent QA491 re-review AND separate lead492 review.
