# Authenticated Railway target evidence - 2026-10-22

Owner: moosey / task231. Read-only CLI collection after Daniel completed CLI
authentication. This supplements, not replaces, the earlier review-clearance
receipt and BB520-231-20261022-PR75-READINESS-HOLD. No operational approval,
merge, deployment, database connection, backup, restore or new spend occurred.

## Deployment target, not merely similarly named project

The account contains **two different Tixmo application projects**. The project
named `tixmo API and Dashboard` is not the current main-triggered deployment
target reported by GitHub. Both were inspected; identifiers must not be mixed.

The GitHub-linked target was confirmed directly through Railway public GraphQL:

| Item | Actual target |
| --- | --- |
| Project | `tixmo mightyquinton`, `c1c17660-3110-4fa8-a0bd-aca06d13a3ed` |
| Environment | production, `dd8e0541-0e1d-478d-bec1-1f6bb7be1e2d` |
| API service | backend api, `13efc131-9ae3-4305-9628-55c783286990` |
| Dashboard service | dash, `275c6d17-fb2a-4768-aa6a-489fa95bacc1` |
| Postgres service | `e9448ee8-7c8e-4311-8f0c-d935930dd99b`, image `postgres-ssl:18` |
| Redis service | `22ca3ef4-ffb2-4b91-bb18-51b5ea9c5c29`, image `redis:8.2.9` |
| Postgres volume instance | `33a260ba-73eb-4696-96a7-d069c6ef7aa1` |
| Postgres volume | `3d13ba92-7e44-4d9e-b63d-c4d0bb9ed41b` |

API and dashboard each have an actual deployment trigger for repository
`chapmandaniel/projectTixmo`, branch **main**, **checkSuites=false**. Trigger
IDs are `225c1f85-8ab6-43e4-b3f1-571a08607793` (API) and
`64ca7a5f-1eae-4b32-b364-9f6ef9b0ff9c` (dashboard). Therefore merging even
PR73/74 must not be called code-only. No platform setting was changed.

Both last/latest deployments report SUCCESS, created `2026-10-21T04:15:16.400Z`:

- API `9dc4d60a-9d95-4508-8c58-8c73e37334ef`.
- Dashboard `874f8350-9374-40ae-b6ff-83729cbdd860`.
- Both resolved-file receipts identify commit
  `ebfbce7dc697effa8e359006c7e71bfe61ff2c6a`. This matches earlier GitHub
  deployment evidence, not the newer GitHub main/PR heads.

API root is `/tixmoapi2`; its resolved config file is
`/tixmoapi2/railway.toml`. Service-instance start override reports
`npx prisma migrate deploy && npm run db:seed && npm start`; the resolved
commit's config source instead specifies
`/bin/sh -c 'npm run migrate && exec node dist/index.js'`. Both paths migrate.
The effective precedence and seed behavior must be confirmed before execution;
the override must not silently be treated as the resolved deployment command.
Dashboard root `/tdash`, Dockerfile `/tdash/Dockerfile`, start
`nginx -g 'daemon off;'`. No restart/redeploy/start was invoked.

These service relationships establish environment co-location only. Actual
API-to-Postgres/Redis references and dashboard API URL were not fetched:
the approved scope prohibits environment/credential/connection-string reads.
A sanitized existing-custodian wiring receipt remains necessary. No database
contents, application rows or `_prisma_migrations` were queried.

## Backup evidence: concrete absent prerequisite

The read-only queries `volumeInstanceBackupList` and
`volumeInstanceBackupScheduleList`, each with actual target volume instance
`33a260ba-73eb-4696-96a7-d069c6ef7aa1`, returned **empty arrays for both**.
Thus Railway currently reports **no volume backups and no volume backup
schedules** for this target. This is not a failed restore test and does not
exclude a separately managed logical backup/PITR arrangement, but no such
arrangement or receipt has been supplied/verified. No backup action was run.

The corresponding attached Postgres volumes in the older application project
also returned empty backups/schedules. They cannot serve as the actual target's
backup proof. Existing W08 task245 notes explicitly retain full restore,
old-code compatibility, write-preserving rollback and timing acceptance OPEN;
historical local tiny-fixture restores are not production-target backup proof.

Required next decision: existing proxy reviews this concrete absence and names
an already-authorized, zero-new-cost backup/isolated-restore path if available,
or routes a real budget/operational exception to the authorized owner. Do not
enable schedules, create resources, take snapshots or restore under the current
read-only grant. No proxy condition or backup criterion is waived here.

## Distinct legacy/candidate project (not merge-trigger target)

`tixmo API and Dashboard`, project `8c5a1df6-dc6b-46ca-a516-dc1c25750921`,
contains production `36121c6d-d63f-4d58-8be2-e3684dfda52a` and
staging-audit-20261005 `d21ebf73-4198-4483-9a16-1fc2fb3685e6`.
Both environments return zero deployment triggers. Production API and dashboard
resolved receipts point to old `2f3a0554`; staging Candidate receipts have null
repo and commit. Its production Postgres is version17 and staging Redis8.2.10,
unlike the actual main-trigger target's Postgres18/Redis8.2.9. Neither project
identity nor parity acceptance may be inferred from a similar service name.

## Source readiness and remaining work

Fresh read-only GitHub inspection still reports PR73 exact0dfb, PR74 exactc9c9
and PR75 exacta5da OPEN with both required checks SUCCESS. PR75 remains DRAFT.
Prior independently reviewed composition equals PR75 tree67271e2e; no new
source qualification was claimed or unchanged tests repeated. Historical235/424
remain open for the specific gaps recorded by independent551;525 has no new
technical gap and awaits actual landing as explicitly recorded by552.

Operational hold remains necessary: real main triggers and missing verified
backup/restore are now evidenced, not hypothetical. Also outstanding are
sanitized wiring, all pending migration/checksum/drift inventory, compatible
last-good code behavior, consenting named operator/second approver, controlled
window/freeze/stop criteria and exact-target postdeploy acceptance. Known target
version differs from W08's intended PG17/Redis8.2.10 qualification target.

## Verification method and limits

Commands: `npx --yes @railway/cli list --json`; schema introspection via
`api describe`/`api search`; explicit GraphQL **query** operations selecting
project/environment/service identifiers, source repo/image, build/start/config
metadata, resolved commit/deployment receipts, deployment triggers, attached
volume IDs and backup/schedule metadata. No GraphQL mutation was submitted.
No environment `config`, variables, credentials, arbitrary deployment `meta`,
logs, customer data, database access, target HTTP probe, install/setup/config
change, new CI run, push or merge was used to collect this receipt.
CLI executed via its existing npx availability; no persistent Railway linking
or setup was performed. Memory recall handler was unavailable; live board and
platform evidence supplied provenance. Documentation check: `git diff --check`.
