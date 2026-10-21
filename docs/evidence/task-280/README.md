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
