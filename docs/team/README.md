# Tixmo autonomous team

This is an OpenClaw-scheduled team with a persistent board and role workspaces,
using native Codex specialist agents under the authenticated manager. It is
coordinated through the existing shared kanban CLI. No custom orchestration service or paid platform is required.

## Operating documents

- [Project brief](PROJECT_BRIEF.md): product scope and inspected baseline.
- [Roles](ROLES.md): persistent agent identities and accountability.
- [Workflow](WORKFLOW.md): assignments, worktrees, review, and completion.
- [Manager runbook](MANAGER_RUNBOOK.md): bounded recurring management cycle.
- [Task template](TASK_TEMPLATE.md): reviewable definition of work.
- [Operations](OPERATIONS.md): controls, recovery, and verification.

## Assign work

```bash
kanban add "Clear outcome" -p tixmo -P 2 -d "Goal, scope, acceptance criteria, constraints"
kanban board -p tixmo
kanban inbox
```

Leave a new task unassigned for the PM to triage, or assign it explicitly to
`tixmo-pm`. The manager reads the board on each cycle, dispatches specialists,
tracks evidence and blockers, and keeps independent work moving. Decisions
requiring Daniel appear in the shared human inbox.

The manager is always scheduled, not an infinite model process: recurring
wakeups recover work after restarts and avoid idle token spinning. Exact live
automation identity and cadence are recorded in Operations after setup.
