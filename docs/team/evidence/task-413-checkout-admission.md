# Task 413 checkout-only admission: bounded implementation handoff

Base: exact `0b7279a55481f138dce4ed2b21576f28d98bea31` (accepted 406).
Branch: `tixmo/task-413-checkout-admission`; isolated worktree `task-413`.
Existing-solution preflight: reused Express/Redis/Jest per 406; no dependencies added.

## Changes

Removed global admission. Only POST orders and payments/create-intent acquire,
after existing authentication and validation. Existing controllers, payment,
inventory, tenant/role fences, raw-body parsing and lease scripts/lifecycle
are unchanged. Shared cap uses strict positive safe-integer configuration
`WAITING_ROOM_MAX_CONCURRENT_REQUESTS`; absent retains 5000 for compatibility.
Explicit blank/whitespace/junk/fraction/nonpositive/unsafe values throw.
Full capacity returns 503 with exact `WAITING_ROOM_ACTIVE`, integer jitter 5..7,
matching Retry-After/body and Cache-Control no-store. No fairness or capacity claim.
Launch needs a separately measured aggregate checkout budget and headroom for
scanner/webhook/recovery; no deployment or production configuration change here.

## Checks and limitations

- `git diff --check`: PASS.
- `node` loading isolated Jest configuration and checking TypeScript transform
  regex: PASS; configuration has no setup hooks and does not inherit default Jest.
- Jest/build/typecheck: **NOT RUN**. Neither task-413 nor shared main has API
  node_modules; no install, dependency copying or network was attempted.
- Default Jest config and tests/setup.ts were inspected: they call database
  bootstrap. Do NOT run the default lane without a separately coordinated grant.
- Authored setup-free mock-only lane `tixmoapi2/jest.waiting-room.config.cjs`.
  Future check after inspected existing dependencies become available:
  `NODE_ENV=test <existing-jest> --config jest.waiting-room.config.cjs --runInBand`
  from tixmoapi2. Route tests use supertest loopback and require explicit permission
  for local HTTP execution; no HTTP server was started during this task.
- Retained seven lease cases plus ready, configured argument, jitter agreement,
  fake-clock renewal and terminal timer cleanup. Config tests cover default,
  valid override and explicit invalid values.
- Actual app/API index and selected real routers are exercised in authored tests;
  controller/service/transport boundaries, identity and validation execution are
  mocked. Real authorize and pure Zod schema imports are retained. Matrix includes
  all ten scanner methods, scanner role denials/PUT validation, target fences and
  trailing slash/query variants, auth/ticket/admin/order bypass, health/readiness/
  docs/unknown and exact raw webhook body. These are authored assertions, **not
  passing runtime evidence** or proof of real identity/schema/provider behavior.
- Other non-selected routers are mocked empty, not an all-endpoint runtime claim.
- No DB/Redis/service/provider/network/install/schema/service/config/scheduler/
  spend/push/merge/deploy actions. Only task-owned product files/tests and this
  evidence document changed; isolated Jest test configuration is the permitted
  mock-only exception, not application/deployment configuration.

## Required next acceptance

Independent lead and QA must review the exact implementation SHA, then execute
and repair/qualify authored suites using inspected dependencies in an authorized
mock-only local lane. Full API/build/disposable Redis script and measured runtime
capacity remain unverified, require separate grants and matching fresh build.
Task 413 stays review, not closed. Backend contract must precede or compose
atomically with frontend 414; frontend must prove reachable actual-checkout busy
feedback, generic errors, retained state/auth and no automatic write replay.
No frontend shipment, integration, release or launch approval is implied.
