# Task 361 source-only serial composition

Combined candidate: `80c6710b89d147588e1514aa99a4e55c5630d38a`.
Base: `cdb41d4d3aa4ccc323a2a1cc6b04a490feafe6a6`.
Branch: `tixmo/task361-compose`; isolated worktree task361.

Decision: composition COMPLETE, submitted REVIEW, not independent approval of the new candidate. Task351 and default integration231 remain untouched. This documentation-only successor adds provenance, not product/test changes.

Inspected exact ancestry and complete test diffs before picking. Refund source2d7490a has parent4a89e7c, which is the shared ancestor of the selected base and refund branch; source7e01d57 follows2d7490a. Tenantccdab follows exactcdb; evidence199cb9af followsccdab. Only the four expressly accepted child commits were cherry-picked serially; no old branch parent/product source was selected. All picks clean, no conflicts/resolutions/assertion edits.

## Verification commands and results

- git show --no-patch --format='%H %P %s' SOURCES: ancestry inspected.
- git diff-tree --no-commit-id --name-status -r SOURCE and git diff SOURCE^ SOURCE -- testfiles: only accepted tests/evidence.
- git merge-base cdb41d4d 2d7490a:4a89e7c93c854a381a661d9e485e1dd47f3a4259.
- git cherry-pick2d7490a,7e01d57,ccdab139,199cb9af (individual full SHAs in manifest), exit0; all picks clean.
- Python inspected git diff --name-only BASE CANDIDATE with a fail-closed allowlist: exactly three expected API tests and evidence docs; no other changed path. This establishes all product/schema/lockfiles byte-identical to base.
- git rev-parse CANDIDATE:PATH versus reviewed SOURCE:PATH: both refund test blobs equal7e01, tenant test blob equalccdab. Exact blob hashes recorded in manifest; 3/3 comparisons PASS.
- git diff BASE HEAD --check: exit0.

Command-scoped Git reviewer identity and core.hooksPath=/dev/null used for picking/evidence commit; no config edited or hook-pass claim. Copied historical evidence/scripts remain inert; none executed. Existing author/QA results are historical provenance, not current candidate test passes.

## Required next gates

Independent exact-new-candidate review/QA and a fresh coordinated disposable-local full API run remain mandatory before351 closure or readiness claims. PM supplied acceptance of325 via358/359 and356 via357/360; their accepted code is preserved exactly, but historical green results do not certify this new combination. No tests, DB/runtime grant, install, generation, product edits, .env/secrets, provider/cloud/spend, persistent config changes, push, merge, deploy, Gateway or scheduler actions occurred in361. No full gate green or deployment approval is claimed.
