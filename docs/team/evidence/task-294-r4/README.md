# Task294 R4: settled capture correction (no product change)

Product `4ec8594850eb547dafc145a14bb1b85cdeaa235c` unchanged; preserves R1/R2/R3
source/evidence. R3 functional PASS independently reproduced by QA296; its
visual evidence was PARTIAL: expiry05 blank,02/02b/03 transition-dim. This
supersedes only screenshot timing, not historical facts or broader acceptance.

Run `bash docs/team/evidence/task-294-r4/runtime.sh` from task294 worktree
with temporary matching task235 API/tdash dependency-cache links. New owned
0700 disk runtime/task294-r4, env-i PG18/RedisDB1/API/Vite/task288 Chromium
launcher/profile. Retains all R3 real App/API/ownership/recovery/financial
assertions and API method/path/status audit, inert Stripe+notifications/logger
boundaries. Only test/harness entrypoint, capture helper, artifacts added.

Each screenshot waits for document.fonts.ready, then at most60x100ms polls:

- State-specific visible landmark(s), expected current page text, positive
  layout dimensions and no hidden/display-none ancestor.
- Every landmark ancestor computed opacity >=.95.
- No running finite Web Animations (infinite activity indicators excluded).
- Fonts loaded and same rounded landmark layout for four successive polls.

Expiry05 specifically requires visible email input and exact actual
`Sign in to check your order. Payment has not been verified.` prompt. Private
content disappearance alone cannot qualify it.03 requires B identity and both
empty lists;02 requires visible auth controls;06 requires confirmed status/link;
01/07 require QR image landmark. No disabling UI animation/style, no product
changes, no assertion removal. capture-states.json records measured conditions
for all eight frames. Capture readiness is bounded, not a fixed blind sleep.

Retained flow: actual A password login/wallet/QR, SQL-revocation401+refresh401
clear, UI relogin, B isolation/reload, signedout validUUIDreturn+anonymous401,
AUIlogin exactsafePAID/SUCCEEDEDprojection, actualreturn401/relogin preservesURL,
confirmedwalletlink -> Aownedwallet/PNGQR. Only auth POST allowed; no financial
mutation requests. Same local PAID order/counts and stub methods uncalled;
not zero DB writes. No synthetic auth/ownership responses.

Limits: seeded paid fixture, not actual purchase/payment/provider confirmation,
inbox/receipt delivery, lostcredential, elapsed expiry, process restart,
production/staging/device/scannability/contrast/accessibility certification.
External browser requests blocked; application-level not kernel isolation.
Full W05/provider/inbox/lostcredentials/launch NO-GO; exactSHA independent review
required. Command-local missing Husky shim bypass remains documented in R1,
no persistent config change. Log trailing whitespace normalized for diff check.

Initial bounded attempt stopped02 because helper incorrectly expected the
sign-in-mode submit text while actual default BuyerAuthPanel is New buyer /
Create buyer account. Real UI had visible input/opacity1/fontsloaded. Retained
initial-browser failure and cleanup. Narrow correction expects actual wallet
sign-in-to-view prompt plus New buyer label; no UI mode/assertion modification.

The next attempt functionally PASS23.306s and met DOM/font/layout/opacity checks.
Combined image-tool presentation appeared to show05 blank and06 partial, prompting
one final bounded compositor precaution (Page.bringToFront, three actual rAF,
--run-all-compositor-stages-before-draw). **Correction after isolated original-
detail viewing and file hashes:**05 is NOT blank;04 and05 are byte-identical
legible auth screens (SHA2569a680b8eb81d2a3e8e5268006f986abc7a1d3a001cf6d9ef03f7b39f15998fd3).
The combined tool display deduplicates repeated images; that placeholder was
misread as a blank artifact. R3 04/05 are also that same hash. No compositor
rendering defect is established. Preserving all attempts, no repeated retries.

Final author result: fresh1/1JestPASS24.221s; all8 measuredcapturestates fontsloaded,
visible expected landmarks, ancestor minOpacity1, no finite animations, stable4.
Personally opened all8 images, then isolated05+06 with original detail to avoid
deduplication ambiguity: expiry auth prompt and confirmation/link fully legible;
02/02b/03 no transition dimness. No accessibility/contrast/scan certification.
Final screenshots and capture-states.json in browser/. Prior evidence immutable.
Cleanup.txt verifies all3attempts PG/Redis/API/browser PIDs and listener ports,
postmaster/socket/profile absent; dependencies unlinked; soleDBreleased.
