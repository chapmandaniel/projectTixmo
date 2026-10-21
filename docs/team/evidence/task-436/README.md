# Independent lead436: REQUEST_CHANGES - persistence failure contract

Exact reviewed candidate **9704866fd5ce034d2ce31072269c9dbd826af4db** versus
**0cdb124530272f2c7408acb0374eb4a576a8fdf4**. New isolated worktree
`/home/daniel/projects/projectTixmo/worktrees/task-436`, branch
`tixmo/task-436-review`, based on candidate. Read assigned board436/432/435,
source and fixtures. This is only the bounded persistence review, not review
of newer successor50bf4bb4 or final task432 qualification.

## Finding: failure after seal publication is accepted as valid evidence

`scripts/market-evidence-store.mjs` publishes manifest.sha256 by hard link,
then unlinks seal.pending, chmods the run directory and fsyncs run and parent.
Any of those post-publication operations can fail. The callback rejects, yet
published seal remains and `verifyEvidence` accepts the bundle. This contradicts
source comment and README guarantees that failed/interrupted writers leave
unsealed reservations rejected by readers. Permission tightening and durability
may also be incomplete despite reader acceptance.

Actual independent `publication-failure.mjs` injects EIO only at run-directory
chmod after publication, asserts callback rejection, then proves the seal exists
and reader accepts. The probe passed/reproduced; source was not modified. The
same ordering admits fsync failure after publication. This is an application
state/durability contract defect, not an authenticity claim or evidence that any
real run failed. Manifest qualification remains INCOMPLETE in the fixture.

Original author should explicitly reconcile publication versus successful durable
completion: fail closed for a callback-failed publication, or represent a defined
published-but-durability-uncertain outcome and stop promising every failed writer
is unsealed. Retain post-publication fault-injection coverage and re-review exact
successor. Do not silently treat a failed callback as successful persistence.

## Actual checks and positive findings

Using existing `/home/daniel/.nvm/versions/node/v24.21.0/bin/node`:

- Author `offline-disk.mjs`: PASS real temporary Git source/lock dirty denial,
  restoration/committed drift, teardown/admission mutation zero local runs,
  12-stage/failure2 disk bundles, hash/seal/tamper/unsealed/no-overwrite checks.
- Author `offline-stub.mjs`: PASS exact12/default override parity, all12 failfast
  positions, teardown/invalid boundary/cleanup, canonical receipt/argument and
  transition mutation protections.
- Retained independent `offline-review.mjs`: PASS public/symlink/traversal path
  rejection, concurrent exclusive reservation, NUL raw content, readonly files,
  resealed canonical raw-index tamper rejection, symlink seal rejection, partial
  raw write unsealed/no reuse. These cover failures BEFORE publication; separate
  post-publication probe above identifies the missing case.
- `node --check` store and offline-disk PASS. Exact Git diff for existing
  market-composition, market-stages and verify-market-local versus base empty:
  existing repaired core/default12 unchanged. `git diff --check` PASS.

Source checks ownership/private mode/nonsymlink canonical paths, exclusive mkdir
reservation and wx file writes, fsync raw+manifest before atomic no-clobber seal
link, content hashes and canonical association on read. Same-UID concurrent
filesystem replacement remains outside this application-level contract: owner
or root can rewrite content and seals. No WORM/immutability/authenticity or OS
network-enforcement claim is approved. Evidence root outside candidate remains
caller precondition, not path-containment enforcement supplied by this store.

No DB, services, runtime, network, installs, configuration, spend, push, merge or
deploy. Fixtures mutate only owned temporary directories and clean them up.
Task436 is not done pending this finding; task432 remains incomplete. Actual
registry/DNS enforcement, local427 lifecycle/CLI wiring, nested API provenance
and final verified dependencies/runtime versions remain outside this reviewed
candidate. Newer unseen adapter successor is not approved. Full-market NO-GO.
