# T108 merge-train dry run (scratch — do not merge)

Scratch branch: `cursor/t108-merge-train`  
This branch must **never** be merged to `main`. No PR was opened. No PR
branch was pushed, updated, or rebased. No workflow files, branch
protection, or GitHub settings were changed.

## Base

| Item | Value |
| --- | --- |
| Requested main | `aee5459` |
| Current `origin/main` at start | `aee54592d25fc1134ea22f01bab0da59074479a0` (unchanged; still `aee5459`) |
| Train created from | `aee54592d25fc1134ea22f01bab0da59074479a0` |
| Combined head before this evidence commit | `df229362ded552420b76513af1c324829709d816` |
| Date | 2026-11-14 |

Excluded from the train: **#193** (to be closed), **#188**.

## Per-PR table (merge order)

Heads captured with `gh pr view N --json headRefName,headRefOid` immediately
before each `git merge --no-ff`.

| Order | PR | Head SHA | Result | Conflict files and resolution | Needs refresh |
| --- | --- | --- | --- | --- | --- |
| 1 | #198 T96 always-run required checks | `9256622171e10795f0c9a9ad92d09e5eda19c00a` | merged clean | — | n |
| 2 | #204 T100 deterministic tests | `1718c506a9b4a341e4e2bff17ff0e6e116d2a6eb` | merged clean | — | n |
| 3 | #190 tdash-patches group | `392e22267e9f1372125d2b7c1d56106a5e009fc3` | merged clean | — | n |
| 4 | #191 `@stripe/react-stripe-js` 7.0.1 | `75247c18e2c5ce0ff516b38c8a9759514b0fe673` | merged clean | lockfiles auto-merged with #190 | n |
| 5 | #192 tixmoapi2-patches group | `2fd9739a9422bc057a5d9d9838eee501a21d319a` | merged clean | — | n |
| 6 | #202 T99 WRONG_EVENT reasonCode | `985d05c6cd428a1806aac614c00a89aa92ff5aef` | merged clean | — | n |
| 7 | #200 T98 offline door scanning | `99cf4e6af26004ec1860a7279a98c9a47832e3ee` | conflict, resolved on scratch | See below | **y** |
| 8 | #203 T101 buyer wallet self-service | `e7fbe8a0d4cdac1e3ecf87584102bc91c1456747` | merged clean | — | n |
| 9 | #205 T103 transfer email normalise | `841746d1776fa5f49c0d7ae77e270c01dc7f5dc7` | merged remaining unique commits (stacked on #203; not a no-op) | Unique vs #203: `6d447420` (fix) + `841746d1` (docs). No conflict. | n |
| 10 | #208 T106 Event Command Center stats | `65f27543f7c29bdb1d292f2354175ee0bca7d05c` | merged clean | — | n |
| 11 | #209 T107 omit VALIDATION-only timeline hours | `71b8feb300c01217fa73f6066ff84a3c31ef0af1` | merged remaining unique commits (stacked on #208; not a no-op) | Unique vs #208: `ad0cf029` (fix) + `71b8feb3` (docs). No conflict. | n |
| 12 | #207 T104 tdash dead code | `492a130ed4617a5f1f3433a56e566b2c7ec19a6d` | merged clean | — | n |
| 13 | #206 T105b stale docs | `8f60f3e3626b4fb3499d2fdc8bd707a9d150778b` | merged clean (git) | No file conflict. GitHub `mergeStateStatus=BLOCKED` with **0 checks** (docs-only path-filter skip on current main workflows). | **y** |

### #200 conflict resolution (scratch only)

Conflict file: `tixmoapi2/tests/integration/scanner-offline-field-contract.test.ts`
(add/add vs #202).

Combined result on this scratch branch:

- Kept #200's full T98 field-contract suite (auth, snapshot, reconnect,
  unpaid/refunded/stolen/dup/unknown/garbage).
- Un-skipped #202's WRONG_EVENT validate-row test and kept #202's live-scan
  403 vs sync-assignment 403 test.
- Updated #200's in-suite wrong-event `reason` from
  `Scanner is not assigned to this event` to the T99 presented message
  `This ticket is for T98 Other Hall.` plus `reasonCode: WRONG_EVENT`.
  After #202, `deniedOfflineScanRow` copies `data.message`, not the live
  403 assignment string.

**A real #200 PR must be refreshed** after #202 is on main: merge main,
keep all tests, drop `it.skip`, and update the WRONG_EVENT reason
assertion. Do not push that refresh from this scratch train.

### #206 refresh

Git merge onto the train was clean (docs-only; based on current main
`aee54592`). After #198 lands, required checks always *run* (job-level
skip instead of missing checks). #206's current head still has 0 checks
on GitHub. Daniel should merge main (post-#198) into #206 so the
always-run workflows attach and the required checks can go green. Do
not push that refresh from this scratch train.

## Combined tests (this branch)

Disposable loopback targets only:
`DATABASE_URL` database `tixmo_disposable_t108`, `REDIS_URL` `/1`,
`TIXMO_ALLOW_DESTRUCTIVE_TESTS=1`. No production, staging, Stripe live,
or inherited app `.env`.

### tixmoapi2 Jest (`npx jest --runInBand` after `npm test` pretest/build)

| Run | Passed | Failed | Skipped | Notes |
| --- | --- | --- | --- | --- |
| Full suite, no `TIXMO_BROWSER_PATH` | 1760 | 0 | 1 | Suites 185 passed, 1 skipped of 186. Skip is `scanner-browser.test.ts` (gated on `TIXMO_BROWSER_PATH`). Time 608.5s. |
| That skipped file with `TIXMO_BROWSER_PATH=/usr/bin/google-chrome` | 1 | 0 | 0 | Completes the CI-equivalent suite. Not a retry of a failure. |
| CI-equivalent total | **1761** | **0** | **0** | Chrome 157 present at `/usr/bin/google-chrome`. |

A first attempt with `--json --outputFile` aborted (Node heap OOM, exit
134) because the JSON reporter buffered the whole suite. That was not a
test failure. Official `jest --runInBand` then passed as above. Pre-push
`verify:api` later passed with `NODE_OPTIONS=--max-old-space-size=8192`.

### tdash Vitest (`npm --prefix tdash test -- --run`)

**507 passed, 0 failed, 0 skipped.** 66 test files. Duration 47.80s.

### tdash build (`npm --prefix tdash run build`)

**Passed.** Vite production build completed (`built in 14.48s` on the
isolated run; `8.88s` inside `verify:market`). Buyer policy pages and
robots html check passed.

No product test failures were attributed to a PR combination. The only
scratch integration edit is the #200/#202 test-file combine above.

## CI required checks

Workflow dispatch:

```text
gh workflow run market-readiness-local.yml --ref cursor/t108-merge-train
→ HTTP 403 Resource not accessible by integration
gh workflow run tdash-design-system.yml --ref cursor/t108-merge-train
→ HTTP 403 Resource not accessible by integration
```

`tdash-design-system.yml` also has **no `workflow_dispatch`** (only
`pull_request` and `push` to `main`/`master`). Per T108 rules, workflows
were not edited, no trigger was added, and no PR was opened to force
checks. Push to this non-default branch does not start those workflows.

**GitHub Actions run ids: none.** The three required checks did **not**
run in CI on this branch.

### Local substitutes (same job steps, this machine)

| Check | CI | Local result |
| --- | --- | --- |
| **local-gates** (`Tixmo Market Readiness Local Gates` / `market-readiness-local.yml` job `local-gates`) | not run (403 dispatch; no PR/push trigger) | `npm run verify:market` **passed**. Also ran Chrome presence, `wallet-browser.test.cjs`, and the receipt/guard node tests from the job. API lint: 0 errors, 384 warnings. Did not run the job's `verify-payment-upgrade.cjs` step. |
| **configured-image-restore** (same workflow, job `configured-image-restore`) | not run | Synthetic restore **unit tests 83 passed / 0 failed**. `verify-image-restore.cjs` **passed** (PG18 SSL + Redis 8.2.9, 43 migrations, fingerprint match). Production image `tixmo-task603-production:ci` **built**. Packaged snapshot roundtrip **passed** (43 migrations, 44 tables). `verify-parity-upgrade.cjs` **passed**. `verify-application-rollback.cjs` and `verify-auth-ip.cjs` **could not bind-mount the workspace into Docker** here (engine via TCP 2375 cannot see `/agent/repos/...`). That is an environment limit, not a merge-train product failure. Those two steps still need GitHub-hosted CI. |
| **guard-and-build** (`Tdash Design System` / `tdash-design-system.yml`) | not run (no `workflow_dispatch`; 403 anyway) | `npm --prefix tdash run design:guard` **passed** (739 tracked baseline violations, no regressions). Vitest **507 passed**. `npm --prefix tdash run build` **passed**. |

## PRs that must be refreshed before Daniel merges in order

1. **#200** — after **#202**. Conflict on
   `tixmoapi2/tests/integration/scanner-offline-field-contract.test.ts`.
   Merge main, keep T98 field-contract tests, drop `it.skip`, expect
   presented WRONG_EVENT message + `reasonCode`.
2. **#206** — after **#198**. Git is clean; required checks are missing
   until the always-run workflows from T96 apply. Merge post-#198 main
   and let `local-gates` / `configured-image-restore` / `guard-and-build`
   report.

Stacked children #205 (on #203) and #209 (on #208) merged as remaining
unique commits with no file conflicts. After the parent is on main,
GitHub can merge the remainder; a main update is optional hygiene, not
a conflict refresh.

## Recommended final merge order

Same as the train, with the two refreshes done on the **PR branches**
(not this scratch branch) before those PRs are merged:

1. **#198** T96  
2. **#204** T100  
3. **#190** tdash patches  
4. **#191** react-stripe-js  
5. **#192** tixmoapi2 patches  
6. **#202** T99  
7. **#200** T98 — **refresh after #202 first**  
8. **#203** T101  
9. **#205** T103 (contains #203; remainder only after #203)  
10. **#208** T106  
11. **#209** T107 (contains #208; remainder only after #208)  
12. **#207** T104  
13. **#206** T105b — **refresh after #198 first** (can also wait until
    last; git is independent of the others)

Do not merge #193 or #188. Do not merge `cursor/t108-merge-train`.
