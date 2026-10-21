# Task #251 — local scanner client inventory and Oct 22 feasibility

Inspected 2026-10-21. Product/client source: exact candidate
`317754edc7b43eb8e27b60c5374679330326c575`. Documentation-only branch:
`tixmo/task-251-scanner-feasibility`, isolated worktree `worktrees/task-251`.
This packet is not physical-device evidence, W10/#247 acceptance, or launch approval.

## Verdict

**No runnable admission-scanner client was found in this candidate.** The runnable
React/Vite dashboard includes scanner *management*, not camera capture, QR decoding,
online admission controls, offline ticket storage, or an offline scan upload queue.
Consequently no scanner-client build/version or supported device/OS/browser can be
attested. API integration tests and HTTP smoke calls do not fill this gap.
Oct 22 physical feasibility is **unproven / blocked**, not a promised device pass.

## Source inventory

| Surface | Entry/build | What the source actually supplies |
| --- | --- | --- |
| Dashboard | `tdash/index.html` → `src/index.jsx` → `src/App.jsx`; `npm --prefix tdash run build` | Authenticated `/scanners` route loads `features/ScannersView.jsx`: lists scanners/logs, registration, revocation. No scanning UI. |
| Registration | `features/RegisterScannerModal.jsx` | Current user organization, optional device ID, `POST /scanners/register`; one-time API-key display/copy. Payload does **not** set eventId; a scoped assignment needs deliberate API/admin handling. |
| Buyer QR presentation | `/wallet`, `src/pages/WalletPage.jsx` | Signed-in buyer loads own tickets/orders, shows QR only for VALID ticket + PAID order and refund not PROCESSING. `Show ticket` fetches `/tickets/:id/qr` and renders returned data-URL image. |
| Scanner service | `tixmoapi2/src/api/scanners/{routes,validation,controller,service}.ts` | Auth, sync, scan, offline validation and admin logs endpoints. These are backend contracts, not a device client. |
| Existing smoke | `scripts/external-smoke-evidence.mjs` | HTTP scanner auth/sync only; no optical decode, camera/device operation or offline client. Not executed here. |

Reproducible source searches: `git ls-files '*package.json' '*pubspec*' '*gradle*'
'*xcode*' '*scanner*' '*Scanner*'` identifies root helper, tdash and API package
manifests, no mobile scanner build manifest. Searching tdash for
`getUserMedia|BarcodeDetector|html5-qrcode|zxing|react-native|scanners/(auth|scan|sync|validate)`
finds no matches. This proves absence in the inspected tracked tree, **not** absence
of a separately maintained external app; none was identified or supplied to this run.

## Authentication and paid synthetic QR path

1. An authorized OWNER/ADMIN/MANAGER/PROMOTER user registers a scanner via
   `POST /api/v1/scanners/register` with organizationId and optional eventId/deviceId.
   Keep its returned key solely in approved device storage; do not put it in
   evidence, board comments or chat. Dashboard user bearer tokens are not scanner keys.
2. Device contract: `POST /api/v1/scanners/auth` with `{apiKey}`. This returns scanner
   details, not a new user bearer token. Sync/scan/validate use
   `Authorization: Bearer <scanner API key>` (`sk_scanner_` prefix).
3. A future authorized disposable-local paid synthetic fixture must include the
   exact organization/event, buyer, PAID order and usable ticket, with identifiers
   and source provenance recorded. This run created no data, payment or QR fixture.
   Existing test mocks are not a genuinely paid hardware demonstration.
4. Buyer signs into `/wallet` on a second display and chooses `Show ticket`.
   The API checks ownership and admission state, generates/caches the QR image
   inside a transaction. Encoding is `TICKET:{ticketId}:{barcode}:{eventId}`
   (`tixmoapi2/src/utils/qrcode.ts`); do not construct a different generic URL QR.
5. The intended scanner must optically decode that image and submit
   `POST /api/v1/scanners/scan` with `{qrData, scanType: 'ENTRY'}`; inspect the
   response success/result, not merely HTTP 200. **This client/device step has no
   identified implementation in this candidate.**
6. Offline contract: `GET /api/v1/scanners/sync?eventId=<id>` returns a streamed JSON
   document with `data.tickets` and `data.timestamp`; client must fully consume it,
   persist tickets/sync timestamp safely, make local decisions and queue scans.
   Reconnection upload is `POST /api/v1/scanners/validate` with
   `{scans:[{qrData,scannedAt,scanType,metadata?}]}`. No such local persistence/queue
   implementation was found. Review duplicate/conflict handling on actual hardware;
   two disconnected scanners can both admit the same ticket before reconciliation.

## Reproducible local setup (not target execution authorization)

Node requirement is `>=24.21.0 <25`; inspected runtime Node v24.21.0, npm 11.19.0.
From a separate checkout of the exact source SHA:

```sh
npm --prefix tdash ci --offline --ignore-scripts --no-audit --no-fund
npm --prefix tdash test -- --run src/test/ScannersView.test.jsx src/test/WalletPage.test.jsx
npm --prefix tdash run design:guard
npm --prefix tdash run build
```

Offline install requires a populated npm cache; otherwise dependency retrieval is a
separate prerequisite, not a reason to change the lockfile. No package lifecycle
scripts were run by this install. These commands require no API/database services.
For a subsequently coordinated local dashboard session, `npm --prefix tdash run dev`
uses port 5173, host enabled, `/api` proxy to `http://localhost:3000`; runtime API
base defaults to `/api/v1`. Do not run root `npm run dev` or verification scripts
blindly: they may start services/apply DB schema. No API, DB, Redis, shared service,
Vite server, provider or remote target was started/contacted here. No environment
or runtime configuration was changed. A device on another host needs deliberate
network reachability/configuration; that was not established by a static build.
A camera web client would also require supported secure-origin/camera permission
handling, which cannot be claimed for the present management screen.

## Fresh checks at candidate source

- Offline dependency install above: exit 0, 297 packages; lockfile unchanged.
- Focused Vitest command above: exit 0, **2 files / 33 tests passed**. Mocked UI
  behavior only, not live API, payment completion, camera or hardware proof.
- Design guard: exit 0; 926 tracked baseline violations, **no regressions**;
  baseline not updated.
- Dashboard build: exit 0, 2,136 modules transformed, built in 12.94 seconds;
  generated ScannersView and WalletPage chunks. This is not a scanner-client build.
- Static paths/contracts inspected directly. An initial guessed scanner route
  path under `src/api/v1` did not exist; corrected to `src/api/scanners`, not a
  product failure. No DB-mutating API/integration suite was run.

## Existing #61 prerequisites and bounded next step

Record missing participation on **existing #61**, no duplicate human ask:

- Named physical scanner device (model/OS/camera), actual owner/operator, gate lead,
  Oct 22 availability/window, second QR display, power/network and reconnect plan.
- Identified installable scanner client source/build/SHA and supported device
  matrix, or PM/lead-scoped implementation decision. Dashboard management cannot
  be relabeled as that client. No new app implementation is authorized by this packet.
- Approved exact disposable-local dataset and device/API connectivity, secure
  key-loading process, and authority for scanner auth last-used writes, registration,
  scans and logs. Existing conditional read-only staging approach does not authorize
  these target mutations. Known staging origins already exist; do not repeat the
  stale missing-hosting request. Deployed SHA/window and operation authority remain
  separate gates.
- Independent QA observing valid/duplicate/wrong-event/cancelled/invalid scans,
  offline sync timestamp, disconnect/reconnect upload/conflict handling, revocation
  and replacement, with actual timestamps/results and gate-lead acceptance.

No physical device/operator was supplied or operated. Host filesystem had no
`/dev/video*` entry; USB bus directories alone are not evidence of an attached,
usable or authorized admission device. No remote node/device was contacted.
PM should reconcile the missing scanner client and participant availability for
Oct 22 through existing #61/#247; full #251 physical proof and #247 acceptance stay
open until genuinely demonstrated. #244 and the full W07 matrix remain parent
rehearsal dependencies, not excuses to invent a scanner proof.

#250/#73/#61 controls and release **NO-GO** remain unchanged. Zero financial
exposure; no target calls, secrets, config changes, deployment, push or merge.
Only this task-scoped evidence document is owned/committed. Independent review
must use the final documentation SHA from the #251 handoff and exact source SHA
above; author submission is review, not done.
