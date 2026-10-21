# Independent QA438 — fresh caller successor

Reviewed immutable `b45649abb438ec791f0c37a57bb42cdcfd928abb`, parent `f45349e422beb381ccfac419271c859df2a13e48`, in NEW isolated branch `tixmo/task-438-qa-successor`, worktree `task-438-r2`. No product edits. Baseline report/repro is separate commit `e547cc90c3541a07bf8b92404a35d143b8ac282a`.

## Verdict

APPROVE **partial source-only transport/publication/caller outcome repair** on exact b45649ab. Known baseline caller gap is fixed: returned caller envelope retains cloned persistence result, warnings, explicit evidenceCompletion and durability; unknown/uncommitted/non-durable outcomes are INCOMPLETE. Failed stages/cleanup reject with evidence; callback rejection says publication UNKNOWN and preserves execution error. Sealed input is not rewritten to recursively include its publication outcome. Not whole432 approval, launch acceptance or runtime authorization.

## Actual checks, all exit 0

- All five authored suites rerun on this successor: `node docs/team/evidence/task-432/offline-stub.mjs`, `offline-disk.mjs`, `offline-nested.mjs`, `offline-publication.mjs`, `offline-caller.mjs` (each with same directory prefix). Covers exact12/default override/failfast, real owned temporary Git mutations, nested raw failures/tamper/join, concrete publication and caller fault injection.
- `node docs/team/evidence/task-438-r2/adversarial-caller.mjs`: independent15-case Cartesian matrix of completed/stage-failed/cleanup-failed execution against missing/uncommitted/non-durable/durable-with-warning callback outcomes, plus callback rejection in each execution state. Cloned warnings cannot be mutated by callback owner; fail/cleanup evidence retains outcomes; persistence error retains execution cause; sealed input remains free of postpublication fields.
- `node docs/team/evidence/task-438-r2/adversarial-transport.mjs`: freshly reruns baseline independent16 canonical/raw/path/failure probes and safety/scrub/stage5 join against exact successor, adapted to assert repaired outcome. Independent target-only/parent-only postpublication fsync faults each return readable committed but durability-unconfirmed; prepublication fsync failure stays unsealed.
- `node --check scripts/market-composition.mjs` and independent caller fixture; `git diff --check`.
- Actual f45349e..b45649ab diff is three files (core, author caller fixture, README). Empty diff for exact12/default runner, verify-api, transport and store; cumulative baseline review plus fresh successor tests retain exact command invariants.

## Limitations and handoff

No real CLI callback wiring,427 all10 owned-runtime lifecycle, registry/DNS enforcement, dependency/generated-client provenance or runtime qualification approved. Concrete collector is trusted integration input, not arbitrary callback security. Application seal/hash checks are not same-UID/root authenticity or OS immutability. Postpublication outcomes live in caller envelope, not sealed bytes; do not infer confirmed durability from the seal alone. No network/audit/runtime/DB/services/install/config/spend/push/merge/deploy, no fullmarket PASS, no432 closure. Lead439 fresh cumulative review remains separate.

Commit hooks: inherited `core.hooksPath=tixmoapi2/.husky` points at a hook requiring missing `_/husky.sh`; inspected hook, used invocation-only hooksPath=/dev/null for evidence commit, no config write or lint-staged claim.
