# Task 412: fresh independent corrected-contract QA

2026-10-21; reviewer `tixmo-qa`. **PASS for source/document contract only.**
Reviewed exact `0b7279a55481f138dce4ed2b21576f28d98bea31`, parent
`db1b5f30a38fe3b336fdb2bf1e51c389dfcde92d`, audited product source
`971275ba7c87b7d6d3d8831d6334922dcf618a05`. Isolated worktree `task-412`,
branch `tixmo/task-412-independent-qa`, created at the exact reviewed SHA.
Author task 406 checkout and shared main were not edited. Only task 412 claimed.

## Findings and acceptance

No remaining blocking source/document finding in this bounded review.

- QA 408 F1 is addressed. Contract scanner inventory now includes PUT and
  DELETE `/api/{version}/scanners/:id` with source ranges 387-392 and 419-423.
  Independently read `tixmoapi2/src/api/scanners/routes.ts`: both require
  authenticate and OWNER/ADMIN/MANAGER/PROMOTER authorization; PUT additionally
  validates `updateScannerSchema`. `src/api/index.ts:53,66` and `src/app.ts:147`
  establish the versioned mount. Required tests now explicitly assert zero
  admission evaluation for both methods while preserving authentication/role
  denials, PUT validation and authorized controller behavior. All ten scanner
  method/path declarations agree with the corrected inventory.
- QA 408 public-checkout advisory is addressed as a future acceptance condition.
  Independently read `tdash/src/App.jsx:281-287`: `/checkout/:slug` is outside
  the wildcard containing WaitingRoomView. Contract explicitly requires
  reachable actual-path busy feedback, marked order/create-intent 503 and
  unmarked generic 503 integration coverage, agreed delay, retained entered
  data/auth/session, no navigation away and no automatic write replay.
  It does not claim current wildcard feedback reaches checkout. Current global
  error state is also delivered only through wildcard AppContent; actual-path
  generic-error visibility must therefore be implemented and tested, as required.
- Re-read the complete corrected contract against unchanged source: global
  admission placement, raw webhook parsing, root versus versioned health,
  checkout auth/validation ordering, auth/ticket routes and non-target routing
  agree. No separate admin router is invented. Non-target routes lose only
  admission contention, not existing auth/rate-limit/signature controls.
- `waitingRoom.ts` retains Redis-time sorted-set leases, 120s expiry, 30s
  renewal, pre-acquire terminal listeners, idempotent removal and fail-open.
  Hardcoded 5000, unmarked 503 and frontend blanket-503 event/suppression are
  correctly classified as current gaps, not repaired behavior. Strict config,
  compatibility-only default, marker/header/body jitter agreement and frontend
  gating are future work. No measured safe-capacity or fairness claim exists.
- Read all seven existing lease test bodies, Redis script, environment config,
  manifests and API setup. Descriptions agree; Redis script imports built dist;
  default Jest setup calls database bootstrap. Future checks remain gated on
  coordinated disposable prerequisites rather than claimed passing now.
  Existing libraries suffice for this bounded contract; no new solution built.

## Reproducible checks and limits

Executed in this checkout before adding this evidence:

- `git rev-parse HEAD HEAD^`: exact reviewed SHA and parent above.
- `git diff --name-only 971275ba7c87b7d6d3d8831d6334922dcf618a05 HEAD`:
  only `docs/team/evidence/task-406-waitingroom-contract.md`; product source
  unchanged from the audited base.
- `git diff HEAD^ HEAD --check`: exit 0. Read exact correction diff and complete
  corrected document; compared prior independent evidence at `fe7781e8`.
- Source reads and `rg` route/dependency inventory: exit 0, not runtime tests.

This commit adds only this independent evidence. Staged and final commit diff
checks and clean status are recorded on task 412 after commit. Git hooks are
disabled command-locally solely to avoid npm execution; no persisted config.
No product edits, npm/build/Jest/Vitest execution, DB/Redis/services/network,
provider/download/install/config/scheduler/spend/merge/deploy occurred.
No implementation, browser, runtime, capacity or launch pass is inferred.
Task 412 closes only this scoped verdict; PM owns task 406 closure/integration.
