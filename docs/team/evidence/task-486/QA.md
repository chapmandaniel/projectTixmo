# Independent QA #486 - dedicated sales-pause contract

## Verdict and identity

SCOPED SOURCE/DOCS PASS; no blocking factual flaw for #485's documentation-only
handoff. This does not approve an implementation, migration, operational pause,
runtime authorization, payments, tenancy qualification or launch.

- Reviewer: tixmo-qa; 2026-10-21.
- Reviewed exact SHA: `1b52f0a353ee1fd5330f26830f7464f84501fa2e`.
- Baseline: `8aae387bcd4290edd259fd75aa11baaa1f62ca63`.
- Independent branch: `tixmo/task-486-sales-pause-qa`.
- New worktree: `/home/daniel/projects/projectTixmo/worktrees/task-486`.
- Candidate delta: solely `docs/W11_SALES_PAUSE_IMPLEMENTATION_CONTRACT.md`,
  189 added lines. No executable source changed.
- Accepted input inspected immutably: #481 handoff at
  `56fbad5630df09fc3be304d480b38263f9c7130a`, not assumed merged.

## Actual board authority, separately from historical document

Read actual #486/#485/#248/#481 and own list/inbox; claimed #486 only.
#248 contains APPROVED `BB248-20261021-SALES-PAUSE-V1` AND later
APPROVED CLARIFICATION `BB248-20261021-PAUSE-AUDIT-MODEL`.
The candidate's audit HOLD is an accurate at-authoring checkpoint; no historical
rewrite is required merely because the board subsequently resolved it.
The clarification now permits separately assigned source preparation of a narrow
Prisma event-sales-control audit model. It does not expand #485 beyond docs.

Carry BOTH decisions into any implementation assignment: audit insert failure
must roll back flag mutation; actor/tenant/time are server-derived; no public
audit exposure or broad CRUD/edit/delete APIs; explicit reviewed event/actor/
tenant retention and cascade semantics; application append-only is NOT a
DB-level tamper-proof guarantee. Preserve operational-text reason boundaries.
The document already specifies atomic evidence, snapshots, replay conflicts,
no-op before=after outcomes and public non-exposure. Explicit retention/cascade
DDL and negative CRUD/exposure checks are mandatory follow-on acceptance, not
an assertion that this Markdown supplied or tested them.

## Independently traced source

- app.ts / api/index.ts mount configured version and events/public before
  authenticated events. events/routes.ts requires auth and existing scoped
  OWNER/ADMIN/MANAGER/PROMOTER roles; controller resolves ActorScope and event
  access. tenantScope.ts global override requires ADMIN + isPlatformAdmin + no
  organization; OWNER is not global. Locked-event tenant revalidation remains
  proposed work: existing assertEventAccess itself uses the global client.
- Search all tixmoapi2/src for order create/createMany/upsert and createOrder
  finds one creation write: orders/service.ts:195, called by orders/controller.ts
  via authenticated validated waiting-room POST. No alternate box-office/public
  write found in that source scope. CheckoutPage.jsx:439 shares it for free/paid/
  discounted selection and bypasses creation only for existing PENDING orders.
- orders/service.ts:87 locks event before rereading PUBLISHED/ON_SALE eligibility,
  event windows/start/deletion and subsequent stable type/promo locks and writes.
  Proposed flag check here and same-row control transaction give the correct
  committed serialization boundary, not request-arrival cutoff.
- events/service.ts:249/307 stale same-status generic update is real;
  transitionEventStatus:494 and standalone publishEvent:518 lack explicit shared
  transaction/lock. Configuration service:14 already locks and composes tx through
  update/publish. cancel/delete/restore lock; clone explicitly creates DRAFT.
  Contract correctly requires lifecycle race repair and no stale full overwrite,
  no status/stock restoration by resume, and clone default unpaused.
- schema.prisma has no salesPaused or generic audit model. Inventory reconciliation
  is narrow scalar actor/before/after evidence without an actor relation; reuse as
  a pattern is sound, not reuse as an unrelated inventory record.
- Existing-order confirm at orders/service.ts:335, payment create-intent:49,
  payment webhook/recovery and late-payment exclusion remain distinct from NEW
  admission. Existing PAID return, PENDING expiry/cancellation rules and manual
  late-paid no-auto-refund policy must remain unchanged.
- ticket/order mounted mine/QR/receipt paths and ticket-admission.service.ts,
  scanners/service.ts retain existing ownership/role/status/refund/event rules.
  This is preservation guidance, not independent certification that every
  preexisting ticket authorization predicate is sufficient.
- Actual EventCommandCenter.jsx, lib/api.js and CheckoutPage.jsx exist; checkout
  has PENDING resume/payment and wallet paths that a pause must not blanket-hide.
  All cited existing future-extension test paths exist. No tests were executed.

## Nonblocking precision and implementation carry-forward

1. Public list/detail in events/service.ts:699 onward use include/full scalar
   Event results (detail spreads event), not existing explicit top-level scalar
   projections as the contract's wording suggests. Adding a Boolean would already
   appear in those raw results. Audit relation must never be included publicly;
   test real serialized output. This does not invalidate the proposed field/API.
2. Existing ApiError/errorHandler has no top-level code property: envelope is
   success/message/errors. Pin SALES_PAUSED's exact location (e.g. errors.code)
   with frontend/API tests before implementation handoff; do not assume adding an
   arbitrary ApiError.code will reach the client.
3. Add retention/cascade and audit-no-CRUD assertions from the newer clarification
   to the implementation acceptance record. Define safe event/actor deletion and
   tenant snapshot handling explicitly rather than infer inventory conventions.

The proposed acceptance matrix meaningfully covers PUBLISHED/ON_SALE and all
creation variants, scoped roles/global ADMIN, denies/malformed/replays/conflicts,
audit/commit failures, deterministic competing lock orders and stale lifecycle
writers, existing-order/payment/recovery/QR/scanner regressions, and resume's
conjunctive eligibility. Source/mock assertions cannot prove these races or
real mounted-route authorization; later separately authorized synthetic runtime
acceptance is mandatory. Named incident/on-call/resume approvals and target
alert delivery remain unqualified.

## Actual checks and boundaries

- git status --short and git worktree list before independent checkout: main's
  existing untracked AGENTS.md and docs/team/ preserved; no shared-main edit.
- git diff --stat / --name-only baseline candidate: only the 189-line Markdown.
- git diff --check baseline candidate: exit 0.
- rg and sed/cat source reads above; git show accepted #481 artifact: inspected.
- No tests/builds/application execution, DB/schema generation/migration, services,
  network/provider calls, environment/secret reads, dependency installs, persistent
  config/scheduler edits, spend, push, merge or deployment.

#486 review complete; #485 closure belongs to PM. Full #248/#243/launch OPEN.
