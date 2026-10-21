# Task 280: browser delivery preparation — BLOCKED, not browser PASS

Candidate: `4ec8594850eb547dafc145a14bb1b85cdeaa235c`.
Branch/worktree: `tixmo/task-280-browser-delivery`, `/home/daniel/projects/projectTixmo/worktrees/task-280`.

## Actual attempt and prerequisite

2026-10-21: cached Chromium was present, but launching the actual browser exited **127** before DevTools or a page was available. `ldd` confirmed missing runtime libraries in both cached Chromium versions; cached headless shell also lacks required libraries. No rendered browser checks ran and **no screenshots exist**. No install, package download or configuration change was attempted.

Command attempted:

```sh
TIXMO_BROWSER_PATH=/home/daniel/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome node scripts/browser/task-280-delivery.mjs
```

Missing Chromium-1243 libraries: `libatk-1.0.so.0`, `libatk-bridge-2.0.so.0`, `libcups.so.2`, `libasound.so.2`, `libgbm.so.1`, `libcairo.so.2`, `libpango-1.0.so.0`, `libXcomposite.so.1`, `libXdamage.so.1`, `libXfixes.so.3`, `libXrandr.so.2`, `libatspi.so.0`.

Recovery condition: an existing local Chromium executable with its runtime libraries resolved, or separately authorized environment repair by the environment owner. Rerun this harness and independently review actual results before claiming browser acceptance.

## Prepared harness (not executed past browser startup)

`scripts/browser/task-280-delivery.mjs` uses Node's built-in WebSocket/CDP and existing tdash Vite dependencies, not a new browser-testing dependency. It launches the real App on loopback with an ephemeral frontend port and no proxy or env files. API requests are intercepted and fulfilled synthetically; external requests are blocked. No API/DB service is started; no backend ports used. The synthetic identities use `example.invalid`; no provider, email, real credentials, identity, receipt, payment or financial operation is used.

Intended assertions: buyer A wallet + QR + transfer dialog; actual Axios 401 and refresh failure; clearing A's tokens/private rendered state while retaining `/wallet`; signing in B through actual BuyerAuthPanel and checking A is absent; checkout return expiry retaining order URL; signing back in A, server-confirmed synthetic PAID status, then following actual wallet link. Audit records synthetic request authorization and blocked external origins, never real tokens. Screenshots/result are written only after those browser steps actually run.

The initial attempt stopped its browser (exit 127), closed its frontend server, removed its temporary browser profile; `ss -ltn '( sport = :5173 )'` showed no listener. Vite treats port zero as its default 5173, so preparation was corrected to reserve an OS-assigned ephemeral port before launch; this correction is syntax-checked but not runtime-browser-verified.

Existing dependencies were reused via an untracked local `tdash/node_modules` symlink to task-235's installed dependencies. No lockfile/package changes. QA should verify against the exact reviewed candidate's lockfile-compatible dependencies when executing acceptance.

## Scope limitations

This preparation is not a browser PASS, backend ownership proof, account recovery approval, full W05 inbox/receipt proof or production acceptance. Existing #250 ownership boundaries remain; no reset/reissue was attempted. Real API/disposable DB execution remains solely release #279's lane. Production remains NO-GO. Independent QA is required.

## Available checks actually run

- `node --check scripts/browser/task-280-delivery.mjs`: exit 0 (syntax only).
- `npm --prefix tdash test -- --run src/test/AppCheckoutReturn.test.jsx src/test/AppWalletSession.test.jsx src/test/api-session-races.test.js src/test/WalletPage.test.jsx src/test/CheckoutPage.test.jsx`: exit 0, **5 files / 53 tests passed**, 2.77 seconds. These remain component/unit tests, not browser acceptance.
- `git diff --check`: exit 0 before commit.

## Review correction (supersedes initial preparation)

Lead #281 / QA #282 correctly rejected the initial fixture: `synthetic-order` could not pass the product UUID guard, and `/orders/:id` with a full order was not the actual return contract. Revised harness uses UUID `00000000-0000-4000-8000-000000000280`, `/orders/:uuid/recovery`, and exactly `{id,status,paymentStatus}` with PAID/SUCCEEDED. Product RecoveryPage UUID guard, endpoint expression and exact response keys are checked directly from candidate source in Node self-tests; no product validation was changed.

The harness positively waits for the transfer dialog, asserts B's stored identity and both empty orders/tickets, and requires actual authenticated recovery requests before and after expiry. API method/route allowlist rejects unintended calls (only synthetic login/refresh POSTs and listed read GETs). Actual auth login and wallet routes were inspected against `auth.js` and `WalletPage.jsx`. CDP calls/connect/discovery have deadlines and pending calls reject on close/error. Owned-child shutdown escalates TERM to KILL within bounds, then verifies PID absence; cleanup independently attempts frontend closure, listener refusal verification and profile removal even when an earlier cleanup step fails. Future runs save `cleanup.json`, including error-path cleanup proof. Page Fetch external-request blocking is **not** a host/browser-wide network sandbox; no such guarantee is claimed.

Checks run after corrections:

- `node --test scripts/browser/task-280-support.test.mjs`: **5 passed**, zero failed. Includes actual loopback listener close/refusal, real stubborn owned-child TERM/KILL/PID verification, CDP lost response/late response/close rejection, source-derived recovery contract validation, and cleanup failure continuing profile removal.
- `node --check scripts/browser/task-280-delivery.mjs`: exit 0.
- `git diff --check`: exit 0.

No Chromium launch retry, installs, downloads, DB/API runtime, provider or email occurred. Rendered interactions/screenshots remain **unverified**, not PASS. Initial 53 component tests are historical evidence on unchanged product base, not a new rendered check or re-run. Independent #281/#282 rereview remains required.

## Actual App attempt with reviewed #283 runtime — partial only, NOT PASS

After PM accepted #283 (`68eb4db523c4054001104c27cb2a0725bfc84906`, independent lead/QA reviewed), executed:

```sh
TIXMO_BROWSER_PATH=/home/daniel/projects/projectTixmo/worktrees/task-283/scripts/runtime/task-283-chromium node scripts/browser/task-280-delivery.mjs
```

Actual runtime reaches App/Vite. First attempt timed out checking `innerText`: no text glyphs rendered; screenshot `initial-wallet-no-glyphs.png` records blank text with styled layout. Narrow harness correction changes text checks to DOM `textContent` (not a claim glyphs are visually readable), adds persistent browser stderr and failure audit/DOM diagnostics. A subsequent diagnostic attempt preserves fatal cause; no product files changed.

**Partial actual assertions reached:** A wallet DOM contains synthetic order; Show ticket triggers authenticated intercepted QR request and admission image exists; Transfer opens positively asserted accessible dialog; screenshot `01-a-wallet-qr-transfer.png` captured. Clicking Refresh drives actual orders/tickets 401s and actual `/auth/refresh` POST with synthetic failure; then browser crashes **SIGTRAP** with `FATAL:third_party/skia/src/ports/SkFontMgr_FontConfigInterface.cpp:163 Not implemented.` Fontconfig default configuration was unavailable. No remaining session-clearing/B-login/return/confirmed-link assertions completed. No result.json/PASS produced.

`browser-stderr.log`, `browser-run.log`, `failure.json` and `cleanup.json` describe the final diagnostic run. Earlier no-glyph screenshot is explicitly from the initial attempt; it is not a final-run screenshot. External font/Stripe renderer requests were intercepted/blocked; only synthetic API requests were fulfilled. Application-level dead-proxy/DNS and CDP blocking remain **not kernel isolation**. Font/raster quality is not accepted.

Final actual cleanup verified browser PID **2663622** absent after SIGTRAP; owned frontend port **37845** connection refused; temporary profile removed. Prior actual attempts also executed independent cleanup (ports36415,36819,43261). Listener9 was checked absent before the final attempts. No backend/DB/real provider/email/API, host repair, downloaded asset, spend, merge or deployment occurred.

Runtime recovery prerequisite is now **usable local font/fontconfig rendering**, not missing ELF dependencies: environment/runtime owner must qualify the text-input/session-recovery rendering path. No further runtime repair or browser retries attempted by frontend. Keep full #280 browser acceptance open and obtain independent exact-SHA source/evidence review. Existing #283 minimal JS qualification is not contradicted; it did not qualify this font-dependent App interaction.

## Completed actual App run with reviewed #288 font runtime

**Supersedes the runtime blockers above for this scoped synthetic flow only.** PM accepted the independently reviewed #288 font/runtime launcher before this run. Product remains exactly `4ec8594850eb547dafc145a14bb1b85cdeaa235c`; only browser harness/evidence changed.

```sh
TIXMO_BROWSER_PATH=/home/daniel/projects/projectTixmo/worktrees/task-288/scripts/runtime/task-288-chromium node scripts/browser/task-280-delivery.mjs
```

Final command **exit 0**; output and complete evidence live in `font-runtime-run/`, separate from historical failed attempts. Actual App/React/Axios rendered browser assertions completed:

1. Buyer A authenticated wallet displays synthetic private order; Show ticket retrieves synthetic admission image; Transfer positively opens dialog. Screenshot `01-a-wallet-qr-transfer.png`.
2. Actual wallet requests receive synthetic401; actual Axios interceptor POSTs `/auth/refresh` and receives401. App retains `/wallet`, removes access token, refresh token and stored user, and clears A's order, admission image and dialog. Screenshot `02-wallet-expired-cleared.png`.
3. Actual BuyerAuthPanel login stores buyer B and loads B-authenticated empty orders/tickets, without A's order. Screenshot `03-b-wallet-isolated.png`. A real page reload (new performance.timeOrigin) preserves B's empty wallet, with no A order/QR/dialog: `03b-b-wallet-reloaded.png`.
4. Synthetic expired A credentials are deliberately reseeded solely to enter checkout return. Actual `/orders/00000000-0000-4000-8000-000000000280/recovery` receives401 and refresh fails; URL retains candidate orderId, auth panel is shown and token cleared: `04-return-expired-preserved.png`.
5. Actual buyer login reauthenticates A; read-only recovery projection `{id,status,paymentStatus}` returns PAID/SUCCEEDED; App shows confirmed status and wallet link: `05-confirmed-wallet-link.png`.
6. Following that actual link delivers `/wallet` and A's synthetic order: `06-delivered-wallet.png`.

`result.json` records exact product SHA, absolute launcher and complete method/path/synthetic-authorization/status audit. It shows401 and200 recovery, two actual synthetic login POSTs, B-authenticated wallet requests across reload, and zero unexpected fixtures. API allowlist permits only login/refresh POST and listed read GETs; no create-intent, purchase, transfer submit, receipt, refund or other financial/backend operation was called. Fonts.googleapis.com and Stripe.js renderer requests were deliberately intercepted/blocked; expected Stripe.js load-error console messages are not real provider communication. Nonfatal GPU sandbox warning remains; no Fontconfig fatal/SIGTRAP in final run. Application proxy/DNS/CDP blocking is still not kernel isolation.

Final `cleanup.json`: owned browser PID **2679333** absent (intentional stop exit143); frontend listener **36019** refused; profile removed. Additional `ps -p 2679333` produced no PID and `ss -ltn '( sport = :36019 )'` showed no listener. Port9 was checked absent before run. No DB/backend started; #291's independent DB lane untouched.

Screenshots01 and05 were opened and visually inspected: actual text/QR marker/status/link are legible (unlike historical no-glyph files). This is narrow visual evidence at the captured viewport, not responsive/a11y/real-provider/real-QR scanning certification. Fonts are qualified local fallback fonts, not remotely downloaded production fonts.

The first font-runtime App attempt reached B login but revealed a harness polling race: `document.body` is briefly null during actual reload. `font-runtime-reload-race/` retains its failure and cleanup (PID2678789/port34671); polling was narrowly null-guarded. One subsequent syntax check caught quoting in diagnostics before a browser launched, corrected immediately. Final complete run above passed. Five Node support selftests, harness syntax, and diff checks were rerun after fixes. No product changes, host configuration/install/download, real identity/provider/email, spend, merge or deployment.

**Author result: scoped synthetic rendered browser PASS, pending independent exact-SHA QA/review.** This does not close full W05 inbox/real backend ownership recovery, provider checkout/receipt delivery, production acceptance or launch NO-GO. Existing #250 authority boundaries remain unchanged; no reset/reissue.
