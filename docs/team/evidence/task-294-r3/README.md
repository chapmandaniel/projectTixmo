# Task294 R3: actual checkout-return recovery -> owned wallet

Product `4ec8594850eb547dafc145a14bb1b85cdeaa235c` unchanged. Prior API checkpoint
a48f0ee and browser R2 82a1d24 evidence/source preserved. New test and browser
entrypoint append narrow actual-return assertions, reusing R2/CDP support and
reviewed task288 local font runtime. No product changes.

## Reproduce

From task294 worktree, temporarily symlink matching-lock task235 dependency
caches at tixmoapi2/node_modules and tdash/node_modules, then:

```
bash docs/team/evidence/task-294-r3/runtime.sh
```

Own env-i loopback PG18/RedisDB1/clientoptionsasserted/API/Vite; envFile=false;
Vite proxy only exact owned API origin; new 0700 disk task294-r3 runtime/profile.
Existing synthetic password-hash A/B and seeded PAID/SUCCEEDED SOLD ticket.
Real mounted app/middleware/password/JWT/SQL session/ownership/QR, no fabricated
API responses. Logger/inert Stripe constructor and notificationService remain
only documented mocks; external browser requests blocked by CDP plus qualified
launcher proxy/DNS guards, not kernel network isolation.

## New assertions, retaining all R2 assertions

1. After actual B reload isolation, browser test clears localStorage and enters
   `/checkout/:actualFixtureSlug?orderId=:actualUUID&redirect_status=succeeded`.
   Actual RecoveryPage shows sign-in/payment-not-verified and retains UUID.
   Source intentionally skips API recovery until signed in; an explicit same-
   browser anonymous GET probe separately proves real recovery401.
2. Actual A BuyerAuthPanel password sign-in produces actual RecoveryPage GET
   and confirmed status. Additional same-browser authenticated GET asserts
   HTTP200 and exact data `{id:fixtureUUID,status:'PAID',paymentStatus:'SUCCEEDED'}`.
   Actual RecoveryPage also independently requires exactly those three keys.
3. SQL sessionVersion fixture revocation, then actual `Check status again`,
   drives real RecoveryPage401 and real refresh401, removes stored identity,
   retains candidate URL, and presents real UI reauthentication. A UI sign-in
   restores actual server-confirmed status and visible wallet link.
4. Actual link delivers `/wallet` with same A order; Show ticket renders real
   PNG QR. Audit requires recovery401/200 and forbids all POST except login/
   refresh. Request blockers also forbid unlisted mutations before forwarding.
5. Parent API assertions retain A/B direct ownership, wrong-password401,
   signed expired-JWT401 and financial invariant: same PAID order row and
   ticket/paymentAttempt/paymentRefund counts, all stub provider methods uncalled.
   Not zero DB writes: login lastLogin, QR cache, sessionVersion fixture writes.

## Boundaries

This is read-only return recovery from a directly seeded paid fixture, NOT a
purchase/payment/Stripe confirmation, inbox receipt, lost-credential recovery,
process restart, actual elapsed token expiry, production/staging/device or
scannability certification. UI session expiry means actual middleware rejects
SQL-revoked credentials; signed expired JWT independently tested via API.
No provider/email/network spend/host config/deploy/merge/publication.
Independent QA and technical review exact new harness SHA required; full W05
inbox/lost-credentials/provider/launch remains NO-GO.

Author result: fresh Jest1/1 PASS18.876s; actual browser sequence passed first
attempt, eight screenshots and request/status audit browser/result.json.
Personally opened06 confirmation/link and07 delivered-wallet PNG QR: legible
actual status and linked owned wallet; no responsive/a11y/scannability claim.
Cleanup.txt independently confirms PG2709617/Redis2709630/API2709717/browser2710055
stopped/absent; ports29976/53524/36545/43007 no listeners; postmaster/socket and
profile gone; dependency links removed. Sole DB released. NODE/browser helper
exit awaited. Log trailing whitespace normalized only for Git diff check.
Command-local missing Husky shim bypass remains as documented in prior task294
checkpoint; no persistent Git/host configuration change. Syntax and diff checks
plus actual fresh acceptance run used. Pending independent exact-SHA review.
