# Independent QA #491 R2 — SCOPED SOURCE/INERT PASS

Reviewed exact candidate `6ab827bff6fdf67283b93f16612106f2217d4dc0`, initial implementation baseline `434bb2fda62ab0d9645896e2020e8a96202ee612`; repair delta versus rejected `913b90d67d88b3b29876ed37de3e56701c8b149d`.
New isolated branch `tixmo/task-491-r2-independent-qa`, worktree `/home/daniel/projects/projectTixmo/worktrees/task-491-r2`.
Original findings report `4459bcd530878600cc765a7cd178bfae82cfb2f9` is immutable and remains accurate for its older candidate. No product files edited. Read new HANDOFF, complete repaired component/helper/ECC diff and both author harness sources before executing. Prior role/team/API/policy contract context retained; no unrelated private memory loaded.

## Findings resolution

1. Prior P2 stale local snapshot/disconnected parent: resolved in source. Component reads `const current = event`, not useState(event). ECC passes existing onUpdate callback, and success passes actual GET-refreshed object to parent. Existing EventManagementDashboard onUpdate(updatedEvent) replaces its eventData when id exists. Same-ID prop updates therefore become displayed state directly. ECC key now includes event id and user id/role. This is source wiring plus inert callback evidence, NOT mounted rendering proof.
2. Prior P2 definitive rejection retry-only lock: resolved in source. All explicit HTTP400/401/403/404/409/422 cases offer local discard/re-entry. Discard itself sends nothing; a new explicit action generates a new key. Transport/408/429/5xx and acknowledged-but-refresh errors retain original UUID/intent/reason. Validity guards suppress stale success and failure. No automatic mutation or implicit resumption introduced.
3. Prior bounded lifecycle gap: source cleanup and event/user identity checks now suppress completion after unmount or newer object snapshots. Effect resets busy/inFlight on newer snapshots without changing the retained ambiguous request. Fresh extracted-body interleaving proved old completion cannot unlock a newer retry or propagate its snapshot. No actual React lifecycle/concurrent renderer assurance claimed; latest refs/identity checks were exercised with inert ports only.

No unresolved blocking source defect identified within this bounded assignment. Existing-role authentication/tenant authorization remain server responsibilities, not newly proved by UI tests. API wrapper `.data` envelope/route role equality verified in original review and unaffected by repair. Original strict checkout error-code handling/eligibility, existing pending/payment/wallet separation and no public audit exposure remain unchanged by repair (repair product delta is only ECC, organizer component and helper classifications).

## Fresh independent checks

`node docs/team/evidence/task-491-r2/adversarial.mjs`: exit0, **8 groups** beyond merely rerunning author suites:

1. Every definitive status permits explicit discard; discard is local-only; subsequent explicit submission changes key.
2. Network/408/429/500/503 preserve object identity, trimmed reason and key across retry; no discard.
3. Successful POST followed by GET403 remains acknowledged-but-unrefreshed ambiguity, no current-state success/parent update, stable retry key.
4. Stale rejection suppressed after same-ID event-object replacement, user-object replacement and unmount; cannot expose discard or mutate state.
5. Deterministic two-request interleaving: prop replacement resets busy; overlapping retry keeps same key; older completion cannot unlock newer request or update parent; latest completion succeeds.
6. Concurrent click guard sends only one request under unchanged snapshot.
7. Historical desired pause vs current unpaused response: exact refreshed object propagated and unpaused message, request cleared.
8. Static authoritative-prop, actor key and parent-callback wiring.

Harness uses node fs/assert, data-URL import of import-free pure salesPause helper, and extracted actual submit/effect/discard bodies with inert setter/ref/crypto/API ports. It imports no React/application module, starts no services, and does not fetch anything. Source/import inspection preceded execution.

## Other actual commands

- `node docs/team/evidence/task-490/inert-checks.mjs`: exit0, original 11 assertions rerun at NEW candidate.
- `node docs/team/evidence/task-490/repair-checks.mjs`: exit0, author's repaired-submit/discard suite rerun at NEW candidate. This suite is separately reported, not counted as independent8 groups.
- `git diff --check 434bb2fda62ab0d9645896e2020e8a96202ee612 HEAD`: exit0 before evidence additions, exact candidate.
- `git status --short` and worktree list inspected before creating NEW review checkout; shared main's untracked AGENTS/team files preserved.

## Scope limits / disposition

SCOPED SOURCE/INERT PASS only, not UI/runtime qualification. Compilation, actual React rendering/effects/unmount/StrictMode/concurrent rendering, browser/design/accessibility, mounted auth/tenant/session races, actual DB/concurrency/rollback and paid/pending/wallet/scanner/recovery runtime regressions remain UNVERIFIED. No application/browser/runtime/services/DB/generation/migration/network/install/env/secrets/config/scheduler/provider/production/spend/push/merge/deploy. No product edits or author-task closure. Lead #492 on this exact new SHA remains mandatory; PM alone closes #490. Full #248/#243/launch remain OPEN. Original #491 done-findings history is preserved, with this separate R2 record superseding only the older candidate's acceptance verdict.
