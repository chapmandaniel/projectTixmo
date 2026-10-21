# November 9, 2026 onsale delivery plan

Prepared October 21, 2026. All planning dates use America/St_Johns.
Audit baseline: `87bbad00da8ee2e6ddddd2658b743103cf2bc467`.
Authority: Daniel Chapman. Status: proposed execution plan; not launch approval.
Detailed findings: [October 21 audit](audits/2026-10-21-onsale-readiness.md).

**Target: a dependable individual-event ticket onsale on November 9. Current status: NO-GO.**
There are 19 elapsed days / 20 calendar dates including today. Aim to be production-ready November 5, decide go/no-go November 6, and preserve November 7–8 for stability.

The fastest route is to close the gaps in the existing purchase path, keep integration serial, and test a frozen configuration. Do not spend this window expanding the product.

## 1. Planning assumptions

Daniel requested synthetic data for now. These are explicit test assumptions, not customer/event facts or approved commercial terms. The reusable specification is [synthetic-onsale.json](audits/2026-10-21-onsale-evidence/synthetic-onsale.json).

| Item | Synthetic assumption |
| --- | --- |
| Deployment | One operator/business, one public event; existing individual-event checkout |
| Fictional event | “Tixmo Onsale Rehearsal”; December 5, 2026, 20:00 America/St_Johns |
| Onsale | November 9, 2026, 10:00 America/St_Johns = 13:30 UTC |
| Inventory | 2,000 tickets: 1,800 GA and 200 VIP; aggregate per-type cap 4 per order |
| Currency/prices | CAD; GA 50.00 and VIP 90.00 test base prices. Tax/fee treatment remains a business decision. |
| Demand model | 3,000 visits in first 10 minutes, 500 concurrent sessions at peak; stress tier 1,000 sessions |
| Purchase pressure | 30 order attempts/second for 60 seconds, with deliberate sold-out outcomes; separate 100 buyers racing for last 10 tickets |
| Client mix | 70% mobile / 30% desktop; current iOS Safari and Android Chrome represented on physical devices |
| Buyers | Generated .test identities; local mail sink for volume tests; a small authorized real-inbox cohort for delivery evidence |
| Payment mode | Local provider simulation for load/fault injection; separate real Stripe test-mode lifecycle matrix |
| Admission | Start with proven online entry and a rehearsed outage procedure. No promise of offline cross-device duplicate prevention. |

Rehearsals use a controllable test clock/relative schedule, so opening/closing can be tested before November 9. The final real event/time/stock/demand must replace these assumptions by October 30, with any material increase triggering new capacity acceptance.

Newfoundland changes UTC offset between the audit date and November 9. Store named timezones and UTC instants; do not copy today's UTC offset into the onsale configuration.

## 2. Scope control

**Must work:** event creation/publication, venue/artwork, schedule, ticket quantities/prices/caps, account authentication/recovery, checkout/hold expiry, payment confirmation, receipt delivery/resend, wallet/QR, orders/attendees, supported refunds/cancellation, operational monitoring, backup/recovery and admission.

**Keep constrained:** individual-event orders, one currency, general admission/VIP ticket types, one approved refund policy and a small known set of tier configurations. Per-order caps exist; a per-person cumulative cap is a separate policy decision and must not be implied.

**Do not add for this deadline:** festival-pass inventory/entitlements, booking intelligence, Social/ProMo/QuantMo/Marketing Hub, resale, reserved seating, extra payment methods, broad navigation redesign or cosmetic baseline cleanup.

Festival/pass UI is currently a development prototype. If real pass sales become mandatory, replan the deadline and capacity/fulfillment work explicitly; do not route preview passes into the event-order API.

Approvals and asset sharing are in the existing V1 checklist. Validate them as internal workflows, or Daniel records an explicit deferral with owner/date. They must not silently disappear from V1 acceptance.

## 3. First 48 hours

| Order | Action | Concrete exit |
| --- | --- | --- |
| 1 | PM reconciles this plan against existing board claims; nominate release owner and QA reviewer | One launch parent task/evidence index; no duplicate or forced claims; actual availability recorded |
| 2 | Lead/backend and frontend take the scheduled-sale contract together | Agreed event/ticket boundary semantics; failing tests for event-window bypass and unchanged timestamp shift |
| 3 | Release prepares the current candidate/config/upgrade packet | Exact SHA, deployment settings, five-migration inventory, safe test targets, missing provider settings and rollback plan |
| 4 | Daniel resolves currency and refund policy, names support/release decision owners | No invented fee/tax/payout/refund assumptions; deadline for approved policy text |
| 5 | Fix schedule/timezone/count contracts in small reviewed changes | Direct API cannot buy early/late; ticket edit cannot move opening time or reset inventory |
| 6 | Correct refund and paid-order recovery instructions against current code | No instruction to double-refund or invoke unmounted /orders/:id/confirm; list tested exception procedures |

Only two execution tasks at a time, including service-consuming reviews; exactly one shared database-mutating test owner. Until board access is restored, retain local scope/ownership/SHA/evidence for later integration. Do not invent board updates.

## 4. Work packages and acceptance

Estimates are focused engineer/QA workdays, including review, not elapsed duration guarantees. Plan roughly **19–28 total workdays** across at most two concurrent execution lanes, plus Daniel/operator decisions. Validate staffing on day one. Provider verification, policy approval, account recovery choice and scanner-client availability can dominate elapsed time.

| ID / target finish | Proposed owner | Scope and acceptance | Dependency / estimate |
| --- | --- | --- | --- |
| W01 · Oct 23 | Lead + backend; independent QA | Enforce authoritative event/ticket windows at order creation; reject deleted/unpublished/closed and direct early purchases; exact opening/closing boundary tests and no browser-only protection | Start now; 1–1.5 days |
| W02 · Oct 24 | Frontend; lead review | Fix ticket timezone round-trip, preserve schedules in Studio, normalize quantity/sold fields, align checkout/tier eligibility and caps. Test unchanged save in Newfoundland/UTC/another browser zone and open-page boundary changes | W01 contract; 2–3 days |
| W03 · Oct 26 | Backend + lead; Daniel policy decision; independent QA | Align refund policy, UI, code and support. Reproduce external-refund mismatch; provide bounded full/partial external refund, dispute, failed-refund and cancellation exception handling. No double refund, false success or invalid admission | Policy decision Oct 22; 2–3 days |
| W04 · Oct 27 | Backend; QA | Recovery fairness/backoff/exception visibility. At least 50 poison rows plus healthy successor, outage/restart and old idempotency-window cases; healthy work progresses once; no money/stock duplication | Can begin after W01; 1–2 days |
| W05 · Oct 28 | Frontend/backend; QA | Receipt and confirmed-return wallet links; authenticated QR retrieval, resend, session expiry. Secure self-service recovery OR Daniel-approved, identity-checked support-assisted recovery demonstrated within its target | Recovery decision Oct 22; 2–4 days |
| W06 · Oct 26 | Release; lead review | Deploy reviewed candidate to authorized staging; record SHA/build provenance, runtime mode/currency, approved policy URLs, webhook/email/storage/monitor configuration; verify secrets by presence/mode without disclosure | Reviewed integration + approved environment/provider writes; 1–2 days |
| W07 · Oct 29 | QA + backend support | Real Stripe test-mode browser matrix and small authorized inbox cohort; order, PaymentIntent, webhook, ticket and receipt IDs correlate. Verify provider and local states, full refund and exceptions | W01–06 as relevant; first happy path Oct 27; 2 days |
| W08 · Oct 30 | Release + QA | Disposable Postgres 17 / Redis 8.2.10 parity run; populated migration harness; inventory reconciliation and credential/session rotation plan; backup restore and rollback rehearsal with measured timing | W06, schema stable; 1.5–2 days |
| W09 · Nov 2 | QA/release + backend | Load, sell-out races and failure/recovery exercises using the synthetic profile. Same-IP/proxy/rate-limit behavior; event-lock contention; no oversell or duplicate charge/fulfillment. Remediate measured bottlenecks only | W04, W06–08; 2–3 days |
| W10 · Nov 3 | QA + gate lead; frontend support | Actual scanner app/device identified; paid QR scanned on two devices; duplicate/wrong-event/refunded/transferred/revoked rejection; outage/reconnect handling. Mobile/keyboard checkout and buyer recovery. Internal reviewer/share/storage acceptance | Actual hardware/client and current candidate; 1.5–2 days |
| W11 · Nov 4 | Release + on-call owner | Fix readiness/deployment mismatch; delivered alert and recovery notification; payment/receipt/refund backlog monitoring; named support and incident drill; protect main with agreed exact checks after authorization | Current deployed candidate; 1 day |
| W12 · Nov 5–6 | Release + independent QA/lead; Daniel release authority | Exact-candidate final regression; approved production upgrade/cutover, evidence-linked config/smoke; authorized bounded live payment/refund if agreed; final go/no-go packet and signoff | All mandatory gates; 2 days |

Treat estimates as ranges with contingency. Do not stack all roles as simultaneous workers. Backend changes to order/payment/admission contracts integrate serially through the lead. Review payment/auth/migration changes with both lead and QA on the exact commit.

The two working lanes are generally product correctness and release/acceptance. While QA owns disposable services, the other lane can do source edits, documentation and independent static review. CI job-scoped services remain isolated; record which run tested which SHA.

## 5. Calendar

| Date | Outcome due | Decision or evidence |
| --- | --- | --- |
| Oct 21 | Baseline audit and launch scope recorded; identify board owners | This audit, current CI/deployment facts, synthetic assumptions |
| Oct 22 | Schedule contract and reproduction cases; business/recovery decisions | Currency/refund/tax-fee model, support recovery choice, provider access owner |
| Oct 23 | Server sale-window change reviewed | Direct-request boundary tests; no early purchase |
| Oct 24 | Editor/checkout contract fixes reviewed | Timezone/count/cap/tier tests and focused mobile check |
| Oct 25 | Refund workflow and exception handling integrated | Policy/code/runbook agreement; failure reproduction and correction |
| Oct 26 | Current candidate on authorized staging | Deployed SHA plus runtime/provider/policy configuration |
| Oct 27 | First complete real test-mode purchase and refund | Browser → Stripe webhook → paid tickets → inbox → wallet |
| Oct 28 | Recovery fixes and buyer-access flow complete | Poison backlog, lost callback, browser closure and account recovery |
| Oct 29 | Provider matrix complete; migration rehearsal underway | 3DS/decline/late payment/refund exception evidence |
| Oct 30 | Restore/upgrade gate and real event specification | Actual event/time/stock/demand/currency; replace synthetic launch inputs |
| Oct 31 | First production-like capacity run and targeted repairs | Latency, errors, contention, inventory invariant report |
| Nov 1 | Repeat failed cases; internal V1 flows accepted | Reviewer/share/storage; no unrelated feature work |
| Nov 2 | Capacity and recovery candidate accepted | Burst/soak/restart results, reconciliation and rate-limit behavior |
| Nov 3 | Full dress rehearsal on candidate and real devices | Purchase/access/support/admission and pause-sales exercise |
| Nov 4 | Release candidate freeze and cutover packet | Exact SHA, reviews, policy approvals, backup/rollback, alert routing |
| Nov 5 | Authorized production cutover and acceptance | SHA/config/smoke, scoped live proof if authorized, staffed ownership |
| Nov 6 | Firm go/no-go | Daniel signs evidence-linked decision; unresolved money/stock/access blockers mean no-go |
| Nov 7 | Stability buffer | Only launch-blocking fixes with exact-commit re-review; revalidate affected evidence |
| Nov 8 | Final configuration lock and operator walkthrough | Sales schedule, stock, price, policy and escalation contacts cross-checked |
| Nov 9 | Controlled onsale | Run the launch timeline below; no speculative changes |

Miss October 27's purchase proof: stop polish and put both lanes on the failed path.
Miss November 2's capacity/restore proof: hold production promotion and reassess supported volume/scope.
Miss November 5's release acceptance: use the buffer only for bounded correction, never to waive core safeguards.
The date itself is not acceptance.

## 6. Synthetic verification matrix

Run against owned disposable data or an explicitly approved staging environment. Never run destructive helpers against a production or inherited DATABASE_URL. Read the script and verify target ownership before each migration/reset.

| Group | Required cases | Pass evidence |
| --- | --- | --- |
| Schedule | T−1 ms, T, T+1 ms; closing boundary; browser clock skew; ticket window narrower than event; timezone round-trip and DST | Server denies out-of-window orders; approved instant survives every editor |
| Selection | Mixed GA/VIP, repeated ticket IDs, over-cap quantity, no current/inactive-only tier, tier exhausted, reconciliation-required inventory | UI and API agree; no unauthorized fallback price or over-allocation |
| Payment | Success, decline/retry, 3DS/redirect, refresh/back navigation, repeated submit, expired hold, delayed success | Exactly one authoritative payment/fulfillment result; no reused expired reservation |
| Webhooks/recovery | Duplicate and different events for same intent, missing callback, crash after processor commit, stale worker, 51+ record backlog | Healthy records progress; replay converges without duplicate tickets/stock/refunds |
| Refund/cancel | Eligible buyer refund, unauthorized user, used/transferred restriction, pending/failed refund, provider-side full/partial refund, dispute, cancelled event | Policy matches behavior; money/admission/stock remain consistent or enter a visible owned exception |
| Receipt/access | Delivered mail, bounce/delay, resend, close/reopen browser, logout/login, lost credentials | Buyer obtains the correct ticket without a new payment; no cross-account access |
| Admission | Two devices race same QR; wrong event; revoked scanner; transfer/reissue; refunded/cancelled ticket; offline/reconnect | At most one online admission; documented offline conflicts and support decision |
| Operations | Provider outage, API restart, Redis/DB unavailable, disk/storage failure simulation, alert + recovery route, rollback | No lost paid orders; dependencies fail safely; recovery owner receives evidence |
| Upgrade | Empty DB migrations and populated prior-schema upgrade; ambiguous inventory; legacy currency/receipts/credentials | Current code runs without silent data loss; unknown legacy inventory remains blocked until reconciled |

Existing test green is the entry condition, not a replacement for this matrix. Stripe mocks prove local behavior; real test-mode runs prove integration; production live-mode proof requires explicit authorization and a bounded transaction. Inbox and device proof cannot be substituted by fabricated records.

### Proposed capacity targets

These are acceptance targets to validate and adjust before commitment, not benchmark results:

- Ramp 100 → 250 → 500 concurrent browsing/checkout sessions; 30-minute soak at 200.
- Separate 30 order attempts/second burst for 60 seconds. Reset the disposable fixture between scenarios; distinguish expected sell-out/validation responses from platform errors.
- 100 distinct synthetic buyers contend for the last 10 tickets. Exactly 10 units may be reserved/sold in total; failed/expired attempts release only their own holds.
- Stress 1,000 sessions to identify failure behavior and a safe operating envelope. Do not promise this capacity unless it passes.
- Target public read p95 ≤500 ms and local order/reservation p95 ≤2 seconds at the accepted load, excluding external payment challenge time; unexpected 5xx <0.5%.
- Zero oversells, duplicate financial effects, duplicate fulfillment or unaccounted inventory transitions. Correctness has no allowed error budget.
- Target paid-to-ticket p95 ≤30 seconds when providers are healthy; alert on any paid order without fulfillment after 2 minutes. Recovery after restored dependency should converge within 5 minutes for the tested backlog.
- Target receipt delivery to authorized test inboxes within 2 minutes; separate provider acceptance, delivery and spam placement.
- Exercise many buyers behind one public IP; current auth limit is 20 attempts/minute/IP in production config. Measure whether launch traffic shares limits before changing them.
- Record DB lock waits/connections, API CPU/memory, Redis use, event loop and payment queue age. Production API/database regions differ in the observed topology; measure the resulting latency before deciding whether a topology change is needed.

Use controlled local processor/email simulators for bulk load. Keep real Stripe test-mode and inbox testing small and authorized. Do not load-test third parties or production as part of the default synthetic exercise.

## 7. Release and go/no-go gates

Each evidence item records: environment, exact Git SHA, deployment ID, timestamp, owner, independent reviewer, commands/scenario, outcome, artifact link and limitations. A fix invalidates affected earlier evidence.

| Gate | GO requires |
| --- | --- |
| G1 · Core correctness | Reviewed W01–05; no open P1 money, stock, schedule, auth or ticket-access defect |
| G2 · Candidate | Exact SHA passes `npm run verify:market`; current dependency audit; deployed API/dashboard identity matches; Postgres/Redis version parity acceptance |
| G3 · Purchase | Real test-mode checkout/3DS/decline/refund and recovery matrix; buyer can retrieve ticket; correct runtime Stripe mode, currency and approved policy URLs |
| G4 · Data | Current backup, tested non-production restore, populated migration/reconciliation acceptance; rollback owner + second approver; rotation disposition |
| G5 · Capacity | W09 targets passed at agreed real demand or lower supported volume explicitly accepted; no correctness failures |
| G6 · Operations | Scheduled readiness passes; delivered alert/recovery notification; payment/refund/receipt backlog owner; support and scanner/device procedure rehearsed |
| G7 · Business/release | Final event/time/stock/prices, refund/cancellation and fee/tax treatment approved; policy publication approved; production action explicitly authorized |
| G8 · Final acceptance | November 6 signed decision with scope exceptions and remaining nonblocking issues; independent QA/lead evidence on exact candidate |

Keep admission proof before onsale under the current V1 checklist. If the event is much later and Daniel chooses a separate doors-readiness milestone, explicitly record that scope change, gate lead and deadline; API existence alone does not justify selling unsupported admission.

The current strict evidence command must pass with real, release-specific artifacts, but is not sufficient by itself: it does not enforce freshness or SHA/environment identity and does not cover the full financial/capacity matrix. Never mark a template “pass” simply to clear the checker.

### Recovery targets and rollback

Proposed rehearsal targets: restore a usable recovery environment within 60 minutes; backup/PITR loss window no more than 15 minutes; reconcile every processor-paid transaction across that window before reopening sales. These are targets until measured and approved.

Rehearse a safe **pause new sales** procedure that preserves already-paid tickets, pending payment reconciliation and support access. Do not use event cancellation as a generic pause button: cancellation invalidates admission. Test the exact supported ticket-sales controls before relying on them.

For a bad application release, pause new sales and return only to a schema-compatible known-good build. After customer writes, restore to a separate recovery DB and reconcile post-backup payments/orders; never blindly overwrite production with an older backup. Keep Stripe/order/ticket identifiers and incident timestamps.

## 8. November 9 operating timeline

Relative to the confirmed onsale time; the synthetic example is 10:00 NST.

| Time | Action / owner |
| --- | --- |
| T−24 h | Release/QA: verify unchanged SHA and final inventory/schedule/policies; confirm backups, monitors, staff coverage and provider account state |
| T−90 min | Release owner: health/readiness, database/Redis, webhook and mail configuration, error/backlog dashboards; identify incident commander and second approver |
| T−60 min | QA + operator: logged-out public journey, login/access, correct prices/currency, opening countdown and sale boundary. No unauthorized production transaction |
| T−30 min | Lock event/ticket settings; support and release staff ready; verify pause-sales procedure and communication draft |
| T−5 min | Independent second-person check of authoritative onsale instant, ticket quantities and domain; owner confirms GO |
| T | Observe first real orders and provider callbacks; compare money, orders, tickets and remaining inventory |
| T+5 / +15 / +30 / +60 min | Check conversion errors, 5xx/latency, auth limits, paid-but-unfulfilled orders, receipts and support queue; reconcile samples and aggregate inventory |
| T+2 h | Reconcile paid/refunded/held/expired counts; hand off remaining exceptions with owners |
| End of day | Financial/order/inventory comparison, incident log and next-day owner; preserve immutable evidence |

Pause sales immediately for overselling, duplicate financial effects, unauthorized access or confirmed inventory corruption. Proposed operational pause triggers: checkout unexpected 5xx >1% for 5 minutes, sustained order p95 >3 seconds for 5 minutes, or an unexplained paid-but-unfulfilled backlog older than 5 minutes. Calibrate these during the rehearsal; ordinary declines and honest sell-out responses are not outages.

During a pause, preserve pending webhook processing, wallet/support access and evidence. Customer messaging, live refunds and infrastructure actions follow Daniel's authorized scope and named incident ownership.

## 9. Decisions and deadlines

Synthetic data lets engineering proceed now. These are future decision deadlines, not questions blocking this audit.

| By | Daniel / operator decision |
| --- | --- |
| Oct 22 | Confirm individual-event-only scope; currency; inclusive tax/fee/payout responsibility; immediate eligible full refund vs organizer approval; cancellation exceptions; self-service vs support-assisted account recovery |
| Oct 22 | Name release decision-maker, support lead, incident commander, gate/device owner and second approver; confirm their availability |
| Oct 24 | Approve final policy text and publication destinations; identify authorized provider/test-inbox access and approve concrete staging/provider setup |
| Oct 30 | Supply real event(s), timezone/opening instant, total capacity, types/prices/caps and expected burst; revise synthetic targets if needed |
| Nov 3 | Accept tested capacity/outage/support procedure and any explicit V1 deferrals |
| Nov 4–5 | Review concrete deployment/migration/backup/rotation packet and authorize scoped production changes; separately approve any live payment/refund proof |
| Nov 6 | GO / NO-GO for the exact release and scope |

Under [AGENTS.md](../AGENTS.md), production deployment/migration/data changes, live payments/refunds, public publishing and customer messaging require explicit authorization. Audit, local documentation, isolated fixes, tests and independent review are authorized. CPM means commit, push and merge, but has not been requested here. Since the repository is public, this plan is prepared locally without pushing or opening a public PR.

## 10. Daily delivery discipline

- PM maintains one launch parent with W01–W12 mapped to existing tasks, exact owners, dependencies and next verification. Two execution tasks maximum; one shared DB test owner.
- Start each work period with failed gates and blockers. Prioritize the next demonstrable purchase/recovery outcome, not the number of tickets closed.
- Integration passes through the lead; authors do not approve their own changes. Payments/auth/migrations require QA and lead review on the exact commit.
- End each day with a compact record: shipped-to-branch SHA, reviewed SHA, deployed SHA, passed/failed gates, remaining blocker, owner and next deadline. “Done” never silently means deployed.
- Freeze feature scope now and candidate behavior November 4. After freeze, only launch-blocking repairs; recheck affected evidence.
- If a required decision is unavailable, block only dependent work and continue safe local tasks. Reuse the existing task/decision rather than creating duplicates.
- If a gate is missed, narrow the supported configuration or move the sale under Daniel's explicit decision. An alternative provider would be a separate authorized commercial plan, not an automatic integration.

## Handoff

This plan completes the requested audit and planning task; implementation packages remain proposed. It does not create or change a scheduler, start an ongoing monitoring commitment, or claim team assignments. Local review/commit details are recorded in the accompanying integration handoff.
