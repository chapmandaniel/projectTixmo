import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateDependencyAudit, DEEPMERGE_DEV_ADVISORY, MINIMATCH_DEV_ADVISORY } from './dependency-audit-gate.mjs';

const ADVISORY_URL = 'https://github.com/advisories/GHSA-gcqx-w48m-w2h4';
const MINIMATCH_URL = 'https://github.com/advisories/GHSA-g3hv-75wg-m249';

function viaAdvisory(url, name, severity = 'low') {
  return { url, name, dependency: name, severity, title: name };
}

function findingReport(extra = {}) {
  return {
    vulnerabilities: {
      deepmerge: {
        name: 'deepmerge',
        severity: 'low',
        via: [viaAdvisory(ADVISORY_URL, 'deepmerge')],
        effects: ['jest-config'],
        nodes: ['node_modules/deepmerge'],
      },
      'jest-config': {
        name: 'jest-config',
        severity: 'low',
        via: ['deepmerge'],
        nodes: ['node_modules/jest-config'],
      },
      jest: {
        name: 'jest',
        severity: 'low',
        via: ['jest-config'],
        nodes: ['node_modules/jest'],
      },
      ...extra,
    },
  };
}

function devJestLock() {
  return {
    packages: {
      '': { devDependencies: { jest: '30.5.2' } },
      'node_modules/jest': { dev: true, dependencies: { 'jest-config': '30.5.2' } },
      'node_modules/jest-config': { dev: true, dependencies: { deepmerge: '^4.3.1' } },
      'node_modules/deepmerge': { version: '4.3.1', dev: true },
    },
  };
}

test('passes when the only finding is this GHSA on a dev path under jest', () => {
  const decision = evaluateDependencyAudit(findingReport(), devJestLock());
  assert.equal(decision.ok, true);
  assert.match(decision.ignored, new RegExp(DEEPMERGE_DEV_ADVISORY));
});

test('passes when npm audit reports no findings', () => {
  const decision = evaluateDependencyAudit({ vulnerabilities: {}, metadata: { vulnerabilities: { total: 0 } } }, devJestLock());
  assert.equal(decision.ok, true);
  assert.equal(decision.ignored, null);
});

for (const severity of ['info', 'low', 'moderate', 'high', 'critical']) {
  test(`fails on another ${severity} GHSA`, () => {
    const decision = evaluateDependencyAudit(
      findingReport({
        leftpad: {
          name: 'leftpad',
          severity,
          via: [viaAdvisory('https://github.com/advisories/GHSA-1111-2222-3333', 'leftpad', severity)],
          nodes: ['node_modules/leftpad'],
        },
      }),
      devJestLock()
    );
    assert.equal(decision.ok, false);
    assert.match(decision.reason, /GHSA-1111-2222-3333/);
  });
}

test('fails when this GHSA is reached through a production path', () => {
  const lock = devJestLock();
  lock.packages[''].dependencies = { app: '1.0.0' };
  lock.packages['node_modules/app'] = { dependencies: { deepmerge: '4.3.1' } };
  lock.packages['node_modules/app/node_modules/deepmerge'] = { version: '4.3.1' };
  const decision = evaluateDependencyAudit(findingReport(), lock);
  assert.equal(decision.ok, false);
  assert.match(decision.reason, /production|not a dev-only/);
});

test('fails when this GHSA is on a dev path that is not under jest', () => {
  const decision = evaluateDependencyAudit(findingReport(), {
    packages: {
      '': { devDependencies: { tools: '1.0.0' } },
      'node_modules/tools': { dev: true, dependencies: { deepmerge: '4.3.1' } },
      'node_modules/deepmerge': { version: '4.3.1', dev: true },
    },
  });
  assert.equal(decision.ok, false);
  assert.match(decision.reason, /jest/);
});

test('the API lockfile keeps deepmerge dev-only under jest', () => {
  const lock = JSON.parse(readFileSync(new URL('../tixmoapi2/package-lock.json', import.meta.url), 'utf8'));
  const decision = evaluateDependencyAudit(findingReport(), lock);
  assert.equal(decision.ok, true);
});

function devMinimatchLock() {
  return {
    packages: {
      '': { devDependencies: { eslint: '8.57.1', jest: '30.5.2' } },
      'node_modules/jest': { dev: true, dependencies: { 'jest-config': '30.5.2' } },
      'node_modules/jest-config': { dev: true, dependencies: { deepmerge: '^4.3.1' } },
      'node_modules/deepmerge': { version: '4.3.1', dev: true },
      'node_modules/eslint': { version: '8.57.1', dev: true, dependencies: { minimatch: '^3.1.2' } },
      'node_modules/eslint/node_modules/minimatch': { version: '3.1.5', dev: true },
      'node_modules/glob': { version: '7.2.3', dev: true, dependencies: { minimatch: '^3.1.1' } },
      'node_modules/glob/node_modules/minimatch': { version: '3.1.5', dev: true },
      'node_modules/minimatch': { version: '11.0.3', dev: true },
    },
  };
}

function findingReportWithMinimatch(extra = {}) {
  return findingReport({
    minimatch: {
      name: 'minimatch',
      severity: 'moderate',
      via: [viaAdvisory(MINIMATCH_URL, 'minimatch', 'moderate')],
      effects: ['eslint', 'glob'],
      nodes: ['node_modules/eslint/node_modules/minimatch'],
    },
    eslint: {
      name: 'eslint',
      severity: 'moderate',
      via: ['minimatch'],
      nodes: ['node_modules/eslint'],
    },
    glob: {
      name: 'glob',
      severity: 'moderate',
      via: ['minimatch'],
      nodes: ['node_modules/glob'],
    },
    ...extra,
  });
}

test('passes when dev-only minimatch 3 is exempt beside the deepmerge finding', () => {
  const decision = evaluateDependencyAudit(findingReportWithMinimatch(), devMinimatchLock());
  assert.equal(decision.ok, true);
  assert.match(decision.ignored, new RegExp(MINIMATCH_DEV_ADVISORY));
  assert.match(decision.ignored, new RegExp(DEEPMERGE_DEV_ADVISORY));
});

test('accepts an exempt advisory reached through a dependency cycle', () => {
  const report = findingReportWithMinimatch();
  report.vulnerabilities.eslint.via = ['@eslint-community/eslint-utils', 'minimatch'];
  report.vulnerabilities['@eslint-community/eslint-utils'] = {
    name: '@eslint-community/eslint-utils',
    severity: 'moderate',
    via: ['eslint'],
    nodes: ['node_modules/@eslint-community/eslint-utils'],
  };
  const decision = evaluateDependencyAudit(report, devMinimatchLock());
  assert.equal(decision.ok, true, decision.reason);
});

test('fails when a cycle never reaches an exempt advisory', () => {
  const decision = evaluateDependencyAudit(findingReport({
    loopA: { name: 'loopA', severity: 'low', via: ['loopB'], nodes: ['node_modules/loopA'] },
    loopB: { name: 'loopB', severity: 'low', via: ['loopA'], nodes: ['node_modules/loopB'] },
  }), devJestLock());
  assert.equal(decision.ok, false);
  assert.match(decision.reason, /mixed with another finding/);
});

test('fails when minimatch 3 is required outside eslint and glob 7', () => {
  const lock = devMinimatchLock();
  lock.packages['node_modules/tools'] = { dev: true, dependencies: { minimatch: '3.1.5' } };
  lock.packages['node_modules/tools/node_modules/minimatch'] = { version: '3.1.5', dev: true };
  const decision = evaluateDependencyAudit(findingReportWithMinimatch(), lock);
  assert.equal(decision.ok, false);
  assert.match(decision.reason, /tools/);
});

test('fails when vulnerable minimatch is on a production path', () => {
  const lock = devMinimatchLock();
  lock.packages[''].dependencies = { 'swagger-jsdoc': '6.2.8' };
  lock.packages['node_modules/swagger-jsdoc'] = { dependencies: { glob: '7.1.6' } };
  lock.packages['node_modules/swagger-jsdoc/node_modules/glob'] = { version: '7.1.6', dependencies: { minimatch: '^3.0.4' } };
  lock.packages['node_modules/swagger-jsdoc/node_modules/minimatch'] = { version: '3.1.5' };
  const decision = evaluateDependencyAudit(findingReportWithMinimatch(), lock);
  assert.equal(decision.ok, false);
  assert.match(decision.reason, /dev-only|production/);
});

test('the API lockfile keeps vulnerable minimatch dev-only under eslint and glob 7', () => {
  const lock = JSON.parse(readFileSync(new URL('../tixmoapi2/package-lock.json', import.meta.url), 'utf8'));
  const decision = evaluateDependencyAudit(findingReportWithMinimatch(), lock);
  assert.equal(decision.ok, true, decision.reason);
});

test('the market gate does not widen npm audit', () => {
  const source = readFileSync(new URL('./verify-market-local.mjs', import.meta.url), 'utf8');
  assert.match(source, /evaluateDependencyAudit/);
  assert.doesNotMatch(source, /--audit-level|--omit=dev/);
  assert.match(source, /dependency-audit-gate\.test\.mjs/);
});
