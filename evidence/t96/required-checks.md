# T96 required checks always report

Baseline `main`: `aee54592d25fc1134ea22f01bab0da59074479a0`.
T96 draft PR: [#198](https://github.com/chapmandaniel/projectTixmo/pull/198), branch `fix/t96-required-checks-always-run`.
This file is on that branch. No merge, admin bypass, branch-protection change, or deploy was used.

## Old behavior

Branch protection on `main` requires these check names:

| Check | Workflow |
| --- | --- |
| `local-gates` | Tixmo Market Readiness Local Gates |
| `configured-image-restore` | Tixmo Market Readiness Local Gates |
| `guard-and-build` | Tdash Design System |

Both workflows used `on.pull_request.paths`. If a PR to `main` did not touch those paths, GitHub never started the workflow, so the required check never reported a conclusion. Merge then needed a manual `workflow_dispatch`. That hit workflow-only / docs-only PRs (for example #186 before its path list was widened) and left Dependabot PRs that missed a path waiting on a missing check.

`http-soak` is a separate opt-in workflow (`codex/http-soak-qualification` plus its own `paths`). It is not a required check.

## New design

`pull_request` no longer has a workflow-level `paths` filter. `push` to `main`/`master` still has the previous path filters. `workflow_dispatch` still runs the full suite.

Each required job keeps its exact name and always runs (never job-level `skipped`). After checkout, `scripts/ci-relevant-changes.sh` diffs `BASE_SHA`..`HEAD_SHA` against a pathspec at least as broad as the old filter, including the workflow file itself:

- Market jobs: `.github/dependabot.yml`, `.github/workflows/dependency-audit-scheduled.yml`, `.github/workflows/market-readiness-local.yml`, `.github/workflows/uptime-status.yml`, `package.json`, `scripts`, `tdash`, `tixmoapi2`
- `guard-and-build`: `tdash`, `.github/workflows/tdash-design-system.yml`, `.github/workflows/uptime-status.yml`

Non-`pull_request` events write `relevant=true` (full coverage). On a PR with no matching paths the job logs `skipped: no relevant changes` and the remaining suite steps are skipped with `if: steps.changes.outputs.relevant == 'true'`. The job conclusion is success, not skipped.

Job-level Postgres/Redis `services:` stay. Restore/parity contract tests require `job.services.*.id` and mapped loopback ports, so those containers still start on a skip. `permissions: contents: read`. `http-soak` is unchanged.

Offline coverage: `scripts/ci-relevant-changes.test.cjs`, included in `npm run verify:market`.

## Docs-only proof (closed)

Throwaway draft [#199](https://github.com/chapmandaniel/projectTixmo/pull/199), branch `cursor/t96-docs-only-proof-d3aa`, base `fix/t96-required-checks-always-run`. Head `21541d41c07ef4b6cb8a592b1e92bd321e49e3ce`. Diff vs T96: one file, `docs/t96-docs-only-proof.md`. No `workflow_dispatch`.

All three required checks reported success with the skip log:

| Check | Conclusion | Job duration | Run ID | Job ID |
| --- | --- | --- | --- | --- |
| `guard-and-build` | success | 7s (run 11s) | [43282899974](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282899974) | [131408592421](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282899974/job/131408592421) |
| `local-gates` | success | 32s | [43282900202](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282900202) | [131408600030](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282900202/job/131408600030) |
| `configured-image-restore` | success | 38s | [43282900202](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282900202) | [131408600595](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282900202/job/131408600595) |

Each detect step printed `skipped: no relevant changes`. Compare to a full T96 run on the same workflows: `guard-and-build` 1m04s, `local-gates` 14m38s, `configured-image-restore` 3m18s. Skip is not instant on the market jobs because service health checks still run.

#199 was closed 2026-11-12T18:45:30Z. Branch `cursor/t96-docs-only-proof-d3aa` was deleted.

## T96 PR #198 on `b8806d36` (implementation commit)

Full suite, because the PR vs `main` changes the workflows and `scripts/`.

| Check | Conclusion | Duration | Run | Job |
| --- | --- | --- | --- | --- |
| `guard-and-build` | success | 1m04s | [43282856978](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282856978) | [131408444752](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282856978/job/131408444752) |
| `local-gates` | success | 14m38s | [43282857138](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282857138) | [131408447056](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282857138/job/131408447056) |
| `configured-image-restore` | success | 3m18s | [43282857138](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282857138) | [131408447629](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282857138/job/131408447629) |

The evidence commit that adds this file retriggers the same required names on the new head; record that second pass below after it finishes.

## Dependabot #190–#192 onto `aee5459`

Updated with merge of `main` into each head. No force-push, no rebase. #193 was not touched (`2b24323412607e398de232e9092eba170564f1ac`). #191 still contains fix commit `00620fa226ba86fb658abc9578ce876453fa03ad`.

These PRs still use the workflows on `main` (T96 is not merged). They touch `tdash/` or `tixmoapi2/`, so the old path filters should start the matching jobs. No `workflow_dispatch` was used.

### #190 [Bump the tdash-patches group](https://github.com/chapmandaniel/projectTixmo/pull/190)

New head: `392e22267e9f1372125d2b7c1d56106a5e009fc3` (merge `aee5459` into `7b208ef2`). Touches `tdash/`.

| Check | Result | Duration | Run | Job |
| --- | --- | --- | --- | --- |
| `guard-and-build` | success | 1m04s | [43282914900](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282914900) | [131408642818](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282914900/job/131408642818) |
| `local-gates` | success | 12m40s | [43282914868](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282914868) | [131408644233](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282914868/job/131408644233) |
| `configured-image-restore` | success | 3m24s | [43282914868](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282914868) | [131408643599](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282914868/job/131408643599) |

### #191 [Bump @stripe/react-stripe-js](https://github.com/chapmandaniel/projectTixmo/pull/191)

New head: `75247c18e2c5ce0ff516b38c8a9759514b0fe673` (merge `aee5459` into `00620fa2`). Touches `tdash/`. First-parent still has `00620fa2`.

| Check | Result | Duration | Run | Job |
| --- | --- | --- | --- | --- |
| `guard-and-build` | success | 1m05s | [43282914856](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282914856) | [131408643356](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282914856/job/131408643356) |
| `local-gates` | success | 13m14s | [43282915207](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282915207) | [131408645072](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282915207/job/131408645072) |
| `configured-image-restore` | success | 2m45s | [43282915207](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282915207) | [131408645532](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282915207/job/131408645532) |

### #192 [Bump the tixmoapi2-patches group](https://github.com/chapmandaniel/projectTixmo/pull/192)

New head: `2fd9739a9422bc057a5d9d9838eee501a21d319a` (merge `aee5459` into `dfc31be9`). Touches `tixmoapi2/` only.

| Check | Result | Duration | Run | Job |
| --- | --- | --- | --- | --- |
| `local-gates` | success | 16m20s | [43282921335](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282921335) | [131408665205](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282921335/job/131408665205) |
| `configured-image-restore` | success | 2m28s | [43282921335](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282921335) | [131408663873](https://github.com/chapmandaniel/projectTixmo/actions/runs/43282921335/job/131408663873) |
| `guard-and-build` | **did not report** | — | — | — |

`guard-and-build` did not start because T96 is not on `main` and this PR does not touch `tdash/**` or the Tdash workflow files, so the current `pull_request.paths` filter on Tdash Design System never fires. Not papered over with `workflow_dispatch`. After T96 merges, a `tixmoapi2`-only PR will still get `guard-and-build` reporting success via the skip path (as #199 did). `http-soak` reported skipped (opt-in, expected).

## What did not go to plan

- Skip on market jobs is ~30–40s, not a few seconds, because GitHub job `services` cannot be conditional without breaking the restore contract tests that require `job.services.postgres.id`.
- #192 still missing `guard-and-build` until T96 is on `main` (old path filter, `tixmoapi2`-only diff). Expected; documented above.
- Adding this evidence file retriggers a full T96 suite on #198 because the PR vs `main` still contains the workflow and `scripts/` changes.
