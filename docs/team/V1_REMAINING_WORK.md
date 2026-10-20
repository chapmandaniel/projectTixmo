# V1 remaining work: executable handoffs

Task #59; tixmo-lead; inspected 2026-10-19. Exact base:
`c35a6f84512b274b2ae9563fda57169770f08c18`, branch
`tixmo/task-59-remaining-v1`, worktree `worktrees/task-59`.
This is a static reconciliation, not a security/payment/runtime or launch pass.
Only this report is owned. PM creates follow-up tasks; none created here.

## Revalidation and deduplication

Compared current main `2f3a055` with candidate base using `git diff --name-only`:
order/payment services/controllers, tenantScope, expiry job and environment config
are unchanged. Read reviewed reports #21/#24/#25/#23 in their task worktrees;
rechecked source below on candidate. Listed all tixmo board tasks including done.
Done audit tasks mean reviewed reports, not implemented remediation.

| Existing work | Disposition; do not duplicate |
| --- | --- |
| #34 and #39/#40 | Disposable-target/redaction guards implemented/reviewed; old #25 verifier finding is not a new unfixed source finding. |
| #35/#41/#43 | Scanner pagination implemented/reviewed. |
| #42/#44/#45; #46/#47/#48 | CI disposable contract and dashboard Docker runtime addressed respectively. |
| #49–#56 | Candidate assembly, frontend clock/regressions and isolated API build evidence; not API runtime/lifecycle verification. |
| #57 | Existing human runtime-access blocker owns disposable Postgres/Redis prerequisite. Do not create another engine/access question or bypass socket permissions. |
| #61 | Queued release-evidence handoff owns nine gate gaps reported by PM; reuse for target/manual evidence rather than new release inventory. |
| #60 | Active narrow signature-catch hardening (Error/string/null/undefined, raw argument preservation); reuse, not a second cleanup implementation. |
| REPO_CLEANUP_FOLLOWUPS.md | Config-import logging regression remains a separate coverage-only candidate; speculative QuantMo/AI and conditional public caching are not V1 execution tasks. |

## H1 — P1 scoped order authorization (backend; lead + QA review)

**Concrete omission, not exercised exploit:** `tixmoapi2/src/api/orders/controller.ts:8,64,77,90,98,108`
removes buyer scope for OWNER/ADMIN/MANAGER on get/list/cancel and sends only ID
to confirm/refund. `orders/service.ts:257,320,449,520,580` has no actor-org
predicate. `orders/routes.ts:114,174` role gates do not add tenant checks.
Compare `utils/tenantScope.ts:13,16,77,87` (all API-relative paths here and below).

Bounded acceptance:

- Tests cover two organizations: scoped OWNER/ADMIN/MANAGER cannot read/list,
  confirm/cancel/refund foreign orders; same-org permitted actions still work;
  eventId/query overrides cannot escape scope. Unauthorized mutations preserve
  order/tickets/inventory and emit no confirmation email.
- CUSTOMER can read/list/cancel own orders only; customer cannot confirm/refund.
  PROMOTER confirm remains tenant-bound without silently broadening get/cancel.
- Derive organization from order event server-side; reload actor using existing
  scope helper. Keep webhook/free-order/expiry internal service paths distinct
  from caller authorization; do not fabricate operator identity for jobs.
- **Policy gate:** matrix says global OWNER/ADMIN, helper recognizes only global
  ADMIN; matrix groups promoter cancel with confirm while controller treats
  promoter as buyer for cancel. PM obtains explicit role contract before
  changing those disputed rights. Do not solve by expanding global privileges.
  Scoped-negative characterization and ordinary tenant fencing can proceed
  independently; policy-dependent positives remain blocked, not guessed.

Focused route/security tests require #57 for actual DB execution; mock-only scope
unit tests can proceed without service startup. No custom RBAC project needed.

## H2 — P1 retry-safe intent preparation (backend; lead + QA review)

**Concrete missing retry control; duplicate charges unproven:**
`payments/service.ts:40,46,54,71` checks pending, always calls Stripe create with
no idempotency options, then overwrites persisted intent. Matching-intent check
at `:224` already exists and must remain. Owner-filtered get and server amount
calculation also already exist.

Acceptance: specify a stable order/amount/currency intent identity; mocked Stripe
regressions for sequential/concurrent prepare, lost response, DB write failure
and retry must converge on one usable persisted intent and preserve buyer
ownership. Inconsistent/terminal intent or changed amount/currency must have an
explicit safe failure/recovery path, never silently replace an already payable
intent. Test mismatch webhook behavior. Do not equate one DB value with only one
external intent. No live Stripe calls. Serial ownership with H3/H4 on payments
service; shared DB invariants get disposable-DB verification after #57.

## H3 — P1 durable fulfillment failure (backend; lead + QA review)

**Concrete control-flow omission:** `payments/service.ts:243–265` catches retry
exhaustion and returns if admin alert succeeds; `handleWebhook:122` then marks
PROCESSED. Existing retry test at `tests/integration/payments_retry.test.ts:68`
invokes private success handling, not final webhook state/HTTP contract.

Acceptance: drive public webhook service/controller path with confirmation
exhaustion, alert success and alert failure. A paid-unfulfilled order must retain
explicit durable retry/reconciliation evidence; never successful-final state
solely because an alert sent. Define HTTP retry contract and verify stored
FAILED/recoverable state, later successful recovery and no duplicate fulfillment.
Preserve event-ID dedupe and mismatch checks. Separate email failure after
successful confirm from inventory failure: retry/reconciliation must not sell
inventory again. Document operator recovery visibility and bounded retry policy;
notification is not recovery. Mocked flow tests can begin now; persistence/HTTP
integration evidence awaits #57. Coordinate H2/H4; no actual refund/payment call.

## H4 — P1 lifecycle race/recovery proof (backend; lead + QA review)

**Concrete nonconditional transitions; incorrect runtime outcomes unproven:**
`orders/service.ts:320,338,364,449,475,507,580,591,623` reads status before a
transaction and updates by ID. Aggregate held guards exist (`:348,485`) but are
not per-order compare-and-transition. Refund counter changes are not guarded
by one successful order transition. `payments/service.ts:142–152` FAILED reclaim
is read/write, and PROCESSING is skipped without stale recovery (`:155`), despite
stored processing timestamps. Event primary-key dedupe already exists.

Acceptance: deterministic barriers/two callers on disposable DB for confirm x2,
cancel x2, confirm vs cancel/expiry, bookkeeping refund x2, distinct success event
IDs for one intent, simultaneous FAILED redelivery and crashed PROCESSING worker.
Assert at most one lifecycle inventory effect, nonnegative counters and
available+held+sold conservation (include another pending order of same ticket
type so aggregate guards cannot mask double consumption). Confirm ticket validity
matches winning order state; retry losers have defined responses. Stale-event
recovery needs bounded ownership/lease semantics, not unconditional takeover.

Expiry source creates 15-minute holds (`orders/service.ts:192`) but job comment
says 30 (`jobs/order-expiry.job.ts:10`); actual selection uses expiresAt (`:16`),
then cancel (`:33`); confirm has no expiry check. PM must approve paid-after-expiry
recovery contract before changing eligibility or automatic actions. Establish
one explicit winner/reconciliation outcome without promising a financial refund.
`docs/BETA_SUPPORT_ADMIN_PLAYBOOK.md` treats refund as platform bookkeeping;
actual Stripe money movement is outside this task and requires separate authority.

Split small reproduction and conditional-transition fixes if needed; do not
bundle new payment infrastructure. #57 blocks race execution, not source/test
preparation. Serial changes with H1/H3 to avoid competing order-service edits.

## Remaining bounded coverage and UI evidence

- **Config logging (P2, coverage omission only):**
  `src/config/environment.ts` currently has no console.log; it warns about missing
  variable names at `:152`. `tests/unit/environment.config.test.ts` covers Stripe
  credential normalization, not no-sensitive-log import behavior. Extend that
  unit suite with isolated modules, synthetic sentinel credentials and a console.log
  spy before import; assert no sentinel output, restore env/spies afterward and
  retain normalization assertions. No real env/credential reads; no product config
  change unless a regression actually reproduces. Fully mocked isolated Jest
  config may omit DB setup for this file only; not integration evidence.
- **Raw signature boundary:** #60 covers safe thrown values and Buffer forwarding,
  not actual Stripe signature correctness. Later focused integration acceptance:
  missing/malformed signature, altered raw bytes rejected with no side effects,
  valid locally generated test signature reaches dispatch. No live webhook.
- **Order input cap:** `orders/validation.ts:3` permits duplicate ticket-type lines;
  `orders/service.ts:106` applies maxPerOrder per line. Add aggregate-per-type limit
  regression and reject/normalize duplicates consistently before holds. Preserve
  conditional inventory reservation. Separate small backend handoff, not a new
  inventory framework; runtime proof awaits #57.
- **Frontend #24 F2:** scanner/log fetch catch only logs (`tdash/src/features/ScannersView.jsx:107,124`
  rechecked at candidate); pagination fix did not add local error
  state. Bounded component tests: failed initial/page/tab fetch, distinct empty
  vs failure, retry same query and recover without stale-success presentation.
- **Frontend #24 F3:** `tdash/src/pages/CheckoutPage.jsx:612` passes orderId in return
  URL; query-driven status recovery is absent. First prove redirect-return need
  under approved test-mode setup; define owner-authorized read-only status and
  pending/failed/paid recovery without duplicate order or client confirm. H1/H2
  contract dependency; this is a source omission, not failed backend fulfillment.
- **Release evidence:** real-origin checkout/share/review, scanner field/offline,
  policy/currency signoff, restore/rollback, monitoring and CI run artifacts remain
  unverified per #23/#24 and launch checklist. Reuse launch runbooks and PM-owned
  evidence tracking in #61; no provisioning, external smoke, deployment or spend implied.

## Verification and limitations

Read required role/repo/team instructions and kanban skill; claimed exact #59.
Inspected main status/worktrees before isolation; main untracked AGENTS.md and
team onboarding untouched. Source inspected with cat/rg/nl; board list included
done tasks, #57 and active #60. No dependencies/tests/services/DB/secrets,
configuration changes, financial actions or external writes performed.
`git diff --check` required before commit; exact result recorded in board handoff.
Documentation only; independent exact-commit review required. Candidate is not
merged to main and this report neither certifies readiness nor approves launch.
