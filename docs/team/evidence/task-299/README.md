# Task 299 — criterion-level acceptance reconciliation

2026-10-21 UTC; source/evidence-only PM decision input. Product/base
`4ec8594850eb547dafc145a14bb1b85cdeaa235c`; isolated branch
`tixmo/task-299-acceptance`. No new application test run is claimed here.
**Release NO-GO; do not equate a package board state with acceptance.**

## Evidence rules and dated sources

[Live-board snapshot](board-snapshot.json) records full package criteria and current
review notes; [project task index](project-task-index.json) is the deduplication
snapshot, not a whole-board readiness count. VERIFIED LOCAL below means the
specific bounded criterion has independent recorded evidence, not every adjacent
criterion. Counts are non-additive, dated executions by the named reviewers,
not fresh executions by task299 and not proof of source compatibility beyond
the exact product/harness tested. Harness branches are not product ancestors.

The task295 handoff remains untouched at commit `0cac3d6`; inspect
`git show 0cac3d6:docs/team/evidence/task-295/README.md`. Its statement that294
was in progress was correct at that snapshot, superseded **only** by294R4 and
reviews296/297 below. Its blanket remaining-auth gap must not be carried forward
as if real A/B ownership, QR, authenticated return and recovery had never run.
Full W05 still has other unmet criteria. The R4 README opening's old blank05
assessment is superseded by its later correction and both independent reviews:
04/05 identical legible auth screens, image-tool deduplication misread, not an
established product rendering defect. Transition screenshots are not a functional
regression. No screenshot here is treated as optical scanning/a11y evidence.

## Criterion matrix

| Package | VERIFIED LOCAL criteria and exact evidence | Still missing; package closure decision |
| --- | --- | --- |
| W01 #238 | Event/ticket half-open intersection, lifecycle restrictions, direct early/late rejection and cap/tenant preservation: source0b4e30d, independent252/253 58 mocked tests. Actual SQL/HTTP early/closed event+ticket, admitted intersection, aggregate cap/buyer isolation, event-lock wait crossing close with no mutation:272/279R2, product4ec8594, independent273/274 and281/282 (6 then7 tests; latter includes manual late-paid). | Exact T−1ms/T/T+1ms SQL admission equality, narrower/empty intersection + lifecycle matrix on current candidate, actual browser-clock-skew rejection still lack current acceptance. Boundary mocks are not actual browser proof; lock-wait proof already exists and should not be rebuilt. Full238 not yet satisfied; local closure is attainable with L1/L2 below, not blocked by commercial inputs. |
| W02 #239 | Studio unchanged event/tier absolute instants, DST and quantityTotal normalization/fail-closed missing inventory:264/825e38d,265/266 14 tests in each St Johns/UTC/Los Angeles. Actual DTO-to-helper contract (query-aware persistence mocks) + open-page eligibility/tier/cap boundary tests:268/eee5fa0,269/270 5 DTO+52 UI+58 API, tsc. | Browser unchanged-edit against real mounted API/SQL with held/sold inventory preserved, no dropped tier schedule, real browser zones/DST and open-page server rejection under skew remain. No claim existing stock reset bug persists; missing proof is end-to-end. L2 can close LOCAL239 if all original local criteria pass independently; provider purchase is not a W02 prerequisite. |
| W03 #240 | Mounted-route/receipt/refund factual runbook corrected db95652,256/257; external full/partial/pending/failed mismatch reproduction six simulators (recorded parent tests, not fresh reread rerun). Manual73 late-paid immediate+recovery enforcement cc3069f:261/262 11 mocks, corroborated SQL279R2 duplicate/distinct/background no automatic refund/stock/fulfillment. | Real processor external full/partial/pending/failed/dispute semantics, commercial cancellation/used/transferred/refund entitlement and accountable operational exception acceptance missing. Simulator is not provider safety or commercial approval. Local factual and manual-policy slices accepted; cannot close whole240 by more mocks or broaden policy. |
| W04 #241 | Refund poison50/healthy51 durable cooldown/CAS:267/afef1d7 14 mocks269/270. Webhook retrieval cooldown:271/f803f11 17 mocks273/274. Actual SQL webhook poison50/healthy51, durable backend-owner reason, claim generation/CAS/stale completion/effect fence:291/adc81d9,293 source +292 fresh3/3 6.022s, product4ec8594; provider returns unsupported synthetic event, no financial handler. | Refund queue persistence/effects with actual SQL; true process crash/restart (reconstructed object is not restart); outages, bounded provider-call behavior and old provider idempotency-window handling/observable accountable exception remain. Existing291 does NOT prove financial exactly-once. L3 closes an explicit local queue/restart slice, not whole241 commercial/provider criterion; old-window ambiguity must fail closed into owned manual exception, not invented retry permission. |
| W05 #242 | Receipt trusted safe wallet URL pure template263/10aafd4 17 tests265/266. Integrated UI expiry/interceptors/account generation242/a187c1f 50 tests261/262. Actual App browser280/6275325 fresh292 PASS (API identities mocked). **Real API+App/password/JWT/SQL session/PNG QR/A-B denial/revocation+reauth/URL-preserving confirmed return/wallet link**294R4/9f2c6f01,297 source +296 fresh1/1 24.091s,8 settled captures; seeded PAID/SUCCEEDED fixture, only auth POST, financial invariants/Stripe uncalled. | Elapsed browser expiry and actual close/reopen context recovery not demonstrated by SQL revocation/reload; mounted receipt/resend local capture is not inbox delivery. Lost-credential self-service/approved support fallback and agreed target remain outside supplied evidence. L4 can close narrowly defined existing-owner local browser continuity/resend behavior; full242 cannot close while receipt/inbox and agreed recovery target remain unproven. Do not rerun A/B baseline as a new gap. |
| W06 #243 | Local provenance/config/migration packet f82b26c,254/252 reviewed. Candidate31 migrations (plan's five recent not total); known Railway origins/read access exist. | Deployment-bound source/archive/image digest/runtimeSHA mapping, mode/currency/policy URL parity, current CI and scoped exact target command/window missing. A local packet is not staging qualification. Reuse61/231; no new hosting/access question. |
| W07 #244 | Local scenario preparation, manual73/source and simulator slices above are inputs only. | Actual Stripe test-mode success/decline/retry/3DS/redirect/refresh/back/repeated-submit/hold-expiry/delayed payment; correlated order/intent/webhook/ticket/receipt/refund IDs and authorized real inbox cohort all absent. 294 seeded PAID is not purchase evidence. Execution needs scoped provider/inbox/staging authority; retain244, no duplicate. |
| W08 #245 | Actual dump/template0 restore cb95d021,277 source +278 fresh:33 table rowcounts/full fingerprints equal,2orders3tickets stock/USED/sessionVersion retained,31 migrations. | PG17/Redis8.2.10 requested parity vs actual PG18 runtime; populated-prior-schema upgrade, representative scanner/payment data (restore tables empty), rotation/session disposition and compatible rollback. Tiny backup0.077590969s/restore0.117993460s not RTO60min/RPO15min qualification or accepted objectives. Local upgrade/parity fixtures remain runnable after DB lane, staged target/restore scope separate. |
| W09 #246 | Last10 race284/5947e47 independent285/286:100 service buyers10 reserves90 soldout,69 lock waiters,stock/rollback; pressure287/c0c41a07 independent289:1800 attempts/60s,900reserve900soldout,no other errors,p95 24.786ms,backlog max2/final0. Actual PG18, real reservation service. | Does not satisfy ramp100/250/500 sessions,200-session30min soak, read/auth/payment/Redis/sameIP/CPU-memory/queue-age workload and all proposed latency/error/paid-ticket/recovery thresholds; stress1000 explicitly not promised. Arrival buckets not exactly30/sec. Local HTTP/synthetic expanded workload can follow W04/W06–08 acceptance; no third-party load. |
| W10 #247 | Feasibility251/d9234ab,QA255 source inventory: management/register/log/revoke UI and paid QR; no repository optical scanner client identified. API/QR image proof is bounded. | Actual intended client/build/SHA, gate owner/operators/devices/Oct22 window from61; two physical device sameQR at most one admission and wrong-event/revoked/refund/transfer/reissue/cancel/outage-reconnect, iOS Safari/Android Chrome buyer access; internal approvals/share/storage acceptance or authorized deferral. External client not disproved; don't invent hardware or authorize feature expansion. |
| W11 #248 | Source/runbook preparation only for target controls. | Local /ready dependency-failure/redaction/liveness/recovery is already active298: **do not duplicate or start DB**. Still named oncall/support/incident/second approver, delivered alert+recovery, calibrated triggers and pause-sales without cancellation preserving paid access/reconciliation. Target monitoring/sends/main protection require scoped authority. |
| W12 #249 | Exact reviewed LOCAL product identified, bounded child evidence indexed. | Current exact-candidate verify:market,dependency audit/full affected regression,runtime/deployment/config/freshness/independent review; W01–11 mandatory G1–G8,freezeNov4/readyNov5/signedNov6. No historical green inheritance. Buffer doesn't waive money/stock/access gates; no cutover/live actions here. |

## Executable local queue — proposals, not new assignments

Deduplication: inspected all project task titles/states (project-task-index.json),
full packages238–250 and294/297/298 notes. No new tickets created. Reuse original
package and child source; PM may create only a missing bounded child after review.
298 is sole current DB owner; all later local DB work serializes after its explicit
cleanup/release. No proposal below authorizes a service in this documentation task.

1. **L1 /238 priority:** extend existing272/279 test file
   `tixmoapi2/tests/integration/orders-sale-windows.local.test.ts`, not a replacement
   harness. Real SQL+mounted HTTP, narrowly controlled Date-only admission clock
   at event AND narrower ticket T−1/T/T+1, null/empty/inverted intersections,
   deleted/unpublished/closed event and caps/tenant negative cases. Preserve real
   timers/locks and report controlled-clock limitations. Each rejection asserts
   order/ticket counts and available/held/sold unchanged; admitted boundary asserts
   exact stock and single reservation. Reuse existing lock-wait case unchanged.
   Independent reviewer must identify controlled equality vs elapsed lock evidence.
2. **L2 /239 plus238 browser clause priority:** reuse280 CDP actual App +294
   mounted authenticated API guard and Studio tests264. Synthetic operator edit
   against actual configuration endpoint with preseeded sold+held inventory;
   unchanged event/tier instant equality and preserved SQL totals/held/sold across
   St Johns/UTC/Los Angeles incl DST, actual published DTO eligibility. Keep page
   open across near-future opening/closing; separately skew only browser Date,
   direct POST before/after must reject on server with no stock mutation. No pay
   intent/provider call; do not confuse a fake timer test with elapsed browser.
   Positive schedule save is local fixture mutation, not publication to a target.
3. **L3 /241 priority afterL1/L2:** extend267 refund fairness with actual SQL rows
   and synthetic provider transport (not Prisma/reconciler mocks),50 poison+healthy51;
   inspect old-idempotency branch first, explicit no-blind-retry expectations and
   owned durable exception if outcome uncertain. Restart an owned child process,
   reconnect to same disposable DB and verify cooldown/owner/generation plus one
   healthy effect; inject bounded local stub timeout/outage, retain manual73 and
   assert no duplicate stock/fulfillment/refund call. Reuse291 webhook cases rather
   than rebuild them. 298 generic dependency faults do not cover financial queue
   durability; coordinate fixture/process faults, never fault another owner's DB.
   This does not resolve actual provider idempotency guarantee or staffing.
4. **L4 /242 priority afterL1/L2:** extend294 settled real-auth browser, close its
   page/context and reopen same owned profile to owned wallet and confirmed URL;
   assert only verified owner/private QR restored and financial requests absent.
   Separate bounded short-lived synthetic token elapsed-expiry case from SQL revoke.
   Mounted PAID receipt/resend with inert local transport capture: safe trusted
   wallet link, denial for B/unpaid, exactly scoped send, no second payment. This
   proves local receipt construction/route behavior, **not** inbox delivery,
   lost credentials or target SLA. Reuse existing A/B/revocation tests unchanged.

Scope correction for PM:238/239 are genuinely closable local engineering packages
once L1/L2 and independent exact-candidate acceptance pass.241/242 combine locally
closable subcriteria with provider/operational/inbox/recovery-target obligations;
close only explicit bounded children unless those original obligations are met or
a recorded scoped decision formally changes package criteria. Do not label full
packages done merely by renaming them LOCAL, nor keep already verified criteria
listed as missing. W03 commercial policy cannot be inferred from current code.

## Authority and verification boundary

250 is now BLOCKED on actual commercial inputs, while recorded scoped
BB250-20261021-LOCAL-ONSALE remains valid for individual-event synthetic CAD,
verified-owner self-service local design and refund specifications/simulators.
It chooses no actual charge/settlement/payout currency,tax/entity/fee/refund or
cancellation terms and supplies no identity/legal consent. ZERO new budget/spend
and ZERO financial exposure.73 manual late-paid NO automatic refund remains;
61 owns participant/device/target-window gates,BB61-STAGING-ONLY is conditional;
231 retains integration/PR ownership. This document grants no merge/deploy/provider/
inbox/production/migration/financial action or support reset/reissue power.

Task299 only reads Git/source/board and writes isolated docs; no DB/services,
env secrets, provider/email/network target/cloud/spend/merge/deploy. Static checks
and exact document SHA are recorded on299; independent QA required, review not
done. New runtime success counts in this task: **zero**. Historical295 preserved.
