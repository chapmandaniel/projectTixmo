# Independent QA #491 — FINDINGS, not approved

Candidate: `913b90d67d88b3b29876ed37de3e56701c8b149d`.
Base: `434bb2fda62ab0d9645896e2020e8a96202ee612`.
New isolated branch `tixmo/task-491-independent-qa`, worktree `/home/daniel/projects/projectTixmo/worktrees/task-491`. No product edits. Reviewed task491/490 acceptance, 490 HANDOFF/harness, 487 API handoff, 485 contract and actual248 approved policy/audit clarification. Existing React, Axios and dashboard primitives adequate; no custom platform/dependencies introduced.

## Blocking findings for original frontend author

1. **P2 stale organizer snapshot / disconnected parent.** `EventSalesControl.jsx:7` captures props once; there is no prop synchronization. ECC mounts it keyed ONLY by event.id (`EventCommandCenter.jsx:185`) and omits the existing onUpdate callback. `setCurrent(refreshed)` updates only this child while parent eventData remains stale. Same-id prop replacement cannot update displayed state/buttons; remount from a retained parent snapshot loses the child's acknowledged refreshed state. Supply the refreshed event through existing parent callback and define prop/pending-request synchronization so stale refreshes cannot overwrite newer state. This is source evidence; not a claim every current parent refresh path fails: EventManagementDashboard.fetchEvent toggles loading and therefore remounts with fresh data.

2. **P2 no recovery from definitive failure.** `EventSalesControl.jsx:19,25-27,33-35`: every error retains request, permanently disables editing reason and offers ONLY retry of the same request. A definitive validation rejection or 409 SALES_PAUSE_REQUEST_CONFLICT can never succeed with that input/key; reason/intent cannot be corrected without leaving/remounting. Independent extracted submit reproduced immutable lock after conflict and attempts to submit opposite intent. Preserve UUID for ambiguous errors, but distinguish definitive rejection and allow explicit discard/reset/new request without automatic mutation. Denied/conflicted requests correctly do not show success.

## Additional bounded lifecycle gap

`EventSalesControl.jsx:20-27` has no cleanup/generation invalidation; extracted submit calls setCurrent after simulated unmount. This does NOT establish a mounted React cross-event overwrite: key(event.id) separates instances and React ignores updates on unmounted instances. Nevertheless request completion is not explicitly invalidated, and mounted same-id/current-prop vs late-response races are not addressed. Add deterministic stale-response checks alongside the snapshot fix; no runtime assurance claimed.

## Verified source/inert behavior

- Actual extracted normalizeResponse from api.js preserves `.data`; real wrapper shape matches helper, no envelope mismatch. Backend controller successResponse and existing error envelope inspected.
- UI roles exactly match route+service OWNER/ADMIN/MANAGER/PROMOTER; backend authenticate + event and organization checks remain. Client is not tenant authorization proof.
- Explicit boolean intent, trimmed bounded reason, browser UUID and retained identical request across ambiguous retry; single in-flight ref. No blind toggle/lifecycle/stock mutation.
- Helper rejects malformed event/key/desired-state acknowledgement before GET; GET current event follows historical replay. Refresh/denial failures propagate without success. No audit reason/actor/history rendered publicly.
- Checkout matches only errors.code SALES_PAUSED; source diff changes NEW advisory/eligibility only. Existing pending continuation and payment/order code paths unchanged; no automatic new order/payment introduced. Inert deleted/expired event eligibility remains zero for both sales lifecycle states; strict alternate-envelope/error negatives checked. Paid/wallet/expiry/cancel runtime regressions unverified.

## Commands and outcomes

After source/import/script inspection (including API wrapper, helper sources, package scripts, Vitest config/setup):

- `node docs/team/evidence/task-490/inert-checks.mjs`: exit0, author's one suite with 11 assertions; historical/current, same identity retry, denial, refresh failure, malformed ack, envelope, lifecycle/cancel cases. Historical author result was rerun independently.
- `node docs/team/evidence/task-491/adversarial.mjs`: exit0, **7 independent groups**: malformed acknowledgement/no GET; actual extracted wrapper shape/historical replay; strict error negatives; both lifecycle deleted/expiry boundary guards; definitive-conflict lock reproduction; simulated-unmount late setter reproduction; snapshot/callback source evidence. All expected assertions pass, including assertions demonstrating defects. These are NOT seven product acceptance passes.
- `git diff --check 434bb2fda62ab0d9645896e2020e8a96202ee612 HEAD`: exit0 for exact candidate before evidence changes.
- Searches using guessed flattened event routes/controllers initially exited2; corrected actual paths to `tixmoapi2/src/api/events/{routes,controller,service}.ts`. No test failure hidden.

Harness imports node fs/assert and data-URL pure helpers only; extracts normalizeResponse and submit bodies with inert ports. No React/application module imported. No browser/app runtime, services, DB, generation/migration, network/install, env/secrets, configuration/scheduler, providers/production/spend, push/merge/deploy. Compilation/rendering/accessibility/design guard, mounted auth/tenant/session handling, real race/rollback and payment/wallet regressions remain UNVERIFIED. Lead review separate mandatory. #490 closure PM-only; full248/243/launch OPEN.
