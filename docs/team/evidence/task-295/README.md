# November 9 onsale — Daniel morning evidence handoff

Snapshot: 2026-10-21 UTC. Task #295, documentation only; independent review pending.
**Release remains NO-GO.** Full W01–W12 packages #238–249 remain OPEN, regardless
of their board todo/review state. Reviewed bounded child deliverables are not full
package acceptance. No canceled/duplicate ticket is counted as delivery; no
whole-board “done” count is used as readiness evidence.

## Candidate and authority

- Reviewed LOCAL product candidate: `4ec8594850eb547dafc145a14bb1b85cdeaa235c`,
  branch `tixmo/task-275-local-integration`, base `eee5fa0dc5d097b65fbd5c48881b9dd97f3e1d58`.
  Non-author technical reviewer #277 verified eight replay patch IDs; QA #278
  independently passed 98 API +76 UI +5 DTO tests, typecheck, both builds and
  design guard (926 baseline, no regressions). Focused mocks, not full E2E.
- #275 composes reviewed local product branches, NOT integration into default
  main, PR #58, #235 or #236. Local main at inspection is `2f3a055`.
  No default merge or deployment by this PM/this task. Runtime deployment ID,
  source/image provenance and current staging-version match are unverified.
- #231 retains integration ownership and its separately authorized PR workflow;
  this handoff neither revokes that authorization nor performs integration.
  #237 keeps exact-candidate readiness/freeze gates: freeze Nov4, ready Nov5,
  signed go/no-go Nov6, stability Nov7–8. Dates are targets, not acceptance.
- [Board snapshot](board-snapshot.json) preserves full descriptions and actual
  dated reviewer/PM notes for #231, #237–250, #61/#73 and #260–294. Live board
  remains authoritative: `KANBAN_AGENT=tixmo-lead KANBAN_PROJECT=tixmo kanban show ID`.
  Board UI: http://127.0.0.1:8787 (server-local). [Full commit IDs](commit-index.json)
  resolve every abbreviated evidence/source SHA below.

## Independently reviewed local evidence

Counts below are actual recorded independent runs, NOT reruns by #295 and NOT
additive coverage totals. Unless specified otherwise, API unit persistence,
provider/email transports and UI transport are mocked. Local SQL runs used fresh
scrubbed `env -i`, restrictive disk-backed disposable loopback PostgreSQL18
runtimes with 31 migrations and owned cleanup; Redis/logger/rate-limit test mocks
mean Redis integration/rate-limit behavior was not proven.

| Package / deliverable | Exact reviewed source or harness | Independent acceptance and remaining limits |
| --- | --- | --- |
| W01 #238 windows | `0b4e30d`, base `317754e` | QA252 + nonauthor backend253: 58 mocked API tests; event/ticket intersection [open,close), admission clock after event lock, caps/tenant fences. No browser clock or exact SQL equality proof. |
| W01 #272 API/lock wait | `03db05c`, base `eee5fa0` | Lead273 source + QA274: 6 real PG/loopback HTTP tests, 13.631s; observed pg_stat_activity Lock crossing closing time rejects with no mutation. Redis/payment/tier/staff matrix not qualified. Committed migrate.log whitespace diffcheck exit2 is recorded, not a clean-range claim. |
| W01/W03 combined #279 R2 | `4c85613`, product `4ec8594` | Lead281 source + QA282: fresh31-migration PG/HTTP 7/7,14.239s. Aged120s LATE_PAYMENT generic eligible1/reason-filtered0; duplicate/distinct/direct reconcile/background recovery preserve manual exception, null paymentClosedAt/NONE refund, order/tickets/stock; Stripe uncalled. Not signed-provider ingress/Redis/email/full equality/browser proof. |
| W02 Studio #264 | `825e38d`, base `0b4e30d` | Lead265 + QA266:14 tests each in America/St_Johns,UTC,America/Los_Angeles. Absolute ticket/tier instants and DST repeated milliseconds preserved; authoritative quantityTotal, missing total fails closed, sold/held not submitted. Request mocks/static API inventory contract, not SQL inventory/browser edits. |
| W02 eligibility #268 revised | `eee5fa0`, originalbase `825e38d` | Lead269 + QA270:5 real-method/JSON DTO-to-helper tests with query-aware persistence mock +52 UI +58 API; API tsc. Configured-empty vs unconfigured tiers distinguished by safe boolean; sortOrder/id matches admission, private count removed. R1/R2 earlier supplied-DTO green superseded. No SQL/publicHTTP/real browser clock acceptance. |
| W03 factual docs/reproduction #240 | `db95652`, parent `c2cbd40` | Lead256 + QA257 corrected receipt-resend docs PASS; six independent simulator tests apply unchanged parent test source, NOT new rerun. Mounted actor-scoped PAID-only receipt route does not confirm/pay. Guide describes external full/partial/pending/dispute limits, not refund entitlement. |
| W03 manual policy enforcement #260 | `cc3069f`, base `317754e` | Lead261 + QA262:11 mocked tests; late-paid retains manual exception, no automatic refund/provider/finalization, excludes legacy reasons from recovery. Defensive ingress retained; realSQL corroboration only in #279 above. No commercial/operator/provider acceptance. |
| W04 refund fairness #267 | `afef1d7`, base `cc3069f` | Lead269 + QA270:14 mocked tests incl manual73; first50 poison/healthy51 progress, durable60s cooldown/updatedAt CAS. Reconstructed instance not process restart; query/reconciler mocked. Metadata-write failure can abort batch; no bounded external-call timeout proved. |
| W04 webhook fairness #271 | `f803f11`, base `afef1d7` | Lead273 + QA274:17 mock tests, durable retrieval-error cooldown/status+generation+timestamp CAS, financial73 fences preserved. No SQL/financial exactly-once claim from units. |
| W04 real SQL #291 | `adc81d9`, tested harness `08f96af`, product `4ec8594` | Lead293 source + QA292 fresh PG3/3,6.022s,134 hashes; first50 poison durable cooldown/owner reason, healthy51 PROCESSED/gen1 after reconstructed instance, duplicate no second finish; SQL-aged61s retry; one concurrent claim winner, gen2 takeover/stale finish/effect fence and stale-retrieval CAS. Synthetic unsupported Stripe event/retrieval stub + forbidden notification boundary. NOT elapsed cooldown, process restart, financial fulfillment exactly-once, provider or fullW04. |
| W05 recovery UI #242 | `a187c1f`, base `317754e` | Lead261 + QA262:50 tests across6 files; actual App/Wallet/Axios interceptors with mocked transport, wallet route survives expiry; old QR/account responses fenced. Idle event simulated, not elapsed browser timer; no backend ownership proof. Supersedes9dffc35 route-loss defect. |
| W05 receipt #263 | `10aafd4`, base `317754e` | Lead265 + QA266:17 pure template tests/typecheck; trusted configured HTTPS or exact loopback wallet link, escaping and unsafe URL omission. No embedded QR/session credentials; no delivered inbox evidence. |
| W05 actual App browser #280 final | `6275325`, product `4ec8594` | Lead293 source + QA292 fresh actual CDP App PASS,7 screenshots,5 Node support tests. A wallet/image/dialog,401+refresh401 identity/private clear preserving route,B UI login+real reload isolation,validUUID return reauth PAID/SUCCEEDED walletlink; no financial requests. QR is synthetic marker, APIs/auth identities intercepted fixtures: NOT real API authorization, barcode, receipt/inbox or provider proof. Earlier missing libraries/glyphs/SIGTRAP runs are superseded only for this scoped flow. |
| W08 local restore #276 | `cb95d02`, base `03db05c` | Backend277 source + QA278 fresh pg_dump/new template0 DB/pg_restore single transaction PASS;33 table rowcounts/full fingerprints source/restored/source-after identical;2orders3tickets,stock/USED QR/sessionVersion revocation data preserved. Scanner/payment tables empty; data-shape not API/device/auth exercise. Tiny fixture backup0.077590969s/restore0.117993460s NOT RTO/RPO/SLA. |
| W09 last-ten #284 | `5947e47`, tested harness `4cae9eb`, product `4ec8594` | Lead285 source + QA286 freshPG1/1,6.838s:100 service buyers ->10 reserves90 soldout/no other error;stock0 available10 held0 sold;10 unique orders/tickets,cap/rollback assertions,69 observed lock waiters. Service-only,no HTTP/payment/session capacity SLA. |
| W09 timed pressure #287 | `c0c41a0`, tested harness `4b3dcd8`, product `4ec8594` | QA289 freshPG1/1,65.854s:1800 service attempts60s,900 reserves900 soldout,no other errors;GA1800held/VIP200untouched,900 CAD pending orders1800unique tickets;backlog max2/final0;p50 13.458/p95 24.786/p99 25.577ms. Recorded arrival buckets not guaranteed exact30 each second; not HTTP/Redis/provider/500–1000 sessions/staging capacity SLA. |

Rootless browser infrastructure #283 `68eb4db` (lead285/QA286) and #288
`ed0b8eb` (lead290 evidence `7414d6f`) independently qualified private pinned
package extraction/hash/JS/font rendering/cleanup, without host installs/config.
Final flow above used #288. App proxy/DNS/CDP blocking is NOT kernel isolation.
The independent evidence commits are `f2657ed` (#286), `0e4879c` (#289),
`dbdab76` (#292 browser), `40eca51` (#292 PG) and `c0ea3cf` (#282 R2).
All cited runtime reviewers recorded owned PIDs/listeners/profile/socket cleanup;
#295 did not independently rerun services or claim a fresh cleanup test.

**#294 is doing/in progress at this snapshot, NOT PASS.** Its intended real
mounted-auth/ownership HTTP synthetic A/B/wallet/QR slice cannot yet be counted.

## Evidence locations and portability

These relative links exist in this candidate and survive its integration:
[W01 contract](../../../SALE_WINDOW_CONTRACT.md),
[W03 factual exceptions](../../../W03_REFUND_RECOVERY_EXCEPTIONS.md),
[candidate235 provenance](../task-235-release-integration.md).
The W03 guide records the historical base conflict; #260/#279 above supersede
that conflict in this candidate, not the unresolved commercial/provider limits.

Later harness/evidence branches are NOT ancestors of this product. Do not turn
the following into false relative links or assume they ship after this doc merges.
Use exact SHA via `git show SHA:path` or these existing local absolute paths:

- [Combined SQL R2](/home/daniel/projects/projectTixmo/worktrees/task-279/docs/team/evidence/task-279-combined-local-r2/README.md); source `4c85613`.
- [Actual App history/final flow](/home/daniel/projects/projectTixmo/worktrees/task-280/docs/evidence/task-280/README.md); source `6275325`.
- [Independent App QA](/home/daniel/projects/projectTixmo/worktrees/review-292-browser/docs/evidence/task-292/README.md); source `dbdab76`.
- [SQL recovery](/home/daniel/projects/projectTixmo/worktrees/task-291/docs/team/evidence/task-291-webhook-pg/README.md); source `adc81d9`.
- [Independent SQL QA](/home/daniel/projects/projectTixmo/worktrees/review-292-pg/docs/team/evidence/task-292-pg/README.md); source `40eca51`.
- [Restore](/home/daniel/projects/projectTixmo/worktrees/task-276/docs/team/evidence/task-276-local-restore/README.md); source `cb95d02`.
- [Last-ten race](/home/daniel/projects/projectTixmo/worktrees/task-284/docs/team/evidence/task-284-local-race/README.md); source `5947e47`.
- [Timed pressure](/home/daniel/projects/projectTixmo/worktrees/task-287/docs/team/evidence/task-287-local-pressure/README.md); source `c0c41a0`.
- [Independent pressure QA](/home/daniel/projects/projectTixmo/worktrees/task-289/docs/team/evidence/task-289-independent-qa/README.md); source `0e4879c`.

Earlier #274/#278 exact commands and independent raw logs are retained locally
at `/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-274/README.md` and
`/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-278/QA.md`; board snapshot
preserves their detailed acceptance notes. These runtime paths are not repository
artifacts. No secret/environment values were loaded for this index.

## Remaining acceptance / decision queue

| Gate | Still required; owner/authority source |
| --- | --- |
| W01/W02 #238/#239 | Exact SQL equality/complete lifecycle+pricing/tenant matrix, open physical browser clock skew/boundary behavior, Studio inventory and schedule acceptance beyond mocks, full affected-candidate regression. API remains authoritative; existing holds not close-revalidated. |
| W03/W04 #240/#241 | Real Stripe external full/partial/pending/failed/dispute/cancellation cases, accountable operator exception visibility, actual outage/process-restart and all-queue recovery/financial exactly-once/old idempotency-window acceptance; preserve manual73. |
| W05/W07 #242/#244 | Real test-mode authenticated ownership/QR/recovery, signed webhook retries/amount/currency, purchase/refund matrix and actual buyer inbox receipt link; physical close/reopen/browser and secure lost-credential recovery target. Synthetic App PASS does not replace these. |
| W06 #243 | Reviewed local packet `f82b26c` (lead254/QA252), NOT staging qualified.31 total migrations; plan's five recent is a subset, not migration total;4 added vs0d193a6. Need deployment-bound source/archive/image digest/runtime mapping, candidate/config modes/currency/policyURL parity, current CI and approved exact staging command/window. Known Railway origins/read access already exist: do not re-ask for hosting. |
| W08 #245 | Actual target PostgreSQL version parity, populated representative scanner/payment data, staged upgrade/rollback safety and independently accepted RTO/RPO objectives/rehearsal. Local tiny restore is not launch qualification. |
| W09 #246 | Approved complete HTTP/auth/payment/cache workload,500–1000 sessions,arrival fidelity and staging capacity/recovery thresholds. Local SQL service races/pressure are bounded, not a capacity guarantee. |
| W10 #247 | Reviewed feasibility inventory `d9234ab` (QA255): management/register/log/revoke UI exists; no repository optical scanner client/build identified. Need actual intended client source/build/SHA, gate lead/operator,model/OS,second QR display, approved synthetic dataset/key/connectivity and Oct22 window. External client existence not disproved. Two physical devices sameQR at most one online admission;wrong event/revoked/refund/transfer/reissue/cancel/offline-reconnect;buyer iOS Safari/Android Chrome access. API tests/QR marker not device proof. |
| W11 #248 | Named release/oncall/support/incident/second-approver coverage,actual delivered alert+recovery notifications,pause-sales without cancel preserving paid access/reconciliation. Target monitoring/main protection changes and sends need scoped authority. |
| W12 #249 / G1–G8 | Exact-candidate full verify:market/dependency audit/runtimeSHA/config/evidence freshness plus independent review, signed Nov6 go/no-go. Missing money/stock/access/core evidence means NO-GO; buffer does not waive gates. No cutover/migration/key rotation/live transaction authorization here. |

#250 actual proxy decision **BB250-20261021-LOCAL-ONSALE** authorizes only LOCAL
individual-event/synthetic CAD engineering, conservative verified-ownership
self-service design and refund reproduction/spec/simulators. Existing budget and
financial exposure ZERO. It does not select actual charge/settlement/payout
currency, tax/jurisdiction/entity consent, inclusive/exclusive fees/bearer/payout,
refund eligibility/window/used-transferred/full-partial/fee treatment, cancellation
or dispute obligations/owner. Those commercial facts remain unresolved in #250.
Support-assisted reset/reissue/identity bypass is not approved; actual recovery
owner/coverage/accepted target/identity-verification process remains required.

#73 Daniel-approved policy remains authoritative: no-org ADMIN-only global scope,
no global OWNER expansion,promoter scoped confirm/own-order cancel,late-paid manual
reconciliation with NO automatic financial refund. #61 and BB61-STAGING-ONLY
retain provenance/CI/target command-window and named hardware/gate/support/release/
second-approver gates. Proxy admission is not approval; recorded scoped decisions
cannot waive independent QA, technical acceptance or identity/legal consent.

## #295 verification and handoff

Documentation only. Static checks: resolve commit-index refs; verify Markdown
relative/absolute local links and cross-branch `git show SHA:path` availability;
count31 migration.sql files; `git diff --check`; ensure only task295 docs change.
No DB, services, provider, inherited env secrets, target calls, email, spending,
push, merge or deploy. Exact documentation commit and check outcomes are recorded
on task #295 after commit. Submit review, not done; independent QA must check that
exact documentation SHA before PM closure. Earlier greens remain dated evidence,
not new executions or full launch approval.
