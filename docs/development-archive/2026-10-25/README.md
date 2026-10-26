# Local development history backup, 2026-10-25

This backup preserves the original committed local development without merging historical branches into main. The Git bundle contains 472 branch tips with their original commits, trees, author metadata, and ancestry. Another 63 local tips are already reachable from main. The manifest accounts for all 535 local branches present when the snapshot was taken.

The prerequisite main commit is `822dcf02a80958b65986bd5eb3f4635760ec9275`. The bundle is a standard incremental Git bundle, not a replacement working tree or a proposal to deploy historical code. Historical tests, prototype verification tools, and reports retain their original context and limitations.

Previously uncommitted development is also published for review in PRs [112](https://github.com/chapmandaniel/projectTixmo/pull/112), [113](https://github.com/chapmandaniel/projectTixmo/pull/113), [114](https://github.com/chapmandaniel/projectTixmo/pull/114), [115](https://github.com/chapmandaniel/projectTixmo/pull/115), and [116](https://github.com/chapmandaniel/projectTixmo/pull/116). PR [117](https://github.com/chapmandaniel/projectTixmo/pull/117) preserves the unpublished release helpers and their offline tests. Original worktrees are unchanged.

## Restore into a clone

Check out this backup branch or download this directory. In a clone with origin pointing to this repository, fetch main so Git has the prerequisite history. Run the following from this directory, inside that clone:

```sh
sha256sum -c SHA256SUMS
git fetch origin main
git bundle verify unpublished-development.bundle
git fetch unpublished-development.bundle 'refs/heads/*:refs/remotes/local-history/*'
```

Recovered branch names appear under `local-history/`, preserving current local branch refs. To work on an original branch snapshot, create a new local branch from the corresponding recovered ref.

## Verification and scope

- Every snapshotted local branch SHA is either exported in the bundle or proven reachable from main.
- A fresh bare repository was seeded with main, then restored from the bundle; all 472 exported tips matched the manifest exactly, and the other 63 tips were verified as main ancestors.
- Bundle byte size: 8487262; SHA-256: `dc0a8377db99a1146d05a800fb677166cccd09d5bd876a9e661f0b43423f587b`.
- GitHub's bundle blob SHA matched the locally computed Git blob SHA `ddaf37ccc14deeeb89b20c429f612b5fc722faf7`.
- A local scan of unpublished Git blobs found no unclassified matches for the checked private-key, GitHub-token, AWS-access-ID, payment-key, and credential-URL patterns. This is a bounded pattern check, not a general security audit.
- The original eight untracked main instruction files that conflicted with tracked upstream files are preserved under `original-untracked-main/` with a SHA-256 manifest. The `.txt` suffix keeps those old instructions inert; their bytes are unchanged.
- Installed dependencies, runtime caches, transient untracked logs, and process state are excluded. Historical tracked files are retained in Git history.
- This backup does not approve any historical implementation, certify current runtime behavior, or merge/deploy anything.

Two older registered worktrees under the server's agentbox archive also had uncommitted package-script changes. Their original HEADs and exact working-tree patches are preserved under `archived-worktrees/`; these patches are historical source, not changes to current package scripts.

The final worktree audit also found 71 untracked reviewer shell/Python helpers and SQL fixtures. Their unchanged bytes are preserved as inert `.txt` files under `untracked-review-helpers/`, with original worktrees, paths, HEADs, sizes, and SHA-256 values in its manifest. They were not executed during recovery and are not current release qualification.

## Final synchronization result

Every one of the 535 snapshotted local branch sources is now available through an ordinary GitHub branch ref, verified against a fresh complete remote branch listing:

| Representation | Branch snapshots |
| --- | ---: |
| Original name and exact original commit | 481 |
| Exact original commit under archive/local-20261025/ to preserve an existing different GitHub head | 14 |
| Fixture-cleaned history copy under sanitized/local-20261025/ | 40 |

All 46 GitHub heads that existed before this synchronization remain unchanged. Local main matches GitHub main at 822dcf02a80958b65986bd5eb3f4635760ec9275. Original local branch heads and recovered working copies were preserved.

The cleaned copies remove three explicit synthetic Stripe test-key literals from old fixture history using the existing cleanup already represented in main. Their runtime values are identical. Forty copied histories have 81 changed commit identities; 39 final source trees are byte-identical, and one old tip changes only that fixture construction. The complete original histories remain in the original bundle. See sanitized/README.md and its provenance mapping.

SYNC-RESULT.json maps every original source ref/SHA to its verified remote destination/SHA. GitHub currently has 575 branch refs, including pre-existing remote-only work and the backup/control branches. The one-off importer workflow was retired after publication. Native Actions imports and the connected user's appropriately scoped ref-creation tools were used; no push-protection override or existing canonical-head overwrite was performed.

PRs 112–118 remain drafts. These publications preserve source for review; no default-branch merge or production deployment was performed. Source/hash checks and the 13 offline release-helper tests are the verification performed here, not fresh runtime qualification of historical implementations.
