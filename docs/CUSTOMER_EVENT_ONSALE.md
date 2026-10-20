# Customer event on-sale interface

Scope: a customer event detail and ticket-selection surface, built locally in
the dedicated `tixmo-event-onsale` worktree on
`codex/customer-event-onsale-2026-10-20`. Base: consolidation commit `281d61d`.
The main working checkout and the consolidation worktree are not modified.
Implementation ownership: this Codex chat; changes are limited to `tdash` and
this handoff. The local kanban CLI is unavailable. Integration remains pending;
carry this record and the exact reviewed implementation SHA into the integration
PR when this branch is submitted.

## Review locally

```sh
npm --prefix tdash ci
npm --prefix tdash run dev -- --host 127.0.0.1 --port 5187 --strictPort
```

- Sample design: `http://127.0.0.1:5187/preview/event-onsale`.
- Real event: `/e/<published-event-slug>`, using the configured API URL.
- Organizer entry: **Event page** in the event command center, enabled for
  published, on-sale, and sold-out events.
- `/preview/event-onsale` is development-only. Its sample event cannot place
  orders or open a real checkout. Sample event, venue, address and availability
  are fictional design fixtures.

## Behavior and contracts

The page loads `GET /events/public/:slug` without authentication or caching.
It uses the event's `images.main`, description, organization, venue, timezone,
ticket types and tier schedules. Missing artwork has a text-first fallback;
missing events and network failures have an explicit retry state. The event
stays open after session expiration or logout in another tab.

The public storefront has its own scoped design system in
`StorefrontPrimitives.jsx` and `storefront.css`; the organizer entry uses the
existing `DashboardButton`. Existing dashboard styling is not replaced.

Quantities respect published inventory, per-order caps, current tier capacity,
sales windows, and unavailable states. Time boundaries update while the page
is open. Selection is advisory: no inventory is reserved here. Prices use
the configured checkout currency; the final payable amount comes from checkout.
No unverified low-stock notices, policy claims, age restrictions or accessibility
promises are displayed.

Checkout receives only ticket IDs and quantities in a `tickets` query parameter.
It reloads current ticket data and clamps those quantities. Existing order,
authentication, payment and reservation APIs remain responsible for purchase.
Payment processing and API code are unchanged.

The public API currently returns only active pricing tiers; it cannot distinguish
a ticket with no tier schedule from a schedule containing only inactive tiers.
That pre-existing contract limitation remains: the order API rejects a purchase
without a current tier. Before launch, expose an explicit schedule-presence field
if inactive-only tier schedules are supported in the operator workflow.

## Verification

2026-10-20, Node 24.21.0:

- `npm --prefix tdash test -- --run`: 33 files, 219 tests passed.
- `npm --prefix tdash run design:guard`: passed, 926 existing baseline entries,
  no new violations and no baseline changes.
- `npm --prefix tdash run build`: passed; preview component excluded from
  production JavaScript.
- Browser: desktop 1440px and mobile 390px layouts visually inspected;
  quantity selection, sample checkout boundary and mobile CTA focus checked.
- Screenshots: local `output/playwright/event-onsale-desktop.png` and
  `output/playwright/event-onsale-mobile.png` (not source deliverables).

No production deployment, real inventory reservation or payment acceptance was
performed. End-to-end purchase acceptance against a disposable API environment
and production release approval remain separate launch work.

## Preview artwork provenance

Built-in image-generation tool, generated and inspected for this task.
Project asset: `tdash/public/images/event-onsale-preview.jpg` (1536 × 1024).
It is used only by the development sample. Published events use their exact
configured artwork. Original PNG remains under the Codex generated-images folder.

Final prompt:

> Use case: photorealistic-natural. Asset type: wide website event hero photograph
> for a clearly labeled fictional sample event. Create an editorial concert
> photograph from behind an audience at a small premium indoor electronic music
> venue at night. Silhouettes of people in foreground, hands raised, a small DJ on
> stage in distance, vivid magenta and warm pink spotlights slicing through
> theatrical haze. Dark inky plum shadows. Authentic live music atmosphere,
> natural photographic grain, candid 35mm photography. Landscape 1536x1024
> composition, stage and strongest lights in upper right and center, calm dark
> left third to support a headline overlay. No text, logos, signage, UI,
> watermarks, or frames.
