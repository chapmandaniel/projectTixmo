# T142: task @mention comments did not create a notification row

Repo `chapmandaniel/projectTixmo`. Times are NST (America/St_Johns, UTC−3:30).
Work was done in a throwaway clone at `/tmp/t142-projectTixmo` on the box, starting from `main` `a702a4a025244d4cfcc087298a720a943f177eab` (the SHA QA used in T140).
No merge, no deploy, no staging or branch-protection changes, no force-push.

## Executive summary

- T140 write-smoke on staging (`a702a4a`) posted a first-name `@Qat140mnt` mention in a task description and a comment. After 1.5s, `GET /notifications` as that teammate returned `total=0`. QA recorded this as a coverage gap, not a proven product defect, because `processMentions` was async and swallowed errors.
- This is a real bug, not a timing miss. The mention regex treated the next word as a last name whenever any word followed the mention. `QA T140 comment @Qat140mnt please see this.` was looked up as firstName `Qat140mnt` + lastName `please`, which matched no org user, so no notification row was written.
- Fix: parse a following token as a last name only when it is capitalized (the dashboard inserts `@First Last `), and fall back to a first-name-only lookup when a first+last query matches nobody. Comment and task-create responses now await mention processing so a 201 means the rows exist, but mention failures are still caught and logged and do not fail the already-written comment or task.
- Errors are logged with `taskId`, `commentId`, `organizationId`, `actorUserId`, `source`, and the stack, instead of a bare `Failed to process comment mentions` / `Error in processMentions` with no context.
- Draft PR opened; required checks documented below. Never merge without Daniel.

## Root cause

`TaskService.processMentions` (`tixmoapi2/src/api/tasks/service.ts` at `a702a4a`) used:

```text
/@([a-zA-Z0-9]+)(?:\s([a-zA-Z0-9]+))?/g
```

The second group is optional in the regex, but it is always captured when a word follows the mention. That is the opposite of the comment in the same function, which claimed `@Daniel` and `@Daniel Chapman` should both work.

T140's exact comment body (`evidence/t140/staging-write-smoke.py` and `evidence/t140/staging-smoke.md`):

```text
QA T140 comment @Qat140mnt please see this.
```

Parse before the fix: `{ firstName: "Qat140mnt", lastName: "please" }`.
The Prisma query required both, scoped to the org, excluding the comment author. No row matched. `createNotification` was never called. Waiting 1.5s (or polling) could not surface a row that was never written.

The existing T117 HTTP test passed because it used the dashboard form `@Sam Lee please confirm radios`, which does have a real last name as the next token.

## Other path findings (not the T140 miss)

- Mentions are written as `Notification` rows (`type: TASK_MENTION`) via `notificationApiService.createNotification` → `prisma.notification.create`. They are not event-only / in-memory.
- Self-mentions are skipped with `id: { not: actorUserId }`. That is intended.
- User lookup is organization-scoped, not team-membership-scoped. A same-org teammate can be mentioned; a user in another org cannot. The existing HTTP test already covers the foreign-org case.
- The product does not parse handles, emails, or user ids. `CreateTaskModal` / `TaskDetailsModal` insert `@First Last` or `@First ` when `lastName` is missing. No change was made to those formats.
- `createTask` and `addComment` fired `processMentions` without `await`, with `.catch` that logged the error and no ids. `processMentions` also wrapped the whole body in try/catch, logged `Error in processMentions` with no context, and swallowed the error so the fire-and-forget promise resolved successfully. That hid failures, but it is not why T140's row was missing: the function returned normally after matching zero users.

## Await decision

The comment (and task-create) response now awaits `processMentions`.

Mention processing is a same-org name lookup plus one notification insert per match. That is cheap compared with the cost of a client or QA poll, and the comment/task row is already committed before this work starts. Awaiting it makes a 201 a real guarantee that the notification row exists, which is what T140 was checking. Failures are still caught at the call site: a mention/notification error is logged with context and does not change the 201 for the already-saved comment or task.

Fire-and-forget would still be racy under load even with the parser fix. The old HTTP test had to poll for up to 1s for that reason.

## Tests

- Unit: `tixmoapi2/tests/unit/task-mentions.test.ts` covers `@Qat140mnt please see this.`, `@Sam Lee please confirm radios`, first-name-only, multiple mentions, and the capitalized-word fallback (`@Sam Please confirm` with no last-name match).
- HTTP regression: `writes a TASK_MENTION notification row for a first-name @mention followed by sentence text` posts `@Sam please see this.` and asserts the API list and the `Notification` row immediately after the comment 201 (no poll). The older `@Sam Lee` test is kept and now matches on `metadata.taskId`.

Local (disposable loopback Postgres `tixmo_disposable_t142` on `127.0.0.1:55432`, Redis `/1`):

- `npx tsc --noEmit` passed
- ESLint on the changed files passed
- `npx jest --runInBand tests/unit/task-mentions.test.ts tests/integration/tasks.http.test.ts` — 15 passed, 15 total (2 suites)

A full local `verify:api` was not used as the gate: `order-confirm-expiry.race.test.ts` failed in this box environment on unchanged order code (reservation stayed `PENDING` instead of `CANCELLED`), which is outside T142. Required CI (`local-gates`, `configured-image-restore`) is the suite proof.

## SHAs and PR

| Ref | SHA | Notes |
| --- | --- | --- |
| `main` (T140 / this branch base) | `a702a4a025244d4cfcc087298a720a943f177eab` | unchanged |
| T142 head | (filled after push) | branch `fix/t142-mention-notifications` |

PR: (filled after open). Draft only. Do not merge without Daniel. No staging/prod deploy.

## CI

(filled after required checks complete)
