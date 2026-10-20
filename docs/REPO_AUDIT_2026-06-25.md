# Repository Audit — projectTixmo

**Date:** 2026-06-25
**Branch:** `claude/upbeat-pascal-zmi2k5`
**Scope:** `tixmoapi2` (Express / Prisma / TypeScript API) and `tdash` (React / Vite dashboard)

## Method

- Installed dependencies for both packages.
- Ran the dashboard production build, ESLint, and `npm audit` (production deps) on both packages.
- Manual review of the security-sensitive paths: authentication/JWT, CORS, the Stripe payment + webhook flow, and the full ticket lifecycle (order → payment → scan/entry → transfer/cancel).

> **Environment caveat:** the full `tsc` typecheck and the Jest suite could not be executed here because Prisma's engine-binary CDN is blocked by this environment's egress proxy. This is an environment limitation, not a repository defect. ESLint, the dashboard build, and `npm audit` all ran successfully.

## Summary of findings

| # | Severity | Area | Finding |
|---|----------|------|---------|
| 1 | 🔴 Critical | Tickets | Unpaid (`PENDING`) tickets are valid for entry, transfer |
| 2 | 🟠 High | Dependencies | Known-vulnerable packages (multer, nodemailer, js-yaml, form-data) |
| 3 | 🟡 Medium | Tooling | Codebase does not pass its own lint/format gate (6,743 ESLint errors) |
| 4 | 🟡 Medium | Tooling | Deprecated TS compiler options (break in TypeScript 7) |
| 5 | 🟡 Medium | Promo codes | `maxUses` enforcement has a TOCTOU race |
| 6 | 🟢 Low | Config | Order-expiry window mismatch (docs 30 min vs code 15 min) |
| 7 | 🟢 Low | Hygiene | Committed debug scripts that query the DB; `.com`/`.co` domain inconsistency |
| 8 | 🟢 Low | Auth | JWT secret defaults to empty string and only warns outside production |

---

## 1. 🔴 Critical — Unpaid tickets are valid for entry

**Root cause:** Tickets are created with `status: 'VALID'` at order **creation** time, while the order is still `PENDING` / unpaid.

`src/api/orders/service.ts:225`
```ts
ticketsToCreate.push({
  orderId: newOrder.id,
  userId,
  eventId,
  ticketTypeId: item.ticketTypeId,
  pricePaid,
  barcode: secureBarcode,
  status: 'VALID',   // <-- VALID while order.status === 'PENDING'
});
```

The entry/scan paths validate only the **ticket** status and **event** status — never the **order's payment status**:

- **Scanner:** `src/api/scanners/service.ts:386-397`. The ticket fetch at `:351` does not even join `order`.
- **Barcode validation:** `src/api/tickets/service.ts:362-390` (`validateTicket`, used by `checkInTicket`).

The ticket owner can fetch their own ticket's QR/barcode immediately via `getTicketById` (`src/api/tickets/service.ts:92`) regardless of payment status.

**Exploit chain:** create an order → tickets are minted `VALID` → fetch the QR code → scan in at the gate **without ever paying**. The window lasts until the order-expiry job cancels the order (~15 minutes); abandoned and failed-payment orders also remain `PENDING` until expiry.

**Evidence this is an oversight, not intent:** `cancelTicket` already gates on payment status, so the check exists in the codebase — it is just missing from the security-critical entry path:

`src/api/tickets/service.ts:290`
```ts
// Check if order is paid
if (ticketTyped2.order.status !== 'PAID') {
  throw ApiError.badRequest('Can only cancel tickets from paid orders');
}
```

`transferTicket` (`src/api/tickets/service.ts:187`) is likewise missing the check — unpaid tickets can be transferred.

**Recommended fix:**
1. Include `order: { select: { status: true } }` in both `validateTicket` and the scanner's ticket fetch, and reject when `order.status !== 'PAID'`.
2. Preferably, mint tickets as `RESERVED` at order creation and flip them to `VALID` only inside `confirmOrder`, so a single source of truth governs validity.
3. Add the same payment gate to `transferTicket`.

---

## 2. 🟠 High — Known-vulnerable dependencies

`npm audit --omit=dev` results:

**API (`tixmoapi2`)**
- `multer` — **high**, Denial of Service via deeply nested field names / incomplete cleanup of aborted uploads.
- `nodemailer` (≤ 9.0.0) — **high**, message-level `raw` option bypasses `disableFileAccess`/`disableUrlAccess`, enabling arbitrary file read and full-response SSRF.
- `js-yaml` — **moderate**, quadratic-complexity DoS via repeated aliases in merge keys.

**Dashboard (`tdash`)**
- `form-data` (4.0.0–4.0.5) — **high**, CRLF injection via unescaped multipart field/file names.

**Recommended fix:** `npm audit fix` resolves multer, js-yaml, and form-data. `nodemailer` requires the v9 upgrade (`npm audit fix --force`, a breaking change) plus a quick review of the send path.

---

## 3. 🟡 Medium — Codebase does not pass its own lint/format gate

`npm run lint` (ESLint 8, as pinned) reports **6,743 errors** (~5,788 auto-fixable Prettier formatting). The large `@typescript-eslint/no-unsafe-*` counts are inflated by the ungenerated Prisma client (which resolves to `any` in this environment), but the Prettier formatting drift is real and indicates lint/format are not enforced.

**Recommended fix:** run `npm run lint:fix` + `npm run format` once to clear the formatting drift, then wire `lint` and `format:check` into CI so the gate stays green.

---

## 4. 🟡 Medium — Deprecated TypeScript compiler options

`tixmoapi2/tsconfig.json:14,29`
```
error TS5107: Option 'moduleResolution=node10' is deprecated and will stop functioning in TypeScript 7.0.
error TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0.
```

**Recommended fix:** add `"ignoreDeprecations": "6.0"` to silence for now, and plan migration to a modern `moduleResolution` (e.g. `bundler`/`node16`) before upgrading to TypeScript 7.

---

## 5. 🟡 Medium — Promo-code `maxUses` race condition

`maxUses` is validated by a read in `validatePromoCode` (`src/api/promo-codes/service.ts:299`), but the `usesCount` increment inside order creation is not guarded atomically:

`src/api/orders/service.ts:239`
```ts
await tx.promoCode.update({
  where: { id: promoCodeId },
  data: { usesCount: { increment: 1 } },
});
```

Two concurrent orders can both pass the validation read and both increment, exceeding `maxUses` (time-of-check/time-of-use).

**Recommended fix:** make the increment conditional, e.g. `updateMany({ where: { id, OR: [{ maxUses: null }, { usesCount: { lt: maxUses } }] }, data: { usesCount: { increment: 1 } } })` and treat `count !== 1` as "promo exhausted".

---

## 6. 🟢 Low — Order-expiry window mismatch

The expiry job documents a 30-minute window, but order creation sets 15 minutes.

- `src/jobs/order-expiry.job.ts:11` — comment says "30-minute expiry window".
- `src/api/orders/service.ts:192` — `expiresAt: new Date(Date.now() + 15 * 60 * 1000)`.

**Recommended fix:** reconcile the two and source the window from a single config value (e.g. `config.cartExpiryMinutes`).

---

## 7. 🟢 Low — Hygiene

- **Committed debug scripts** at the API root connect to the database and dump users/orgs: `tixmoapi2/check_admin.js`, `check_user.js`, `seed_org.js`, `seed_venue.js`. Move to `scripts/` or delete.
- **Domain inconsistency:** `check_admin.js` references `admin@tixmo.com`, while config defaults to `admin@tixmo.co` (`src/config/environment.ts:8`); `fromEmail` defaults to `noreply@tixmo.com`. The `.com`/`.co` split recurs across the codebase — pick one.

---

## 8. 🟢 Low — JWT secret defaults to empty string

`src/config/environment.ts:60,143-154`
```ts
jwtSecret: process.env.JWT_SECRET || '',
...
if (missingEnvVars.length > 0) {
  if (config.nodeEnv === 'production') {
    throw new Error(...);
  } else {
    console.warn(`WARNING: Missing environment variables: ...`);  // dev/test still boot
  }
}
```

Outside production the server boots with an empty signing secret, so tokens are signed/verifiable with `''`.

**Recommended fix:** fail fast in all non-test environments, or generate an ephemeral random secret for dev rather than defaulting to `''`.

---

## What looks good

- Dashboard production build succeeds cleanly.
- Stripe webhook is correctly wired for raw-body signature verification (`src/app.ts` raw-body middleware scoped to `/api/v1/payments/webhook`).
- Inventory hold at checkout uses an atomic conditional `updateMany` with a `quantityAvailable: { gte }` guard — no oversell window (`src/api/orders/service.ts:165-181`).
- Stripe webhook handling is idempotent (dedupe via `paymentWebhookEvent`) and verifies the payment-intent-to-order match.
- CORS origin trust logic is sound and normalizes origins (`src/utils/clientOrigin.ts`).

## Suggested remediation order

1. **Critical ticket gate** (finding 1) — add the `order.status === 'PAID'` check to the scan/validate/transfer paths.
2. **`npm audit fix`** (finding 2) — low-risk, high-value.
3. Promo-code atomic guard (finding 5) and config reconciliation (findings 6–8).
4. Lint/format cleanup + CI enforcement (finding 3) and TS option migration (finding 4).
