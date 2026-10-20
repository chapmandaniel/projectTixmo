# Task177 guarded full-market evidence

2026-10-20; tixmo-release. **Full market gate NOT PASS: exit124 at the150-second deadline during API verification.** Task175 must remain REVIEW; this is failure evidence for independent exact-SHA review, not acceptance or launch approval.

## Exact identity and scope

Isolated branch `tixmo/task-177-full-market`, worktree `/home/daniel/projects/projectTixmo/worktrees/task-177`, exact reviewed aggregate `03491597452a9871ce13e2747615271740338502`; product `11afdfac875c0cf8a8e96781573481ed65dbeb4e`. Independent prior static approval176 evidence `766380ccd360140d4e2aceb1c58c01dd5b505ead`. This commit adds evidence only. Source/assertions/manifests/lockfiles unchanged; identity logs and final Git checks retained. Scanner71 excluded. Release61 and manual readiness gaps remain NO-GO. No merge, deployment, production access, financial action, scheduler, provider or spend action.

## Authorization and guarded execution

Fresh PM task177 note explicitly granted sole disposable database-mutating owner after checking claims/workers/processes. Read role/team guidance, LOCAL_MARKET_READINESS_GATES, task57 native route, task141 helper and current task173 exemplar, verifier and safety code. Existing maintained native binaries/approved lifecycle selected; no new orchestration. Retained helper `task-177-artifacts/runtime.sh` adapts173 paths/labels and bounded verification commands, preserves UID/executable/datadir/direct-child/listener/readiness/target validation and exact bounded cleanup, and additionally calls both owned_identity guards before createdb. Runtime data remains for inspection, never reused implicitly.

Fresh directory `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task177.sXjLfq`, mode0700 UID1000, disk-backed filesystem. Owned PG PID1262456 on127.0.0.1:26505; Redis direct child PID1262469 on127.0.0.1:48341. Explicit newly-created `tixmo_disposable_57` target and Redis/1; unknown inherited URLs never used. SQL identity and safety guard passed before schema mutation. Raw preflight/live identity/runtime logs retained. Unrelated UID70/999 services untouched.

## Actual checks

- `npm ci --prefix tixmoapi2` and `npm ci --prefix tdash`: both exit0; no dependency edits. Logs retained, including audit reports64 API and23 dashboard vulnerabilities; no fixes attempted.
- Prisma migrate deploy: exit0, all27 migrations applied to fresh disposable DB.
- `TIXMO_EXPERIMENTAL_RECOVERY=1 npm run verify:market` under150s timeout: exit124. API build/Prisma generation completed. Gate reached API verification but did not return from suppressed-output Jest before deadline. Gate did NOT reach dashboard/design/build/syntax steps; cannot infer API pass or totals. This distinguishes a deadline failure from a confirmed assertion failure.
- Separately labeled supplementary dashboard tests: exit0,25files164/164tests,12.13s. Supplementary design guard: exit0,1055 tracked baseline violations/no regressions. Supplementary dashboard production build: exit0,7.41s. These do NOT change full-gate exit124.
- Three documented root helper syntax checks: each exit0. Retained runtime helper `bash -n`: exit0.
- Supplementary full API run uses same approved runtime and unchanged standard test command to expose raw child logs; independent from failed gate. Final status and observed partial suite outputs are recorded below. No test/source repair, assertion weakening, retry loop or full-suite pass claim.

## Native-vs-CI and install side effect

Native Node24.21.0/npm11.19.0/PostgreSQL18.6/Redis8.0.5 differ from CI Node20/PostgreSQL14/Redis7. No GitHub Actions run or version-parity claim. Recovery was explicitly enabled locally; CI workflow does not explicitly set that environment flag.

Existing API prepare lifecycle ran `husky install tixmoapi2/.husky` during requested npm ci and rewrote shared `/home/daniel/projects/projectTixmo/main/.git/config` at09:13:24UTC; observed resulting core.hooksPath=`tixmoapi2/.husky`. Prior value was not snapshotted, so a change-versus-idempotent rewrite cannot be determined. Reported promptly to PM; no guessed restoration or further config action. Future installs must inspect/suppress existing lifecycle side effects using supported HUSKY=0 behavior before execution. This limits the no-config-change claim; source/manifests/locks remain preserved.

## Handoff

Independent reviewer must review exact evidence commit and raw logs, confirm source identity and cleanup, and accept failure evidence without closing175. Full API totals and full market pass remain unfulfilled. Deduplicate any diagnostic/repair work through PM; no product repair performed here.

## Final diagnostic and cleanup

Cleanup independently confirmed both owned /proc PIDs absent and both selected TCP listeners absent. Supplementary API stopped early after ~50s via UID/cwd/cmdline-validated owned timeout SIGTERM for PM handoff; exit124; observed PASS suite lines=26, FAIL suite lines=1; final suite/test totals unavailable, not a pass. Runtime cleanup preserved original market exit124.

Observed bounded diagnosis: supplementary `tests/unit/payments.prepare.test.ts` test `successful webhook mismatch protection remains active` FAILS: expected rejection `{statusCode:400}`, received `TypeError: prisma_1.default.$transaction is not a function` at line109. This is an actual supplementary assertion failure, distinct from authoritative full-gate timeout; no repair performed. PM should deduplicate test-mock/contract diagnosis with existing test-contract work rather than assume product defect or weaken assertions. Initial commit attempt failed missing author identity; subsequent commit used command-scoped author/committer environment and command-scoped hooks suppression, not persistent config writes.
