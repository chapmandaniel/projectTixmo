#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const usage = `Usage:
  npm run evidence:dependency-audit

Optional environment:
  TIXMO_DEPENDENCY_AUDIT_EVIDENCE_PATH  JSON output path. Default: docs/dependency-audit/production-dependency-audit.json

Runs production-only dependency audits for launch packages and writes a JSON artifact.
`;

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(usage);
  process.exit(0);
}

const packages = [
  {
    id: 'dashboard',
    path: 'tdash',
    command: ['npm', '--prefix', 'tdash', 'audit', '--omit=dev', '--json'],
  },
  {
    id: 'api',
    path: 'tixmoapi2',
    command: ['npm', '--prefix', 'tixmoapi2', 'audit', '--omit=dev', '--json'],
  },
];

const evidence = {
  startedAt: new Date().toISOString(),
  result: 'running',
  checks: [],
};

const outputPath = path.resolve(
  process.env.TIXMO_DEPENDENCY_AUDIT_EVIDENCE_PATH ||
    'docs/dependency-audit/production-dependency-audit.json'
);

const runCommand = (definition) =>
  new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(definition.command[0], definition.command.slice(1), {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (exitCode) => {
      const durationMs = Date.now() - startedAt;
      let audit = null;
      let parseError = '';

      try {
        audit = JSON.parse(stdout);
      } catch (error) {
        parseError = error instanceof Error ? error.message : String(error);
      }

      const counts = audit?.metadata?.vulnerabilities || {};
      const total = Number(counts.total || 0);
      const status = exitCode === 0 && audit && total === 0 ? 'pass' : 'fail';

      resolve({
        id: definition.id,
        packagePath: definition.path,
        command: definition.command.join(' '),
        status,
        exitCode,
        durationMs,
        vulnerabilityCounts: {
          info: Number(counts.info || 0),
          low: Number(counts.low || 0),
          moderate: Number(counts.moderate || 0),
          high: Number(counts.high || 0),
          critical: Number(counts.critical || 0),
          total,
        },
        vulnerabilities: audit?.vulnerabilities || {},
        parseError,
        stderr: stderr.trim(),
      });
    });
  });

const writeEvidence = () => {
  evidence.finishedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(`[evidence:dependency-audit] evidence written ${outputPath}\n`);
};

for (const definition of packages) {
  process.stdout.write(`[evidence:dependency-audit] running ${definition.command.join(' ')}\n`);
  const check = await runCommand(definition);
  evidence.checks.push(check);
  process.stdout.write(
    `[evidence:dependency-audit] ${check.status} ${definition.id} ${check.vulnerabilityCounts.total} vulnerabilities\n`
  );
}

evidence.result = evidence.checks.every((check) => check.status === 'pass') ? 'pass' : 'fail';
writeEvidence();

if (evidence.result !== 'pass') {
  process.exit(1);
}
