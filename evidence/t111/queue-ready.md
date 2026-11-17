# T111 queue-ready

Draft only. No merge to `main`, deploy, staging/production change, branch-protection
or settings change, or admin bypass.

This file lives on the T111 dispatch PR branch
`cursor/t111-workflow-dispatch-842b`.

## (a) PR #200 refresh

| Item | Value |
| --- | --- |
| PR | https://github.com/chapmandaniel/projectTixmo/pull/200 |
| Branch | `cursor/t98-offline-door-scanning-0a66` |
| Previous head | `99cf4e6af26004ec1860a7279a98c9a47832e3ee` |
| New head | `4fd5fc98128620f8be434eaf74121f20c01c0a1b` |
| Merge | `--no-ff` of `fix/t99-wrong-event-reason-code` (`985d05c6`) into #200. Parents: `99cf4e6` + `985d05c6`. No force-push. |
| Draft | yes |
| `mergeStateStatus` | **CLEAN** |

**#202 must be merged to main first; this branch now contains #202's commits.**

### Conflict resolution

File: `tixmoapi2/tests/integration/scanner-offline-field-contract.test.ts` (add/add vs #202).

Resolved the same way as T108 scratch `cursor/t108-merge-train` head `7b8137a`
(`evidence/t108/merge-train.md`):

- Kept #200's full T98 field-contract suite (auth, snapshot, reconnect,
  unpaid/refunded/stolen/dup/unknown/garbage).
- Dropped the stale `it.skip` so T99 WRONG_EVENT tests run.
- Kept #202's live-scan 403 vs sync-assignment 403 test.
- In-suite wrong-event assertion is
  `reason: 'This ticket is for T98 Other Hall.'` with
  `reasonCode: WRONG_EVENT` (after T99, `deniedOfflineScanRow` copies
  `data.message`, not the live 403 assignment string).

### Local tixmoapi2 Jest

Command: `npm --prefix tixmoapi2 test -- --runInBand` (pretest build, then Jest).
Node `v24.21.0`. Disposable Postgres `tixmo_disposable_t111` on `127.0.0.1:5432`,
Redis `redis://127.0.0.1:6379/1`, `TIXMO_ALLOW_DESTRUCTIVE_TESTS=1`. Synthetic
JWT/session/Stripe values match `.github/workflows/market-readiness-local.yml`.
`TIXMO_BROWSER_PATH=/usr/bin/google-chrome`. `NODE_OPTIONS=--max-old-space-size=8192`.
No production, staging, or inherited app `.env`.

| Run | Suites | Tests | Notes |
| --- | ---: | ---: | --- |
| Full suite | 183 (181 passed, 2 failed) | **1715 passed**, 2 failed, 0 skipped, 1717 total | 564.9s |
| Targeted `scanner-offline-field-contract.test.ts` + `scan-reasons.unit.test.ts` | 2 passed | **15 passed** | Confirms combined T98+T99 coverage |

The two full-suite failures are the known browser flakes **fixed in #204**, which
is not on this branch (T99 already saw `wallet-browser-recovery` fail on this
cloud image; T108 recorded the same pair until #204 was in the train):

- `tests/integration/scanner-browser.test.ts` — `failureStage` expected 0, received 1
- `tests/integration/wallet-browser-recovery.test.ts` — stage 1 `failureCategory` 3 (`other`)

They are not product failures from the #202 merge. CI `local-gates` is the
authority for those suites and **passed without a re-run**.

Expected combined count vs `origin/main` `aee54592` (182 suites / 1711 tests):
183 suites / 1717 tests (T98 field sequence + unskipped WRONG_EVENT + T99
live-scan companion + T99 unit tests).

### #200 CI on head `4fd5fc98` (no re-runs)

All required checks succeeded on the first attempt. `scanner-browser` and
`wallet-browser-recovery` did not flake in CI.

| Check | Conclusion | Duration | Run | Job |
| --- | --- | --- | --- | --- |
| `local-gates` (required) | success | 13m47s | [43627415767](https://github.com/chapmandaniel/projectTixmo/actions/runs/43627415767) | [132546312241](https://github.com/chapmandaniel/projectTixmo/actions/runs/43627415767/job/132546312241) |
| `configured-image-restore` (required) | success | 3m12s | [43627415767](https://github.com/chapmandaniel/projectTixmo/actions/runs/43627415767) | [132546312594](https://github.com/chapmandaniel/projectTixmo/actions/runs/43627415767/job/132546312594) |
| `guard-and-build` | success | 1m42s | [43627415973](https://github.com/chapmandaniel/projectTixmo/actions/runs/43627415973) | [132546313246](https://github.com/chapmandaniel/projectTixmo/actions/runs/43627415973/job/132546313246) |
| `http-soak` | skipped | — | [43627415779](https://github.com/chapmandaniel/projectTixmo/actions/runs/43627415779) | [132546313680](https://github.com/chapmandaniel/projectTixmo/actions/runs/43627415779/job/132546313680) |

`mergeStateStatus=CLEAN` on head `4fd5fc98128620f8be434eaf74121f20c01c0a1b`.

## (b) Dispatch PR

| Item | Value |
| --- | --- |
| PR | https://github.com/chapmandaniel/projectTixmo/pull/210 |
| Branch | `cursor/t111-workflow-dispatch-842b` |
| Base | `main` (explicit). Branched from #198 head `9256622171e10795f0c9a9ad92d09e5eda19c00a`. |
| Head before this evidence commit | `af5fb766049f64c7a8586e62cda9cd32a85b7344` |
| Draft | yes |
| Native GitHub stack | refused: stack requires base ref = #198 head `fix/t96-required-checks-always-run`. Left base `main` as specified. Body states it is stacked on #198 and must merge after it. |

### Workflow_dispatch check

On #198 head `9256622`:

- `.github/workflows/market-readiness-local.yml` **already has** `workflow_dispatch:` (also present on `main`). Not edited.
- `.github/workflows/tdash-design-system.yml` **did not** have `workflow_dispatch`.

Unique diff vs #198 (`9256622..af5fb766`): **one line** —

```diff
 on:
+  workflow_dispatch:
   pull_request:
   push:
```

`pull_request` (no path filter, from T96) and `push` path filters, job names, and
steps are unchanged. `scripts/ci-relevant-changes.sh` already treats
non-`pull_request` events (including `workflow_dispatch`) as full coverage.
`node --test scripts/ci-relevant-changes.test.cjs`: 5 passed.

### #210 CI on head `af5fb766` (no re-runs)

`guard-and-build` ran the full dashboard suite because the PR touches
`.github/workflows/tdash-design-system.yml` (`Skip (no relevant changes)` was
skipped; Design Guard / tests / build ran). `local-gates` and
`configured-image-restore` also ran the full suite because this PR is based on
`main` and still contains #198's `scripts/` + workflow edits vs `main`.

| Check | Conclusion | Duration | Run | Job |
| --- | --- | --- | --- | --- |
| `guard-and-build` (required) | success | 1m39s | [43627665239](https://github.com/chapmandaniel/projectTixmo/actions/runs/43627665239) | [132547075613](https://github.com/chapmandaniel/projectTixmo/actions/runs/43627665239/job/132547075613) |
| `local-gates` (required) | success | 14m05s | [43627665309](https://github.com/chapmandaniel/projectTixmo/actions/runs/43627665309) | [132547076306](https://github.com/chapmandaniel/projectTixmo/actions/runs/43627665309/job/132547076306) |
| `configured-image-restore` (required) | success | 2m50s | [43627665309](https://github.com/chapmandaniel/projectTixmo/actions/runs/43627665309) | [132547076333](https://github.com/chapmandaniel/projectTixmo/actions/runs/43627665309/job/132547076333) |

`mergeStateStatus=CLEAN` on head `af5fb766049f64c7a8586e62cda9cd32a85b7344`
before this evidence commit. Adding this file retriggers CI; final head and
run ids are recorded below after that pass.

## Merge order (after `main` is merged in)

1. **#198** T96 always-run required checks
2. **#210** this dispatch PR (`workflow_dispatch` on Tdash Design System)
3. **#204** T100 deterministic tests
4. **#190** tdash-patches group
5. **#191** `@stripe/react-stripe-js`
6. **#192** tixmoapi2-patches group
7. **#202** T99 WRONG_EVENT reasonCode
8. **#200** T98 offline door scanning — **refreshed; contains #202**
9. **#203** T101 buyer wallet self-service
10. **#205** T103 transfer email normalise
11. **#208** T106 Event Command Center stats
12. **#209** T107 omit VALIDATION-only timeline hours
13. **#207** T104 tdash dead code
14. **#206** T105b stale docs

Do not merge #193 or #188. Do not merge `cursor/t108-merge-train`.

## Re-runs

None. CI `scanner-browser` / `wallet-browser-recovery` did not flake on #200 or
#210. Local Jest failures of those two files are disclosed above and were not
treated as product failures or skipped.

## This evidence commit

#200 head stays `4fd5fc98128620f8be434eaf74121f20c01c0a1b` (no further push).
This file is the next commit on #210. Adding it retriggers required checks
because the PR vs `main` still contains T96 workflow/`scripts/` changes. Those
runs are the final-head evidence; they are not a retry of a failure.
