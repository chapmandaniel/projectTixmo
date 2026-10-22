# Task 553: independent wiring-wrapper review

Reviewer: tixmo-lead. Date: 2026-10-22. Parent: task 231.
Reviewed exact commit: `395cafb73f63cfc38fe91b7268d2e9022484d9b3`.
Branch: `task-553-independent-wiring-review`; isolated checkout: `worktrees/task-553`.
Owned change: this document only. No author code repaired.

## Verdict: CHANGES REQUIRED

The wrapper is not yet fail-closed across its output and failure boundaries.
This verdict concerns the helper and its receipt, not launch authorization.

### F1 - P1: allowlisted keys are not an allowlisted output schema

`scripts/railway-wiring-redacted.py:68-76` checks catalog top-level keys and
migration field names, but validates values only for migration name/checksum.
An arbitrary synthetic sentinel in `finished_at` is emitted unchanged. The
same applies to serverVersion, databaseSizeBytes, timestamps and step counts;
nested or oversized values are not rejected. This violates the claimed
approved-metadata-only output contract in the receipt at lines 9-13.

The receipt path at script lines 80, 94-99 additionally emits IDs obtained from
arbitrary extra project services, not just fixed SERVICES IDs. With all four
expected services present, adding an extra service whose ID is a synthetic
sentinel and referencing it alongside postgres emits the sentinel and still
reports expectedServiceReference=true. This does not demonstrate a real secret
was leaked; it demonstrates that returned values are not constrained as claimed.

Remediation: validate types, bounded lengths, numeric ranges, timestamp/null
formats, version format, array cardinality and all IDs before output. Derive
emitted IDs exclusively from the fixed allowlist; reject unexpected reference
mixes or describe them using bounded booleans rather than arbitrary IDs. Reject
unknown/unexpected nested values. Add adversarial fixtures for each emitted field.

### F2 - P1: failed SQL process is reported with successful process status

Script lines 64-67 print `catalog_connection_or_query_failed` then return.
`main()` at lines 120-122 also returns, so the program exits 0 despite a failed
psql execution. A caller relying on process success can mistake failed evidence
collection for completed collection. Mocked psql exit2 reproduces normal return.

Remediation: propagate a nonzero exit (or raise a sanitized exception handled
by the outer guard), preserving suppression of stdout/stderr/raw exceptions.
Verify both receipt status and actual CLI exit status offline.

### F3 - P2: internal URL identity check omits protocol validation

Script lines 35-45 compare host/port/path/user but do not require valid
Postgres schemes for either internal URL. Two identical synthetic
`https://u:p@internal/db` strings pass and result in apiPostgresWiringMatch=true
when the public URL is shaped correctly. This is a false wiring attestation,
not proof that the real deployed URLs were malformed.

Remediation: require postgres/postgresql schemes, nonempty host/database/user,
valid ports and a bounded accepted URL structure for all three URLs before
matching. Keep any proxy identity claim scoped to the service's returned
configuration unless independently authenticated infrastructure evidence binds it.

### C1 - output/completeness and TLS limitations

Script line 59 limits rows to 500 without an overflow/completeness signal.
A database with more than 500 entries would silently produce a partial inventory.
The output validator also accepts a mocked 501-entry result. Request 501 rows,
reject overflow or emit a bounded explicit completeness flag; validate returned
cardinality independently. This does not invalidate a genuine 31-row result.

PGSSLMODE=require at line 50 requests TLS, but is not an explicit verify-full
hostname-authentication policy. The receipt accurately says TLS required; do
not upgrade that into proof of independently verified proxy/server identity.
No live TLS negotiation or certificate verification was exercised in this review.

## Checks actually executed

All Python checks used in-memory import with bytecode disabled, synthetic
fixtures and unittest.mock; no wrapper live mode was invoked against a service.
Subprocess calls inside catalog were replaced with local fake results and
query_data was replaced with synthetic dictionaries. Commands were local
`python3 - <<'PY'` harnesses and `git diff --check`.

- PASS: existing self-test invoked through main with subprocess forbidden.
- PASS: mocked baseline SQL uses BEGIN READ ONLY, statement_timeout5s,
  lock_timeout1s, LIMIT500 and ROLLBACK; no logs column/application-row query.
- PASS: mocked psql invocation uses -X, -w, ON_ERROR_STOP, deadline25s;
  explicit environment has PGSSLMODE=require and connection timeout5s, no
  inherited PGOPTIONS. URL passwords are not passed as process arguments.
- PASS: differing internal host rejects before any mocked psql call.
- REPRODUCED: synthetic finished_at value emitted (F1).
- REPRODUCED: nonallowlisted extra service ID emitted (F1).
- REPRODUCED: nonzero psql result returns normally (F2).
- REPRODUCED: matching non-Postgres internal URLs accepted (F3).
- REPRODUCED: 501 mocked migration entries accepted (C1).
- PASS: syntax compilation in memory without writing bytecode.
- PASS: git diff --check before commit.

## Evidence boundary and handoff

No target/API/DB/network calls, credential-file or environment-value reads,
installs, servers, runtime/configuration changes, migrations, backups, pushes,
merges or deployments. No actual environment values printed. Existing resource
files under task57 were not read or executed. No full API/UI tests are relevant
to this docs-only independent review.

The parent receipt's 31 ledger records, 32 candidate migrations and manual
name/checksum comparison are parent-reported observations, not independently
replayed or machine-proven reconciliation here. Their wording at receipt
lines 39-41 correctly distinguishes displayed-inventory comparison from an
automated invariant. No rerun of the single actual catalog query is requested.
No claim of schema-drift absence, restore readiness, encrypted recovery storage,
cost containment, effective deployment-source identity or launch readiness is
approved. Parent owns repairs; review the exact successor with offline fixtures.

## Exact successor re-review: PASS within offline scope

Reviewed exact successor `dafe27e602e21e6441c23accab85b5a3eb447a9b`
against original `395cafb73f63cfc38fe91b7268d2e9022484d9b3`.
Independent checkout: `worktrees/task-553-r2`, branch
`task-553-successor-wiring-review`. Original verdict above is retained as
historical evidence, not a verdict against this corrected successor.

F1 resolved: catalog validation now enforces bounded types, numeric ranges,
version normalization, timestamp parsing/normalization, unique formatted
migration identities, fixed keys and row count. Service-reference output can
only include fixed approved IDs; unknown references remain unresolved without
emitting arbitrary IDs. F2 resolved: client failure exits1 with sanitized
failure JSON. F3 resolved: all URL schemes and required identity components
are validated; internal host must use the private Railway suffix before
identity comparison. C1 resolved for completeness: 500-or-more returned rows
are rejected, conservatively treating the SQL ceiling as potentially truncated.

The successor selects verify-full and the explicit system CA bundle for
future connections, with no weaker fallback. This is a verified command-
construction property only. It neither upgrades the historical require-mode
connection nor proves a trusted matching live server certificate is available.

### Checks executed against exact successor

- `python3 -B scripts/railway-wiring-redacted.test.py`: PASS, seven methods.
- `python3 -B scripts/railway-wiring-redacted.py --self-test`: PASS.
- Separate independent inline `python3 -B` harness: PASS, 39 adversarial cases:
  12 top-level type/value mutations, 18 timestamp type/format/year mutations,
  two row-count ceiling cases, four URL scheme/private-host/required-component
  cases, one mixed known/unknown service-reference case and two client/output
  error cases. The original secret-shaped sentinel cannot escape through
  invalid scalar metadata or extra IDs. Failures do not print raw fake errors.
- Author fixture tests additionally verify fixed read-only SQL, statement and
  lock timeouts, connection deadline, verify-full/CA settings and no password
  in arguments. Every catalog query and subprocess execution was mocked.
- `git diff --check`: PASS. Checkout clean before adding this report.

No remaining blocking defect found in this bounded review. The initial
commit attempt for the original report encountered a missing husky helper;
review documentation commits use command-local core.hooksPath=/dev/null,
without installations or persistent configuration changes.

No live query, network, credential/environment-value read, server, install,
configuration change, migration, backup, deployment, push or merge occurred.
The parent-reported 31-record manual comparison remains neither independently
replayed nor machine-proven. No schema-drift, operational grant, restore,
backup, certificate availability or launch-readiness approval follows from
this offline helper review.
