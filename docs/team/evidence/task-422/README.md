# Task 422: full dashboard regression evidence

Author: tixmo-release. Source under test: `8aae387bcd4290edd259fd75aa11baaa1f62ca63`.
Isolated branch `tixmo/task-422-full-dashboard`, worktree
`/home/daniel/projects/projectTixmo/worktrees/task-422`.
Evidence commit is a documentation-only successor; source, tests, assertions,
baseline, lockfiles and configuration remain identical to that tested SHA.

## Preflight

Read role/repository/team workflow, board 422/404/414/419/362, dashboard
package scripts, Vite/Vitest config, setup.js and full strict design guard.
The suite uses jsdom and existing mock transports. Search of dashboard source
and tests found no listen/createServer/setupServer/node:http/node:net/WebSocket
setup. No listener, database or service was started. Only .env.example exists
in this checkout; no inherited dotenv file was copied or read for execution.
No custom solution or dependencies were introduced: existing Vitest/Vite/guard
are the established adequate tools.

Byte comparisons of tdash package.json and package-lock.json against BOTH
existing task251 and task315 returned0. task315 dependencies resolve task251.
Independently checked installed/lock versions: React18.3.1, Axios1.20.0,
Vitest4.1.11, Vite6.4.3, testing-library/react16.3.2, jsdom27.4.0: all match.
A temporary local tdash/node_modules symlink pointed to existing task251
node_modules. No install/download or dependency repair. Node v24.21.0.

## Exact executed gate commands

Working directory is the isolated worktree above. Every npm command used this
literal scrubbed prefix, not an unknown inherited PATH/environment:

```sh
env -i PATH=/home/daniel/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin HOME=/home/daniel timeout --signal=TERM --kill-after=5s 180s npm --prefix tdash test -- --run --reporter=default --reporter=json --outputFile.json=../docs/team/evidence/task-422/vitest.json
env -i PATH=/home/daniel/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin HOME=/home/daniel npm --prefix tdash run design:guard
env -i PATH=/home/daniel/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin HOME=/home/daniel timeout --signal=TERM --kill-after=5s 60s npm --prefix tdash run build
```

Each stdout/stderr was redirected to corresponding committed .log; exit codes
are in .exit files. Single full unfiltered Vitest attempt, no retry or repair.
Full suite and the sequential guard/build ran as two independent local shell
executions, no shared services. Neither timeout fired.

- Full dashboard Vitest exit0: 34/34 test files PASS,250/250 tests PASS,
  0failed/0pending/0todo; duration16.73s. JSON testResults contains34 files and
  250 assertions. Vitest JSON suite counters are75/75 (include nested describe
  suites); do not mislabel these as75 test files. Console reports34 files.
- Snapshots21 matched;0 added/removed/updated/unmatched/unchecked.
- Strict unchanged designguard exit0:924 tracked baseline violations and no
  regressions or resolved-entry mismatch. No baseline regeneration.
- Production build exit0:2137 transformed modules,15.43s.
- No failing tests or skipped tests, no implementation changes to obtain pass.

## Cleanup, limitations, handoff

Both owned execution sessions completed exit0 before this report. Temporary
node_modules symlink was unlinked after completion; no running test/service
execution remains owned by this task. Generated dist is ignored build output.
Shared main checkout's existing untracked AGENTS.md/docs/team preserved.
Only docs/team/evidence/task-422 is committed; final/staged diff checks pass.
Product-directory Git diff against source SHA returned0. Commit used command-local
GIT_AUTHOR/COMMITTER_NAME and EMAIL (Tixmo Release/tixmo-release@local), plus
`git -c core.hooksPath=/dev/null commit` to avoid inherited unrelated hooks;
no Git config or hook changes. Required explicit gates above were executed.

Task362 board evidence is a guarded full API run on older80c6710b, not a
current dashboard run. It is NOT inherited as evidence for this candidate.
This task establishes only the current composed candidate's dashboard
mock/jsdom regression, strict design guard and static production build.
No full API/real Redis/Lua/browser/provider/capacity/market/launch gate was run.
No DB/services/network/install/config/scheduler/spend/push/merge/deploy.
No transport syscall guard was added; the mock/config inspection is the stated
network assurance boundary, not an OS-level network sandbox.

Submit task422 REVIEW. PM must arrange independent exact-commit evidence
review before closure; this is not launch approval or default-branch integration.
