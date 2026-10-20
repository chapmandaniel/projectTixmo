# Development workflow

## 1. Intake and refinement

New work enters kanban project `tixmo`. PM checks for duplicates and existing
claims, reads dependencies, writes measurable acceptance criteria and selects
an owner from ROLES. Unclear business decisions go through `kanban ask`.
Use backlog for speculative work, todo for ready work. Priority P0 is urgent;
P1 is a critical-path blocker; P2 normal; P3 optional.

## 2. Claim and isolate

Each worker sets its identity explicitly, then claims its exact assigned ID:

```bash
export KANBAN_AGENT=tixmo-frontend # substitute your configured agent ID
export KANBAN_PROJECT=tixmo
kanban show ID
kanban claim ID
```

Check `git status` and `git worktree list` before creating a checkout. Example:

```bash
git -C /home/daniel/projects/projectTixmo/main worktree add \
  -b tixmo/task-ID-short-name \
  /home/daniel/projects/projectTixmo/worktrees/task-ID \
  main
```

Use the PM-selected reviewed baseline if a dependency requires another branch.
Never assume another task's unmerged commit is on main. Record branch,
worktree, baseline SHA and owned files in a task note. Dependencies between
API/UI changes require an explicit contract and integration order.

## 3. Execute and verify

Keep changes within acceptance criteria. Use existing libraries and tools
before building replacements. Run relevant checks; code changes require
meaningful tests for changed behavior. Full readiness gates are run by QA or
release against a disposable local environment after coordinated changes.
Do not start database-mutating checks until the test target is verified local
and disposable and other test owners are idle. A missing prerequisite is a
blocker, not a pass. Capture exact command, exit status and commit SHA.

## 4. Independent review

Commit task-owned changes on the task branch. `kanban review ID -m` must
include the SHA, diff summary, checks and limitations. PM creates/assigns an
independent review task referencing that exact SHA and acceptance criteria.
QA/lead reviews in a separate checkout, leaving findings on the original
task. Findings return the implementation to its original author; never claim
the author's task as the reviewer. A newer commit invalidates prior approval
for affected behavior and must be re-reviewed.

## 5. Close and integrate

PM closes only after acceptance is verified and required reviews pass. Done
means the scoped deliverable is reviewed; it does not mean deployed. Record
the branch/SHA and integration status explicitly. Default-branch merges,
production changes and external publication require Daniel's authorization;
prepare a concrete release/integration decision without repeatedly asking.

## 6. Failure recovery

On failure, record the failing command and reason; attempt one bounded repair
where within scope. Repeated identical failure becomes a blocked task with
owner and recovery condition. Do not create retry loops or duplicate tasks.
If a claim expires, inspect the corresponding worker's run/session and branch
before reassignment. Resume the same owner when possible. Never force-take a
claim, kill unrelated processes or run destructive Git cleanup.
