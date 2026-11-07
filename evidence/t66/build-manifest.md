# T66 scratch integration manifest

Scratch artifact only. This is not a staging QA pass, not a production deploy, and not a close of T66. DevOps owns any later staging deployment. Restoration to baseline after QA is still pending. Source pull requests stay draft and were not updated.

## Pins

| Role | SHA |
| --- | --- |
| Fixed base | `82905aeb5fd92fcf12be6223d8075d669736ab6d` |
| PR 178 head (frozen at capture) | `77892a409e0416520cc811151732444fa44ea9e0` |
| PR 179 head (frozen at capture) | `968d85ed5d8098e8432754a727dd70717e84eca0` |
| PR 180 head (frozen at capture) | `000e2c7f370e22a92eeaf8c9cfec64f25621f206` |

Captured from the open draft pull requests on 2026-11-07. Each head matched the last-known SHA supplied with the task. Branch: `cursor/t66-combined-staging-scratch-54fb`. The integration build SHA is the commit that contains this file. Read it with `git rev-parse HEAD` on that branch after the commit; do not amend the commit to embed its own hash.

PR 173 / T65 (`e7a4d0449912888427869a6622051d1b20a87478`, CORS allowlist) is not a parent and none of its files are in this diff.

## What was combined

Additive `--no-ff` merges, in order, of the pinned heads onto the fixed base. No rebase, amend, or force-push of published commits.

- PR 178: scanner browser teardown ignores a late `Browser.close` after the Chrome process group has exited, and EventStudio clears notification timers on unmount.
- PR 179: a direct public link to a draft is returned with `ended: false` and `undated: true` (browse list still hides drafts; order creation still refuses a draft). Checkout imports `@stripe/stripe-js/pure` and calls `loadStripe` only when the loaded event is present, the sale is not closed, and a publishable key exists. Ended, undated, draft-as-undated, and missing-event checkout do not load Stripe.js. Open checkout still does.
- PR 180: closed-sale checkout renders the existing `StorefrontBrand` logo in a storefront header, keeps the event name as the only `h1`, and does not change `ClosedSaleNotice` title, body, or link targets.

`CheckoutPage.jsx` auto-merged. Both the pure-loader gate and the closed-sale header are present. `saleClosed` (`ended || undated`) and `closedSaleCopy` cover the same closed states. A draft is closed only because PR 179 forces the undated flag; the header then comes from the same `event && closedSale` branch as any other undated or ended checkout. Open checkout does not render that header and still calls `loadStripe`. No intended behavior was dropped and no side was chosen over the other.

## Conflict resolution

Only `tdash/src/test/CheckoutPage.test.jsx` conflicted.

PR 180 adds a second "My tickets" link in the header, so PR 179's unscoped `getByRole('link', { name: 'My tickets' })` queries are ambiguous. Those queries were replaced with `expectClosedCheckoutChrome()`, which checks the header logo (`/images/tixmo_logo.png`, class `sf-logo`), the Tixmo link to `#event-top`, header "My tickets" to `/wallet`, notice "Back to the event" to `/e/neon-nights`, and notice "My tickets" to `/wallet`. Every `loadStripe` assertion from PR 179 remains: not called for ended, undated, draft-as-undated, and missing event; called with `pk_test_checkout` for open checkout. Open checkout still asserts there is no banner and no Tixmo image. Both draft test names are kept. Exact notice strings are unchanged:

- Ended title: `This event has ended`
- Ended body: `Ticket sales are closed. Tickets you already bought are in My tickets.`
- Undated title: `This event isn't open for sale yet`
- Undated body: `Tickets aren't on sale until the organizer sets a date.`

`closedSaleCopy` still prefers ended over undated when both flags are set. PR 179 sets drafts to undated and not ended, so a past-dated draft stays on the undated notice.

## Migrations

No Prisma schema change. No migration files added or edited. `tixmoapi2/scripts/migration-census.cjs` still reports `MIGRATION_COUNT` 43. No new migration is required for this artifact. Draft handling is a response-time flag in `withEventSaleTiming`, not a stored column.

## Out of scope

No deployment, no merge to `main`, no production or Stripe setting changes, no customer messages, no source-branch updates. Combined staging QA is not claimed here.
