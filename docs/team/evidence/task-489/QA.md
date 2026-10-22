# Independent QA 489: scoped source-only PASS

Reviewed exact `434bb2fda62ab0d9645896e2020e8a96202ee612` against
`1b52f0a353ee1fd5330f26830f7464f84501fa2e`, independently of lead488.
Branch `tixmo/task-489-independent-qa`; new isolated worktree
`/home/daniel/projects/projectTixmo/worktrees/task-489`. No implementation edits.
Read role/repository AGENTS and required team README/brief/roles/workflow;
kanban mine/inbox and full 489/487/485/248 notes, including both actual approved
BB248 SALES-PAUSE-V1 and PAUSE-AUDIT-MODEL decisions. Claimed only489.

## Findings

No blocking source defect found within this bounded review. This verdict is
NOT runtime qualification, deployment approval, full248 acceptance, or proof
of database transaction behavior. No other review verdict was used.

- Additive SQL supplies existing/new event default false and narrow evidence
  table; Prisma matches fields/indexes/restrict event relationship. Actor and
  tenant snapshots survive user/tenant deletion; timestamp defaults on server.
  RESTRICT hard event deletion, soft-delete retention, no expiry/pruning and
  future separate erasure review are explicitly documented. No tamperproof claim.
- Authenticated existing roles, server-loaded actor and locked event tenant
  authorization precede replay lookup; strict HTTP input has no actor/tenant/time
  fields. Existing global ADMIN helper is reused, OWNER is not a global bypass.
- Explicit desired-state pause/resume uses event-row lock before current read;
  audit creation and flag update share the transaction. Errors propagate; success
  waits for transaction promise. Same-key identical replay does not mutate current
  state; conflicting actor/reason/state fails; new-key no-op stores before=after.
  Historical replay response requires refetch, explicitly documented for frontend.
- Sole source order insertion remains `orders/service.ts:tx.order.create`.
  Pause guard is after existing event-row lock/current read and existing lifecycle/
  deleted/window checks, before allocations/stock/order writes, covering both
  PUBLISHED and ON_SALE. Conflict details map through ApiError/errorHandler to
  existing `errors.code=SALES_PAUSED`; no extra top-level error field invented.
- Generic update and standalone status/publish now lock before validation;
  generic update no longer writes status. Existing configuration transaction is
  passed through rather than nested. Cancel/delete/restore keep existing locks
  and narrow writes; clone explicit construction does not copy pause/audit.
- No public audit relation includes/CRUD added. Public full Event scalar reads
  naturally include salesPaused, not relation evidence. Only new-order method
  changed in orders service; pending, intent, paid ticket, scanner, receipt,
  reconciliation/recovery code remains unchanged in this diff. Source preservation
  does not prove regressions absent. UI is explicitly deferred, contract recorded.

## Reproducible actual checks (from worktree root)

1. `node docs/team/evidence/task-489/inert-probes.cjs` — exit0, eight probe
   groups PASS. Extracts exact current pause method body and order eligibility
   guard; never imports application modules. In-memory ports exercise pause,
   replay/conflict/no-op, historical replay after resume, tenant/role denials,
   audit/update/commit error propagation, and both lifecycle guards/error precedence.
2. `python3 docs/team/evidence/task-487/source_checks.py` — exit0, six
   author STATIC assertions PASS, explicitly not behavioral proof.
3. `git diff --check 1b52f0a353ee1fd5330f26830f7464f84501fa2e 434bb2fda62ab0d9645896e2020e8a96202ee612`
   — exit0. Review-document working diff check also exit0.
4. `rg -n 'order\.create|order\.createMany|salesPaused|salesControls' tixmoapi2/src`
   plus source reads — one order insertion; pause only in new-order eligibility
   and dedicated event control; no public relation reference.

No executed-check failures. Installed package scripts, Jest config/setup and
service imports inspected before probes. Build runs forbidden `prisma generate`;
Jest setup calls database bootstrap, and app imports instantiate Prisma/config.
Neither executed. Compilation/generated-client compatibility UNVERIFIED, not PASS.

## Mandatory limits and remaining qualification

Mock transaction deliberately models rollback; this only proves method error
propagation and call topology under that model, NOT PostgreSQL rollback/locks,
commit failure semantics, contention, or concurrency. Scope helper in harness is
an explicitly labeled mirror of inspected existing helper, NOT mounted auth proof.
No HTTP mounting/Zod/runtime ORM behavior, waiting-room/free/promo/full paid flow,
status/configure concurrency, tenancy/roles end-to-end, expiry/manual late-paid,
scanner/access/recovery regressions qualified. These require later separately
authorized synthetic acceptance. Author's six static assertions cannot waive it.

No application/runtime/services/DB/generation/migration execution/network/install/
environment/secrets/config/scheduler/provider/production/spend/push/merge/deploy.
Only review docs/harness committed. Main and other worktrees preserved. PM retains
implementation487 closure; full248/243/launch stay OPEN.
