# Task 143 prerequisite checkpoint (not recovery acceptance)

Base e5d2cd57793deb8025a93cef3051c17f182ab6b7; task branch only.
Existing Prisma/PostgreSQL/Jest operations suffice; no new dependencies.

This bounded checkpoint adds a preserving BIGINT default-zero column migration
and extracts confirmation's existing CAS/inventory transaction body into a
transaction-client operation. Public actor scope, initial status checks and
snapshot remain unchanged; authoritative PENDING CAS is retained. Internal
callers omit the snapshot to reread on their supplied transaction client.
The method performs no email, retry delay or external call. No HTTP route added.

**Expired takeover remains disabled. This is NOT whole-handler fencing.**
No payment service code changed. All task143 admission/lease/generation fencing,
terminal CAS, handler event locks, TOCTOU regressions, deterministic successor
PROCESSING snapshots and mutation kills remain unimplemented/unverified.
Historical task137/141 evidence is untouched. Generation adds BigInt values to
Prisma records: future recovery snapshot output must use a BigInt-safe serializer,
not alter historical artifacts or mistake JSON serialization errors for RED.

Resume: implement the entire reviewed task139 transaction-fencing contract
before enabling expired admission. Add realDB generation/migration preservation
coverage including preexisting row timestamps, overflow and boundary admission;
run full specified regressions and all durable mutation oracles. Both independent
exact-SHA lead and QA reviews are required; PM alone closes implementation.

Checks and owned-runtime cleanup are recorded with exact SHA on board143.
No merge, deployment, production database or provider actions performed.
