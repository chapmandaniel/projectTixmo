# Task 320: bounded source-only API triage

## Provenance and restrictions

- Product base: `4ec8594850eb547dafc145a14bb1b85cdeaa235c`.
- Task318 evidence: `aa64c2c59bba570ec39958d06e004cfbc7b2ad59`, read from `../task-318/docs/team/evidence/task-318/` relative to the worktree parent.
- Branch: `tixmo/task-320-api-triage`; worktree `/home/daniel/projects/projectTixmo/worktrees/task-320`.
- Evidence-only change. No product/test edits, tests, DB/services, network, AWS API/credential access, spending, deploy or merge. Installed kanban and aws-storage skill/reference read.
- Existing task318 result remains failed: 15 suites / 40 tests. This report diagnoses only the assigned two public-event tests, smoke analytics assertion, and unattributed blocked storage attempt.

## 1. Public event tests: confirmed fixture/expectation drift

Task318 summary reports benchmark TypeError reading `map` at `src/api/events/service.ts:781`, and public unit TypeError reading `tiers` at line784.

The real Prisma query includes `ticketTypes` plus `_count.tiers` and active `tiers` (`service.ts:765-773`). DTO projection maps those rows, strips `_count`, and exposes `hasConfiguredTiers` (`779-785`). This is intentional schedule-presence privacy behavior, not evidence of a production missing-relation defect.

- `tests/benchmark/event_cache.benchmark.test.ts:43-50`: `MOCK_EVENT` omits `ticketTypes`; returned at59; first call72 fails before timing comparison. Narrow repair: provide realistic `ticketTypes: []` or a complete row including `_count: {tiers: 0}`, `tiers: []`. Keep the two fresh database reads; additionally assert two `findFirst` calls and no cache get/set, rather than relying only on timing/logs. Do not introduce caching or production defaults to hide malformed mocks.
- `tests/unit/api/events-public.service.test.ts:24-30`: ticket fixture has `tiers: []` but no `_count`. Supply `_count: {tiers: 0}`. Its line38 `expect(result).toBe(event)` is independently stale: service now returns a projected object rather than the Prisma object reference. Replace reference identity with exact DTO value equality retaining ticket ID, slug and availability, expecting `hasConfiguredTiers: false`, and assert raw `_count` is absent. Preserve the query assertion39-48; strengthen the tier include contract. Add a second successive mock database result with a changed ticket ID/availability and assert the second result reflects it, preserving the original checkout-freshness purpose. Cover configured-but-no-active-tier (`_count.tiers > 0`, `tiers: []`) without exposing inactive rows.

Recommended scope: only these two test files, no event service repair warranted by these failures. Focused test rerun remains necessary in a separately authorized local execution lane.

## 2. Smoke analytics: failure localized, root cause not established

`tests/smoke/v1-market-smoke.test.ts:229-234` loads the same order and asserts PAID and two tickets before scanner success and dashboard `sales.totalOrders >= 1` at275. The failure therefore is not simply an unpaid checkout fixture. Keep that semantic assertion.

Source chain:

- Order creation sets eventId and configured currency (`src/api/orders/service.ts:195-205`). Config defaults to cad and skips dotenv during tests (`src/config/environment.ts:1-4,70`); task318 runtime scrubs inherited environment. Smoke webhook uses cad (`tests/smoke/v1-market-smoke.test.ts:213-218`). Currency mismatch is not established and default source values agree.
- Dashboard uses a rolling 30-day order-created window ending at application `now` (`src/api/analytics/service.ts:254-261`). It defaults sales currency to cad (`78-85`).
- `src/services/paid-sales-query.ts:10-18,20-32` filters PAID, currency, order created_at, and event organization. Its ticket SOLD filter affects only ticket counts: LEFT JOIN preserves matching orders even without SOLD tickets. A scanned/USED ticket therefore cannot alone explain totalOrders0.
- `src/api/analytics/service.ts:97-121` aggregates the scoped rows and sums their counts. Source does not cache this result.

Task318 retains no order created_at/currency/event.organization_id versus dashboard period diagnostics or SQL predicate counts. No specific SQL/product/fixture repair is justified yet. Next bounded local lane should capture only the created order's nonsecret id/status/currency/createdAt/eventId/event.organizationId and dashboard period; check each scoped SQL predicate on that order in the same disposable DB, compare application and DB clocks/session timezone, and compare direct sales analytics with dashboard output. If date filtering is the cause, repair the evidenced time conversion/clock fixture, not by widening windows or dropping date/org/currency predicates. If organization/currency differ, repair the exact violated creation/query contract with regression coverage. Do not change production SQL merely to obtain green smoke.

## 3. Blocked storage attempt: candidate boundary, not attribution

`task-318/blocked-network.jsonl` contains exactly one record: PID2850838, kind https, host s3.us-east-1.amazonaws.com. `network-guard.cjs:4` records only pid/kind/host before throwing; it has no stack, time, Jest test path or command context. No suite attribution is proven, and overall Jest result does not prove there were no network attempts.

Concrete source candidate:

- `src/services/upload.service.ts:32-45` returns test-local metadata when storage is unconfigured; `resolveFileUrl:128-130` similarly has a fallback.
- `deleteFile:146-152` has no corresponding local/unconfigured test boundary and always invokes `s3Client.send(DeleteObjectCommand)`.
- `src/config/s3.ts:9-20` constructs the client using optional endpoint/region and fallback bucket. This report makes no claim about actual provider calls; the evidence guard blocked before connection.
- `src/api/approvals/service.ts:992-998` catches storage-delete failures and still returns successful deletion. `tests/integration/approvals.test.ts:566-574` exercises an approval deletion; this is a plausible swallowed-attempt path, not a proven originating suite. Asset deletion has other catch-and-log paths (`src/api/assets/service.ts:627-631,968-973`). Public mock tests do not identify an initiating storage path. Smoke upload service is mocked (`tests/smoke/v1-market-smoke.test.ts:47-64`); smoke also failed before its later asset flow.

Next local instrumentation proposal (not implemented): retain hard non-loopback denial and append a sanitized `new Error().stack`, monotonic/timestamp, command/run ID and Jest current test file/name when available. Async SDK stacks may lack originating tests: use a Jest setup-owned per-suite context plus an instrumented mocked storage boundary recording caller stack. Do not record request bodies, authorization headers, credentials, signed URLs or arbitrary environment. Run only with scrubbed credentials and local services; treat any blocked attempt as gate failure even when application catches it.

After attribution, choose a narrow repair: mock `uploadService.deleteFile` or client `send` in the responsible integration fixture; alternatively align deleteFile's explicitly unconfigured test behavior with uploadFile, covering both test-local fallback and configured mocked client delegation. Preserve real configured deletion and cleanup semantics. Never disable the guard or introduce blanket success swallowing in production.

## Checks and limitations

Executed read-only `rg`, `nl`, `cat`, `git status`, `git worktree list`, and exact commit inspection; created isolated worktree at requested base. Documentation check: `git diff --check` (recorded by handoff). No runtime tests/builds were executed; no new pass claims. Smoke root cause and storage originating suite remain unproven, with concrete next diagnostic scopes above. Independent review required; task author submits review, not done.
