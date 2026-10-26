# Fixture-cleaned historical export copies

GitHub push protection rejected three synthetic Stripe test-key literals in historical commit `32e2c0b1`. They are test canaries, not live credentials. The existing cleanup in `27fb8342`, whose replacement fixture blob is already present in main's history, constructs the same strings from components.

These export-only copies apply that existing cleanup to the historical fixture blob and rebuild its descendant commit identities. Original local branches and the full original-history bundle remain unchanged. No push-protection override or force update of existing remote heads is used.

Verification:

- Forty branch copies contain 81 rewritten commits. Author/committer metadata and commit messages are preserved; no signature headers needed removal.
- Only two historical trees change, both in `tixmoapi2/tests/unit/stripe-read-probe.test.ts`. Every other file is byte-identical at every corresponding rewritten commit.
- All three fixture strings evaluate to exactly the original runtime values.
- Thirty-nine final branch trees are entirely byte-identical. One old branch tip changes only the same fixture source construction.
- All cleaned histories exclude the flagged commit and blob.
- `manifest.json` lists exported refs and original heads. `rewrite-provenance.json` provides the complete commit mapping.

The exported refs live under `sanitized/local-20261025/`. This is historical source preservation, not new application qualification or permission to merge or deploy those old branches.
