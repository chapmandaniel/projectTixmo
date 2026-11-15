# T119 merge checklist (merge-train v3, throwaway)

Throwaway branch `cursor/t119-merge-train-v3` off `main` `aee54592`. **Never merge this branch.** No deploy, staging, branch-protection edits or force-push. Built from the T115 checklist plus #213/#214.

## Per-PR line (what it does / risk / must land first)
 (what it does / risk / must land first)

| PR | What it does | Risk | Must land first |
| ---: | --- | --- | --- |
| #198 | T96: required PR checks always report; drop path-filter skips for `local-gates` / `configured-image-restore` / `guard-and-build`. | med | none (base `main`) |
| #210 | T111: add `workflow_dispatch` to Tdash Design System. Contains #198. | low | #198 |
| #204 | T100: isolate timers/env/Redis and receipt coupling so API Jest + tdash Vitest are deterministic (fixes scanner-browser / wallet-browser-recovery flakes). | med | none |
| #190 | Dependabot: tdash-patches group, 6 patch updates (`package.json` + lockfile). | low | none |
| #191 | Dependabot: `@stripe/react-stripe-js` 6.6.0 → 7.0.1 and Checkout import/test bump. | med | none (#190 first if both land serially; both touch `tdash` lockfile) |
| #192 | Dependabot: tixmoapi2-patches group, 4 patch updates. | low | none |
| #202 | T99: offline `POST /scanners/validate` returns `reasonCode: WRONG_EVENT` for a foreign-event ticket. | med | none |
| #200 | T98: offline door-scanning field-contract tests (API + ScannerPage). Contains #202. | low | #202 |
| #203 | T101: buyer wallet self-service HTTP + WalletPage tests. | low | none |
| #205 | T103: trim/lowercase wallet transfer `recipientEmail`. Branched off #203. | med | #203 |
| #208 | T106: Event Command Center occupancy / timeline / scanner-stats tests. | low | none |
| #209 | T107: omit VALIDATION-only hours from entry timeline. Stacked on #208. | med | #208 |
| #207 | T104: delete 13 dead tdash feature modules; rewrite design-system-guard baseline. | high | none |
| #206 | T105b: docs-only historical banners on stale onsale/deploy docs. | low | #198 (so required checks actually run) |
| #211 | T113: EventManagementDashboard + remaining TeamMemberWizard Vitest coverage. | low | none |
| #212 | T114: keep event dashboard on fetch errors; title-only slugs. Stacked on #211. | med | #211 |
| #213 | T117 (QA): tasks HTTP/Todo + notification list/read/bell tests (bug tests skipped; un-skipped by #214). | low | none (base `main`) |
| #214 | T118: notification `:id/read` non-UUID returns 400; bell VIEW ALL calls existing `PUT /notifications/read-all`; mention suggestions null-safe; TaskDetailsModal sends HIGH/MEDIUM/LOW enum. Stacked on #213. | med | #213 |

## Exact merge order

`#198, #210, #204, #190, #191, #192, #202, #200, #203, #205, #208, #209, #207, #206, #211, #212, #213, #214`

Each merge: `git merge --no-ff` of the PR head from `gh pr view N --json headRefName,headRefOid`.

## Per-PR merge table (this train)

| PR | Head | Result |
| ---: | --- | --- |
| #198 | `9256622` | clean |
| #210 | `45c0f69` | clean |
| #204 | `1718c50` | clean |
| #190 | `392e222` | clean |
| #191 | `75247c1` | clean |
| #192 | `2fd9739` | clean |
| #202 | `985d05c` | clean |
| #200 | `4fd5fc9` | clean |
| #203 | `e7fbe8a` | clean |
| #205 | `841746d` | clean |
| #208 | `65f2754` | clean |
| #209 | `71b8feb` | clean |
| #207 | `492a130` | clean |
| #206 | `8f60f3e` | clean |
| #211 | `dd18769` | clean |
| #212 | `9e07efc` | clean |
| #213 | `9174a4c` | clean |
| #214 | `ec47ac2` | clean |

**Conflicts: none.** No `it.skip` added.

## Refresh after an earlier PR merges to main


These heads are still based on `main` `aee54592` (or on another open PR). After the named predecessor lands on `main`, merge `main` into the remaining PR (no force-push):

| PR | Refresh after | Why |
| ---: | --- | --- |
| #210 | #198 | Contains #198; GitHub checks / diff will be stale until it sees the merge commit on `main`. |
| #206 | #198 | Docs-only; required checks are skipped by path filters until T96 lands. |
| #200 | #202 | Contains #202 (`--no-ff` merge `4fd5fc98` already on this head). |
| #205 | #203 | Branched off #203 head `e7fbe8a0`; product fix sits on T101 tests. |
| #209 | #208 | Stacked on #208. |
| #212 | #211 | Stacked on #211. |
| #191 | #190 (recommended) | Both rewrite `tdash/package-lock.json`. This train auto-merged them cleanly, but a serial merge to `main` should refresh #191 after #190. |
| #214 | #213 | Stacked on #213 (base is #213's branch); retarget base to `main` after #213 lands, then merge `main` in. |

No conflict-driven refresh was needed in this train.

## Merge it in one sitting

Land the source PRs (never this branch) in this order: `#198, #210, #204, #190, #191, #192, #202, #200, #203, #205, #208, #209, #207, #206, #211, #212, #213, #214`.

Between merges:
1. Before each merge, if the PR is in the refresh table and its predecessor just landed, merge `main` into it (no force-push), or retarget its base to `main` for stacked PRs (#209, #212, #214).
2. Confirm the PR shows **CLEAN** and all 3 required checks (`local-gates`, `configured-image-restore`, `guard-and-build`) are green **on its current head**. Never admin-bypass; never re-run a red check without a code change.
3. Merge, then confirm `main`'s push run is green before the next merge. If `main` goes red, stop and fix forward before continuing.
4. Extra care: after #198 confirm the 3 checks report on every later PR (no path-filter skips); after #207 confirm nothing on `main` still imports the deleted modules (tdash build + guard green); after #191 confirm checkout Vitest still green.
5. At the end, `main` should match this train's tree for the merged files (compare with `git diff main cursor/t119-merge-train-v3 -- . ':!evidence/t119'`; expect empty).

## Close list (do not merge)


| PR | One-line reason |
| ---: | --- |
| #188 | Parked Social Command Center phase 1 — out of V1 launch scope; large scaffold (UI + Prisma + capture) not in this train. |
| #193 | Dependabot `@types/node` 24.19.1 → 26.6.6 is a major types jump while `engines.node` is `>=24.21.0 <25`; types would not match the pinned runtime. |

## Local test results

Pending: filled in by the T119 local run (see STATE).

## CI (dispatched on this branch)

Pending: see STATE for run ids.
