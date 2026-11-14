# T104 dead tdash modules

Baseline: `main` `aee54592` (Merge pull request #195).
Branch: `cursor/t104-tdash-dead-code-4352`.
Node: `v24.21.0` / npm `11.19.0` (same as `.nvmrc` and CI `setup-node`).
Kanban CLI was not available in this session; evidence lives here and on the draft PR.

T90 listed 13 `tdash` modules that `App.jsx` never reaches. Each was checked for routes, static imports, `import()` / `React.lazy`, barrel re-exports, string-based lookups, and test-only imports. Transitive deadness: a module imported only by another dead module is dead. Prototype branches were checked with `git grep` on the listed heads. A prototype **uses** a module only if live `tdash/src` JS/JSX (not the module itself, not dated audit inventories) imports or renders it.

## Search commands

On `origin/main` and the three prototype refs, excluding the design-system baseline:

```bash
git rev-parse origin/main \
  origin/feat/social-dashboard-prototype \
  origin/feat/analytics-dashboard-prototype \
  origin/preview/social-analytics-combined
# aee54592d25fc1134ea22f01bab0da59074479a0
# 63f8c622a13a1ad554f52d5d90224300c4f631af   #194
# 34ba3f443241240a050b59c54385f031ed6c594f   #197
# 9c054d4a702b75e141d05b7287d236ec8a63f95f   #201

git grep -n -E 'PromoCodesView|PromoCodeModal|EventWizard|UserModal|ECC_Marketing|ApprovalsView|ApprovalStudio|ComingSoonView|PersonalTodoView|ApprovalGalleryCard|CreativeControls|CreativePreview|CreateApprovalModal' \
  origin/main -- tdash ':!tdash/design-system-guard-baseline.json'

git grep -n -E "from ['\"].*/(PromoCodesView|PromoCodeModal|EventWizard|UserModal|ECC_Marketing|ApprovalsView|ApprovalStudio|ComingSoonView|PersonalTodoView|ApprovalGalleryCard|CreativeControls|CreativePreview|CreateApprovalModal)|import\(['\"].*/(PromoCodesView|PromoCodeModal|EventWizard|UserModal|ECC_Marketing|ApprovalsView|ApprovalStudio|ComingSoonView|PersonalTodoView|ApprovalGalleryCard|CreativeControls|CreativePreview|CreateApprovalModal)|<(PromoCodesView|PromoCodeModal|EventWizard|UserModal|ECC_Marketing|ApprovalsView|ApprovalStudio|ComingSoonView|PersonalTodoView|ApprovalGalleryCard|CreativeControls|CreativePreview|CreateApprovalModal)" \
  origin/main origin/feat/social-dashboard-prototype origin/feat/analytics-dashboard-prototype origin/preview/social-analytics-combined -- '*.js' '*.jsx' '*.ts' '*.tsx'

git grep -n -E 'PromoCodesView|PromoCodeModal|EventWizard|UserModal|ECC_Marketing|ApprovalsView|ApprovalStudio|ComingSoonView|PersonalTodoView|ApprovalGalleryCard|CreativeControls|CreativePreview|CreateApprovalModal' \
  origin/main -- 'tdash/src/test'

git grep -n -E "lazy\(\(\) => import\('\./features/(PromoCodesView|PromoCodeModal|EventWizard|UserModal|ECC_Marketing|ApprovalsView|ApprovalStudio|ComingSoonView|PersonalTodoView|ApprovalGalleryCard|CreativeControls|CreativePreview|CreateApprovalModal)" \
  origin/main origin/feat/social-dashboard-prototype origin/feat/analytics-dashboard-prototype origin/preview/social-analytics-combined
```

There is one barrel file (`tdash/src/index.jsx`, app entry). It does not re-export any of the 13. No component map / registry strings for these names exist outside the modules themselves (and `ApprovalsDashboard.jsx`'s **local** `CreateApprovalModal` function, which is not `features/CreateApprovalModal.jsx`).

## Verdict table

| Module | Verdict | Main reachability | Prototype check | Reason if kept |
| --- | --- | --- | --- | --- |
| `tdash/src/features/PromoCodesView.jsx` | **deleted** | Only defines itself and imports dead `PromoCodeModal`. `/promo` in `App.jsx` is `<Navigate to="/dashboard" />`. No tests. | Same file exists on #194/#197/#201; no live import. `PromoCodesView` → `PromoCodeModal` is dead→dead on those refs too. | |
| `tdash/src/features/PromoCodeModal.jsx` | **deleted** | Imported only by `PromoCodesView.jsx` and `ECC_Marketing.jsx` (both dead). No tests. | Same dead→dead imports only. | |
| `tdash/src/features/EventWizard.jsx` | **deleted** | No importer. Live create-event path is `EventStudio` (lazy via `EventsView` / ECC). No tests. Zero design-guard baseline rows. | No live import. `EventStudio.jsx` still has a comment “Replaces the old EventWizard”; that is not an import and was left unchanged. | |
| `tdash/src/features/UserModal.jsx` | **deleted** | No importer. Team create/edit uses `TeamMemberWizard`. No tests. | No live import. | |
| `tdash/src/features/ECC_Marketing.jsx` | **deleted** | `EventCommandCenter.jsx` imports Overview/Orders/Attendees/Tickets/Settings/EventStudio/placeholder — not Marketing. Imports dead `PromoCodeModal`. No tests. | No live import. | |
| `tdash/src/features/ApprovalsView.jsx` | **deleted** | `/approvals` lazy-loads `ApprovalsDashboard`, not this view. Imports dead `CreateApprovalModal.jsx` plus live `ApprovalCard` / `ApprovalDetailView` (those stay). No tests. | No live import. | |
| `tdash/src/features/ApprovalStudio.jsx` | **deleted** | No importer. No tests. | No live import. | |
| `tdash/src/features/ComingSoonView.jsx` | **deleted** | Held routes (`/quantmo`, `/social`, `/creative`, `/marketing`) use `DashboardPlaceholderView`. No tests. | No live import. | |
| `tdash/src/features/PersonalTodoView.jsx` | **deleted** | `/personal-todo` redirects to `/dashboard`. Live todos are `TodoView`. No tests. | No live import. | |
| `tdash/src/features/ApprovalGalleryCard.jsx` | **deleted** | No importer. Live cards are `components/ApprovalCard.jsx`. No tests. | No live import. | |
| `tdash/src/features/CreativeControls.jsx` | **deleted** | `/creative` is the ProMo placeholder. No importer, no tests. | No live import. | |
| `tdash/src/features/CreativePreview.jsx` | **deleted** | Same as CreativeControls. No importer, no tests. | No live import. | |
| `tdash/src/features/CreateApprovalModal.jsx` | **deleted** | Imported only by dead `ApprovalsView.jsx`. No tests. | Same dead→dead import. `ApprovalsDashboard.jsx:181` defines a **different** local `CreateApprovalModal` used at line 655; that live function was not touched. | |

All 13 deleted. None kept.

## Extra files

| File | Action | Why |
| --- | --- | --- |
| `tdash/design-system-guard-baseline.json` | **edited** (not deleted) | Guard fails if tracked fingerprints disappear. Removed 181 violation records whose `file` was one of the deleted modules (920 → 739). `generatedAt` and every remaining fingerprint unchanged. `EventWizard.jsx` had no baseline rows. This is not a `--update` rewrite. |
| Tests for the 13 modules | none | `git grep` on `tdash/src/test` returned no hits. Nothing to delete. |
| Helpers / CSS / assets unique to the 13 | none | Imports were `react`, `lucide-react`, `../lib/api`, `../lib/dashboardTheme`, `../lib/utils`, `../lib/eventTime`, `../components/TicketBuilder`, `../components/dashboard/DashboardPrimitives`, `../components/InputField`, `../components/StatusBadge`, `../components/ApprovalCard`, `./ApprovalDetailView`, plus the dead cluster (`PromoCodeModal`, `CreateApprovalModal.jsx`). All of those live helpers are still imported by reachable code. No module-local CSS or assets. |
| `tdash/src/features/EventStudio.jsx` comment naming EventWizard | **kept** | Comment only; task forbids live-code refactor beyond removing dead imports. There were no dead imports in live files. |
| `tdash/src/features/ApprovalsDashboard.jsx` local `CreateApprovalModal` | **kept** | Reachable from `/approvals`. Not the deleted module. |
| Dated audit inventories (`docs/audits/2026-10-04-security-*.json/md`, `docs/audits/2026-10-20-local-development-reconciliation.json`) | **kept** | Point-in-time file lists, not runtime imports. Same policy as T79. |

Prototype refs #194 / #197 / #201 also list the 13 paths in those audit files. That is inventory, not usage.

## Verification

`tdash/package.json` has no `lint` script and no ESLint config (same as T79).

| Check | Command | Exit | Result |
| --- | --- | --- | --- |
| Design guard | `npm --prefix tdash run design:guard` | 0 | Passed with **739** tracked baseline violations and no regressions |
| Tests | `npm --prefix tdash test -- --run` | 0 | **66** files passed, **500** tests passed, **0** failed, **0** skipped |
| Build (after) | `npm --prefix tdash run build` | 0 | Vite 6.4.5 production build + buyer-policy + robots checks |

Skipped count: 0 before (no `it.skip` / `test.skip` / `describe.skip` / `it.todo` / `test.todo` under `tdash/src`; Vitest summary omits a skipped line when the count is 0) and 0 after. Not increased.

## Bundle size (Vite production build)

Dead JS was already outside the module graph (`✓ 2159 modules transformed` before and after). Tailwind still scanned the unused files for class names, so CSS dropped.

| Asset | Before (delete) | After (delete) |
| --- | --- | --- |
| `dist/app-assets/index-*.css` | 109.35 kB / gzip 18.38 kB (`index-Ch1HkbNq.css`) | 100.04 kB / gzip 17.13 kB (`index-Bqz7PvfD.css`) |
| `dist/app-assets/index-*.js` (app shell) | 301.51 kB / gzip 100.58 kB | 301.51 kB / gzip 100.57 kB |
| `dist/app-assets/AnalyticsView-*.js` | 483.09 kB / gzip 156.82 kB | 483.09 kB / gzip 156.82 kB |
| `dist/app-assets/ApprovalsDashboard-*.js` | 55.80 kB / gzip 13.87 kB | 55.80 kB / gzip 13.87 kB |
| Modules transformed | 2159 | 2159 |

CSS: **−9.31 kB** raw / **−1.25 kB** gzip. JS chunks unchanged at reported hundredths of a kB.

## Constraints honored

- Draft PR only. No merge, deploy, staging, labs, workflow, or branch-protection changes.
- No `tixmoapi2` edits.
- No test weakening, no skip/retry, no live-code refactor beyond deleting unused modules and their baseline rows.
