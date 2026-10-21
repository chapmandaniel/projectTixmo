# Task 415 independent lead review

Reviewed EXACT implementation `b46fd6490bcb4def2023ee883290c568c74fd134`,
parent `0b7279a55481f138dce4ed2b21576f28d98bea31` (accepted 406).
Isolated branch `tixmo/task-415-independent-review`, worktree `task-415`.
Reviewer tixmo-lead; no implementation edits.

## Verdict

**PASS scoped architecture/security source review and offline lease/config tests.**
No blocking source finding in the complete ten-file diff against accepted 406.
This is NOT complete implementation acceptance: actual-app route suite remains
NOT RUN, independent QA416 is required, and task413 must remain review.
No production identity, signature/provider, measured capacity or launch approval.

## Source findings and authored-test review

- `app.ts` removes only global admission/import. `orders/routes.ts:12,61`
  retains router authentication and validates before admission; payments
  `routes.ts:50-55` retains authenticate then validate before admission.
  Repository source search finds only these two admission mounts. No prefix
  bypass list or whole-router admission; trailing slash/query routing retained.
- All ten scanner method/paths remain outside admission: POST register/auth/
  validate/scan, GET root/sync/logs/:id, PUT/:id, DELETE/:id. Existing scanner
  device authentication and user auth/role middleware remain unchanged; PUT
  retains validate(updateScannerSchema). Auth, tickets validate/check-in,
  organizer/admin/order recovery/refund/receipt, health/readiness/docs and
  unmatched routes are structurally exempt without weakening their fences.
- Raw Stripe webhook parser/JSON-skip and webhook controller route unchanged;
  removal of global admission removes its lease contention. No inventory,
  financial service, schema or controller change. Existing v1 raw-parser
  specificity is unchanged, not newly certified for arbitrary API versions.
- Strict decimal positive safe-integer cap parser rejects explicit invalid
  values, absent retains compatibility5000 only. Redis key/scripts, 120s lease,
  30s renewal, 2x TTL, listeners-before-acquire, terminal/release-once and
  uncertain-acquisition fail-open logic unchanged. Config argument only changes.
- Rejection marker exact WAITING_ROOM_ACTIVE; one sampled integer5..7 is reused
  for Retry-After and JSON retryAfter, with Cache-Control no-store.
- Read complete task413 handoff and all three authored test bodies. Route suite
  uses actual app/index/selected routers, mock controller/auth/validation/service
  boundaries and real authorize, and parameterizes all ten scanner paths,
  role denials, PUT validation, both target fences/variants, non-target and raw
  webhook body. It is static-reviewed only: supertest starts loopback HTTP,
  forbidden in this task. No claim these assertions currently pass or prove
  real identity/schema/provider behavior. Other routers are mocked empty.

## Actual verification and dependency provenance

Read default Jest config/setup: setup invokes bootstrapTestDatabase. Did NOT run
that lane. Inspected explicit jest.waiting-room.config.cjs (empty setup arrays)
and imports: lease tests mock Redis/logger/environment; config tests import only
environment and dotenv with NODE_ENV=test, so dotenv.config is skipped. Neither
selected suite imports bootstrap, app, services or a connecting client.

Task177 manifest/lock hashes differ: rejected as provenance source. Task390
node_modules resolves to task354; read task390 evidence README provenance.
Both task354 and task390 manifests/locks byte-match candidate:
package.json SHA256 `1279d580b6f1db936b116a830850f83bf67b03ef31f7cd504a79821d2a5aa6d9`;
package-lock SHA256 `f530d7671524de570d43a6cf7e105cc8161f4c1be6b71a7ffc89025ee8a139da`.
Compared installed hidden lock versions with source lock for Jest30.5.2,
ts-jest29.4.11, TypeScript5.9.3, dotenv16.6.1, http-status-codes2.3.0: matching.
Added only local untracked task415 node_modules symlink to existing task354 tree;
no install/generation or dependency changes.

Actual command from task415 root:

```
NODE_ENV=test node tixmoapi2/node_modules/jest/bin/jest.js --config tixmoapi2/jest.waiting-room.config.cjs --runInBand --no-cache --runTestsByPath tixmoapi2/tests/unit/waiting-room.test.ts tixmoapi2/tests/unit/waiting-room-config.test.ts
```

Exit0, **2 suites /29 tests PASS**, 4.866s. Explicit paths excluded route suite.
Lease lifecycle, fail-open, configured argument, jitter/header/body agreement,
fake-clock renewal/terminal cleanup and cap-parser cases passed with mocks.
`git diff HEAD^ HEAD --check`: exit0 for implementation diff.
Read git status/worktree list and exact SHA/parent before isolated checkout.
Evidence staged/final diff checks recorded with commit handoff.

Build/typecheck, route HTTP suite, full API, disposable Redis/Lua execution and
load/capacity checks: NOT RUN. No network/server/DB/Redis/provider/install,
persistent config/scheduler/spend/push/merge/deploy. Existing dependencies reused
only for the inspected offline suites. Future route execution needs explicit
localHTTP authorization and independent QA; full API needs separately coordinated
disposable environment. Frontend414 remains gated, must not ship marker-only
consumer first and must qualify actual-checkout feedback/state/auth/no-write-replay.
