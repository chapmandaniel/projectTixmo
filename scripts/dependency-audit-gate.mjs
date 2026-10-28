// Market-readiness audit exception.
//
// GHSA-gcqx-w48m-w2h4 (CVE-2026-93753) covers deepmerge >=4.2.0 <=4.3.1.
// https://github.com/advisories/GHSA-gcqx-w48m-w2h4
// As of 2026-10-28 the advisory has no first_patched_version. npm's only
// suggested fix is a breaking downgrade to Jest 25. Remove this exception
// when a patched deepmerge is published and the lockfile no longer resolves
// a version inside that range. Review it again on 2026-11-28 if the patch
// is still missing.

export const DEEPMERGE_DEV_ADVISORY = 'GHSA-gcqx-w48m-w2h4';

const ADVISORY_ID = /GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}/i;

function advisoryId(via) {
  if (!via || typeof via !== 'object') return null;
  const match = String(via.url || '').match(ADVISORY_ID);
  return match ? match[0] : null;
}

function collectAdvisoryIds(vulnerabilities) {
  const ids = new Set();
  for (const vuln of Object.values(vulnerabilities)) {
    for (const via of vuln.via || []) {
      const id = advisoryId(via);
      if (id) ids.add(id);
    }
  }
  return ids;
}

function onlyThisDeepmergeAdvisory(vulnerabilities) {
  const memo = new Map();
  const visit = (name, stack) => {
    if (memo.has(name)) return memo.get(name);
    if (stack.has(name)) return false;
    const vuln = vulnerabilities[name];
    if (!vuln || !Array.isArray(vuln.via) || vuln.via.length === 0) return false;
    stack.add(name);
    let ok = true;
    for (const via of vuln.via) {
      if (typeof via === 'string') {
        if (!visit(via, stack)) ok = false;
        continue;
      }
      const id = advisoryId(via);
      const target = via.dependency || via.name;
      if (id?.toLowerCase() !== DEEPMERGE_DEV_ADVISORY.toLowerCase() || target !== 'deepmerge' || name !== 'deepmerge') ok = false;
    }
    stack.delete(name);
    memo.set(name, ok);
    return ok;
  };
  return Object.keys(vulnerabilities).every((name) => visit(name, new Set()));
}

function resolveInstalled(packages, parentKey, name) {
  let cursor = parentKey;
  while (true) {
    const candidate = cursor ? `${cursor}/node_modules/${name}` : `node_modules/${name}`;
    if (Object.prototype.hasOwnProperty.call(packages, candidate)) return candidate;
    if (!cursor) return null;
    const nested = cursor.lastIndexOf('/node_modules/');
    cursor = nested === -1 ? '' : cursor.slice(0, nested);
  }
}

function dependencyNames(node, includeDev) {
  return [
    ...Object.keys(node?.dependencies || {}),
    ...Object.keys(node?.optionalDependencies || {}),
    ...(includeDev ? Object.keys(node?.devDependencies || {}) : []),
  ];
}

function walk(packages, roots) {
  const seen = new Set();
  const queue = [...roots];
  while (queue.length) {
    const key = queue.pop();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const node = packages[key];
    if (!node) continue;
    for (const name of dependencyNames(node, false)) {
      const next = resolveInstalled(packages, key, name);
      if (next) queue.push(next);
    }
  }
  return seen;
}

function deepmergeInstalls(lockfile) {
  const packages = lockfile?.packages;
  if (!packages || typeof packages !== 'object') return { ok: false, reason: 'lockfile has no package graph' };
  const keys = Object.keys(packages).filter(
    (key) => key === 'node_modules/deepmerge' || key.endsWith('/node_modules/deepmerge')
  );
  if (keys.length === 0) return { ok: false, reason: `${DEEPMERGE_DEV_ADVISORY} is present but deepmerge is not installed` };

  const root = packages[''] || {};
  const prodRoots = [];
  for (const name of dependencyNames(root, false)) {
    const key = resolveInstalled(packages, '', name);
    if (key) prodRoots.push(key);
  }
  const prod = walk(packages, prodRoots);
  const jestKey = resolveInstalled(packages, '', 'jest');
  if (!jestKey) return { ok: false, reason: `${DEEPMERGE_DEV_ADVISORY} is present but jest is not installed` };
  const jestTree = walk(packages, [jestKey]);

  for (const key of keys) {
    if (packages[key]?.dev !== true) {
      return { ok: false, reason: `${key} is not a dev-only install` };
    }
    if (prod.has(key)) return { ok: false, reason: `${DEEPMERGE_DEV_ADVISORY} is reachable from a production dependency` };
    if (!jestTree.has(key)) return { ok: false, reason: `${key} is not under jest` };
  }

  for (const [key, node] of Object.entries(packages)) {
    for (const name of dependencyNames(node, key === '')) {
      if (name !== 'deepmerge') continue;
      if (!jestTree.has(key)) {
        return { ok: false, reason: `deepmerge is required by ${key || 'the package root'}, which is not under jest` };
      }
    }
  }
  return { ok: true };
}

export function evaluateDependencyAudit(report, lockfile) {
  if (!report || typeof report !== 'object' || report.error) {
    return { ok: false, reason: 'npm audit did not return a vulnerability report' };
  }
  const vulnerabilities = report.vulnerabilities || {};
  const ids = collectAdvisoryIds(vulnerabilities);
  if (ids.size === 0) {
    if (Object.keys(vulnerabilities).length > 0) {
      return { ok: false, reason: 'audit findings have no advisory id' };
    }
    const total = report.metadata?.vulnerabilities?.total;
    if (typeof total === 'number' && total !== 0) {
      return { ok: false, reason: 'audit metadata reports vulnerabilities that were not listed' };
    }
    return { ok: true, ignored: null };
  }
  for (const id of ids) {
    if (id.toLowerCase() !== DEEPMERGE_DEV_ADVISORY.toLowerCase()) {
      return { ok: false, reason: `advisory ${id} is not exempt` };
    }
  }
  if (!onlyThisDeepmergeAdvisory(vulnerabilities)) {
    return { ok: false, reason: `${DEEPMERGE_DEV_ADVISORY} is mixed with another finding` };
  }
  const installs = deepmergeInstalls(lockfile);
  if (!installs.ok) return installs;
  return {
    ok: true,
    ignored: `ignored ${DEEPMERGE_DEV_ADVISORY} on dev-only deepmerge under jest; remove when a patched deepmerge exists (https://github.com/advisories/GHSA-gcqx-w48m-w2h4)`,
  };
}
