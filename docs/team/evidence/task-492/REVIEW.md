# Independent lead #492 — scoped SOURCE/INERT APPROVE

Reviewed exact implementation `6ab827bff6fdf67283b93f16612106f2217d4dc0`
against backend base `434bb2fda62ab0d9645896e2020e8a96202ee612`.
Reviewer: tixmo-lead, independent of original frontend author.
New isolated branch `tixmo/task-492-independent-lead`, worktree
`/home/daniel/projects/projectTixmo/worktrees/task-492`, created at exact target.
Only this report and independent inert harness are added; no implementation edits.

Read role/repository/team instructions, current claims and #492/#490/#491/#487/#485/#248,
actual BB248 sales-pause and audit-model decisions, implementation handoffs and
contract, and immutable QA R2 `cc702a3871f016ab232d87288ded5a7edda5bb60` report.
Earlier rejected `913b90d6` is NOT the approval target. Original QA findings remain
immutable; both P2 fixes were independently inspected in the current source.
Existing React/API/dashboard primitives satisfy reuse; no dependency was added.

## Contract review

- Explicit boolean intent plus trimmed reason and browser UUID are captured once
  per request and retained across retry, rather than toggling current state.
  Definitive 400/401/403/404/409/422 failures offer explicit local-only discard;
  ambiguous network/408/429/5xx and acknowledged-refresh failure retain identity.
  No automatic resubmit, key replacement, resume, order or payment was introduced.
- POST acknowledgement matches event, key and desired state before GET current
  event. Historical replay evidence never becomes displayed current state. GET
  failure is acknowledgement-without-current-refresh, not success or discard.
  API normalizer returns the `.data` shape consumed by the helper; controller
  awaits transactional service completion before response.
- Organizer renders authoritative event props, not an independently stale local
  event snapshot. GET-refreshed event goes through actual ECC onUpdate to
  EventManagementDashboard setEventData. Event/actor identity key, latest captured
  event/user reference comparisons, unmount cleanup and in-flight guard protect
  stale completions. Prop replacement releases busy but retains the ambiguous
  request, so an overlapping retry uses the same server idempotency key. Source
  and extracted mocks are not mounted React/concurrent renderer qualification.
- UI role set equals existing authenticated route roles OWNER/ADMIN/MANAGER/
  PROMOTER. Actual server rechecks persisted organization scope before replay or
  mutation. This adds no global OWNER override or audit CRUD/public audit display.
  UI visibility alone is not authorization proof; mounted tenant acceptance remains.
- NEW checkout eligibility honors pause in both PUBLISHED and ON_SALE; resume
  cannot bypass existing lifecycle/deleted/start/window/ticket/stock constraints.
  Cached pause advisory is limited to no existing order, no current error, and
  otherwise applicable ticket eligibility. Backend lifecycle/window rejection
  precedes SALES_PAUSED. Exact existing `errors.code` is recognized, not a guessed
  top-level code. Other errors and existing-order messaging remain intact.
- Existing PENDING creation-intent continuation bypasses NEW eligibility only as
  before; paid confirmation, wallet, receipt, scanner and recovery code are not
  changed by the reviewed diff. Pause neither extends expiry nor resurrects a
  cancelled order. No public reason/actor/history is added. These are source
  preservation observations, not payment/access/runtime guarantees.

No blocking architectural or contract defect found in this bounded scope.

## Actual checks

Scripts/imports inspected before execution: pure helper modules have no imports;
all harness execution uses node fs/assert, data URLs of pure local modules and
extracted bodies with inert ports, not application/React/axios imports. Package,
Vite config and test setup inspected; no app/build/test-runner runtime launched.

- `node docs/team/evidence/task-490/inert-checks.mjs` — exit0, author helper suite.
- `node docs/team/evidence/task-490/repair-checks.mjs` — exit0, author extracted
  submit/discard lifecycle suite. Author tests are not counted as independent.
- `node docs/team/evidence/task-492/contract-checks.mjs` — exit0, four independent
  groups: actual pure API normalizer with explicit resume historical replay/current
  state and identical request retry, malformed acknowledgement prevents GET;
  extracted checkout catch strict nested envelope and existing-order/other error
  precedence; both lifecycle pause plus cancellation/deletion/expiry/start bounds
  and existing PENDING source separation; static server-role/scope/precedence and
  parent/stale-result wiring. Static assertions are explicitly not behavior proof.
- `git diff --check 434bb2fda62ab0d9645896e2020e8a96202ee612 6ab827bff6fdf67283b93f16612106f2217d4dc0`
  — exit0, exact reviewed candidate whitespace.
- `git diff --check` — exit0 before evidence commit.
- Shared checkout status/worktree list inspected before isolation. Initial source
  search guessed nonexistent services/routes paths; corrected to actual
  `tixmoapi2/src/api/{events,orders}`. No product edits resulted.

## Limits and handoff

APPROVE only scoped source/inert preparation, not release readiness. Compilation,
actual React effects/StrictMode/render/unmount/session races, browser/design guard,
accessibility, mounted route/auth/tenant, generated-client/schema compatibility,
real DB locks/concurrency/rollback and pending/paid/wallet/scanner/recovery runtime
regressions remain UNVERIFIED and require separately authorized acceptance.
No app/browser runtime, services, DB, generation/migrations, network, installs,
env/secrets, config/scheduler, cloud/provider/production, spend, push/merge/deploy.
No findings require author repair at this target. #490 remains REVIEW for PM
closure decision; #248/#243/full launch remain OPEN. Branch preparation only,
not integrated or deployed. This report does not approve any later changed SHA.
