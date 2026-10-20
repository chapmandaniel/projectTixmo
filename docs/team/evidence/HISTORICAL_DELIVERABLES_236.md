# Task236 historical deliverable provenance

Imported 2026-10-20 from reviewed work absent the local candidate. This archive
preserves original evidence and makes it reviewable; **it does not certify this
branch, the PR58 combination, native CI, a deployed environment, or launch**.
Words such as "fresh", "current", "PASS" and "NO-GO" in original reports describe
their original capture and scope, not a new execution or new approval.

## Exact sources

| Imported report | Original commit | Original date | Tested/reference product | Original acceptance |
| --- | --- | --- | --- | --- |
| [RELEASE_EVIDENCE_HANDOFF_61.md](../RELEASE_EVIDENCE_HANDOFF_61.md) | `f75036662a7b097d20f0d2b920ca590ea5765c5f` | 2026-10-19 | `c35a6f84512b274b2ae9563fda57169770f08c18` | QA74 |
| [task-209-complete-api.md](task-209-complete-api.md) | `b4bb2753e5e6fe18d968c0b4789fa54e414833a6` | 2026-10-20 | `e48e4a0069cdb25f8f524e0afdfcbf43b8eb55f7` | QA210 |
| [task-210-independent-api-and-aggregate-review.md](task-210-independent-api-and-aggregate-review.md) | `bd576356375e7ac107a99d4683475426341435e1` | 2026-10-20 | `e48e4a0069cdb25f8f524e0afdfcbf43b8eb55f7` | independent review210 |
| [task-213-full-market.md](task-213-full-market.md) | `d2dc727b5b34acd8be756be03a3f218afd668c5d` | 2026-10-20 | `0d193a6e8f8180d509f5cfdbb793203904047237` | QA214 |
| [task-214-independent-full-market-review.md](task-214-independent-full-market-review.md) | `8d9f7b2ce020289b8f6a314b3e14837a2d7e9c5d` | 2026-10-20 | `0d193a6e8f8180d509f5cfdbb793203904047237` | independent review214 |

Raw `task-209-artifacts/` and `task-213-artifacts/` are imported byte-for-byte
from their respective source commits. Report bodies are unchanged below an
added historical banner. Raw helper scripts are audit artifacts, not newly
authorized commands; do not execute them merely because they are preserved here.
Five trailing-whitespace lines in imported raw logs are deliberately preserved;
a full diff whitespace check reports those original artifact bytes. Newly
authored Markdown and the regression have no whitespace errors.
Original paths, process identities, disk locations, clocks, dependencies and
runtime versions describe the old capture, not today's running infrastructure.
Some original absolute worktree paths and references to intermediate reports
are historical references and need not resolve in a fresh checkout.

## What the evidence actually establishes

- Task209 captured **79 suites /493 tests, zero failed/skipped**, on `e48e4a0`.
  Task210 independently reviewed that evidence and its scoped acceptance.
- Task213 captured a local full-market pass on `0d193a6`, including **170
  dashboard tests**. Its API subprocess suppressed counts; the task209 total
  must not be attributed to task213 or this new branch. Task214 independently
  reviewed the exact task213 capture.
- These used Node24/PostgreSQL18/Redis8 and reused dependencies; they are not
  fresh-install/native-CI parity claims. No database or service was started by
  task236. New combined-source checks remain the integration owner's job.
- Handoff61 was prepared against `c35a6f8`, independently accepted as preparation
  by QA74, then retained as a checklist while actual release-input gates stayed
  open. Its original "review required" and nine-gap/checker observations are
  historical, not a renewed claim of missing approval or a current checker defect.
  Later Railway225/230 work established existing staging origins/control-plane
  access while deployment-bound source/build attestation remained unresolved;
  do not repeat the old blanket missing-hosting/access premise. Actual target
  execution scope, release evidence and named human participants still require
  the current board's reconciliation. Importing this handoff grants no authority.

## Reviewed regression and deliberate deferral

`tixmoapi2/tests/unit/environment.config.test.ts` is copied unchanged from
`6c57442c2a5a83aa999b557dc7e2967d20a43781` (2026-10-19), independently approved
by review88. It uses mocked dotenv and synthetic-only environment values, and
checks import output in development, test and production. Its old approval is
not approval of this aggregate; task236 requests a different exact-tip reviewer.

Checker commit `6787e18748149370f4a974718053a93261bc9714` is **not imported**:
PR58 `f699a53` already implements equivalent local-provenance blocker behavior,
but uses a different output contract. Both checker implementation and its
48-case coverage/contract integration are deferred to the combined candidate;
no incompatible `information`-field assertion is introduced on this branch.
No QA scratch, untracked reviewer tests, mutation edits, caches or runtime
directories have been included.
