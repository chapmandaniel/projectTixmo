# Team operations

## Runtime model

The active path is an OpenClaw-scheduled project manager on the authenticated
`moosey` Codex route, with native Codex agents executing five specialist roles.
Six role workspaces and kanban identities provide stable responsibilities;
board tasks, branches and artifacts provide durable continuity across runs.

Six per-agent OpenClaw entries are also registered, but their internal
sessions are not used for execution: the installed shared-auth resolver still
selects the obsolete `main` auth store. The active native-specialist route
inherits the manager's working inference and does not require credential copies.
This is a deliberate working fallback, not a claim that cross-agent auth is fixed.

## Control

- Add work: `kanban add "Outcome" -p tixmo -d "Acceptance criteria"`.
- View work: `kanban board -p tixmo`; decisions: `kanban inbox`.
- Resolve a decision: `kanban answer ID "Decision and constraints"`.
- View scheduling: `openclaw automations list --all` or Automations in UI.
- Pause/resume: disable/enable the named Tixmo PM automation in Automations.
  Disabling a timer does not cancel already-running worker turns; stop those
  explicitly in their sessions if an immediate halt is required.
- Reprioritize on the board; do not edit private agent conversations as the
  only record of a decision.

## Recovery

Inspect the automation's last run/error and next run, then the task's claim,
notes, worker session and branch. Check model authentication on the affected
agent; a configured identity alone is not a working route. Resume existing
work rather than cloning tasks. Do not force stale claims without verifying
the worker has stopped. Preserve existing agents, schedules and repositories.

## Verification criteria

Prove actual scheduler inference, board access, native specialist completion,
and independent review of an exact task artifact before enabling recurring
product dispatch. A queued message is not completion evidence.

## Runtime record

Observed 2026-10-19:

- Board and registered project: `tixmo`; repository
  `/home/daniel/projects/projectTixmo/main`.
- Manager automation: `47becb15-dc97-43c5-b798-2a4e22d14896`, named **Tixmo
  Project Manager**. Cadence: every 10 minutes. Actual agent: `moosey`;
  explicit existing working OAuth/Codex model route, no unauthenticated fallback.
- Successful forced scheduler health run:
  `manual:47becb15-dc97-43c5-b798-2a4e22d14896:1792441200895:2`, status **ok**.
  Board snapshot exited 0. A native specialist actually read package.json and
  returned project name `project-tixmo` plus verify:market command. This proves
  scheduled inference, file/board access and native delegation/completion.
- Pilot task #26: native tech lead authored and committed only
  `docs/team/BOOTSTRAP_CHECK.md`, commit
  `26831b3270740d5e498938bf0576045bdb5c0e6c`, branch
  `tixmo/task-26-bootstrap-check`, isolated worktree
  `/home/daniel/projects/projectTixmo/worktrees/task-26`.
- Independent pilot review #27 **PASS**: reviewer verified exact SHA, all 49
  package-script expansions, 23 paths, component claims and three follow-up
  source references. PM closed #26 after review. Static documentation review,
  not a runtime product-health claim.
- Manager automation is **ENABLED** every 10 minutes. It targets this WebChat
  conversation explicitly (`sessionTarget=current` with exact sessionKey),
  announcing meaningful results; unchanged cycles return NO_REPLY. Failure
  alert threshold is two failures, one-hour cooldown.
- Initial full work cycle **running**:
  `manual:47becb15-dc97-43c5-b798-2a4e22d14896:1792441360930:4`.
  Observed actual dispatch notes on #21 and #22; native tech lead claimed
  #21 and created isolated branch/worktree task-21. QA baseline #22 was
  dispatched. This is execution-start evidence, not completion of those tasks.
  Setup #20 is done; readiness tasks #21-25 are released.
- A narrow tool allowlist suppressed native delegation on an intermediate
  trial; restored the known-working captured `toolsAllow=["*"]` policy. Role
  limits remain instructional, not a tool-enforced sandbox. Intermediate
  isolated announce delivery had no channel; corrected to current-conversation
  delivery above. Setup owner resolved the generated escalation #28 without
  requiring human action.
- Initial readiness assignments #21-25 wait for setup #20 to close. Manager
  converts evidenced gaps into bounded implementation tasks and reviews them.
- Registered but inactive per-agent entries: tixmo-pm, tixmo-lead,
  tixmo-frontend, tixmo-backend, tixmo-qa, tixmo-release. Each has a unique
  workspace/agentDir and disabled heartbeat. Do not dispatch them with
  sessions_send until the separate shared-auth resolver problem is repaired.
- Supported configuration correction set authInheritance owner to moosey,
  but installed runtime still resolves legacy shared auth to absent main.
  No secrets were copied or printed. Attempt to configure a process-stable
  environment selector was rejected without applying it. No new login needed
  for the active manager/native-worker route.
- Isolation is worktree/instruction based, not an OS sandbox claim. No
  production mutations, live payments, new infrastructure or public publishing
  were performed. Code checks/build/UI health remain separate from team setup.
