# Task351 source-only reviewed-repair composition

2026-10-21; tixmo-lead. **REVIEW / runtime UNVERIFIED**, not done. New isolated `/home/daniel/projects/projectTixmo/worktrees/task-351`, branch `tixmo/task-351-composed-api`, base exact `4a89e7c93c854a381a661d9e485e1dd47f3a4259`. Code-composition tip `4ffa438` (full SHA in provenance.json); final evidence commit follows in board handoff.

## Provenance and commands

Read role/workflow and351; claimed exact task before work. Inspected parent chains and accepted deltas before serial cherry-pick.321/322 are direct children of4ec8594;323 full SHA is `232532dcbb143323d42d508a17bfc7ba8965bd23`, child of accepted cancellation baselinef8bac3e.333/334 reviewed final tips are evidence-only commits: picking those tips alone would omit approved source. Therefore included only their complete exclusive reviewed ranges, not unrelated ancestors:

-321 `f28a4cc986c917135764d7a73ee4d0f4b424339d`.
-322 `1b1a7abea4341510db031063c1a61c8ce75e167f`.
-323 `232532dcbb143323d42d508a17bfc7ba8965bd23`.
-333 `61feda408cd721da6d60cc240400f99605855fba`, `4e98efb2d5b7255e72aabe8784b6cea036e420ae`, `b0bc7e833345d847efa84d2a4957e289a1494bfc`.
-334 `476faca3fd43a6926a289eb51c2254ea1e9cd98b`, `ded97d5c945ab286aa5d53ba5521eb61201f0156`, `6fafb9f9da99d81584341034d3683daa5876b3ac`.

Actual command: `git -c user.name='Tixmo Lead' -c user.email='tixmo-lead@local.invalid' -c core.hooksPath=/dev/null cherry-pick` followed by the nine full SHAs above in order; exit0, **no conflicts or manual resolutions**. Command-scoped hook bypass addresses known missing Husky bootstrap; no config changes or hook-gate pass claimed. provenance.json maps all resulting commits and original accepted tips/bases and records every accepted changed file's Git blob.

## Static verification and delta

Python/subprocess verification PASS: all **102** accepted changed files, including tests/evidence, equal their exact accepted-tip blobs after composition. No assertion rewrite/deletion or baseline adjustment by integrator. All other pre-existing API tracked files equal base. API delta is exactly **1 source file +15 test files**, individually enumerated in provenance.json. Source change solely333 UTC-bound normalization in paid-sales-query.ts. Schema, migrations, dependency manifests/lock remain unchanged. Existing base refund tests/fences, cancellation source, manual/fairness tests and all other API files preserved exactly. No active backend325 continuation or341 extras incorporated.

`git diff --check 4a89e7c HEAD -- tixmoapi2`: exit0. Whole-range counterpart: exit2 on preserved historical raw evidence whitespace, exact diagnostics retained in provenance.json; not represented as PASS and raw logs not rewritten. No fresh tests/build/typecheck/runtime executed; historical accepted focused results are not a combined-candidate pass. No services, DB, dependencies, provider, credentials, cloud, spend, config, scheduler, push, default integration, merge or deploy touched.231 external/default integration owner remains unchanged. Shared main untracked instruction files preserved.

## Independent exact-final-SHA gate recipe (NOT executed/authorized here)

PM must allocate an independent reviewer and sole disposable-local DB slot after current backend325 cleanup is accepted; source-only351 does not hold that slot. Reviewer creates a separate checkout at final351 evidence SHA, verifies this manifest and unchanged accepted blobs, and prepares independently writable matching offline dependencies/generated client (no shared writes or implicit downloads). Inspect existing owned-runtime helpers, verification-safety.cjs and scripts/verify-api.mjs first. Use fresh owned0700 disk runtime with exact process/listener ownership checks, scrubbed env-i before imports, synthetic values only, loopback disposable DB plus explicit Redis DB1, preimport nonloopback guard with blocked attempts fatal, and bounded identity-checked cleanup.

After validating explicit disposable DATABASE_URL/REDIS_URL and TIXMO_ALLOW_DESTRUCTIVE_TESTS=1 under that grant, run root `npm run verify:api`. Inspected verifier runs API build, migration rehearsal, Prisma db push --accept-data-loss --skip-generate, then entire API Jest suite --runInBand. These mutate DB and must never run against unknown/inherited targets. Capture final exact SHA, command/exit/timings, fresh test JSON and complete diagnostics via guarded task-local instrumentation; verifier suppresses raw child failure output, so arrange permitted diagnostic collection without replacing or weakening gate steps. Establish total/pass/fail/skip and zero blocked-network attempts; certify exact owned service/worker/port/socket cleanup before releasing DB. Any failure remains a failure, then return concrete findings to original authors. No composition green is claimed now.

351 stays REVIEW for independent new-combined-SHA QA/fullAPI gate; broader325 remains PARTIAL (shared-stock/broader rollback/routes/actor/manual-fairness/fullAPI). Later affected backend changes require fresh exact-SHA review before integration. No releaseGO or default-branch action follows from this source-only composition.
