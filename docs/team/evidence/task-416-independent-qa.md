# Task 416 independent QA

## Verdict and identity

PASS for bounded checkout-admission source and mock-route acceptance on exact product
`b46fd6490bcb4def2023ee883290c568c74fd134`, parent
`0b7279a55481f138dce4ed2b21576f28d98bea31`. Independent QA, not product author.
Branch `tixmo/task-416-independent-qa`; worktree
`/home/daniel/projects/projectTixmo/worktrees/task-416`.
Lead evidence `9e34cc9f02ca9304fbc13776c466155af95fb62d` read; independent checks below.
Main preflight had untracked AGENTS.md/docs/team; untouched. Existing worktrees inspected.
Claimed only 416; never claimed or closed 413.

## Dependency and setup safety

Independently resolved task390 API node_modules to task354 API node_modules.
Candidate, task390 and task354 API manifests/locks byte-match (sha256):
- package.json: 1279d580b6f1db936b116a830850f83bf67b03ef31f7cd504a79821d2a5aa6d9
- package-lock.json: f530d7671524de570d43a6cf7e105cc8161f4c1be6b71a7ffc89025ee8a139da

Installed package versions independently matched lock: Jest30.5.2, ts-jest29.4.11,
TypeScript5.9.3, Express4.22.3, Supertest6.3.4, dotenv16.6.1,
http-status-codes2.3.0, @prisma/client5.22.0. Used task-local dependency symlink,
not installation; removed after checks. Did not modify shared dependency tree.
Read default Jest setup: it calls bootstrapTestDatabase, so never used it.
Explicit jest.waiting-room.config.cjs has empty setupFiles/setupFilesAfterEnv.
Read app/API index, selected routers/validation imports, authorization/notFound,
environment, waitingRoom and all three tests before execution.
All controllers, Redis, readiness, logger, Sentry, Swagger, client-origin,
request-logger, rate-limit transports and nonselected business routers are mocked
before app require. Validation schemas only import zod; docs router only uses
Express and mocked Swagger. Actual app/index/selected routers, authorize and
waitingRoom run. Auth/validation are synthetic fence mocks: these tests verify
placement/preservation, not real JWT or schema/security correctness.

## Reviewable task-only harness adjustment

Supertest source serverAddress uses app.listen(0), an unspecified bind.
To obey explicit loopback-only grant, changed ONLY route-test harness:
createServer(actual app), await listen(0, '127.0.0.1') in beforeAll,
request(server) in place of request(app), await server.close in afterAll and
assert server.listening false. Existing assertions were unchanged; no product
source changes. Exact product under test remains b46fd649; this evidence commit
also contains that explicit listener/cleanup harness patch for reproducibility.
No initial failing test run; this was a pre-execution safety adjustment.

## Actual commands and results

From worktree root, temporary symlink:
`ln -s /home/daniel/projects/projectTixmo/worktrees/task-354/tixmoapi2/node_modules tixmoapi2/node_modules`

```sh
env -i PATH="$PATH" NODE_ENV=test DATABASE_URL=postgresql://synthetic:synthetic@127.0.0.1:1/synthetic JWT_SECRET=synthetic JWT_REFRESH_SECRET=synthetic SESSION_SECRET=synthetic timeout 80s node tixmoapi2/node_modules/jest/bin/jest.js --config tixmoapi2/jest.waiting-room.config.cjs --runInBand --no-cache --detectOpenHandles --runTestsByPath tixmoapi2/tests/unit/waiting-room.test.ts tixmoapi2/tests/unit/waiting-room-config.test.ts tixmoapi2/tests/unit/waiting-room-routes.test.ts
```

Exit0, 3 suites/85 tests PASS, 8.874s. Route suite56 tests; lease/config29.
No failures, snapshots or open-handle warning. Owned server awaited close and
listening=false assertion passed; Jest exited naturally (no forceExit).

From tixmoapi2, inspected scripts/build.cjs: TypeScript compiler/alias transformer
only; tsconfig excludes tests and node_modules. Executed:

```sh
env -i PATH="$PATH" NODE_ENV=test timeout 60s node node_modules/typescript/bin/tsc --noEmit
env -i PATH="$PATH" NODE_ENV=test timeout 60s node scripts/build.cjs
```

Both exit0, no diagnostics. Build emitted ignored task-local dist only.
Did NOT run npm run build, since its Prisma generation would mutate shared
generated dependency files; compile-only build above is not regeneration proof.

## Acceptance evidence

- Two target POST mounts only; orders router-level authenticate and both target
  validation fences run before Redis acquire. Unauthorized/invalid targets do
  not acquire. Trailing-slash/query variants tested. Busy blocks controller.
- All ten mounted scanner method/path pairs bypass admission, preserve synthetic
  auth requirements; real authorize role checks preserved; scanner PUT retains
  validation-fence ordering and no acquire.
- Health/readiness/docs/unknown routes, auth paths, ticket validate/check-in,
  admin user/organization deletion and order non-target operations bypass.
  Protected-route auth and admin role denial retained in selected router tests.
- Webhook exact raw bytes reach mocked controller/signature boundary, no acquire.
- Strict positive safeinteger config: absent5000 compatibility only; bounds,
  malformed/fractional/zero/negative/unsafe representations tested.
- Exact WAITING_ROOM_ACTIVE503; matching Retry-After/header+body, no-store;
  jitter5/6/7 endpoints tested in middleware suite and actual HTTP contract.
- Sorted-set/key/Lua/TTL unchanged by candidate diff; configured cap reaches
  acquire; finish/close/aborted release once, pending-acquire abort, renewal and
  timer cleanup, unready/error fail-open all passed mocked lifecycle tests.

## Limits and cleanup

NOT RUN: full API/default setup, real Redis Lua/integration, DB migrations,
Prisma generation, provider/signature verification, browser/frontend, capacity,
load/fairness/sellout, production or deployment. No capacity or launch approval.
No install/download/container/config/scheduler/spend/merge/push/deploy.
One owned OS-assigned loopback listener only, closed in afterAll; Jest process
exited. Typecheck/build child processes exited0. Process inspection found no
lingering owned Jest/typecheck process (build was then active and subsequently
exited0). Dependency symlink removed after execution. No assertion weakening.

Scoped QA approval may support PM source-only integration sequencing with lead415;
413 closure and remaining full-environment gates belong to PM, not this review.
Frontend414 still requires its own implementation/actual-path integration QA.
