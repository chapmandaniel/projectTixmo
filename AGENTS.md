# Tixmo development team

## Start here

Read `docs/team/README.md`, `docs/team/PROJECT_BRIEF.md`, and your role in
`docs/team/ROLES.md`. The shared kanban project `tixmo` is the source of truth
for assignments, dependencies, decisions, and verification evidence.

Repository: `/home/daniel/projects/projectTixmo/main`.
Owner and product authority: Daniel Chapman.

## Work protocol

- Set `KANBAN_AGENT` to your configured agent ID and `KANBAN_PROJECT=tixmo`.
- Read `kanban list --mine`, `kanban inbox`, and your assigned task. Claim the
  exact task before work. Never take another agent's claim or force a claim.
- Follow `docs/team/WORKFLOW.md`. Only work on approved scope or concrete
  readiness gaps in the existing V1 launch docs; do not invent new features.
- Use an isolated Git worktree and branch per implementation task. Never
  change branches, reset, clean, or stash in the shared `main` checkout.
- Preserve others' changes. Document dependencies and file ownership before
  parallel work. Integrate related changes serially through the tech lead.
- Record commit SHA, actual checks and outcomes, failures, limitations, and
  handoff instructions on the board. Historical green evidence is not a new pass.
- Code authors submit to `review`; an independent reviewer checks the exact
  commit. Only then can the PM close the implementation task as `done`.
- Keep task notes current; heartbeat active claims at least hourly. Claims
  expire after two hours without activity. Check execution before reclaiming.
- Block only the dependent work; use `kanban ask` for decisions and continue
  independent authorized work. Do not repeatedly create the same question.

## Project structure and verification

- `tdash/`: React/Vite dashboard, Vitest tests, design-system guard.
- `tixmoapi2/`: Express/TypeScript API, Prisma/Postgres, Redis, Jest.
- `scripts/`: local verification and launch-evidence helpers.
- `docs/`: launch, payment, scanner, policy, operations and evidence runbooks.
- Full local gate: `npm run verify:market`; see
  `docs/LOCAL_MARKET_READINESS_GATES.md` before execution.
- Frontend: `npm --prefix tdash test -- --run`,
  `npm --prefix tdash run design:guard`, `npm --prefix tdash run build`.
- API: `npm --prefix tixmoapi2 run build`, `npm run verify:api`.
- Read scripts before running them: API verification applies database schema.
  Use an explicitly disposable local test DB, never production or an unknown
  inherited DATABASE_URL. Coordinate shared database/ports before tests.
- Preserve lockfiles with `npm ci`. Never weaken tests, update guard baselines,
  or remove assertions merely to make checks pass.
- Consult `tixmoapi2/MASTER_DOCUMENTATION.md` for API architecture; its older
  progress claims and `PROGRESS.md` must be checked against current code and
  newer launch docs rather than treated as live status.

## Autonomy boundaries

Local investigation, documentation, implementation on task branches, tests,
and independent review are authorized. No new paid services, production
deployment/migration/data mutation, live payment/refund, public publishing,
or external customer messaging without Daniel's explicit authorization for
that action. Do not merge into the default branch until authorized; keep
reviewed deliverables on branches ready for integration. Existing project
instructions may impose stricter environment constraints.

Never print secrets, load unrelated personal memory, or read another agent's
private workspace. Do not alter Gateway settings or the scheduler as part of
product work. Read relevant installed AWS skills before AWS work; current
server AWS access is read-only Storybook monitoring, not Tixmo infrastructure
authorization. Follow the workspace's Secrets Manager safety requirements.
