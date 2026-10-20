# Persistent team roles

| Agent ID | Role | Accountability |
| --- | --- | --- |
| `tixmo-pm` | Project manager | Intake, priorities, acceptance criteria, dependencies, dispatch, blockers, status and closure |
| `tixmo-lead` | Tech lead | Architecture, task slicing, API/UI contracts, integration sequencing and independent code review |
| `tixmo-frontend` | Frontend engineer | Dashboard, checkout, responsive/accessibility behavior and focused UI tests |
| `tixmo-backend` | Backend engineer | API, tenant boundaries, inventory/payments, Prisma changes and API tests |
| `tixmo-qa` | QA reviewer | Independent acceptance verification, regression evidence and release-readiness findings |
| `tixmo-release` | Release engineer | Local environments, CI reproducibility, observability and rollback/release evidence |

Each role has dedicated workspace instructions. The active runtime is the
authenticated moosey Codex manager plus native Codex specialist agents. Roles
use the IDs above as kanban identities. Registered per-agent OpenClaw entries
exist but are NOT the active execution route because shared auth inheritance
is broken. Shared knowledge lives in the repository and board, not private
conversations. PM explicitly delegates native specialists with fork_turns none,
including role instructions and exact task context. Workers report to PM and
do not recursively form teams or change schedules.

Only PM orchestrates concurrent assignments. Maximum two concurrent execution
tasks initially, one per specialist. A review counts toward this limit when
it uses shared test services. One database-mutating test owner at a time.
PM must check current active/claimed tasks before dispatch and never flood
busy sessions with duplicate work. Work continues in short, bounded turns;
the next PM tick recovers incomplete handoffs.

Code review must not be by the author. QA checks acceptance and regression
evidence; lead checks architecture/contracts. PM resolves sequencing and
requires both when changes touch payments, authorization or migrations.
Release engineer prepares release candidates but cannot self-approve launch.
