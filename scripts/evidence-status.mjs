#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const usage = `Usage:
  npm run evidence:status
  npm run evidence:status -- --json
  npm run evidence:status -- --strict
  npm run evidence:status:strict

Summarizes local and target launch-evidence artifacts that should be attached to the market launch ticket.

By default, missing evidence is reported but does not fail the command. Use --strict for go/no-go checks where any open evidence gap should exit non-zero.
`;

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(usage);
  process.exit(0);
}

const wantsJson = process.argv.includes('--json');
const strict = process.argv.includes('--strict');

const readJson = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
};

const getValue = (body, fieldPath) =>
  fieldPath.split('.').reduce((value, key) => (value && typeof value === 'object' ? value[key] : undefined), body);

const fileStatus = (label, filePath, options = {}) => {
  const absolutePath = path.resolve(filePath);
  const exists = fs.existsSync(absolutePath);
  const body = exists ? readJson(absolutePath) : null;
  const result = body?.result;
  const warnings = [];
  const validationErrors = [];

  if (exists && !body) validationErrors.push('artifact is not valid JSON');
  if (exists && body && !result) validationErrors.push('artifact has no result field');
  if (options.nonLaunchEvidence) warnings.push('local non-launch evidence only');
  if (exists && body && options.requiredFields?.length) {
    const missingFields = options.requiredFields.filter((field) => {
      const value = getValue(body, field);
      return value === undefined || value === null || value === '';
    });

    if (missingFields.length) {
      validationErrors.push(`artifact missing required field(s): ${missingFields.join(', ')}`);
    }
  }

  warnings.push(...validationErrors);
  const passed = result === 'pass' && validationErrors.length === 0;
  const pending = result === 'pending' && validationErrors.length === 0;

  return {
    label,
    path: filePath,
    exists,
    result: result || null,
    status: exists && passed ? 'pass' : exists && pending ? 'pending' : exists ? 'fail' : 'missing',
    warnings,
    nextAction: options.nextAction || '',
  };
};

const listMatching = (dirPath, pattern) => {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .flatMap((entry) => {
      const child = path.join(dirPath, entry.name);
      if (entry.isDirectory()) return listMatching(child, pattern);
      return pattern.test(child) ? [child] : [];
    })
    .sort();
};

const latestStatus = (label, dirPath, pattern, nextAction = '', options = {}) => {
  const matches = listMatching(dirPath, pattern);
  const latest = matches[matches.length - 1];
  if (!latest) {
    return {
      label,
      path: null,
      exists: false,
      result: null,
      status: 'missing',
      warnings: [],
      nextAction,
      requiredFields: options.requiredFields || [],
    };
  }

  return fileStatus(label, latest, { ...options, nextAction });
};

const manualArtifactRequiredFields = [
  'environment',
  'capturedAt',
  'releaseSha',
  'owner',
  'evidence.summary',
];

const sections = [
  {
    name: 'Local Evidence',
    items: [
      fileStatus(
        'local seeded external smoke',
        'docs/external-smoke-runs/local-external-smoke-2026-06-09.json'
      ),
      fileStatus(
        'local public-route screenshots',
        'docs/public-route-screenshots/public-route-evidence.json'
      ),
      fileStatus(
        'local checkout runtime config',
        'docs/checkout-config-evidence/local-runtime-config-2026-06-09.json',
        {
          nonLaunchEvidence: true,
          nextAction:
            'Run `npm run evidence:checkout-config` against staging/production with real policy URLs, Stripe publishable key, and payment currency.',
        }
      ),
      fileStatus(
        'local production dependency audit',
        'docs/dependency-audit/production-dependency-audit.json'
      ),
    ],
  },
  {
    name: 'Target Evidence',
    items: [
      latestStatus(
        'staging/production external smoke',
        'docs/external-smoke-runs',
        /(?:staging|production)-.+\.json$/,
        'Set target API/dashboard URLs plus seeded demo credentials or workflow secrets, then run `npm run smoke:external` or `.github/workflows/external-smoke-evidence.yml`.'
      ),
      latestStatus(
        'staging/production checkout runtime config',
        'docs/checkout-config-evidence',
        /(?:staging|production)-.+\.json$/,
        'Configure target `runtime-config.js` with approved policy URLs, `stripePublishableKey`, and payment currency, then run `npm run evidence:checkout-config`.'
      ),
      latestStatus(
        'staging/production public-route screenshots',
        'docs/public-route-screenshots',
        /(?:staging|production)-.+\/public-route-evidence\.json$/,
        'Run `npm run evidence:public-routes` against the target dashboard; use `TIXMO_PUBLIC_EVIDENCE_REQUIRE_POLICIES=true` for launch policy-link evidence.'
      ),
    ],
  },
  {
    name: 'Manual And Operational Evidence',
    items: [
      latestStatus(
        'real-device scanner/offline field test',
        'docs/scanner-field-test-evidence',
        /(?:staging|production)-.+\.json$/,
        'Start with `npm run evidence:manual-template -- --gate scanner --environment staging --owner "Name"`, run `docs/SCANNER_SETUP_AND_FIELD_TEST.md`, then set `result: "pass"` when complete.',
        { requiredFields: manualArtifactRequiredFields }
      ),
      latestStatus(
        'backup/migration rollback evidence',
        'docs/backup-rollback-evidence',
        /(?:staging|production)-.+\.json$/,
        'Start with `npm run evidence:manual-template -- --gate backup --environment staging --owner "Name"`, then complete scheduled backup, manual backup, restore test, rollback owner, and smoke evidence.',
        { requiredFields: manualArtifactRequiredFields }
      ),
      latestStatus(
        'external reviewer/shared asset flow evidence',
        'docs/external-review-share-evidence',
        /(?:staging|production)-.+\.json$/,
        'Start with `npm run evidence:manual-template -- --gate review-share --environment staging --owner "Name"`, then run logged-out external review and shared-asset flows on the target domain.',
        { requiredFields: manualArtifactRequiredFields }
      ),
      latestStatus(
        'policy approval/publication evidence',
        'docs/policy-approval-evidence',
        /(?:staging|production)-.+\.json$/,
        'Start with `npm run evidence:manual-template -- --gate policy --environment staging --owner "Name"`, finish `docs/POLICY_PUBLICATION_CHECKLIST.md`, publish URLs, and verify checkout/runtime config.',
        { requiredFields: manualArtifactRequiredFields }
      ),
      latestStatus(
        'uptime/status monitoring evidence',
        'docs/uptime-status-evidence',
        /(?:staging|production)-.+\.json$/,
        'Start with `npm run evidence:manual-template -- --gate uptime --environment staging --owner "Name"`, configure monitors, capture manual/scheduled passing runs, and confirm alert routing.',
        { requiredFields: manualArtifactRequiredFields }
      ),
    ],
  },
];

const blockers = sections
  .flatMap((section) => section.items.map((item) => ({ section: section.name, ...item })))
  .filter((item) => item.status !== 'pass' || item.warnings.length);

const summary = {
  openEvidenceGaps: blockers.length,
  strict,
  readyForGoNoGo: blockers.length === 0,
};

if (wantsJson) {
  process.stdout.write(`${JSON.stringify({ sections, blockers, summary }, null, 2)}\n`);
} else {
  sections.forEach((section) => {
    process.stdout.write(`\n${section.name}\n`);
    section.items.forEach((item) => {
      const warningText = item.warnings.length ? ` (${item.warnings.join('; ')})` : '';
      process.stdout.write(`- [${item.status}] ${item.label}${warningText}\n`);
      if (item.path) process.stdout.write(`  ${item.path}\n`);
    });
  });

  const actionableBlockers = blockers.filter((item) => item.nextAction);

  if (actionableBlockers.length) {
    process.stdout.write('\nNext Actions\n');
    actionableBlockers.forEach((item) => {
      process.stdout.write(`- ${item.label}: ${item.nextAction}\n`);
    });
  }

  process.stdout.write(`\nOpen evidence gaps: ${blockers.length}\n`);
  if (strict && blockers.length) {
    process.stdout.write('Strict mode: failing because launch evidence gaps remain.\n');
  }
}

process.exitCode = blockers.some((item) => item.status === 'fail') || (strict && blockers.length) ? 1 : 0;
