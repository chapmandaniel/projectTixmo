#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const gates = {
  scanner: {
    label: 'Real-device scanner/offline field test',
    directory: 'docs/scanner-field-test-evidence',
    runbook: 'docs/SCANNER_SETUP_AND_FIELD_TEST.md',
  },
  backup: {
    label: 'Backup and migration rollback',
    directory: 'docs/backup-rollback-evidence',
    runbook: 'docs/DB_BACKUP_AND_MIGRATION_ROLLBACK.md',
  },
  'review-share': {
    label: 'External reviewer and shared asset flow',
    directory: 'docs/external-review-share-evidence',
    runbook: 'docs/PRODUCTION_LAUNCH_CHECKLIST.md Section 7',
  },
  policy: {
    label: 'Policy approval and publication',
    directory: 'docs/policy-approval-evidence',
    runbook: 'docs/POLICY_PUBLICATION_CHECKLIST.md',
  },
  uptime: {
    label: 'Uptime/status monitoring',
    directory: 'docs/uptime-status-evidence',
    runbook: 'docs/UPTIME_STATUS_MONITORING.md',
  },
};

const usage = `Usage:
  npm run evidence:manual-template -- --gate scanner --environment staging --owner "Name"
  npm run evidence:manual-template -- --gate all --environment staging --owner "Name"

Options:
  --gate          One of: ${Object.keys(gates).join(', ')}, all
  --environment   staging, production-like, or production
  --owner         Person accountable for this evidence
  --release-sha   Release commit SHA. Default: current git HEAD short SHA when available.
  --date          File date in YYYY-MM-DD format. Default: today.
  --output        Override output path. Only valid with one gate.
  --output-dir    Override output directory. Useful with --gate all.
  --force         Overwrite an existing output file.

Creates pending manual evidence JSON artifact(s) with required metadata fields.
`;

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(usage);
  process.exit(0);
}

const readOption = (name, fallback = '') => {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] || '';
};

const hasFlag = (name) => args.includes(name);

const gitSha = () => {
  const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return result.status === 0 ? result.stdout.trim() : '';
};

const gateId = readOption('--gate');
const environment = readOption('--environment');
const owner = readOption('--owner');
const releaseSha = readOption('--release-sha', gitSha());
const date = readOption('--date', new Date().toISOString().slice(0, 10));
const gate = gates[gateId];
const selectedGates = gateId === 'all' ? Object.entries(gates) : gate ? [[gateId, gate]] : [];

const fail = (message) => {
  process.stderr.write(`[evidence:manual-template] ${message}\n\n${usage}`);
  process.exit(1);
};

if (!selectedGates.length) {
  fail(`Unknown or missing --gate: ${gateId || '<missing>'}`);
}

if (gateId === 'all' && readOption('--output')) {
  fail('--output is only valid when creating one gate. Use --output-dir with --gate all.');
}

if (!environment) {
  fail('--environment is required.');
}

if (!owner) {
  fail('--owner is required.');
}

if (!releaseSha) {
  fail('--release-sha is required when git HEAD cannot be detected.');
}

const createArtifact = (id, definition) => ({
  result: 'pending',
  environment,
  capturedAt: new Date().toISOString(),
  releaseSha,
  owner,
  gate: id,
  runbook: definition.runbook,
  evidence: {
    summary: `${definition.label} evidence pending.`,
    ticketUrl: '',
    artifactUrls: [],
    redactedReferences: [],
  },
  checklist: [
    'Complete the matching runbook.',
    'Attach safe, redacted references to the launch ticket.',
    'Set result to "pass" only after the release owner accepts the evidence.',
  ],
});

const outputForGate = (id, definition) => {
  const outputDir = readOption('--output-dir');
  if (outputDir) {
    return path.resolve(outputDir, `${id}-${environment}-${date}.json`);
  }

  if (gateId === 'all') {
    return path.resolve(path.join(definition.directory, `${environment}-${date}.json`));
  }

  return path.resolve(readOption('--output', path.join(definition.directory, `${environment}-${date}.json`)));
};

const writes = selectedGates.map(([id, definition]) => ({
  id,
  outputPath: outputForGate(id, definition),
  artifact: createArtifact(id, definition),
}));

const existing = writes.filter(({ outputPath }) => fs.existsSync(outputPath));
if (existing.length && !hasFlag('--force')) {
  fail(`Output already exists: ${existing.map(({ outputPath }) => outputPath).join(', ')}. Use --force to overwrite.`);
}

writes.forEach(({ outputPath, artifact }) => {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
  process.stdout.write(`[evidence:manual-template] wrote ${outputPath}\n`);
});

process.stdout.write('[evidence:manual-template] Fill the evidence fields, then set result to "pass" when the runbook is complete.\n');
