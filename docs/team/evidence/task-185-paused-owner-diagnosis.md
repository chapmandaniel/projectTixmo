# Task185: paused-owner fixture contract diagnosis

Author: tixmo-lead. Base/evidence `4e3664d719c301159b40a58a2fc684c4d84ab905`; immutable candidate source `7574eea362ea827c1da85a0bf60002352a355dd1`. Branch `tixmo/task-185-paused-owner-diagnosis`, isolated `worktrees/task-185`. Documentation only: no fixture/product changes, dependency installation, DB, services or runtime reproduction. Independent exact-commit QA is required before closure.

## Evidence and conclusion

Task182 raw `task-182-artifacts/api.log:229-299` records two barrier timeouts (fresh, before-handler) and the before-finish deep-equality failure. Its final complete run was 79 suites (76 pass/3 fail), 493 tests (486 pass/7 fail), exit1, not a process timeout. Independent QA183 approved that evidence at `ebc5c26b096392215bf8f34009857e6b995d74cf`; it did not approve a passing market gate.

The fixture and candidate contracts disagree. These observations do not establish a product recovery defect:

1. `tixmoapi2/tests/integration/payment-paused-owner.baseline.test.ts:32-44`: fresh and before-handler wrap real admission. Line40 requires `result === true` BEFORE resolving `reached`. Current `src/api/payments/service.ts:163-191` returns `{eventId, generation: 1n}` on creation, a newer generation-bearing claim on takeover, or null on rejection, never boolean true. The assertion therefore rejects A before reaching its signal. Lines57-61 immediately absorb A into allSettled, then await an unreachable signal; the outer five-second barrier masks that assertion. Admission is outside handleWebhook's try (service134-139). This source-level control-flow diagnosis explains the two observed timeout paths without claiming a DB deadlock, failed admission or new executed reproduction. A future repair should surface A rejection immediately while still retaining bounded cleanup.
2. Before-finish wraps finish rather than admission, so it reaches the gate without hitting line40. Lines65-70 explicitly age only the fixture lease and await B's complete signed redelivery. Service14 enables recovery; service171-184 admits expired PROCESSING via generation CAS; service198-202 finishes only matching PROCESSING generation. The log269-284 shows expected PROCESSING/gen1 versus actual PROCESSED/gen2 with refreshed processing/terminal timestamps. Line74's whole-snapshot equality is explicitly labelled a baseline observation, not candidate acceptance. It contradicts successful enabled recovery; the diff alone is not proof of all downstream assertions.
3. The test-only `TIXMO_ASSERT_PAUSED_RECOVERY` switch (fixture73/84) is distinct from `TIXMO_EXPERIMENTAL_RECOVERY` used by candidate acceptance harnesses. Setting either flag alone cannot fix line40; using a flag merely to skip equality is not sufficient acceptance. Line78 also JSON.stringifies a snapshot now containing BigInt attemptGeneration, so once earlier failures are repaired this diagnostic would throw. Use the existing local BigInt-to-string replacer pattern from `payment-expired-successor.test.ts:101`; retain native BigInts in assertions, do not patch globals.

## Historical baseline versus candidate acceptance

Tasks141/142 accepted TEST-ONLY historical `e5d2cd57793deb8025a93cef3051c17f182ab6b7`: three default GREEN observations and two deliberate durable recovery REDs/one fresh PASS, no barrier timeout. At that time expired B was skipped and no successor generation existed. The report `task-141-paused-owner-baseline.md` explicitly says baseline observations are not future candidate acceptance. Preserve its historical snapshots/report as historical evidence, not current green criteria.

Task143 subsequently introduced generation-bearing ownership and enabled recovery at product `ed2a02b2f2ec5cafeb7428d47b150b00a25f368e`; board143 records final independent lead172 and freshQA173 plus lead174 evidence acceptance and scoped closure. Its 19-suite/82-test finite139 acceptance did not run this old baseline fixture or establish full-market acceptance. Do not reopen its fulfilled gates merely because an obsolete fixture expectation fails; do not treat its historical focused pass as a new full-suite pass. Current source retains its admission/fence contract (service134-219).

## Minimal future fixture-only repair scope (NOT implemented)

- Preserve all three signed schedules and full durable snapshots, unrelated-buyer/ticket isolation, four-ticket/one-event counts, inventory and email assertions, bounded5s barriers/drain and nested-finally spy restoration. Do not increase deadlines to hide rejection, delete tests or weaken assertions.
- Adapt the admission seam to assert the exact real `{eventId, generation:1n}` claim and return it unchanged. Observe A rejection promptly alongside barrier progress, without unhandled rejections or abandoned promises. Keep real admission/handler calls and fixture-only timestamp expiration outside transactions; no mocked ownership or fabricated affected counts.
- Retain fresh default full-snapshot equality: while live A is paused before handler, B must not claim, increment generation, fulfill, change inventory or email. A then completes generation1 once.
- For expired phases, replace the historical unchanged-B oracle with explicit enabled-candidate phase oracles, not an unchecked mode skip. Before B: gen1 PROCESSING; before-handler target PENDING, inventory6/4/0, zero email; before-finish target PAID/SUCCEEDED, inventory6/2/2, one email. After completed B: gen2 PROCESSED, PAID/SUCCEEDED, inventory6/2/2, one email, unchanged other buyer/tickets, one event. Require valid new processing/terminal timestamps; preserve unchanged business state across before-finish B, and one transition across before-handler B.
- Snapshot after B and again after releasing stale A; assert full durable equality and final generation2, so stale A cannot overwrite successor/business state. This baseline schedule observes B already terminal and is NOT sufficient to prove generation fencing while B PROCESSING. Preserve existing separate real successor tests: `payment-expired-successor.test.ts:60-71,89-109` gates actual B generation2 outside locks; asserts B still PROCESSING, stale A success/failure, exact full snapshot equality and real zero terminal rows before B release (before-handler produces no terminal attempt). Keep separate after-terminal controls, handler-ownership rejection coverage and existing mutation evidence; do not replace these with final-status-only checks or demand a terminal write where the handler fence correctly rejects earlier.
- Make only fixture-local BigInt-safe diagnostic serialization. Preserve historical artifacts unchanged. Future repair must obtain exact-SHA independent review and a fresh sole-owner guarded disposable-runtime PM grant for focused schedules and complete API/full-market rerun. No product/schema/config changes are implied.

## Checks and limitations

Read required role/team docs; inspected board141/142/143/183, source, existing successor suite and actual182 failure log. Existing Jest/deferred/BigInt-replacer patterns already suffice; no custom library needed. Static inspection only, no mock execution, build, Jest or DB rerun claimed. Source identity and diff-whitespace checks are recorded in the board handoff. This diagnosis does not prove repaired fixtures pass, other four failures resolved, current full market readiness, exactly-once external email, or production acceptance.175/177 remain open; release NO-GO.


## Task188 independent QA: APPROVE diagnosis only

Exact reviewed commit `e245579998b81309e3b6ebb1efc9633111b0b421`, versus
`4e3664d719c301159b40a58a2fc684c4d84ab905`, immutable source
`7574eea362ea827c1da85a0bf60002352a355dd1`. Reviewer tixmo-qa; new isolated
`tixmo/review-188` at `worktrees/review-188`. Entire diff is this one diagnosis
file (32 original added lines); no repair implementation. Existing shared-main
untracked AGENTS/docs-team files were inspected and preserved.

Independent static inspection confirms fixture40 checks strict boolean true after
real admission but before reached.resolve. Product beginWebhookEvent returns a
claim object or null, so a successful real claim fails that assertion; handleWebhook
awaits admission outside its try. Immediate allSettled attaches rejection handling
but does not propagate it to the separately awaited reached promise. The 5s timeout
therefore masks the assertion, not evidence of product deadlock. Before-finish uses
a different seam, reaches its barrier, expires A's lease and lets B finish; old
whole-snapshot equality then rejects enabled recovery's generation2/PROCESSED
transition. Read actual182 api.log229-299 corroborates these distinct observations;
this review does not re-execute them or infer all remaining assertions would pass.

Read historical141 report and142/143 board records:141/142's three GREEN baseline
observations plus two deliberate durable recovery REDs/one fresh PASS were test-only,
not enabled-candidate acceptance.143's scoped independent enabled19suite82test
acceptance is historical focused evidence, not current full-market green. The old
baseline was not part of that acceptance. Runtime flags differ: paused-recovery
flag alters old oracle, experimental-recovery flag enables successor test schedules;
neither resolves strict boolean admission mismatch. Product recovery is already true
regardless of its stale disabled comment. BigInt snapshot JSON diagnostic is also a
real latent fixture hazard; local replacer is appropriate, native assertions retained.

Minimal proposed fixture-only repair is technically correct with these explicit
phase obligations: fresh B leaves full snapshot/gen1/business/email unchanged, then
A completes once; expired before-handler starts PENDING/6,4,0/zero email and B
fulfills once; expired before-finish starts PAID/SUCCEEDED/6,2,2/one email and B only
completes recovery without repeating business effects. Both expired paths require
B PROCESSED/gen2, valid new timestamps, unchanged unrelated buyer/tickets/counts,
and full after-B versus after-stale-A durable equality. Claim seam must return real
claim unchanged and race barrier with prompt rejection, retaining bounded drain and
finally spy restoration. No deadline increases, skipped oracle, fabricated ownership
or affected counts are warranted.

Existing payment-expired-successor.test.ts was independently inspected60-109: B is
actually held PROCESSING/gen2 outside locks, stale A success/failure terminal writes
observe real zero-row counts, full snapshots stay equal before B release; before-handler
correctly has no terminal attempt because handler fence rejects first. After-terminal
controls are separate. Diagnosis preserves all of this rather than replacing it with
terminal-only status checks. No new product defect or missing gate inferred.

Checks actually performed: `git diff --stat 4e3664d e245579` one documentation file;
`git diff --exit-code 7574eea362ea827c1da85a0bf60002352a355dd1 -- tixmoapi2/src tixmoapi2/tests tixmoapi2/prisma package.json package-lock.json tixmoapi2/package.json tixmoapi2/package-lock.json` exit0;
`git diff --check` exit0. Review only appends evidence; no fixture/product edits,
Jest/mock/build/DB/services/install/runtime verification performed. Future repair and
fresh guarded sole-owner PM runtime grant/review remain required;175/177 nonpassing,
release NO-GO.188 review complete;185 closure belongs to PM.
