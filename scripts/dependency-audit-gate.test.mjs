import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateDependencyAudit, DEEPMERGE_DEV_ADVISORY } from './dependency-audit-gate.mjs';

const ADVISORY_URL = 'https://github.com/advisories/GHSA-gcqx-w48m-w2h4';

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

test('the market gate does not widen npm audit', () => {
  const source = readFileSync(new URL('./verify-market-local.mjs', import.meta.url), 'utf8');
  assert.match(source, /evaluateDependencyAudit/);
  assert.doesNotMatch(source, /--audit-level|--omit=dev/);
  assert.match(source, /dependency-audit-gate\.test\.mjs/);
});
