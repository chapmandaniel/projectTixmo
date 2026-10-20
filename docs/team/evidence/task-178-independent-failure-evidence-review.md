# Task178 independent static failure-evidence review

2026-10-20, tixmo-qa. **ACCEPT scoped honest failure evidence and actionable repair diagnosis; NOT product approval, full-gate PASS, or task177/175 closure.** No tests, npm, builds, database commands or services were executed by this reviewer.

## Exact identity

Reviewed exact evidence `2890aea6af8f7fc6c693980b6e7a14046f22e45e` in isolated worktree `/home/daniel/projects/projectTixmo/worktrees/review-178`, branch `tixmo/review-178`. Base aggregate `03491597452a9871ce13e2747615271740338502`; product `11afdfac875c0cf8a8e96781573481ed65dbeb4e`. Independent Git diffs against both show no changes outside `docs/team/evidence`; aggregate-to-evidence adds 27 files (report plus 26 artifacts), 823 lines. Product source, assertions, manifests and locks are identical. Main's existing untracked files were preserved.

## Evidence independently inspected

Read task177 report, retained runtime helper, preflight/live identity/runtime/cleanup/source logs, gate log and exit, supplementary raw API failure, install logs/exits, migration and dashboard/design/build/syntax evidence. Full market exit124 at the helper's 150-second timeout occurs after API build and while API verification output is suppressed. No API totals or subsequent full-gate stages are established. The exact suppressed substep is not independently proven by market.log alone: verifier runs schema bootstrap then Jest and buffers both. Do not promote a likely Jest timeout to an independently localized hang or product assertion failure.

Supplementary evidence: npm ci API/dashboard exit0; migration log says27 found and all applied; market API build progressed to API verification, establishing build completion. Dashboard supplementary exit0,25 files/164 tests; design exit0 with1055 existing baseline violations/no regressions; production build exit0. Syntax log records three helper exits0; bash syntax success is reported but has no separate retained artifact. These are recorded author-run checks, not reviewer reruns, and do not override gate124. Native Node24/PG18/Redis8 do not establish CI20/14/7 parity.

Raw supplementary API has exactly26 `PASS ` suite lines and1 `FAIL ` suite line, no final suite/test totals. Its exit124 and diagnostic-bound log document early termination, not a completed suite. Exact failing test: `tests/unit/payments.prepare.test.ts`, `successful webhook mismatch protection remains active`, line109: expected `{statusCode:400}`, got `$transaction is not a function`.

## Narrow repair recommendation (not implemented)

Current unit mock supplies only `prisma.order` and invokes private `handlePaymentSuccess(intent)` without the now-required webhook claim. Source `service.ts:208-224,229-260` requires callback `$transaction`, ordered `$queryRaw` event ownership/generation, live lease and order-lock results, followed by transactional order lookup. Missing transaction is the first failure; adding it alone is insufficient.

One bounded backend fixture-contract repair should supply a valid `{eventId,generation}` claim, callback transaction mock and matching PROCESSING generation/live-lease query responses, and transaction-local `order.findUnique` returning the different stored intent. Reuse the current fenced fixture pattern in `payments.webhook-recovery.test.ts` rather than bypassing `withWebhookFence`. Preserve rejection400 and original no-confirm assertion; additionally mock/assert `confirmOrderInTransaction` not called (the old `confirmOrder` assertion alone is stale), no order mutation and no confirmation email. Keep production mismatch/fence checks unchanged. Compare historical105/109 and66/84 fixture work before editing; those historical fixes are already ancestry, not proof the present fixture is current. PM confirms no open duplicate repair among175/177/178; attach one repair scope to this finding rather than duplicate old tasks.

Separately, plan one fresh PM-granted, sole-owner guarded full-suite run with a budget sufficient for the unchanged full command and cleanup, capturing bounded sanitized diagnostic evidence on failure. Determine whether150 seconds is insufficient versus a real stall from timing/child completion evidence; do not blindly increase limits or claim timeout equals this unit assertion. Preserve verifier suppression/redaction; do not stream potentially sensitive raw child output. Focused fixture verification must precede the full rerun, and both need exact-SHA independent acceptance. No runtime authority is granted here.

## Safeguards, cleanup and config limitation

Helper statically preserves fresh0700 disk-backed runtime, UID/executable/datadir checks, Redis direct-child identity and socket PID, exact loopback listener ownership, explicit disposable target checks before schema mutation, deadlines and bounded identity-checked cleanup. Live/runtime logs substantiate PID1262456 PG/26505 and1262469 Redis/48341. At this review, direct `/proc` checks show both absent; `ss` selection for both ports returns empty. Process inspection shows only pre-existing unrelated UID70 PostgreSQL/UID999 Redis and no owned verifier/Jest service; nothing was stopped or started by reviewer. Logs cannot prove absence of every conceivable unauthorized action, but inspected helper/evidence reveal none beyond disclosed install side effect.

API npm prepare actually ran Husky install; current read-only Git inspection returns `core.hooksPath=tixmoapi2/.husky`. Prior value is unknown, so no claim of successful restoration, intentional value change or pristine config is supportable. No guessed restore was performed. Future dependency installs should use supported HUSKY=0 after inspecting lifecycle, retaining npm ci source/lock parity. This is an operational deviation requiring explicit disclosure, already present, not grounds to hide failed evidence.

## Disposition

No blocking defect in acceptance as honest failure evidence after the localization/count precision above. Full-market readiness remains blocked by incomplete gate/API totals and the reproduced supplementary fixture failure; runtime/CI parity and release61/manual gaps persist. Scanner71 stays excluded. Leave177 and175 REVIEW; this review does not authorize integration, deployment, production mutation or release.
