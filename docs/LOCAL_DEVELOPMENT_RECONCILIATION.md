# Local development reconciliation

The original project folder is the primary checkout:
`/Users/danielchapman/Desktop/Project Tixmo`. Its reviewed development belongs on
`main`; preserved working copies are not a substitute for integration.

## Original working changes

The original branch `codex/tixmo-ai-feature-strategy-2026-10-05` was based on
`2f3a055`. Every one of its 323 Git-status entries was compared with committed
release `f699a53` and consolidated main `3a8d7d5`.

| Entries | Review outcome |
| --- | --- |
| 297 | Exact content already committed on main, including the intended deletions. |
| 21 | Content committed in the release ancestor, then amended by the reviewed payment, access, checkout and verification reconciliation. |
| 5 | Older package manifests/locks and populated signing templates explicitly superseded by current secure configuration. |

The [per-file record](audits/2026-10-20-local-development-reconciliation.json)
contains every path, its original status, disposition and content hashes. No
original source path is left without a disposition. The private recovery backup
is retained for recovery only; it does not contain pending implementation.

The five configuration decisions are:

- Keep dashboard overrides and the resolved `source-map-js` 1.2.2, Vite 6.4.4
  and `follow-redirects` 1.16.1, replacing the older local resolutions.
- Keep API compression 1.8.2, handlebars 4.7.10, `proxy-addr` 2.0.8 and the
  js-yaml override, replacing older dependency selections.
- Keep JWT, refresh and session signing values blank in `.env.example`.
  Local runtime `.env` files remain local configuration.
- Keep the disposable-database pre-push verifier already committed on main.

## Customer-facing development

The customer event on-sale commits through `ffff2b3` and festival increment
`51822e5` are integrated together with the consolidated checkout. The combined
app includes `/e/:slug`, operator links, bounded ticket-selection handoff,
the actual unchanged Tixmo logo, and development-only festival previews with
optional passes and individual event ticket pages.

The storefront is aligned with the live design-system tokens and shared
primitives: event photography, high contrast, direct CTAs and logo breathing
room. Festival fixtures and sample purchases stay in development previews.
The documented festival/pass backend remains proposed work, as requested in
that prototype task; it is not a configured sales capability.

## Checkout completion

After the reviewed integration lands, update the original checkout to main,
install its locked dependencies and run the full market gate from that folder.
Retire the superseded original branch only after the checkout is clean. All
committed development heads must be ancestors of main. No new production
application deployment is part of this reconciliation; production auto-deploy
remains paused for the coordinated account/data rollout.
