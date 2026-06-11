# Manual Launch Evidence Artifacts

`npm run evidence:status` tracks automated artifacts and manual go/no-go evidence. Manual gates stay open until a JSON artifact with `result: "pass"` and the required metadata fields exists in the expected folder.

Use `npm run evidence:status` for triage. Use `npm run evidence:status:strict` at go/no-go; strict mode exits non-zero while any artifact is missing, failed, or marked local-only.

Use these paths:

| Gate | Artifact path pattern |
| --- | --- |
| Real-device scanner/offline field test | `docs/scanner-field-test-evidence/<staging-or-production>-<date>.json` |
| Backup and migration rollback | `docs/backup-rollback-evidence/<staging-or-production>-<date>.json` |
| External reviewer and shared asset flow | `docs/external-review-share-evidence/<staging-or-production>-<date>.json` |
| Policy approval and publication | `docs/policy-approval-evidence/<staging-or-production>-<date>.json` |
| Uptime/status monitoring | `docs/uptime-status-evidence/<staging-or-production>-<date>.json` |

Create a pending artifact from a template:

```sh
npm run evidence:manual-template -- --gate scanner --environment staging --owner "Name"
```

Create all pending manual artifacts for a target environment:

```sh
npm run evidence:manual-template -- --gate all --environment staging --owner "Name"
```

Supported gates:

- `scanner`
- `backup`
- `review-share`
- `policy`
- `uptime`
- `all`

The template command writes `result: "pending"`. `npm run evidence:status` treats pending artifacts as open evidence gaps, and `npm run evidence:status:strict` still fails until the artifact is complete and changed to `result: "pass"`.

Minimum artifact shape:

```json
{
  "result": "pass",
  "environment": "staging",
  "capturedAt": "2026-06-09T00:00:00.000Z",
  "releaseSha": "abc1234",
  "owner": "Name",
  "evidence": {
    "summary": "Short human-readable result",
    "ticketUrl": "https://github.com/org/repo/issues/123",
    "artifactUrls": []
  }
}
```

`npm run evidence:status` enforces `environment`, `capturedAt`, `releaseSha`, `owner`, and `evidence.summary` for manual evidence artifacts.

Do not store raw scanner keys, raw reviewer/share tokens, database passwords, Stripe secrets, JWT/session secrets, backup files, or private customer data in these JSON files. Store sensitive proof in the approved launch ticket, provider UI, or secure evidence location, and reference it by safe URL or redacted identifier.

Manual evidence should only use `result: "pass"` when the matching runbook is actually complete:

- Scanner field test: `docs/SCANNER_SETUP_AND_FIELD_TEST.md`
- Backup and rollback: `docs/DB_BACKUP_AND_MIGRATION_ROLLBACK.md`
- External reviewer and shared asset flow: `docs/PRODUCTION_LAUNCH_CHECKLIST.md` Section 7
- Policy approval: `docs/POLICY_PUBLICATION_CHECKLIST.md`
- Uptime/status monitoring: `docs/UPTIME_STATUS_MONITORING.md`
