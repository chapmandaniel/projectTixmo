# Dependency Audit Evidence

Use this check before launch evidence is attached or refreshed:

```sh
npm run evidence:dependency-audit
```

The command runs production-only dependency audits for:

- `tdash`
- `tixmoapi2`

It writes JSON evidence to:

```text
docs/dependency-audit/production-dependency-audit.json
```

Override the output path when capturing dated or environment-specific evidence:

```sh
TIXMO_DEPENDENCY_AUDIT_EVIDENCE_PATH=docs/dependency-audit/production-dependency-audit-2026-06-09.json npm run evidence:dependency-audit
```

Attach the JSON artifact to the market launch evidence ticket when dependency security is part of the go/no-go review. The check is production-only by design, so dev dependency advisories should be triaged separately from the launch runtime gate.
