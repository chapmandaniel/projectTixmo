# Review Portal to Assets Consolidation Plan

## Fit Judgment

Partially aligned.

The opportunity is strong: reviewers are judging files, revisions, comments, and final-use readiness, so the workflow belongs closer to the asset library than in a separate top-level "Review Portal" module. The current implementation already points that way because approved approval assets are surfaced inside the asset library after `approvedForLibraryAt` is set. The risk is treating this as a simple removal. The review system owns external reviewer tokens, decisions, comments, revision history, reminders, and notification email behavior; those capabilities should be preserved and surfaced through Assets, not deleted.

Relevant Tixmo cues:

- Keep the dashboard high-contrast, premium, and event-driven.
- Keep CTAs direct and operational: "Request review", "Approve asset", "Share folder", "Download selected".
- Extend `tdash/src/components/dashboard/DashboardPrimitives.jsx` and `tdash/src/lib/dashboardTheme.js` instead of adding one-off surfaces.
- Preserve clean module hierarchy. Assets should become the creative workspace; approvals should become a lifecycle state inside that workspace.

## Current Implementation Map

### Dashboard routes and navigation

- `tdash/src/App.jsx` routes `/assets` to `AssetLibraryView`, `/approvals` to `ApprovalsDashboard`, `/review/*` to `ExternalReviewPage`, and `/assets/shared/:token` to `SharedAssetFolderPage`.
- `tdash/src/layouts/DashboardLayout.jsx` exposes separate top-level nav items for `Assets` and `Review Portal`, and polls pending approvals for the Review Portal badge.
- `tdash/src/features/DashboardHome.jsx` exposes separate dashboard cards for `Asset Library` and `Review Portal`.
- `tdash/src/lib/dashboardTruth.js` includes `assets` and `approvals` as separate default favorites.

### Asset library

- `tdash/src/features/AssetLibraryView.jsx` loads direct library assets from `GET /assets` and approval-origin assets from `GET /approvals?limit=100&includeArchived=true`.
- Direct uploads go to `POST /assets` and become `AssetLibraryAsset` records.
- Approved approval assets are only shown after an `ApprovalAsset` receives `approvedForLibraryAt`.
- Folder creation, movement, deletion, and read-only folder share links are owned by the `/assets` API.
- `tdash/src/pages/SharedAssetFolderPage.jsx` provides the unauthenticated read-only folder-share experience at `/assets/shared/:token`.

### Review portal

- `tdash/src/features/ApprovalsDashboard.jsx` owns the internal approvals gallery, creation modal, deep-linked detail view, archive/delete actions, and "add approved images to asset library".
- `tdash/src/features/ApprovalDetailView.jsx` owns internal detail review: revisions, asset preview, comments, reviewer management, reviewer decisions, and revision upload.
- `tdash/src/pages/ExternalReviewPage.jsx` owns the unauthenticated reviewer experience at `/review/:token`.
- `tixmoapi2/src/api/review/routes.ts` exposes public token routes for review fetch, decisions, comments, reviewer adds, and comment deletion.
- `tixmoapi2/src/api/approvals/service.ts` owns reviewer token generation, deadline expiry, reviewer interaction tracking, revision lifecycle, comments, decisions, reminders, notification emails, and approval status recalculation.

### Data model

- `ApprovalRequest`, `ApprovalRevision`, `ApprovalAsset`, `ApprovalReviewer`, `ApprovalReviewDecision`, `ApprovalComment`, and `ApprovalReminder` are a dedicated approval workflow graph.
- `AssetLibraryAsset`, `AssetLibraryFolder`, `AssetLibraryFolderShare`, and `AssetLibraryFolderShareFolder` are a dedicated library/share graph.
- The current bridge is `ApprovalAsset.approvedForLibraryAt` plus `approvedForLibraryById`; no `AssetLibraryAsset` row is created when an approval asset is promoted.

## UX Diagnosis

### What works

- Assets already feels like the right parent destination: it has folders, search, type filters, direct uploads, bulk download, selection state, and folder sharing.
- Review already behaves like a media review flow: title, event, due date, revisions, reviewer roster, decisions, comments, and downloadable asset files.
- Public review and public folder sharing are both token-based, unauthenticated, and visually related enough to converge into one external "asset package" family.

### What feels fragmented

- Users must choose between "Assets" and "Review Portal" before knowing whether an item is a draft, in review, approved, or shared.
- Approved approval assets appear in Assets, but pending review assets are hidden behind another module.
- "Share folder" and "send for review" are split even though both are external asset handoff actions.
- Approvals duplicate asset browsing and preview behavior instead of feeling like an asset detail mode.
- The Review Portal naming is system-centric. "Review" is an action/state; "Assets" is the object users are managing.

### Visual and system drift

- `ApprovalsDashboard.jsx`, `ApprovalDetailView.jsx`, and `ExternalReviewPage.jsx` still include many raw dashboard hex classes and local panel constants.
- `AssetLibraryView.jsx` uses more shared primitives but still contains a large amount of local UX logic.
- The consolidation should include a design-system pass, especially for tabs, status chips, asset cards, preview panels, review sidebars, and token-page shells.

## Product Decision

Make Assets the creative workspace and remove Review Portal as a separate top-level internal module.

Do not remove the review domain, review API, or external `/review/:token` experience in the first pass. Instead, embed review workflows inside Assets:

- Assets top-level route remains `/assets`.
- Internal approvals move into `/assets?tab=reviews`, `/assets/reviews`, or an in-page `Reviews` tab.
- Existing `/approvals` deep links redirect to the new Assets review tab/detail route for compatibility.
- Existing `/review/:token` links remain valid because email links and reviewer tokens depend on them.
- Public folder shares remain `/assets/shared/:token`.

Recommended internal information architecture:

- `Assets / Library`: direct uploads, approved files, folders, search, share links.
- `Assets / In Review`: active review requests, pending decisions, changes requested, overdue, awaiting promotion.
- `Assets / Requests`: create/request review flow, draft/revision upload, reviewer management.
- `Assets / Shared`: active folder shares and external handoff history.

This keeps review as an asset lifecycle, not a separate destination.

## Target User Flows

### Internal operator: request review

1. Open `Assets`.
2. Choose `Request review`.
3. Pick existing library files or upload new files.
4. Choose event, title, deadline, reviewers, and instructions.
5. Submit; reviewers receive existing `/review/:token` links.
6. New request appears in `Assets / In Review`.

Key improvement: the user does not leave the creative workspace to start a review.

### Internal operator: manage active review

1. Open `Assets / In Review`.
2. Select an asset/review card.
3. Detail drawer/page shows preview, versions, reviewer status, decisions, comments, and revision upload.
4. If approved, show `Add to library` or `Mark ready in library`.
5. If changes requested, show `Upload revision`.

Key improvement: review work is a stateful detail mode of an asset package.

### External reviewer

1. Open email link at `/review/:token`.
2. Review the asset package, switch versions, comment, approve/request changes/decline.
3. Optionally add another reviewer if allowed.

Key improvement: existing token links keep working. Later, this page can be renamed visually to "Asset Review" without breaking the URL.

### External read-only recipient

1. Open `/assets/shared/:token`.
2. Browse folders and download approved assets.

Key improvement: share links stay read-only and separate from decision-making review links.

## Data Architecture Recommendation

### Near-term: preserve both tables, normalize presentation

Use a unified frontend item model while keeping backend models intact:

```ts
type CreativeAssetItem =
  | { source: 'library'; assetLibraryAssetId: string; reviewState: 'none' }
  | { source: 'approval'; approvalAssetId: string; approvalId: string; reviewState: 'in_review' | 'changes_requested' | 'approved' | 'declined' };
```

This matches current behavior and avoids a risky migration before the UX is proven.

### Mid-term: add explicit library linkage

Add optional linkage so promoted approval assets can become first-class library assets without losing review provenance:

- `AssetLibraryAsset.approvalAssetId?`
- `AssetLibraryAsset.approvalRequestId?`
- `ApprovalAsset.assetLibraryAssetId?`

Then update `addApprovedAssets` to create or link `AssetLibraryAsset` records instead of only stamping `approvedForLibraryAt`.

This enables folder movement, direct deletion, sharing, and reporting to behave consistently for promoted review assets.

### Avoid for first pass

Do not collapse approval models into asset-library models immediately. Decisions, reviewers, revisions, deadline reminders, and token security are workflow records, not generic asset metadata.

## Implementation Plan

### Phase 1: navigation consolidation

- Replace top-level `Review Portal` nav item with a review badge on `Assets`.
- Update `DashboardHome` so the Assets tile mentions active reviews and carries the pending review count.
- Keep `/approvals` as a redirect or compatibility wrapper that opens the Assets review tab.
- Update `DASHBOARD_HOME_DEFAULT_FAVORITES`, hidden defaults, and truth order so `approvals` is no longer a separate default module.
- Keep `/review/*` and `/assets/shared/:token` public routes unchanged.

Primary files:

- `tdash/src/App.jsx`
- `tdash/src/layouts/DashboardLayout.jsx`
- `tdash/src/features/DashboardHome.jsx`
- `tdash/src/lib/dashboardTruth.js`

### Phase 2: Assets workspace tabs

- Add an Assets header with tabs or segmented controls: `Library`, `In Review`, `Shared`.
- Move the approvals gallery from `ApprovalsDashboard.jsx` into an Assets review tab component.
- Keep the existing approval detail route state, but make back links say `Back to assets` or `Back to reviews`.
- Preserve current query/deep-link support with a new shape like `/assets?view=reviews&approvalId=...`.
- Add counts for pending reviews, changes requested, approved awaiting library, active shares, and selected assets.

Primary files:

- `tdash/src/features/AssetLibraryView.jsx`
- `tdash/src/features/ApprovalsDashboard.jsx`
- `tdash/src/features/ApprovalDetailView.jsx`
- `tdash/src/test/AssetLibraryView.test.jsx`
- `tdash/src/test/ApprovalsDashboard.test.jsx`
- `tdash/src/test/ApprovalDetailView.test.jsx`

### Phase 3: shared asset/review primitives

- Extract asset card, preview shell, status chip, review timeline item, reviewer row, and action toolbar into reusable dashboard primitives or local asset-workspace components.
- Replace raw dashboard hex classes in approval surfaces with theme tokens and shared primitives.
- Preserve the high-energy Tixmo feel with decisive image-first cards, compact controls, and direct CTAs.

Primary files:

- `tdash/src/components/dashboard/DashboardPrimitives.jsx`
- `tdash/src/lib/dashboardTheme.js`
- `tdash/src/features/AssetLibraryView.jsx`
- `tdash/src/features/ApprovalDetailView.jsx`
- `tdash/src/pages/ExternalReviewPage.jsx`
- `tdash/src/pages/SharedAssetFolderPage.jsx`

### Phase 4: review creation from Assets

- Replace the approval creation modal with an Assets-native `Request review` flow.
- Let users choose existing library assets, upload new files, or mix both if backend support is added.
- For first pass, keep `POST /approvals` upload-based creation and make the UI explain that selected existing assets will need upload/link support if not implemented yet.
- For second pass, add backend support to create approvals from existing `AssetLibraryAsset` records.

Backend options:

- Add `sourceAssetIds` to `createApprovalBodySchema`.
- Allow `ApprovalAsset` to reference or copy from `AssetLibraryAsset`.
- Decide whether review revisions should duplicate files into approval storage or reference library originals.

### Phase 5: promotion and library linkage

- Update `POST /approvals/:id/approved-assets` so approved assets become first-class `AssetLibraryAsset` rows or gain a durable link to one.
- Let the user choose destination folder/category while promoting approved assets.
- Show promoted assets in the library exactly like direct uploads, with a provenance badge such as `Approved review`.
- Preserve existing `approvedForLibraryAt` for audit/history.

Primary backend files:

- `tixmoapi2/prisma/schema.prisma`
- `tixmoapi2/src/api/approvals/service.ts`
- `tixmoapi2/src/api/assets/service.ts`
- `tixmoapi2/src/api/approvals/validation.ts`
- Approval and asset unit/integration tests.

### Phase 6: public surfaces cleanup

- Retitle public review UI from `Review Portal` to `Asset Review` or `Creative Review`.
- Keep `/review/:token` as the URL for existing email links.
- Align `ExternalReviewPage` and `SharedAssetFolderPage` visual shells so both feel like external asset package views.
- Do not merge decision-making review links with read-only folder-share links. They have different permissions and should remain separate token types.

## Route Strategy

Recommended:

- Keep `/assets` as the internal creative workspace.
- Add `/assets/reviews` or `/assets?view=reviews`.
- Add `/assets/reviews/:approvalId` only if the app wants path-based detail URLs; otherwise use `approvalId` query params.
- Redirect `/approvals` to `/assets?view=reviews`.
- Redirect `/approvals?approvalId=abc` to `/assets?view=reviews&approvalId=abc`.
- Keep `/review/:token` for external review.
- Keep `/assets/shared/:token` for public folder shares.

## Permission Strategy

Keep current role boundaries:

- Review curation archive/delete/promote remains `ADMIN` and `OWNER`.
- Asset upload/folder/share management remains `ADMIN`, `OWNER`, `MANAGER`, and `PROMOTER`.
- External reviewers use only token-scoped review permissions.
- Public folder-share recipients use only token-scoped read/download permissions.

Open product decision:

- Should `MANAGER` and `PROMOTER` be able to create review requests from Assets? Current approval creation is authenticated and not visibly role-restricted in the service. If this is intentional, preserve it. If not, add explicit permission rules before moving the flow into Assets.

## Risks

- Breaking external review links if `/review/:token` is removed or renamed at the route level.
- Losing comments, reviewer decisions, or reminder behavior if approval records are converted into generic library assets too early.
- Confusing users if promoted approval assets remain second-class records that cannot be moved/deleted/shared exactly like direct uploads.
- Increasing dashboard design drift if approval views are copied into Assets without extracting reusable primitives.
- Duplicating source files if future "review existing library asset" support blindly copies large video/PDF assets.
- Hiding urgent review work if the top-level nav badge disappears without a clear Assets badge/count replacement.

## Test Plan

Frontend:

- Update `AssetLibraryView.test.jsx` for tabs, review counts, direct upload, folder share, and promoted approval assets.
- Update `ApprovalsDashboard.test.jsx` or replace with Assets review-tab tests.
- Update `ApprovalDetailView.test.jsx` for back-labels and query/deep-link behavior.
- Update `ExternalReviewPage.test.jsx` only for copy/shell changes, not route semantics.
- Update smoke tests expecting the `Review Portal` nav link.

Backend:

- Keep existing approval tests for create, revisions, reviewers, decisions, comments, token access, archive/delete, and promotion.
- Add tests if `approved-assets` creates `AssetLibraryAsset` records.
- Add tests if approvals can be created from existing asset-library records.
- Keep asset-library tests for upload, folder movement, folder shares, revoke, public share, and delete.

Verification:

- Run `npm run design:guard` from `tdash`.
- Run focused frontend tests for Assets, Approvals/Reviews, ExternalReview, and SharedAssets.
- Run focused backend approval and asset-library tests.
- Capture desktop and mobile screenshots for `/assets`, the review tab/detail state, `/review/:token`, and `/assets/shared/:token`.

## Recommended First Slice

The safest first implementation slice is navigation and presentation consolidation only:

1. Add an `In Review` tab inside `AssetLibraryView`.
2. Render the existing approvals gallery/detail flow there with minimal behavior changes.
3. Remove the standalone Review Portal nav/card, replacing it with an Assets badge.
4. Redirect `/approvals` to the Assets review view.
5. Update labels from `Review Portal` to `Asset Review` where user-facing.
6. Run design guard and focused frontend tests.

This validates the UX direction without touching approval security, tokens, reminders, or database shape. After that, promote approved review assets into first-class `AssetLibraryAsset` records.
