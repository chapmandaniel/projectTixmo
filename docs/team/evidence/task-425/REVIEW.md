# Task 425 independent release-evidence review

Reviewer: tixmo-qa, 2026-10-21. New isolated worktree `task-425`, branch `tixmo/task-425-independent-qa`, base/tested product `8aae387bcd4290edd259fd75aa11baaa1f62ca63`.

## Scope and method

Read exact task 424/425 assignments, role/team workflow, actual market/API scripts, guarded release runner and raw receipts. No product/test edits, network/install, service/database grants, or broad test reruns. QA independently hashed the 602 source-manifest entries against this clean exact-candidate checkout: zero mismatches. API package.json and package-lock.json also byte-match recorded task362 dependency source. Copied Prisma/TypeScript tooling isolation receipt records independent single-link inodes; existing dependencies are not a fresh install or fresh dependency advisory result.

## Corroborated results

- Actual `npm run verify:market` invokes `scripts/verify-market-local.mjs` with 12 sequential stages. First API `npm audit` exited 1; guard records blocked HTTPS registry.npmjs.org. 0 stages passed, 1 failed, 11 not reached. No offline/cached audit equivalence or advisory PASS. The eight-stage readiness document is stale relative to source.
- Supplementary `verifyApi` DI runner uses unchanged verifier and adds only Jest JSON capture; all four actual commands/statuses were read from committed commands.jsonl. API build/migrate/schema-bootstrap are supplementary, not completed market stages.
- Supplementary dashboard raw log reports 34 files / 250 tests passed, no pending/failing tests. Vitest JSON reports 75 nested suite objects (not 75 test files). Design guard passes against 924 existing baseline violations, not zero-debt; production build exit 0.
- Separate root real-Redis waiting-room script is outside Jest and the 12 market stages. Its separate receipt is reviewed below.
- Runtime is synthetic/disposable local PostgreSQL18.6 and Redis8.0.5 binaries, not production parity or capacity/provider/browser/scanner/launch acceptance.

## Final exact-evidence review

Reviewed immutable evidence commit `689dad8f79f21a417075ac4800d6d108e1e1e9bb`, direct docs-only successor of the tested product SHA. Independently compared all 37 changed evidence files byte-for-byte to their committed Git objects: zero differences; all changes are under task424 evidence. No product changes.

Full supplementary API FAIL: build/migrate/schema exit0; Jest exit1, 231.896s; 110 suites (99 passed, 1 failed, 10 skipped), 830 tests (803 passed, 1 failed, 26 skipped). The failed HTTP-pressure test requires TASK379_ARTIFACT_DIR unconditionally at line24, before fixture/listener setup. Source additionally requires current invocation identity and specialized native-listener registration. This is an unmet safe-runtime integration precondition, not observed product-load failure and not permission to weaken/skip the test. No pressure or API acceptance is inferred. JSON/raw-log counts agree. Existing skipped assertions span ten payment concurrency/successor sensitivity suites; skipped tests are not passing proof.

Separate real Redis/Lua receipt: exit0, 1 pass/0 fail/0 skip; inspected exact two-client/20-contender admissions/idempotence/expiry/replacement/duplicate-release assertions. This is not HTTP abort/no-drift or capacity acceptance. Missing database/JWT warning is consistent with scrubbed Redis-only command.

Dependency verification independently confirms API package/lock bytes match task362; dashboard package/lock match task251; Prisma/TypeScript/generated-client files have independent inodes and nlink1; generated client schema equals candidate after whitespace normalization. These checks establish recorded reuse provenance, not a fresh install or advisory audit.

After release cleanup marker, QA independently inspected /proc, ss, runtime filesystem and links. Both owned PIDs3394179/3394192 absent; ports30896/50913 have no listeners; no remaining sockets/postmaster.pid/owned Node/Postgres/Redis workers; no API/dashboard dependency symlinks; runtime remains0700. See independent-cleanup.json. No service was touched by QA.

Verdict: APPROVE evidence accuracy and cleanup for the exact evidence SHA above. REJECT full market/API acceptance: both commands failed. Task424 remains OPEN; PM retains closure. This approval does not cover staging parity (target PG14/Redis7), real HTTP abort-load, provider/browser/scanner/production/launch readiness. No merge/deploy authorization.

