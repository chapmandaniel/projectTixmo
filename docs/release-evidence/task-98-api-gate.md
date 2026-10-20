# Task 98: guarded disposable API gate

2026-10-19; release owner `tixmo-release`; independent QA required.

## Candidate and isolation

Executed candidate: `0375516e058fd3a1bbc18e1db5f1f44751e96647`, on isolated
branch `tixmo/task-98-api-gate` in worktree
`/home/daniel/projects/projectTixmo/worktrees/task-98`.
It contains reviewed API93 `8a07603ce10a4768b7cffea7027846ca53c2b520`
and aggregate-limit70 `b6e6fff`; the only diff from API93 is task57 runtime
documentation (228 added lines). This commit adds evidence only.

PM authorized one sole database/services mutation owner. Existing-solution
preflight reused maintained PostgreSQL18.6/Redis8.0.5 extracted packages from
`task-57/.local-runtime-57/root`; existing task56 API dependencies/generated
Prisma client were linked locally, without installation, regeneration,
lockfile change or system configuration change. Node24.21.0/npm11.19.0.
No root/API `.env` exists in this isolated worktree. Existing generated-client
schema equals candidate schema after whitespace normalization (raw file
hashes differ only due to formatting).

## Procedure and bounded repair

Read reviewed task57 lifecycle, verifier, pure safety guard, Jest setup/config,
environment config and test mocks before execution. Ran reviewed lifecycle
with unique mode0700 temp directories and randomly chosen loopback ports.
Before TCP/database access, asserted process executable/PID identity,
unique Redis socket INFO PID and exact PID-owned loopback TCP listeners.
Services were started by the invoking user; the script's explicit process
UID assertion ran during owned-instance teardown, not before TCP/database
access. This timing distinction corrects the original evidence wording; it
does not add a startup UID check or establish a new runtime pass.
Created only `tixmo_disposable_98` as user `tixmo98`; SQL verified actual
DB/user/address/port, Redis PING succeeded, and the guard accepted explicit
URLs with `TIXMO_ALLOW_DESTRUCTIVE_TESTS=1` before schema mutation.

Initial runtime `/tmp/tixmo98.Bd9DKx`, PG20767 PID736164, Redis43018 PID736177:
command exit127 before npm/schema/Jest because sanitized PATH omitted the
existing nvm Node/npm directory. Both services shut down, cleanup status0;
no PG PID file or listeners remained. This is NOT a test run or pass.

One authorized repair added the inspected existing executable directory
`/home/daniel/.nvm/versions/node/v24.21.0/bin` to the explicit PATH. A fresh
runtime `/tmp/tixmo98.QwtwBP` used PG36045 and Redis44101.
Gate command: `npm run verify:api`, through `env -i` and GNU timeout150s
(TERM, kill-after20s); outer lifecycle bound180s with25s signal grace.
Explicit environment supplied owned URLs, test NODE_ENV, destructive opt-in,
Redis DB1, synthetic JWT/refresh/session values and synthetic Stripe values,
CI1, NO_COLOR1, disabled AWS metadata, scoped loader library path and a fresh
owned HOME. No inherited application URLs, live keys or .env were sourced.

Uncommitted external `/tmp/tixmo98-summary.cjs` preloaded an observation-only
wrapper around child_process.spawnSync and synchronized its ESM export.
It returned the original result unchanged; no arguments/output/status were
modified. It emitted only strictly allowlisted Jest numeric summaries and
suite paths plus child exit/signal, never raw child output or error bodies.
No product verifier/test changes, assertion removals or baseline changes.

## Result

Repaired invocation **exit1**, Jest child exit1 (signal null), elapsed94.912s.
Schema bootstrap succeeded; verifier reported API tests failed.

- Suites: **5 failed, 54 passed, 59 total**.
- Tests: **7 failed, 419 passed, 426 total**; snapshots0.
- Failed suites: `tests/unit/asset-library.service.test.ts`,
  `tests/integration/tickets.test.ts`, `tests/smoke/v1-market-smoke.test.ts`,
  `tests/integration/payments.test.ts`,
  `tests/integration/payments_retry.test.ts`.

Failing test titles/assertion bodies/root causes were not captured by the
strict allowlist, so are **not diagnosed** or guessed. The verifier safely
suppressed raw child output. Suite paths identify focused follow-up scope,
not attribution to reviewed changes. The single authorized repair was spent
on the PATH issue; no additional invocation or product repair was attempted.
In particular, an API gate failure is not payment or launch acceptance.

Final exact service PIDs: PostgreSQL736587 and Redis736600. EXIT trap performed
bounded exact-cluster fast stop and exact child Redis termination; both
returned stopped. Cleanup status0; final assertions confirmed absent
PostgreSQL PID file and no listeners on36045/44101. A separate post-run check
also confirmed no live owned PIDs/listeners. Temp data and allowlisted logs
are preserved locally for inspection; services are not running.

`git diff --check` passed. No product/schema/test/config/lockfile edits;
only this evidence document is committed. Independent QA should inspect the
exact evidence SHA and scope, then coordinate any new focused DB-mutating
diagnosis with PM before execution. Current full API integration gate is RED.

## Scope limitations

Global Redis client/rate-limit mocks mean this is not real Redis integration.
Synthetic Stripe/mocks provide no payment runtime or redirect acceptance.
Native PostgreSQL18.6/Redis8.0.5 differ from CI PostgreSQL14/Redis7; version
parity is unproven. This is not a market gate, task68 race run, launch approval,
production migration/deploy, default-branch merge or independent QA approval.
